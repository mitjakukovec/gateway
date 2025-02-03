import { FastifyPluginAsync } from 'fastify'
import { RaydiumCLMM } from '../raydium-clmm'
import { 
  PositionInfo, 
  PositionInfoSchema, 
} from '../../../services/clmm-interfaces'

export const positionInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: {
      network?: string;
      positionAddress: string;
    }
    Reply: PositionInfo
  }>(
    '/position-info',
    {
      schema: {
        description: 'Get info about a Raydium CLMM position',
        tags: ['raydium-clmm'],
        querystring: {
          type: 'object',
          properties: {
            network: { type: 'string', default: 'mainnet-beta' },
            positionAddress: { type: 'string' }
          },
          required: ['positionAddress']
        },
        response: {
          200: PositionInfoSchema
        }
      }
    },
    async (request) => {
      const { network = 'mainnet-beta', positionAddress } = request.query
      const raydium = await RaydiumCLMM.getInstance(network)
      return raydium.getPositionInfo(positionAddress)
    }
  )
}

export default positionInfoRoute
