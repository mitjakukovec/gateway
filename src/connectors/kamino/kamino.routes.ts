import type { FastifyPluginAsync } from 'fastify';
import sensible from '@fastify/sensible';

import { reservesInfoRoute } from './routes/reservesInfo';
import { reserveInfoRoute } from './routes/reserveInfo';
import { reserveDepositRoute } from './routes/reserveDeposit';
import { reserveWithdrawRoute } from './routes/reserveWithdraw';
import { reserveBorrowRoute } from './routes/reserveBorrow';
import { reserveRepayRoute } from './routes/reserveRepay';
import { obligationInfoRoute } from './routes/obligationInfo';

export const kaminoRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(sensible);

  await fastify.register(reservesInfoRoute);
  await fastify.register(reserveInfoRoute);
  await fastify.register(reserveDepositRoute);
  await fastify.register(reserveWithdrawRoute);
  await fastify.register(reserveBorrowRoute);
  await fastify.register(reserveRepayRoute);
  await fastify.register(obligationInfoRoute);
};

export default kaminoRoutes;
