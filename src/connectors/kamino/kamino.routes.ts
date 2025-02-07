import type { FastifyPluginAsync } from 'fastify';
import sensible from '@fastify/sensible';

import { reservesInfoRoute } from './routes/reservesInfo';

export const kaminoRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(sensible);

  await fastify.register(reservesInfoRoute);
};

export default kaminoRoutes;
