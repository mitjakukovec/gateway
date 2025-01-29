import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { Meteora } from '../meteora';
import { Solana } from '../../../chains/solana/solana';
import { Keypair } from '@solana/web3.js';
import { logger } from '../../../services/logger';
import { DecimalUtil } from '@orca-so/common-sdk';
import { Decimal } from 'decimal.js';
import { BN } from 'bn.js';
import { StrategyType } from '@meteora-ag/dlmm';

// Schema definitions
const OpenPositionRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'mainnet-beta' })),
  walletAddress: Type.String({ 
    description: 'Will use first available wallet if not specified',
    examples: [] // Will be populated during route registration
  }),
  lowerPrice: Type.Number({ default: 0.05 }),
  upperPrice: Type.Number({ default: 0.15 }),
  poolAddress: Type.String({ default: 'FtFUzuXbbw6oBbU53SDUGspEka1D5Xyc4cwnkxer6xKz' }),
  baseTokenAmount: Type.Optional(Type.Number()),
  quoteTokenAmount: Type.Optional(Type.Number()),
  slippagePct: Type.Optional(Type.Number({ default: 1 })),
  strategyType: Type.Optional(Type.Number({ 
    default: StrategyType.SpotBalanced,
    enum: Object.values(StrategyType).filter(x => typeof x === 'number')
  })),
});

const OpenPositionResponse = Type.Object({
  signature: Type.String(),
  fee: Type.Number(),
  positionAddress: Type.String(),
  positionRent: Type.Number(),
  baseTokenBalanceChange: Type.Number(),
  quoteTokenBalanceChange: Type.Number(),
});

type OpenPositionRequestType = Static<typeof OpenPositionRequest>;
type OpenPositionResponseType = Static<typeof OpenPositionResponse>;

async function openPosition(
  fastify: FastifyInstance,
  network: string,
  address: string,
  lowerPrice: number,
  upperPrice: number,
  poolAddress: string,
  baseTokenAmount: number | undefined,
  quoteTokenAmount: number | undefined,
  slippagePct?: number,
  strategyType: number = 3
): Promise<OpenPositionResponseType> {
  const solana = await Solana.getInstance(network);
  const meteora = await Meteora.getInstance(network);
  const wallet = await solana.getWallet(address);
  const newImbalancePosition = new Keypair();

  const dlmmPool = await meteora.getDlmmPool(poolAddress);
  const tokenX = await solana.getToken(dlmmPool.tokenX.publicKey.toBase58());
  const tokenY = await solana.getToken(dlmmPool.tokenY.publicKey.toBase58());
  const tokenXSymbol = tokenX?.symbol || 'UNKNOWN';
  const tokenYSymbol = tokenY?.symbol || 'UNKNOWN';

  if (!dlmmPool) {
    throw fastify.httpErrors.notFound(`Pool not found: ${poolAddress}`);
  }

  // Validate that at least one token amount is provided
  if ((baseTokenAmount === undefined || baseTokenAmount === 0) && 
      (quoteTokenAmount === undefined || quoteTokenAmount === 0)) {
    throw fastify.httpErrors.badRequest('Must provide either baseTokenAmount or quoteTokenAmount');
  }

  const lowerPricePerLamport = dlmmPool.toPricePerLamport(lowerPrice);
  const upperPricePerLamport = dlmmPool.toPricePerLamport(upperPrice);
  const minBinId = dlmmPool.getBinIdFromPrice(Number(lowerPricePerLamport), true) - 1;
  const maxBinId = dlmmPool.getBinIdFromPrice(Number(upperPricePerLamport), false) + 1;

  // Add validation for bin width
  const binWidth = maxBinId - minBinId;
  if (binWidth <= 0) {
    throw fastify.httpErrors.badRequest('Upper price must be greater than lower price');
  }
  
  // Only set a single bin array
  const MAX_BIN_WIDTH = 69;
  if (binWidth > MAX_BIN_WIDTH) {
    throw fastify.httpErrors.badRequest(
      `Position width (${binWidth} bins) exceeds ${MAX_BIN_WIDTH} bins for a single bin array.`
    );
  }

  const totalXAmount = new BN(
    DecimalUtil.toBN(new Decimal(baseTokenAmount || 0), dlmmPool.tokenX.decimal)
  );
  const totalYAmount = new BN(
    DecimalUtil.toBN(new Decimal(quoteTokenAmount || 0), dlmmPool.tokenY.decimal)
  );

  const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: newImbalancePosition.publicKey,
    user: wallet.publicKey,
    strategy: {
      maxBinId,
      minBinId,
      strategyType,
    },
    totalXAmount,
    totalYAmount,
    slippage: slippagePct ?? meteora.getSlippagePct(),
  });

  logger.info(`Opening position in pool ${poolAddress} with price range ${lowerPrice.toFixed(4)} - ${upperPrice.toFixed(4)} ${tokenYSymbol}/${tokenXSymbol}`);
  const { signature } = await solana.sendAndConfirmTransaction(createPositionTx, [wallet, newImbalancePosition], 1_000_000);

  const { baseTokenBalanceChange, quoteTokenBalanceChange, fee } = 
    await solana.extractPairBalanceChangesAndFee(
      signature,
      tokenX,
      tokenY,
      wallet.publicKey.toBase58()
    );

  const sentSOL = Math.abs(baseTokenBalanceChange - fee);

  logger.info(`Position opened at ${newImbalancePosition.publicKey.toBase58()}: ${Math.abs(baseTokenBalanceChange).toFixed(4)} ${tokenXSymbol}, ${Math.abs(quoteTokenBalanceChange).toFixed(4)} ${tokenYSymbol}`);

  return {
    signature,
    fee: fee,
    positionAddress: newImbalancePosition.publicKey.toBase58(),
    positionRent: sentSOL,
    baseTokenBalanceChange,
    quoteTokenBalanceChange,
  };
}

export const openPositionRoute: FastifyPluginAsync = async (fastify) => {
  // Get first wallet address for example
  const solana = await Solana.getInstance('mainnet-beta');
  let firstWalletAddress = '<solana-wallet-address>';
  
  try {
    firstWalletAddress = await solana.getFirstWalletAddress();
  } catch (error) {
    logger.warn('No wallets found for examples in schema');
  }
  
  // Update schema example
  OpenPositionRequest.properties.walletAddress.examples = [firstWalletAddress];

  fastify.post<{
    Body: OpenPositionRequestType;
    Reply: OpenPositionResponseType;
  }>(
    '/open-position',
    {
      schema: {
        description: 'Open a new Meteora position',
        tags: ['meteora'],
        body: OpenPositionRequest,
        response: {
          200: OpenPositionResponse
        },
      }
    },
    async (request) => {
      try {
        const { 
          network, 
          walletAddress, 
          lowerPrice, 
          upperPrice, 
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct,
          strategyType 
        } = request.body;
        const networkToUse = network || 'mainnet-beta';
        
        return await openPosition(
          fastify,
          networkToUse,
          walletAddress,
          lowerPrice,
          upperPrice,
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct,
          strategyType
        );
      } catch (e) {
        if (e.statusCode) return e;
        logger.error(e);
        throw fastify.httpErrors.internalServerError('Internal server error');
      }
    }
  );
};

export default openPositionRoute; 