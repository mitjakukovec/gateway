import { Solana } from '../../chains/solana/solana';
import { PublicKey } from '@solana/web3.js';
import { KaminoConfig } from './kamino.config';
import type { ReservesInfo } from './kamino.interfaces';
import { getMarket } from './kamino.utils';
import { logger } from '../../services/logger';

export class Kamino {
  private static _instances: Record<string, Kamino>;
  public config: KaminoConfig.NetworkConfig;
  private solana: Solana;
  private kaminoProgramIds: Record<string, string>;
  private kaminoMarketAddresses: Record<string, string>;

  private constructor() {
    this.config = KaminoConfig.config;
    this.solana = null;
    this.kaminoProgramIds = null;
    this.kaminoMarketAddresses = null;
  }

  private kaminoProgramId(programAddressOrName: string): PublicKey {
    const entry = Object.entries(this.kaminoProgramIds).find(([key, value]) => {
      return key === programAddressOrName || value === programAddressOrName;
    });
    if (entry) {
      return new PublicKey(entry[1]);
    }
  }

  private kaminoMarketAddress(marketAddressOrName: string): PublicKey {
    const entry = Object.entries(this.kaminoMarketAddresses).find(
      ([key, value]) => {
        return key === marketAddressOrName || value === marketAddressOrName;
      },
    );
    if (entry) {
      return new PublicKey(entry[1]);
    }
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
      this.solana = await Solana.getInstance(network);
      this.kaminoProgramIds = this.config.kaminoProgramIds(network);
      this.kaminoMarketAddresses = this.config.kaminoMarketAddresses(network);
    } catch (error) {
      logger.error('Failed to initialize Kamino:', error);
      throw error;
    }
  }

  /** Get Kamino market reserves */
  async getReserves(marketAddressOrName: string): Promise<ReservesInfo> {
    try {
      const marketPubkey = this.kaminoMarketAddress(marketAddressOrName);
      if (!marketPubkey) {
        throw new Error(`Market not found: ${marketAddressOrName}`);
      }
      const connection = this.solana.connection;
      const market = await getMarket({
        connection,
        marketPubkey,
      });

      const reserves = market.getReserves().filter((reserve) => {
        return reserve.stats.status === 'Active';
      });

      const currentSlot = await connection.getSlot();

      return reserves.map((reserve) => {
        const tokenSymbol =  reserve.getTokenSymbol();
        const liquidityAvailable = reserve.getLiquidityAvailableAmount().toNumber();
        const utlizationRatio = reserve.calculateUtilizationRatio();
        const { totalBorrow, totalSupply } = reserve.getEstimatedDebtAndSupply(currentSlot, 0);
        const totalSupplied = totalSupply.toNumber();
        const totalSupplyAPY = reserve.totalSupplyAPY(currentSlot);
        const totalBorrowed = totalBorrow.toNumber();
        const totalBorrowAPY = reserve.totalBorrowAPY(currentSlot);
        const borrowFactor = reserve.getBorrowFactor().toNumber();

        return {
          tokenSymbol,
          liquidityAvailable,
          utlizationRatio,
          totalSupplied,
          totalSupplyAPY,
          totalBorrowed,
          totalBorrowAPY,
          borrowFactor,
        };
      });
    } catch (error) {
      logger.error('Failed to get Kamino reserves:', error);
      throw error;
    }
  }
}
