import {
  invalidEthPrivateKeyError,
  isEthPrivateKey,
  validatePrivateKey,
  invalidChainError,
  invalidAddressError,
  validateChain,
  validateAddress,
  validateAccountID,
  invalidAccountIDError,
} from '../../../src/services/wallet/wallet.validators';

import { missingParameter } from '../../../src/services/validators';

import 'jest-extended';

describe('isEthPrivateKey', () => {
  it('pass against a well formed private key', () => {
    expect(
      isEthPrivateKey(
        'da857cbda0ba96757fed842617a40693d06d00001e55aa972955039ae747bac4' // noqa: mock
      )
    ).toEqual(true);
  });

  it('fail against a string that is too short', () => {
    expect(isEthPrivateKey('da857cbda0ba96757fed842617a40693d0')).toEqual(
      false
    );
  });

  it('fail against a string that has non-hexadecimal characters', () => {
    expect(
      isEthPrivateKey(
        'da857cbda0ba96757fed842617a40693d06d00001e55aa972955039ae747qwer'
      )
    ).toEqual(false);
  });
});

describe('validatePrivateKey', () => {
  it('valid when req.privateKey is an ethereum key', () => {
    expect(
      validatePrivateKey({
        chain: 'ethereum',
        privateKey:
          'da857cbda0ba96757fed842617a40693d06d00001e55aa972955039ae747bac4', // noqa: mock
      })
    ).toEqual([]);
  });
  it('return error when req.privateKey does not exist', () => {
    expect(
      validatePrivateKey({
        chain: 'ethereum',
        hello: 'world',
      })
    ).toEqual([missingParameter('privateKey')]);
  });

  it('return error when req.chain does not exist', () => {
    expect(
      validatePrivateKey({
        privateKey:
          '5r1MuqBa3L9gpXHqULS3u2B142c5jA8szrEiL8cprvhjJDe6S2xz9Q4uppgaLegmuPpq4ftBpcMw7NNoJHJefiTt',
      })
    ).toEqual([missingParameter('chain')]);
  });

  it('return error when req.privateKey is invalid ethereum key', () => {
    expect(
      validatePrivateKey({
        chain: 'ethereum',
        privateKey: 'world',
      })
    ).toEqual([invalidEthPrivateKeyError]);
  });

describe('validateChain', () => {
  it('valid when chain is ethereum', () => {
    expect(
      validateChain({
        chain: 'ethereum',
      })
    ).toEqual([]);
  });

  it('return error when req.chain does not exist', () => {
    expect(
      validateChain({
        hello: 'world',
      })
    ).toEqual([missingParameter('chain')]);
  });

  it('return error when req.chain is invalid', () => {
    expect(
      validateChain({
        chain: 'shibainu',
      })
    ).toEqual([invalidChainError]);
  });
});

describe('validateAddress', () => {
  it('valid when address is a string', () => {
    expect(
      validateAddress({
        address: '0x000000000000000000000000000000000000000',
      })
    ).toEqual([]);
  });

  it('return error when req.address does not exist', () => {
    expect(
      validateAddress({
        hello: 'world',
      })
    ).toEqual([missingParameter('address')]);
  });

  it('return error when req.address is not a string', () => {
    expect(
      validateAddress({
        address: 1,
      })
    ).toEqual([invalidAddressError]);
  });
});

describe('validateAccountID', () => {
  it('valid when account ID is a string', () => {
    expect(
      validateAccountID({
        accountId: '0x000000000000000000000000000000000000000',
      })
    ).toEqual([]);
  });

  it('valid when account ID is not specified', () => {
    expect(validateAccountID({})).toEqual([]);
  });

  it('return error when req.accountId is not a string', () => {
    expect(validateAccountID({ accountId: 1 })).toEqual([
      invalidAccountIDError,
    ]);
    });
  });
});
