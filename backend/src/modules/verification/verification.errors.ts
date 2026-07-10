import { ApiError } from '../../utils/apiError';

export class VerificationError extends ApiError {
  constructor(message: string, statusCode = 400) {
    super(statusCode, message);
  }
}

export class TransactionNotFoundError extends VerificationError {
  constructor(txHash: string) {
    super(`Transaction not found on Soroban RPC: ${txHash}`, 404);
  }
}

export class TransactionNotSuccessfulError extends VerificationError {
  constructor(txHash: string, status: string) {
    super(`Transaction ${txHash} is not successful on-chain. Status: ${status}`);
  }
}

export class WrongNetworkError extends VerificationError {
  constructor(expected: string, actual: string) {
    super(`Transaction was verified on the wrong network. Expected ${expected}, got ${actual}.`);
  }
}

export class WrongContractError extends VerificationError {
  constructor(expected: string, actual?: string) {
    super(`Transaction does not target the expected contract. Expected ${expected}, got ${actual ?? 'none'}.`);
  }
}

export class WrongEventError extends VerificationError {
  constructor(expected: string[], actual: string[]) {
    super(`Transaction does not contain the expected event. Expected one of [${expected.join(', ')}], got [${actual.join(', ')}].`);
  }
}

export class WrongWalletError extends VerificationError {
  constructor(expected: string, actual?: string) {
    super(`Transaction actor does not match expected wallet. Expected ${expected}, got ${actual ?? 'none'}.`);
  }
}

export class WrongEntityError extends VerificationError {
  constructor(expected: string, actual?: string) {
    super(`Transaction event references the wrong entity. Expected ${expected}, got ${actual ?? 'none'}.`);
  }
}

export class WrongAmountError extends VerificationError {
  constructor(expected: string, actual?: string) {
    super(`Transaction amount does not match expected amount. Expected ${expected}, got ${actual ?? 'none'}.`);
  }
}

export class ReplayTransactionError extends VerificationError {
  constructor(txHash: string) {
    super(`Transaction has already been processed: ${txHash}`);
  }
}

