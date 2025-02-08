import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { RaydiumCLMM } from '../raydium-clmm';
import { PublicKey } from '@solana/web3.js';
import { logger } from '../../../services/logger';
import { PositionInfoSchema } from '../../../services/clmm-interfaces';
import { httpBadRequest, ERROR_MESSAGES } from '../../../services/error-handler';

// Schema definitions
const GetPositionsOwnedRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'mainnet-beta' })),
  poolAddress: Type.String({ 
    examples: ['61JtCktQq2ci8c6oJfCghZgZv5VWgQeZ6kUwpjVWQ6e9'] 
  }),
});

const GetPositionsOwnedResponse = Type.Array(PositionInfoSchema);

type GetPositionsOwnedRequestType = Static<typeof GetPositionsOwnedRequest>;
type GetPositionsOwnedResponseType = Static<typeof GetPositionsOwnedResponse>;

export const positionsOwnedRoute: FastifyPluginAsync = async (fastify) => {
  // Remove wallet address example population code
  
  fastify.get<{
    Querystring: GetPositionsOwnedRequestType;
    Reply: GetPositionsOwnedResponseType;
  }>(
    '/positions-owned',
    {
      schema: {
        description: "Retrieve a list of positions owned by a user's wallet in a specific Raydium CLMM pool",
        tags: ['raydium-clmm'],
        querystring: GetPositionsOwnedRequest,
        response: {
          200: GetPositionsOwnedResponse
        },
      }
    },
    async (request) => {
      try {
        const { poolAddress } = request.query;
        const network = request.query.network || 'mainnet-beta';
        const raydium = await RaydiumCLMM.getInstance(network);
        
        // Validate pool address only
        try {
          new PublicKey(poolAddress);
        } catch (error) {
          throw httpBadRequest(ERROR_MESSAGES.INVALID_SOLANA_ADDRESS('pool'));
        }
        console.log('poolAddress', poolAddress)

        // Get pool info to extract program ID
        const [poolInfo] = await raydium.getClmmPoolfromAPI(poolAddress);
        console.log('poolInfo', poolInfo)
        const positions = await raydium.raydium.clmm.getOwnerPositionInfo({
          programId: poolInfo.programId
        });
        console.log('positions', positions)

        if (!positions.length) {
          throw httpBadRequest('User does not have any positions in this pool');
        }

        const positionsInfo = await Promise.all(
          positions.map(pos => raydium.getPositionInfo(pos.nftMint.toString()))
        );
        return positionsInfo;
      } catch (e) {
        logger.error(e);
        if (e.statusCode) {
          throw fastify.httpErrors.createError(e.statusCode, 'Request failed');
        }
        throw fastify.httpErrors.internalServerError('Internal server error');
      }
    }
  );
};

export default positionsOwnedRoute; 