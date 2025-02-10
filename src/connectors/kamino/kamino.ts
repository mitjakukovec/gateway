import { Solana } from '../../chains/solana/solana';
import { PublicKey } from '@solana/web3.js';
import { KaminoConfig } from './kamino.config';
import type {
  ReserveInfo,
  ReservesInfo,
  ObligationInfo,
} from './kamino.interfaces';
import { getMarket } from './kamino.utils';
import { VanillaObligation } from '@kamino-finance/klend-sdk';
import { httpNotFound } from '../../services/error-handler';
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
  async getReserve(
    marketAddressOrName: string,
    tokenAddressOrSymbol: string,
  ): Promise<ReserveInfo> {
    try {
      const marketPubkey = this.kaminoMarketAddress(marketAddressOrName);
      if (!marketPubkey) {
        throw httpNotFound(`Market not found: ${marketAddressOrName}`);
      }
      const tokenPubkey = await this.solana.getToken(tokenAddressOrSymbol);
      if (!tokenPubkey) {
        throw httpNotFound(`Token not found: ${tokenAddressOrSymbol}`);
      }

      const connection = this.solana.connection;
      const market = await getMarket({
        connection,
        marketPubkey,
      });

      const reserve = market.getReserveByMint(
        new PublicKey(tokenPubkey.address),
      );
      if (!reserve) {
        throw httpNotFound(`Reserve not found: ${tokenAddressOrSymbol}`);
      }

      const currentSlot = await connection.getSlot();

      const reserveAddress = reserve.address.toBase58();
      const tokenSymbol = reserve.getTokenSymbol();
      const liquidityAvailable = reserve
        .getLiquidityAvailableAmount()
        .toNumber();
      const utlizationRatio = reserve.calculateUtilizationRatio();
      const { totalBorrow, totalSupply } = reserve.getEstimatedDebtAndSupply(
        currentSlot,
        0,
      );
      const totalSupplied = totalSupply.toNumber();
      const totalSupplyAPY = reserve.totalSupplyAPY(currentSlot);
      const totalBorrowed = totalBorrow.toNumber();
      const totalBorrowAPY = reserve.totalBorrowAPY(currentSlot);
      const borrowFactor = reserve.getBorrowFactor().toNumber();

      return {
        reserveAddress,
        tokenSymbol,
        liquidityAvailable,
        utlizationRatio,
        totalSupplied,
        totalSupplyAPY,
        totalBorrowed,
        totalBorrowAPY,
        borrowFactor,
      };
    } catch (error) {
      logger.error('Failed to get Kamino reserve:', error);
      throw error;
    }
  }

  /** Get Kamino market reserves */
  async getReserves(marketAddressOrName: string): Promise<ReservesInfo> {
    try {
      const marketPubkey = this.kaminoMarketAddress(marketAddressOrName);
      if (!marketPubkey) {
        throw httpNotFound(`Market not found: ${marketAddressOrName}`);
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
        const reserveAddress = reserve.address.toBase58();
        const tokenSymbol = reserve.getTokenSymbol();
        const liquidityAvailable = reserve
          .getLiquidityAvailableAmount()
          .toNumber();
        const utlizationRatio = reserve.calculateUtilizationRatio();
        const { totalBorrow, totalSupply } = reserve.getEstimatedDebtAndSupply(
          currentSlot,
          0,
        );
        const totalSupplied = totalSupply.toNumber();
        const totalSupplyAPY = reserve.totalSupplyAPY(currentSlot);
        const totalBorrowed = totalBorrow.toNumber();
        const totalBorrowAPY = reserve.totalBorrowAPY(currentSlot);
        const borrowFactor = reserve.getBorrowFactor().toNumber();

        return {
          reserveAddress,
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

  /** Get Kamino obligation by wallet address */
  async getObligation(
    marketAddressOrName: string,
    walletAddress: string,
  ): Promise<ObligationInfo> {
    try {
      const marketPubkey = this.kaminoMarketAddress(marketAddressOrName);
      if (!marketPubkey) {
        throw httpNotFound(`Market not found: ${marketAddressOrName}`);
      }

      const wallet = await this.solana.getWallet(walletAddress);
      const walletPubkey = new PublicKey(wallet.publicKey);

      const connection = this.solana.connection;
      const market = await getMarket({
        connection,
        marketPubkey,
      });

      const vanillaObligation = new VanillaObligation(
        this.kaminoProgramId('KLEND'),
      );

      const obligation = await market.getObligationByWallet(
        walletPubkey,
        vanillaObligation,
      );
      if (!obligation) {
        throw httpNotFound(`Obligation not found for wallet: ${walletAddress}`);
      }

      const obligationAddress = obligation.obligationAddress.toBase58();
      const depositPositions = await Promise.all(
        obligation.getDeposits().map(async (position) => {
          const tokenPubkey = await this.solana.getToken(
            position.mintAddress.toBase58(),
          );
          const reserve = market.getReserveByMint(
            new PublicKey(tokenPubkey.address),
          );
          const tokenSymbol = tokenPubkey.symbol;
          const reserveAddress = position.reserveAddress.toBase58();
          const depositAmount = position.marketValueRefreshed
            .div(reserve.getOracleMarketPrice())
            .toNumber();
          return {
            reserveAddress,
            tokenSymbol,
            depositAmount,
          };
        }),
      );
      const borrowPositions = await Promise.all(
        obligation.getBorrows().map(async (position) => {
          const tokenPubkey = await this.solana.getToken(
            position.mintAddress.toBase58(),
          );
          const reserve = market.getReserveByMint(
            new PublicKey(tokenPubkey.address),
          );

          const tokenSymbol = tokenPubkey.symbol;
          const reserveAddress = position.reserveAddress.toBase58();
          const borrowAmount = position.marketValueRefreshed
            .div(reserve.getOracleMarketPrice())
            .toNumber();
          return {
            reserveAddress,
            tokenSymbol,
            borrowAmount,
          };
        }),
      );
      const currentLtv = obligation.refreshedStats.loanToValue.toNumber();
      const maxLtv = obligation.refreshedStats.borrowLimit
        .div(obligation.refreshedStats.userTotalDeposit)
        .toNumber();
      const liquidationLtv =
        obligation.refreshedStats.liquidationLtv.toNumber();
      return {
        obligationAddress,
        depositPositions,
        borrowPositions,
        maxLtv,
        liquidationLtv,
        currentLtv,
      };
    } catch (error) {
      logger.error('Failed to get Kamino obligation:', error);
      throw error;
    }
  }
}
