import { FastifyPluginAsync } from 'fastify';
import type { ReservesInfoRequest, ReservesInfoReply } from '../kamino.interfaces';
import {
  ReservesInfoRequestSchema,
  ReservesInfoReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { logger } from '../../../services/logger';

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
        const { market } = request.query;
        const network = request.query.network || 'mainnet-beta';
        const kamino = await Kamino.getInstance(network);
        return await kamino.getReserves(market.toUpperCase());
      } catch (e) {
        logger.error(e);
        if (e.statusCode) {
          throw fastify.httpErrors.createError(e.statusCode, 'Request failed');
        }
        throw fastify.httpErrors.internalServerError('Internal server error');
      }
    },
  });
};

export default reservesInfoRoute;
