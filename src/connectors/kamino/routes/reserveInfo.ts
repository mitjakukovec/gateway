import { FastifyPluginAsync } from 'fastify';
import { PublicKey } from '@solana/web3.js';
import type {
  ReserveInfoRequest,
  ReserveInfoReply,
} from '../kamino.interfaces';
import {
  ReserveInfoRequestSchema,
  ReserveInfoReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { Solana } from '../../../chains/solana/solana';
import { httpNotFound } from '../../../services/error-handler';
import { logger } from '../../../services/logger';

/** Get Kamino market reserve */
export const reserveInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: ReserveInfoRequest;
    Reply: ReserveInfoReply;
  }>('/reserve-info', {
    schema: {
      description: 'Get Kamino market reserve info',
      tags: ['kamino'],
      querystring: {
        ...ReserveInfoRequestSchema,
        properties: {
          network: { type: 'string', examples: ['mainnet-beta'] },
          market: { type: 'string', examples: ['MAIN'] },
          token: { type: 'string', examples: ['SOL'] },
        },
      },
      response: {
        200: ReserveInfoReplySchema,
      },
    },
    handler: async (request, _reply) => {
      try {
        const { market: marketAddressOrName, token: tokenAddressOrSymbol } =
          request.query;

        const network = request.query.network || 'mainnet-beta';
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

        const connection = solana.connection;
        const market = await kamino.getMarket({
          connection,
          marketPubkey,
        });

        const reserve = market.getReserveByMint(tokenPubkey);
        if (!reserve) {
          throw httpNotFound(`Reserve not found: ${tokenAddressOrSymbol}`);
        }

        const currentSlot = await connection.getSlot();

        const reserveAddress = reserve.address.toBase58();
        const tokenSymbol = reserve.getTokenSymbol();
        const liquidityAvailable = reserve
          .getLiquidityAvailableAmount()
          .toNumber();
        const utlizationRatio = reserve.calculateUtilizationRatio();
        const { totalBorrow, totalSupply } = reserve.getEstimatedDebtAndSupply(
          currentSlot,
          0,
        );
        const totalSupplied = totalSupply.toNumber();
        const totalSupplyAPY = reserve.totalSupplyAPY(currentSlot);
        const totalBorrowed = totalBorrow.toNumber();
        const totalBorrowAPY = reserve.totalBorrowAPY(currentSlot);
        const borrowFactor = reserve.getBorrowFactor().toNumber();

        return {
          reserveAddress,
          tokenSymbol,
          liquidityAvailable,
          utlizationRatio,
          totalSupplied,
          totalSupplyAPY,
          totalBorrowed,
          totalBorrowAPY,
          borrowFactor,
        };
      } catch (error) {
        logger.error('Failed to get Kamino market reserve:', error);
        if (error.statusCode) {
          throw fastify.httpErrors.createError(error.statusCode, 'Request failed');
        }
        throw fastify.httpErrors.internalServerError('Internal server error');
      }
    },
  });
};

export default reserveInfoRoute;
