import { FastifyPluginAsync } from 'fastify';
import type { ReserveBorrowRequest, ReserveBorrowReply } from '../kamino.interfaces';
import {
  ReserveBorrowRequestSchema,
  ReserveBorrowReplySchema,
} from '../kamino.interfaces';
import { Kamino } from '../kamino';
import { logger } from '../../../services/logger';

export const reserveBorrowRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: ReserveBorrowRequest;
    Reply: ReserveBorrowReply;
  }>('/reserve-borrow', {
    schema: {
      description: 'Borrow from Kamino market reserve',
      tags: ['kamino'],
      body: {
        ...ReserveBorrowRequestSchema,
        properties: {
          network: { type: 'string', examples: ['mainnet-beta'] },
          market: { type: 'string', examples: ['MAIN'] },
          wallet: { type: 'string', examples: ['<solana-wallet-address>'] },
          token: { type: 'string', examples: ['SOL'] },
          amount: { type: 'number', examples: [10] },
        },
      },
      response: {
        200: ReserveBorrowReplySchema,
      },
    },
    handler: async (request, _reply) => {
      try {
        const { market, wallet, token, amount } = request.body;
        const network = request.body.network || 'mainnet-beta';
        const kamino = await Kamino.getInstance(network);
        return await kamino.reserveBorrow(market.toUpperCase(), wallet, token, amount);
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

export default reserveBorrowRoute;
