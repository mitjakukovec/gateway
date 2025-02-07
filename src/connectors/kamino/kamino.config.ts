import { AvailableNetworks } from '../connector.requests';
import { ConfigManagerV2 } from '../../services/config-manager-v2';

export namespace KaminoConfig {
  export interface NetworkConfig {
    tradingTypes: Array<string>;
    availableNetworks: Array<AvailableNetworks>;
    programIds: {
      [network: string]: {
        KLEND: string;
      };
    };
    marketAddresses: {
      [network: string]: {
        JITO: string;
        JLP: string;
        MAIN: string;
        ALTCOINS: string;
        ETHENA: string;
      };
    };
    kaminoProgramIds: (network: string) => Record<string, string>;
    kaminoMarketAddresses: (network: string) => Record<string, string>;
  }

  export const config: NetworkConfig = {
    tradingTypes: ['KLEND'],
    availableNetworks: [
      { chain: 'solana', networks: ['mainnet-beta', 'devnet'] },
    ],
    programIds: ConfigManagerV2.getInstance().get('kamino.programIds'),
    marketAddresses: ConfigManagerV2.getInstance().get('kamino.marketAddresses'),
    kaminoProgramIds: (network: string): Record<string, string> => {
      return config.programIds[network];
    },
    kaminoMarketAddresses: (network: string): Record<string, string> => {
      return config.marketAddresses[network];
    },
  };
}
