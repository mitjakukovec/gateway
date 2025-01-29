import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { Meteora } from '../meteora';
import { Solana } from '../../../chains/solana/solana';
import { logger } from '../../../services/logger';
import { PoolInfo, PoolInfoSchema } from '../../../services/common-interfaces';

// Schema definitions
const FetchPoolsRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'mainnet-beta' })),
  limit: Type.Optional(Type.Number({ minimum: 1, default: 10 })),
  tokenA: Type.Optional(Type.String({
    description: 'First token symbol or address',
  })),
  tokenB: Type.Optional(Type.String({
    description: 'Second token symbol or address',
  })),
});

type FetchPoolsRequestType = Static<typeof FetchPoolsRequest>;
type FetchPoolsResponseType = PoolInfo[];

export const fetchPoolsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: FetchPoolsRequestType,
    Reply: FetchPoolsResponseType
  }>('/fetch-pools', {
    schema: {
      querystring: FetchPoolsRequest,
      response: {
        200: Type.Array(PoolInfoSchema)
      },
      tags: ['meteora'],
      description: 'Fetch info about Meteora pools'
    },
    handler: async (request, _reply) => {
      try {
        const { limit, tokenA, tokenB } = request.query;
        const network = request.query.network || 'mainnet-beta';
        
        const meteora = await Meteora.getInstance(network);
        if (!meteora) {
          throw fastify.httpErrors.serviceUnavailable('Meteora service unavailable');
        }
        
        const solana = await Solana.getInstance(network);
        if (!solana) {
          throw fastify.httpErrors.serviceUnavailable('Solana service unavailable');
        }

        let tokenMintA, tokenMintB;
        
        if (tokenA) {
          const tokenInfoA = await solana.getToken(tokenA);
          if (!tokenInfoA) {
            throw fastify.httpErrors.notFound(`Token not found: ${tokenA}`);
          }
          tokenMintA = tokenInfoA.address;
        }
        
        if (tokenB) {
          const tokenInfoB = await solana.getToken(tokenB);
          if (!tokenInfoB) {
            throw fastify.httpErrors.notFound(`Token not found: ${tokenB}`);
          }
          tokenMintB = tokenInfoB.address;
        }
    
        const pairs = await meteora.getPools(limit, tokenMintA, tokenMintB);
        if (!Array.isArray(pairs)) {
          logger.error('Invalid pairs response from Meteora');
          return [];
        }

        const poolInfos = await Promise.all(
          pairs
            .filter(pair => pair?.publicKey?.toString)
            .map(async pair => {
              try {
                return await meteora.getPoolInfo(pair.publicKey.toString());
              } catch (error) {
                logger.warn(`Failed to get pool info for ${pair.publicKey.toString()}: ${error.message}`);
                return null;
              }
            })
        );

        return poolInfos.filter(Boolean);
      } catch (e) {
        logger.error('Error in fetch-pools:', e);
        if (e.statusCode) throw e;
        throw fastify.httpErrors.internalServerError();
      }
    }
  });
};

export default fetchPoolsRoute; 