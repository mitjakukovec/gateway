import type { FastifyPluginAsync } from 'fastify';
import sensible from '@fastify/sensible';

import { reserveInfoRoute } from './routes/reserveInfo';
import { reservesInfoRoute } from './routes/reservesInfo';
import { obligationInfoRoute } from './routes/obligationInfo';

export const kaminoRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(sensible);

  await fastify.register(reserveInfoRoute);
  await fastify.register(reservesInfoRoute);
  await fastify.register(obligationInfoRoute);
};

export default kaminoRoutes;
