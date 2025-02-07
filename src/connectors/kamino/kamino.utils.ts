import { Connection, PublicKey } from '@solana/web3.js';
import { KaminoMarket } from '@kamino-finance/klend-sdk';
import { getMedianSlotDurationInMsFromLastEpochs } from '@kamino-finance/klend-sdk';

/** Get Kamino Lending Market */
export async function getMarket({
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
