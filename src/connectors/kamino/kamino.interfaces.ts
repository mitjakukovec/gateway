import { Type, Static } from '@sinclair/typebox';

export const ReserveInfoRequestSchema = Type.Object(
  {
    network: Type.Optional(Type.String()),
    market: Type.String(),
    token: Type.String(),
  },
  { $id: 'ReserveInfoRequest' },
);

export type ReserveInfoRequest = Static<typeof ReserveInfoRequestSchema>;

export const ReserveInfoReplySchema = Type.Object(
  {
    tokenSymbol: Type.String(),
    liquidityAvailable: Type.Number(),
    utlizationRatio: Type.Number(),
    totalSupplied: Type.Number(),
    totalSupplyAPY: Type.Number(),
    totalBorrowed: Type.Number(),
    totalBorrowAPY: Type.Number(),
    borrowFactor: Type.Number(),
  },
  { $id: 'ReserveInfoReply' },
);

export type ReserveInfo = Static<typeof ReserveInfoReplySchema>;

export const ReservesInfoRequestSchema = Type.Object(
  {
    network: Type.Optional(Type.String()),
    market: Type.String(),
  },
  { $id: 'ReservesInfoRequest' },
);

export type ReservesInfoRequest = Static<typeof ReservesInfoRequestSchema>;

export const ReservesInfoReplySchema = Type.Array(
  Type.Object({
    tokenSymbol: Type.String(),
    liquidityAvailable: Type.Number(),
    utlizationRatio: Type.Number(),
    totalSupplied: Type.Number(),
    totalSupplyAPY: Type.Number(),
    totalBorrowed: Type.Number(),
    totalBorrowAPY: Type.Number(),
    borrowFactor: Type.Number(),
  }),
  { $id: 'ReservesInfoReply' },
);

export type ReservesInfo = Static<typeof ReservesInfoReplySchema>;
