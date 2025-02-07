import { FastifyPluginAsync } from 'fastify';
import type {
  ReserveInfoRequest,
  ReserveInfo,
} from '../kamino.interfaces';
import {
  ReservesInfoRequestSchema,
  ReserveInfoReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { logger } from '../../../services/logger';

export const reserveInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: ReserveInfoRequest;
    Reply: ReserveInfo;
  }>('/reserve-info', {
    schema: {
      description: 'Get Kamino reserve info',
      tags: ['kamino'],
      querystring: {
        ...ReservesInfoRequestSchema,
        properties: {
          network: { type: 'string', examples: ['mainnet-beta'] },
          market: {
            type: 'string',
            examples: ['MAIN'],
          },
          token: { type: 'string', examples: ['SOL'] },
        },
      },
      response: {
        200: ReserveInfoReplySchema,
      },
    },
    handler: async (request, _reply) => {
      try {
        const { market, token } = request.query;
        const network = request.query.network || 'mainnet-beta';

        const kamino = await Kamino.getInstance(network);
        const reserve = await kamino.getReserve(market, token);

        return reserve;
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

export default reserveInfoRoute;
