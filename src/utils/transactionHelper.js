const mongoose = require('mongoose');
const logger = require('./logger');

const TRANSACTION_UNSUPPORTED_PATTERNS = [
  /Transaction numbers are only allowed/i,
  /This MongoDB deployment does not support retryable writes/i,
  /Current topology does not support sessions/i,
  /Transaction .* not supported/i,
  /transactions are not supported/i
];

const isTransactionUnsupportedError = (error) => {
  if (!error) {
    return false;
  }

  const message = error.message || '';
  return TRANSACTION_UNSUPPORTED_PATTERNS.some(pattern => pattern.test(message));
};

const runWithTransaction = async (callback, options = {}) => {
  const { fallbackOnUnsupported = true, label = 'transaction' } = options;
  let session;

  try {
    session = await mongoose.startSession();
    let result;

    await session.withTransaction(async () => {
      result = await callback(session);
    });

    return result;
  } catch (error) {
    if (!fallbackOnUnsupported || !isTransactionUnsupportedError(error)) {
      throw error;
    }

    logger.warn(
      `MongoDB transaction unsupported during ${label}; falling back to non-transaction execution. ` +
      `Reason: ${error.message}`
    );

    return callback(null);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const applySession = (operation, session) => {
  if (session && operation && typeof operation.session === 'function') {
    return operation.session(session);
  }

  return operation;
};

const saveWithOptionalSession = (document, session) => {
  if (session) {
    return document.save({ session });
  }

  return document.save();
};

module.exports = {
  runWithTransaction,
  applySession,
  saveWithOptionalSession,
  isTransactionUnsupportedError
};
