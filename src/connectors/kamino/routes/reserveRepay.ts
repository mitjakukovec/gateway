import { FastifyPluginAsync } from 'fastify';
import type { ReserveRepayRequest, ReserveRepayReply } from '../kamino.interfaces';
import {
  ReserveRepayRequestSchema,
  ReserveRepayReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { logger } from '../../../services/logger';

export const reserveRepayRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: ReserveRepayRequest;
    Reply: ReserveRepayReply;
  }>('/reserve-repay', {
    schema: {
      description: 'Repay to Kamino market reserve',
      tags: ['kamino'],
      body: {
        ...ReserveRepayRequestSchema,
        properties: {
          network: { type: 'string', examples: ['mainnet-beta'] },
          market: { type: 'string', examples: ['MAIN'] },
          wallet: { type: 'string', examples: ['<solana-wallet-address>'] },
          token: { type: 'string', examples: ['SOL'] },
          amount: { type: 'number', examples: [10] },
        },
      },
      response: {
        200: ReserveRepayReplySchema,
      },
    },
    handler: async (request, _reply) => {
      try {
        const { market, wallet, token, amount } = request.body;
        const network = request.body.network || 'mainnet-beta';
        const kamino = await Kamino.getInstance(network);
        return await kamino.reserveRepay(market.toUpperCase(), wallet, token, amount);
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

export default reserveRepayRoute;
