import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { UniswapConfig } from './uniswap/uniswap.config';
import { JupiterConfig } from './jupiter/jupiter.config';

// Define the schema using Typebox
const NetworkSchema = Type.Object({
  chain: Type.String(),
  networks: Type.Array(Type.String())
});

const ConnectorSchema = Type.Object({
  name: Type.String(),
  trading_type: Type.Array(Type.String()),
  available_networks: Type.Array(NetworkSchema)
});

const ConnectorsResponseSchema = Type.Object({
  connectors: Type.Array(ConnectorSchema)
});

// Type for TypeScript
type ConnectorsResponse = Static<typeof ConnectorsResponseSchema>;

export const connectorsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ConnectorsResponse }>(
    '/',
    {
      schema: {
        description: 'Get available connectors',
        tags: ['connectors'],
        response: {
          200: ConnectorsResponseSchema
        }
      }
    },
    async () => {
      return {
        connectors: [
          {
            name: 'uniswap',
            trading_type: UniswapConfig.config.tradingTypes,
            available_networks: UniswapConfig.config.availableNetworks,
          },
          {
            name: 'jupiter',
            trading_type: JupiterConfig.config.tradingTypes,
            available_networks: JupiterConfig.config.availableNetworks,
          },
        ],
      } as any;
    }
  );
};

export default connectorsRoutes;
