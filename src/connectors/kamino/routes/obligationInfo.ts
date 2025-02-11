import { FastifyPluginAsync } from 'fastify';
import { PublicKey } from '@solana/web3.js';
import type {
  ObligationInfoRequest,
  ObligationInfoReply,
} from '../kamino.interfaces';
import {
  ObligationInfoRequestSchema,
  ObligationInfoReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { VanillaObligation } from '@kamino-finance/klend-sdk';
import { Solana } from '../../../chains/solana/solana';
import { httpNotFound } from '../../../services/error-handler';
import { logger } from '../../../services/logger';

/** Get Kamino obligation */
export const obligationInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: ObligationInfoRequest;
    Reply: ObligationInfoReply;
  }>('/obligation-info', {
    schema: {
      description: 'Get Kamino market obligation info',
      tags: ['kamino'],
      querystring: {
        ...ObligationInfoRequestSchema,
        properties: {
          network: { type: 'string', examples: ['mainnet-beta'] },
          market: { type: 'string', examples: ['MAIN'] },
          wallet: { type: 'string', examples: ['<solana-wallet-address>'] },
        },
      },
      response: {
        200: ObligationInfoReplySchema,
      },
    },
    handler: async (request, _reply) => {
      try {
        const { market: marketAddressOrName, wallet: walletAddress } =
          request.query;

        const network = request.query.network || 'mainnet-beta';
        const solana = await Solana.getInstance(network);
        const kamino = await Kamino.getInstance(network);

        const marketPubkey = kamino.getMarketAddress(marketAddressOrName);
        if (!marketPubkey) {
          throw httpNotFound(`Market not found: ${marketAddressOrName}`);
        }

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

        const obligationAddress = obligation.obligationAddress.toBase58();
        const depositPositions = await Promise.all(
          obligation.getDeposits().map(async (position) => {
            const tokenPubkey = await solana.getToken(
              position.mintAddress.toBase58(),
            );
            const reserve = market.getReserveByMint(
              new PublicKey(tokenPubkey.address),
            );
            const tokenSymbol = tokenPubkey.symbol;
            const reserveAddress = position.reserveAddress.toBase58();
            const depositAmount = position.amount
              .div(reserve.getMintFactor())
              .toNumber();
            return {
              reserveAddress,
              tokenSymbol,
              depositAmount,
            };
          }),
        );

        const borrowPositions = await Promise.all(
          obligation.getBorrows().map(async (position) => {
            const tokenPubkey = await solana.getToken(
              position.mintAddress.toBase58(),
            );
            const reserve = market.getReserveByMint(
              new PublicKey(tokenPubkey.address),
            );
            const tokenSymbol = tokenPubkey.symbol;
            const reserveAddress = position.reserveAddress.toBase58();
            const borrowAmount = position.amount
              .div(reserve.getMintFactor())
              .toNumber();
            return {
              reserveAddress,
              tokenSymbol,
              borrowAmount,
            };
          }),
        );

        const currentLtv = obligation.refreshedStats.loanToValue.toNumber();
        const maxLtv = obligation.refreshedStats.borrowLimit
          .div(obligation.refreshedStats.userTotalDeposit)
          .toNumber();
        const liquidationLtv =
          obligation.refreshedStats.liquidationLtv.toNumber();

        return {
          obligationAddress,
          depositPositions,
          borrowPositions,
          maxLtv,
          liquidationLtv,
          currentLtv,
        };
      } catch (error) {
        logger.error('Failed to get Kamino market obligation:', error);
        if (error.statusCode) {
          throw fastify.httpErrors.createError(
            error.statusCode,
            'Request failed',
          );
        }
        throw fastify.httpErrors.internalServerError('Internal server error');
      }
    },
  });
};

export default obligationInfoRoute;
