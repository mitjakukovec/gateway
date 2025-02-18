import type { FastifyPluginAsync } from 'fastify';
import sensible from '@fastify/sensible';

import { fetchPoolsRoute } from './routes/fetchPools';
import { poolInfoRoute } from './routes/poolInfo';
import { positionsOwnedRoute } from './routes/positionsOwned';
import { quoteSwapRoute } from './routes/quoteSwap';
import { positionInfoRoute } from './routes/positionInfo';
import { executeSwapRoute } from './routes/executeSwap';
import { openPositionRoute } from './routes/openPosition';
import { openPositionBinIdRoute } from './routes/openPositionBinId';
import { addLiquidityRoute } from './routes/addLiquidity';
import { removeLiquidityRoute } from './routes/removeLiquidity';
import { collectFeesRoute } from './routes/collectFees';
import { closePositionRoute } from './routes/closePosition';

export const meteoraRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(sensible);
  
  await fastify.register(fetchPoolsRoute);
  await fastify.register(poolInfoRoute);
  await fastify.register(positionsOwnedRoute);
  await fastify.register(positionInfoRoute);
  await fastify.register(quoteSwapRoute);
  await fastify.register(executeSwapRoute);
  await fastify.register(openPositionRoute);
  await fastify.register(openPositionBinIdRoute);
  await fastify.register(addLiquidityRoute);
  await fastify.register(removeLiquidityRoute);
  await fastify.register(collectFeesRoute);
  await fastify.register(closePositionRoute);
};

export default meteoraRoutes; 