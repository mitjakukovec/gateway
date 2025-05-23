import {
  Transaction,
  Wallet,
  ContractInterface,
  BigNumber,
  ethers,
} from 'ethers';
import { CurrencyAmount, Token, Trade as TradeUniswap } from '@uniswap/sdk';
import { Trade } from '@uniswap/router-sdk';
import { Trade as UniswapV3Trade } from '@uniswap/v3-sdk';
import {
  TradeType,
  Currency,
  CurrencyAmount as UniswapCoreCurrencyAmount,
  Token as UniswapCoreToken,
  Fraction as UniswapFraction,
} from '@uniswap/sdk-core';
import { BalanceRequest } from '../chains/chain.requests';
import { Type, Static } from '@sinclair/typebox';

export type Tokenish =
  | Token
  | UniswapCoreToken;

export type UniswapishTrade =
  | Trade<Currency, Currency, TradeType>
  | UniswapV3Trade<Currency, UniswapCoreToken, TradeType>
  | TradeUniswap;

export type UniswapishAmount =
  | CurrencyAmount
  | UniswapCoreCurrencyAmount<Currency>
  | UniswapFraction;

export type Fractionish =
  | UniswapFraction;

export interface ExpectedTrade {
  trade: UniswapishTrade;
  expectedAmount: UniswapishAmount;
}

export interface Uniswapish {
  /**
   * Router address.
   */
  router: string;

  /**
   * Router smart contract ABI.
   */
  routerAbi: ContractInterface;

  /**
   * Interface for decoding transaction logs
   */
  abiDecoder?: any;

  /**
   * Default gas estiamte for swap transactions.
   */
  gasLimitEstimate: number;

  /**
   * Default time-to-live for swap transactions, in seconds.
   */
  ttl: number;

  init(): Promise<void>;

  ready(): boolean;

  balances?(req: BalanceRequest): Promise<Record<string, string>>;

  /**
   * Given a token's address, return the connector's native representation of
   * the token.
   *
   * @param address Token address
   */
  getTokenByAddress(address: string): Tokenish;

  /**
   * Given the amount of `baseToken` to put into a transaction, calculate the
   * amount of `quoteToken` that can be expected from the transaction.
   *
   * This is typically used for calculating token sell prices.
   *
   * @param baseToken Token input for the transaction
   * @param quoteToken Output from the transaction
   * @param amount Amount of `baseToken` to put into the transaction
   */
  estimateSellTrade(
    baseToken: Tokenish,
    quoteToken: Tokenish,
    amount: BigNumber,
    allowedSlippage?: string,
    poolId?: string,
  ): Promise<ExpectedTrade>;

  /**
   * Given the amount of `baseToken` desired to acquire from a transaction,
   * calculate the amount of `quoteToken` needed for the transaction.
   *
   * This is typically used for calculating token buy prices.
   *
   * @param quoteToken Token input for the transaction
   * @param baseToken Token output from the transaction
   * @param amount Amount of `baseToken` desired from the transaction
   */
  estimateBuyTrade(
    quoteToken: Tokenish,
    baseToken: Tokenish,
    amount: BigNumber,
    allowedSlippage?: string,
    poolId?: string,
  ): Promise<ExpectedTrade>;

  /**
   * Given a wallet and a Uniswap-ish trade, try to execute it on blockchain.
   *
   * @param wallet Wallet
   * @param trade Expected trade
   * @param gasPrice Base gas price, for pre-EIP1559 transactions
   * @param uniswapRouter Router smart contract address
   * @param ttl How long the swap is valid before expiry, in seconds
   * @param abi Router contract ABI
   * @param gasLimit Gas limit
   * @param nonce (Optional) EVM transaction nonce
   * @param maxFeePerGas (Optional) Maximum total fee per gas you want to pay
   * @param maxPriorityFeePerGas (Optional) Maximum tip per gas you want to pay
   */
  executeTrade(
    wallet: Wallet,
    trade: UniswapishTrade,
    gasPrice: number,
    uniswapRouter: string,
    ttl: number,
    abi: ContractInterface,
    gasLimit: number,
    nonce?: number,
    maxFeePerGas?: BigNumber,
    maxPriorityFeePerGas?: BigNumber,
    allowedSlippage?: string,
    poolId?: string,
  ): Promise<Transaction>;
}

export interface PriceLevel {
  price: string;
  quantity: string;
  timestamp: number;
}
export interface Orderbook {
  buys: PriceLevel[];
  sells: PriceLevel[];
}

export interface MarketInfo {
  [key: string]: any;
}

export type NetworkSelectionRequest = Static<typeof NetworkSelectionSchema>;

export class ResponseWrapper<T> {
  get status(): number {
    return this._status || -1;
  }
  set status(value: number) {
    this._status = value;
  }
  private _status: number | undefined;

  title?: string;
  message?: string;
  body?: T;
}

export interface CustomTransactionReceipt
  extends Omit<
    ethers.providers.TransactionReceipt,
    'gasUsed' | 'cumulativeGasUsed' | 'effectiveGasPrice'
  > {
  gasUsed: string;
  cumulativeGasUsed: string;
  effectiveGasPrice: string | null;
}

export interface CustomTransaction
  extends Omit<
    Transaction,
    'maxPriorityFeePerGas' | 'maxFeePerGas' | 'gasLimit' | 'value' | 'chainId'
  > {
  maxPriorityFeePerGas: string | null;
  maxFeePerGas: string | null;
  gasLimit: string | null;
  chainId: number | string;
  value: string;
}

export interface CustomTransactionResponse
  extends Omit<
    ethers.providers.TransactionResponse,
    'gasPrice' | 'gasLimit' | 'value'
  > {
  gasPrice: string | null;
  gasLimit: string;
  value: string;
}

export interface TransferRequest extends NetworkSelectionRequest {
  to: string;
  from: string;
  amount: string;
  token: string;
}

export type TransferResponse = string | FullTransferResponse;

export interface FullTransferResponse {
  network: string;
  timestamp: number;
  latency: number;
  amount: string;
  gasPrice: string;
  gasLimit: string;
  gasUsed: string;
  gasWanted: string;
  txHash: string;
}

export const NetworkSelectionSchema = Type.Object({
  chain: Type.String(),
  network: Type.String(),
  connector: Type.String()
});

