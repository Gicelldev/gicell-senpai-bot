jest.mock('mongoose', () => ({
  startSession: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

const mongoose = require('mongoose');
const logger = require('../src/utils/logger');
const {
  runWithTransaction,
  isTransactionUnsupportedError
} = require('../src/utils/transactionHelper');

describe('transactionHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('runs callback inside a session transaction when supported', async () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined)
    };
    mongoose.startSession.mockResolvedValue(session);

    const callback = jest.fn().mockResolvedValue('ok');

    const result = await runWithTransaction(callback, { label: 'unit-test' });

    expect(result).toBe('ok');
    expect(callback).toHaveBeenCalledWith(session);
    expect(session.withTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  test('falls back without session when transaction support is unavailable', async () => {
    const session = {
      withTransaction: jest.fn(async () => {
        throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
      }),
      endSession: jest.fn().mockResolvedValue(undefined)
    };
    mongoose.startSession.mockResolvedValue(session);

    const callback = jest.fn().mockResolvedValue('fallback-ok');

    const result = await runWithTransaction(callback, { label: 'fallback-test' });

    expect(result).toBe('fallback-ok');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('falling back'));
    expect(session.endSession).toHaveBeenCalled();
  });

  test('rethrows non-transaction-support errors', async () => {
    const session = {
      withTransaction: jest.fn(async () => {
        throw new Error('duplicate key error');
      }),
      endSession: jest.fn().mockResolvedValue(undefined)
    };
    mongoose.startSession.mockResolvedValue(session);

    await expect(runWithTransaction(jest.fn(), { label: 'non-fallback' }))
      .rejects
      .toThrow('duplicate key error');

    expect(session.endSession).toHaveBeenCalled();
  });

  test('detects known unsupported transaction errors', () => {
    expect(isTransactionUnsupportedError(new Error('Transaction numbers are only allowed on a replica set member or mongos')))
      .toBe(true);
    expect(isTransactionUnsupportedError(new Error('some unrelated failure')))
      .toBe(false);
  });
});
