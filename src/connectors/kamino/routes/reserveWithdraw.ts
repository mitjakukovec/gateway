import { FastifyPluginAsync } from 'fastify';
import Decimal from 'decimal.js';
import { PublicKey } from '@solana/web3.js';
import type {
  ReserveWithdrawRequest,
  ReserveWithdrawReply,
} from '../kamino.interfaces';
import {
  ReserveWithdrawRequestSchema,
  ReserveWithdrawReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import {
  KaminoAction,
  VanillaObligation,
  buildAndSendTxn,
  getComputeBudgetAndPriorityFeeIxns,
} from '@kamino-finance/klend-sdk';
import { Solana } from '../../../chains/solana/solana';
import { httpNotFound } from '../../../services/error-handler';
import { logger } from '../../../services/logger';

/** Withdraw from Kamino market reserve */
export const reserveWithdrawRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: ReserveWithdrawRequest;
    Reply: ReserveWithdrawReply;
  }>('/reserve-withdraw', {
    schema: {
      description: 'Withdraw from Kamino market reserve',
      tags: ['kamino'],
      body: {
        ...ReserveWithdrawRequestSchema,
        properties: {
          network: { type: 'string', examples: ['mainnet-beta'] },
          market: { type: 'string', examples: ['MAIN'] },
          wallet: { type: 'string', examples: ['<solana-wallet-address>'] },
          token: { type: 'string', examples: ['USDC'] },
          amount: { type: 'number', examples: [10] },
        },
      },
      response: {
        200: ReserveWithdrawReplySchema,
      },
    },
    handler: async (request, _reply) => {
      try {
        const {
          market: marketAddressOrName,
          wallet: walletAddress,
          token: tokenAddressOrSymbol,
          amount: tokenAmount,
        } = request.body;

        const network = request.body.network || 'mainnet-beta';
        const solana = await Solana.getInstance(network);
        const kamino = await Kamino.getInstance(network);

        const marketPubkey = kamino.getMarketAddress(marketAddressOrName);
        if (!marketPubkey) {
          throw httpNotFound(`Market not found: ${marketAddressOrName}`);
        }

        const tokenInfo = await solana.getToken(tokenAddressOrSymbol);
        if (!tokenInfo) {
          throw httpNotFound(`Token not found: ${tokenAddressOrSymbol}`);
        }
        const tokenPubkey = new PublicKey(tokenInfo.address);

        const wallet = await solana.getWallet(walletAddress);
        if (!wallet) {
          throw httpNotFound(`Wallet not found: ${walletAddress}`);
        }
        const walletPubkey = new PublicKey(wallet.publicKey);

        const connection = solana.connection;
        const market = await kamino.getMarket({
          connection,
          marketPubkey,
        });

        const reserve = market.getReserveByMint(tokenPubkey);
        if (!reserve) {
          throw httpNotFound(`Reserve not found: ${tokenAddressOrSymbol}`);
        }

        const vanillaObligation = new VanillaObligation(
          kamino.getProgramId('KLEND'),
        );

        const obligation = await market.getObligationByWallet(
          walletPubkey,
          vanillaObligation,
        );
        if (!obligation) {
          throw httpNotFound(
            `Obligation not found for wallet: ${walletAddress}`,
          );
        }

        const amount = new Decimal(tokenAmount)
          .mul(reserve.getMintFactor())
          .toString();

        const withdrawAction = await KaminoAction.buildWithdrawTxns(
          market,
          amount,
          tokenPubkey,
          walletPubkey,
          obligation
        );

        const priorityFeePerComputeUnit = await solana.estimatePriorityFees();
        const defaultComputeUnits = solana.config.defaultComputeUnits;
        const priorityFee = new Decimal(
          solana.config.defaultComputeUnits * priorityFeePerComputeUnit,
        );

        const computeIxs = getComputeBudgetAndPriorityFeeIxns(
          defaultComputeUnits,
          priorityFee,
        );

        const withdrawIxs = [
          ...computeIxs,
          ...withdrawAction.setupIxs,
          ...withdrawAction.lendingIxs,
          ...withdrawAction.cleanupIxs,
        ];

        try {
          const signature = await buildAndSendTxn(
            connection,
            wallet,
            withdrawIxs,
            [],
          );
          return { signature };
        } catch {
          throw new Error('Transaction failed');
        }
      } catch (error) {
        logger.error('\nFailed to withdraw from Kamino market reserve:', error);
        if (error.statusCode) {
          throw fastify.httpErrors.createError(error.statusCode, 'Request failed');
        }
        throw fastify.httpErrors.internalServerError('Internal server error');
      }
    },
  });
};

export default reserveWithdrawRoute;
