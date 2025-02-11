import { Connection, PublicKey } from '@solana/web3.js';
import {
  KaminoMarket,
  getMedianSlotDurationInMsFromLastEpochs,
} from '@kamino-finance/klend-sdk';
import { KaminoConfig } from './kamino.config';
import { logger } from '../../services/logger';

export class Kamino {
  private static _instances: Record<string, Kamino>;
  public config: KaminoConfig.NetworkConfig;
  private kaminoProgramIds: Record<string, string>;
  private kaminoMarketAddresses: Record<string, string>;

  private constructor() {
    this.config = KaminoConfig.config;
    this.kaminoProgramIds = null;
    this.kaminoMarketAddresses = null;
  }

  /** Gets Kamino program Id */
  public getProgramId(programAddressOrName: string): PublicKey {
    const entry = Object.entries(this.kaminoProgramIds).find(([key, value]) => {
      return key === programAddressOrName || value === programAddressOrName;
    });
    if (!entry) {
      throw Error(`Uknown program ${programAddressOrName}`);
    }
    return new PublicKey(entry[1]);
  }

  /** Gets Kamino market address*/
  public getMarketAddress(marketAddressOrName: string): PublicKey {
    const entry = Object.entries(this.kaminoMarketAddresses).find(
      ([key, value]) => {
        return key === marketAddressOrName || value === marketAddressOrName;
      },
    );
    if (!entry) {
      throw Error(`Unknown market address ${marketAddressOrName}`);
    }
    return new PublicKey(entry[1]);
  }
  
  /** Get Kamino Lending Market */
  public async getMarket({
    connection,
    marketPubkey,
  }: {
    connection: Connection;
    marketPubkey: PublicKey;
  }): Promise<KaminoMarket> {
    connection;
    marketPubkey;
    const slotDuration = await getMedianSlotDurationInMsFromLastEpochs();
    const market = await KaminoMarket.load(
      connection,
      marketPubkey,
      slotDuration,
    );
    if (!market) {
      throw Error(`Could not load market ${marketPubkey.toString()}`);
    }
    return market;
  }

  /** Gets singleton instance of Kamino */
  public static async getInstance(network: string): Promise<Kamino> {
    if (!Kamino._instances) {
      Kamino._instances = {};
    }
    if (!Kamino._instances[network]) {
      const instance = new Kamino();
      await instance.init(network);
      Kamino._instances[network] = instance;
    }
    return Kamino._instances[network];
  }

  /** Initializes Kamino instance */
  private async init(network: string) {
    try {
      logger.info('Initializing Kamino');
      this.kaminoProgramIds = this.config.kaminoProgramIds(network);
      this.kaminoMarketAddresses = this.config.kaminoMarketAddresses(network);
    } catch (error) {
      logger.error('Failed to initialize Kamino:', error);
      throw error;
    }
  }
}
