import { Ethereum } from '../chains/ethereum/ethereum';
import { Solana } from '../chains/solana/solana';
import { Uniswap } from '../connectors/uniswap/uniswap';
import {
  Ethereumish,
  Uniswapish,
} from './common-interfaces';
import { Jupiter } from '../connectors/jupiter/jupiter';

export type ChainUnion =
  | Ethereumish
  | Solana;

export type Chain<T> = T extends Ethereumish
  ? Ethereumish
    : T extends Solana
      ? Solana
        : never;

export class UnsupportedChainException extends Error {
  constructor(message?: string) {
    message =
      message !== undefined
        ? message
        : 'Please provide a supported chain name.';
    super(message);
    this.name = 'UnsupportedChainError';
    this.stack = (<any>new Error()).stack;
  }
}

export async function getInitializedChain<T>(
  chain: string,
  network: string,
): Promise<Chain<T>> {
  const chainInstance = await getChainInstance(chain, network);

  if (chainInstance === undefined) {
    throw new UnsupportedChainException(`unsupported chain ${chain}`);
  }

  if (!chainInstance.ready()) {
    await chainInstance.init();
  }

  return chainInstance as Chain<T>;
}

export async function getChainInstance(
  chain: string,
  network: string,
): Promise<ChainUnion | undefined> {
  let connection: ChainUnion | undefined;

  if (chain === 'ethereum') {
    connection = Ethereum.getInstance(network);
  } else if (chain === 'solana') {
    connection = Solana.getInstance(network);
  } else {
    connection = undefined;
  }

  return connection;
}

export type ConnectorUnion =
  | Uniswapish
  | Jupiter;

export type Connector<T> = T extends Uniswapish
  ? Uniswapish
    : T extends Jupiter
      ? Jupiter
        : never;

export async function getConnector<T>(
  chain: string,
  network: string,
  connector: string | undefined,
): Promise<Connector<T>> {
  let connectorInstance: ConnectorUnion;

  if (connector === 'uniswap') {
    connectorInstance = Uniswap.getInstance(chain, network);
  } else if (connector === 'jupiter') {
    connectorInstance = Jupiter.getInstance(network);
  } else {
    throw new Error('unsupported chain or connector');
  }

  if (!connectorInstance.ready()) {
    await connectorInstance.init();
  }

  return connectorInstance as Connector<T>;
}
