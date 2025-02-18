import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { Meteora } from '../meteora';
import { StrategyType } from '@meteora-ag/dlmm';
import { Solana } from '../../../chains/solana/solana';
import { Keypair, PublicKey } from '@solana/web3.js';
import { logger } from '../../../services/logger';
import { DecimalUtil } from '@orca-so/common-sdk';
import { Decimal } from 'decimal.js';
import { BN } from 'bn.js';
import { 
  OpenPositionRequest, 
  OpenPositionResponse, 
  OpenPositionResponseType,
} from '../../../services/clmm-interfaces';
import { Type, Static } from '@sinclair/typebox';
import { httpBadRequest, httpNotFound, ERROR_MESSAGES } from '../../../services/error-handler';

const SOL_POSITION_RENT = 0.05; // SOL amount required for position rent
const SOL_TRANSACTION_BUFFER = 0.01; // Additional SOL buffer for transaction costs

async function openPosition(
  fastify: FastifyInstance,
  network: string,
  walletAddress: string,
  minBinId: number,
  maxBinId: number,
  poolAddress: string,
  baseTokenAmount: number | undefined,
  quoteTokenAmount: number | undefined,
  slippagePct?: number,
  strategyType: number = 3
): Promise<OpenPositionResponseType> {
  const solana = await Solana.getInstance(network);
  const meteora = await Meteora.getInstance(network);

  // Validate addresses first
  try {
    new PublicKey(poolAddress);
    new PublicKey(walletAddress);
  } catch (error) {
    const invalidAddress = error.message.includes(poolAddress) ? 'pool' : 'wallet';
    throw httpBadRequest(ERROR_MESSAGES.INVALID_SOLANA_ADDRESS(invalidAddress));
  }

  const wallet = await solana.getWallet(walletAddress);
  const newImbalancePosition = new Keypair();

  let dlmmPool;
  try {
    dlmmPool = await meteora.getDlmmPool(poolAddress);
    if (!dlmmPool) {
      throw httpNotFound(ERROR_MESSAGES.POOL_NOT_FOUND(poolAddress));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid account discriminator')) {
      throw httpNotFound(ERROR_MESSAGES.POOL_NOT_FOUND(poolAddress));
    }
    throw error; // Re-throw unexpected errors
  }

  const tokenX = await solana.getToken(dlmmPool.tokenX.publicKey.toBase58());
  const tokenY = await solana.getToken(dlmmPool.tokenY.publicKey.toBase58());
  const tokenXSymbol = tokenX?.symbol || 'UNKNOWN';
  const tokenYSymbol = tokenY?.symbol || 'UNKNOWN';

  if (!baseTokenAmount && !quoteTokenAmount) {
    throw httpBadRequest(ERROR_MESSAGES.MISSING_AMOUNTS);
  }

  // Check balances with SOL buffer
  const balances = await solana.getBalance(wallet);
  const requiredBaseAmount = (baseTokenAmount || 0) + 
    (tokenXSymbol === 'SOL' ? SOL_POSITION_RENT + SOL_TRANSACTION_BUFFER : 0);
  const requiredQuoteAmount = (quoteTokenAmount || 0) + 
    (tokenYSymbol === 'SOL' ? SOL_POSITION_RENT + SOL_TRANSACTION_BUFFER : 0);

  if (balances[tokenXSymbol] < requiredBaseAmount) {
    throw httpBadRequest(
      ERROR_MESSAGES.INSUFFICIENT_BALANCE(
        tokenXSymbol,
        requiredBaseAmount,
        balances[tokenXSymbol]
      )
    );
  }

  if (tokenYSymbol && balances[tokenYSymbol] < requiredQuoteAmount) {
    throw fastify.httpErrors.badRequest(
      `Insufficient ${tokenYSymbol} balance. Required: ${requiredQuoteAmount}, Available: ${balances[tokenYSymbol]}`
    );
  }

  const totalXAmount = new BN(
    DecimalUtil.toBN(
      new Decimal(
        baseTokenAmount || 0 + 
        (tokenXSymbol === 'SOL' ? SOL_POSITION_RENT : 0)
      ), 
      dlmmPool.tokenX.decimal
    )
  );
  const totalYAmount = new BN(
    DecimalUtil.toBN(
      new Decimal(
        quoteTokenAmount || 0 + 
        (tokenYSymbol === 'SOL' ? SOL_POSITION_RENT : 0)
      ), 
      dlmmPool.tokenY.decimal
    )
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

  console.info(`Opening position in pool ${poolAddress} with bin id range ${minBinId} - ${maxBinId} ${tokenYSymbol}/${tokenXSymbol}`);
  const { signature } = await solana.sendAndConfirmTransaction(createPositionTx, [wallet, newImbalancePosition], 1_000_000);

  const { baseTokenBalanceChange, quoteTokenBalanceChange, fee } = 
    await solana.extractPairBalanceChangesAndFee(
      signature,
      tokenX,
      tokenY,
      wallet.publicKey.toBase58()
    );

  // Calculate sentSOL based on which token is SOL
  const sentSOL = tokenXSymbol === 'SOL' 
    ? Math.abs(baseTokenBalanceChange - fee)
    : tokenYSymbol === 'SOL'
    ? Math.abs(quoteTokenBalanceChange - fee)
    : fee;

  console.info(`Position opened at ${newImbalancePosition.publicKey.toBase58()}: ${Math.abs(baseTokenBalanceChange).toFixed(4)} ${tokenXSymbol}, ${Math.abs(quoteTokenBalanceChange).toFixed(4)} ${tokenYSymbol}`);

  return {
    signature,
    fee: fee,
    positionAddress: newImbalancePosition.publicKey.toBase58(),
    positionRent: sentSOL,
    baseTokenAmountAdded: baseTokenBalanceChange,
    quoteTokenAmountAdded: quoteTokenBalanceChange,
  };
}

export const MeteoraOpenPositionRequest = Type.Intersect([
  Type.Omit(OpenPositionRequest, ['lowerPrice', 'upperPrice']),
  Type.Object({
    minBinId: Type.Number(),
    maxBinId: Type.Number(),
    strategyType: Type.Optional(Type.Number({ 
      enum: Object.values(StrategyType).filter(x => typeof x === 'number')
    }))
  })
], { $id: 'MeteoraOpenPositionRequest' });

export type MeteoraOpenPositionRequestType = Static<typeof MeteoraOpenPositionRequest>;

export const openPositionBinIdRoute: FastifyPluginAsync = async (fastify) => {
  const solana = await Solana.getInstance('mainnet-beta');
  let firstWalletAddress = '<solana-wallet-address>';
  
  const foundWallet = await solana.getFirstWalletAddress();
  if (foundWallet) {
    firstWalletAddress = foundWallet;
  } else {
    logger.debug('No wallets found for examples in schema');
  }
  
  // Update schema example
  OpenPositionRequest.properties.walletAddress.examples = [firstWalletAddress];

  fastify.post<{
    Body: MeteoraOpenPositionRequestType;
    Reply: OpenPositionResponseType;
  }>(
    '/open-position-bin-id',
    {
      schema: {
        description: 'Open a new Meteora position',
        tags: ['meteora'],
        body: {
          ...Type.Omit(OpenPositionRequest, ['lowerPrice', 'upperPrice']),
          properties: {
            ...Type.Omit(OpenPositionRequest, ['lowerPrice', 'upperPrice']).properties,
            network: { type: 'string', default: 'mainnet-beta' },
            minBinId: { type: 'number' },
            maxBinId: { type: 'number' },
            poolAddress: { type: 'string', examples: ['FtFUzuXbbw6oBbU53SDUGspEka1D5Xyc4cwnkxer6xKz'] },
            slippagePct: { type: 'number', examples: [1] },
            strategyType: { 
              type: 'number', 
              examples: [StrategyType.SpotImBalanced],
              enum: Object.values(StrategyType).filter(x => typeof x === 'number')
            }
          }
        },
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
          minBinId, 
          maxBinId, 
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
          minBinId,
          maxBinId,
          poolAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct,
          strategyType
        );
      } catch (e) {
        logger.error(e);
        if (e.statusCode) {
          throw fastify.httpErrors.createError(e.statusCode, 'Request failed');
        }
        throw fastify.httpErrors.internalServerError('Internal server error');
      }
    }
  );
};

export default openPositionBinIdRoute; 