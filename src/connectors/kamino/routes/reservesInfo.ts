import { FastifyPluginAsync } from 'fastify';
import type {
  ReservesInfoRequest,
  ReservesInfoReply,
} from '../kamino.interfaces';
import {
  ReservesInfoRequestSchema,
  ReservesInfoReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { Solana } from '../../../chains/solana/solana';
import { httpNotFound } from '../../../services/error-handler';
import { logger } from '../../../services/logger';

/** Get Kamino market reserves */
export const reservesInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: ReservesInfoRequest;
    Reply: ReservesInfoReply;
  }>('/reserves-info', {
    schema: {
      description: 'Get Kamino market reserves info',
      tags: ['kamino'],
      querystring: {
        ...ReservesInfoRequestSchema,
        properties: {
          network: { type: 'string', examples: ['mainnet-beta'] },
          market: { type: 'string', examples: ['MAIN'] },
        },
      },
      response: {
        200: ReservesInfoReplySchema,
      },
    },
    handler: async (request, _reply) => {
      try {
        const { market: marketAddressOrName } = request.query;

        const network = request.query.network || 'mainnet-beta';
        const solana = await Solana.getInstance(network);
        const kamino = await Kamino.getInstance(network);

        const marketPubkey = kamino.getMarketAddress(marketAddressOrName);
        if (!marketPubkey) {
          throw httpNotFound(`Market not found: ${marketAddressOrName}`);
        }
        const connection = solana.connection;
        const market = await kamino.getMarket({
          connection,
          marketPubkey,
        });

        const reserves = market.getReserves().filter((reserve) => {
          return reserve.stats.status === 'Active';
        });

        const currentSlot = await connection.getSlot();

        return reserves.map((reserve) => {
          const reserveAddress = reserve.address.toBase58();
          const tokenSymbol = reserve.getTokenSymbol();
          const liquidityAvailable = reserve
            .getLiquidityAvailableAmount()
            .toNumber();
          const utlizationRatio = reserve.calculateUtilizationRatio();
          const { totalBorrow, totalSupply } =
            reserve.getEstimatedDebtAndSupply(currentSlot, 0);
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
        });
      } catch (error) {
        logger.error('Failed to get Kamino market reserves:', error);
        if (error.statusCode) {
          throw fastify.httpErrors.createError(error.statusCode, 'Request failed');
        }
        throw fastify.httpErrors.internalServerError('Internal server error');
      }
    },
  });
};

export default reservesInfoRoute;
