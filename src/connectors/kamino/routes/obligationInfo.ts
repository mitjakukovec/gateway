import { FastifyPluginAsync } from 'fastify';
import type {
  ObligationInfoRequest,
  ObligationInfo,
} from '../kamino.interfaces';
import {
  ObligationInfoRequestSchema,
  ObligationInfoReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { logger } from '../../../services/logger';

export const obligationInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: ObligationInfoRequest;
    Reply: ObligationInfo;
  }>('/obligation-info', {
    schema: {
      description: 'Get Kamino obligation info',
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
        const { market, wallet } = request.query;
        const network = request.query.network || 'mainnet-beta';

        const kamino = await Kamino.getInstance(network);
        const obligation = await kamino.getObligation(market.toUpperCase(), wallet);

        return obligation;
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

export default obligationInfoRoute;
