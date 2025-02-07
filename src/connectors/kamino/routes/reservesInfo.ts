import { FastifyPluginAsync } from 'fastify';
import type {
  ReservesInfoRequest,
  ReservesInfo,
} from '../kamino.interfaces';
import {
  ReservesInfoRequestSchema,
  ReservesInfoReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { logger } from '../../../services/logger';

export const reservesInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: ReservesInfoRequest;
    Reply: ReservesInfo;
  }>('/reserves-info', {
    schema: {
      description: 'Get Kamino reserves info',
      tags: ['kamino'],
      querystring: {
        ...ReservesInfoRequestSchema,
        properties: {
          network: { type: 'string', examples: ['mainnet-beta'] },
          market: {
            type: 'string',
            examples: ['MAIN'],
          },
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
        const reserves = await kamino.getReserves(market);

        return reserves;
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
