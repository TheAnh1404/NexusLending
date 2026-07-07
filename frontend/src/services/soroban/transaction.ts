import { TransactionBuilder, Account, rpc, Contract, scValToNative } from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { sorobanRpc } from './client';
import { PASSPHRASE, NETWORK } from './config';

export type TxStage = 'preparing' | 'wallet' | 'submitting' | 'confirming' | 'confirmed';

export interface TxResult {
  txHash: string;
  explorerUrl: string;
  ledger: number;
  status: 'SUCCESS';
  contractId: string;
  functionName: string;
  blockTimestamp: string;
  returnValue?: unknown;
  contractReturnValue?: unknown;
}

const explorerUrlFor = (txHash: string): string =>
  NETWORK === 'testnet'
    ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
    : `https://stellar.expert/explorer/public/tx/${txHash}`;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const toJsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, toJsonSafe(item)])
    );
  }
  return value;
};

const parseReturnValue = (returnValue: unknown): unknown => {
  if (!returnValue) return undefined;
  try {
    return toJsonSafe(scValToNative(returnValue as never));
  } catch {
    return undefined;
  }
};

const getLedgerClosedAt = async (ledger: number): Promise<string> => {
  try {
    const ledgers = await (sorobanRpc as any).getLedgers({
      startLedger: ledger,
      pagination: { limit: 1 },
    });
    const ledgerInfo = ledgers?.ledgers?.find((item: any) =>
      item.sequence === ledger || item.ledger === ledger || item.ledgerSequence === ledger
    ) ?? ledgers?.ledgers?.[0];
    return ledgerInfo?.ledgerCloseTime ?? ledgerInfo?.ledgerClosedAt ?? new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
};

export async function buildAndSubmitTx(
  contractId: string,
  functionName: string,
  args: any[],
  userWallet: string,
  onStage?: (stage: TxStage) => void
): Promise<TxResult> {
  onStage?.('preparing');

  const accountResponse = await sorobanRpc.getAccount(userWallet);
  const account = new Account(userWallet, accountResponse.sequenceNumber());

  const contract = new Contract(contractId);
  const operation = contract.call(functionName, ...args);

  const tx = new TransactionBuilder(account, {
    fee: '100000', // baseline base fee
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(180)
    .build();

  const simulated = await sorobanRpc.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    const rawError = simulated.error ?? 'Unknown simulation error';
    // Try to extract a human-readable error from diagnostic events
    const diagnosticMatch = rawError.match(/data:\["([^"]+)"/);
    const contractErrMatch = rawError.match(/Error\(Contract,\s*#?(\d+)\)/);
    let friendlyMessage = rawError;
    if (contractErrMatch) {
      const code = parseInt(contractErrMatch[1], 10);
      const errorNames: Record<number, string> = {
        1: 'Contract already initialized',
        2: 'Contract not initialized',
        3: 'Unauthorized',
        10: 'Invalid loan amount',
        11: 'Invalid APR',
        12: 'Invalid duration',
        13: 'Invalid max LTV',
        14: 'Invalid liquidation threshold',
        15: 'Invalid liquidation bonus',
        16: 'Invalid min health factor (must be >= 1.4)',
        17: 'Invalid collateral amount',
        18: 'Invalid amount',
        19: 'Max LTV exceeds liquidation threshold',
        20: 'Offer not found',
        21: 'Offer is not in Draft status',
        22: 'Offer is not funded',
        23: 'Offer is not active',
        24: 'Offer already cancelled',
        25: 'Offer already expired',
        26: 'Offer already matched',
        27: 'Insufficient locked funds',
        30: 'Vault contract not configured',
        31: 'Loan Manager contract not configured',
        32: 'Marketplace contract not configured',
        40: 'Arithmetic overflow',
      };
      friendlyMessage = errorNames[code] ?? `Contract error #${code}`;
    } else if (diagnosticMatch) {
      friendlyMessage = diagnosticMatch[1];
    }
    console.error(`[Soroban] Simulation failed for ${functionName}:`, rawError);
    throw new Error(`Simulation failed: ${friendlyMessage}`);
  }

  const preparedTx = rpc.assembleTransaction(tx, simulated) as any;
  const unsignedXdr = preparedTx.toXDR();

  onStage?.('wallet');
  const signResult = await signTransaction(unsignedXdr, {
    networkPassphrase: PASSPHRASE,
  });

  if (signResult.error) {
    throw new Error(`Freighter signing failed: ${signResult.error}`);
  }

  const signedXdr = signResult.signedTxXdr;
  if (!signedXdr) {
    throw new Error('Freighter did not return a signed transaction XDR.');
  }
  const signedTx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE) as any;

  onStage?.('submitting');
  const sendRes = await sorobanRpc.sendTransaction(signedTx);
  if (sendRes.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify((sendRes as any).errorResult)}`);
  }

  const txHash = sendRes.hash;
  if (!txHash) {
    throw new Error('Stellar RPC did not return a transaction hash.');
  }

  onStage?.('confirming');
  for (let attempts = 0; attempts < 30; attempts++) {
    await sleep(2000);
    const txStatus = await sorobanRpc.getTransaction(txHash);
    const status = (txStatus as any).status;

    if (status === 'SUCCESS') {
      const ledger = (txStatus as any).ledger as number | undefined;
      if (!ledger) {
        throw new Error('Confirmed transaction did not include a ledger number.');
      }
      const blockTimestamp = await getLedgerClosedAt(ledger);
      const contractReturnValue = parseReturnValue((txStatus as any).returnValue);
      onStage?.('confirmed');
      return {
        txHash,
        explorerUrl: explorerUrlFor(txHash),
        ledger,
        status: 'SUCCESS',
        contractId,
        functionName,
        blockTimestamp,
        returnValue: (txStatus as any).returnValue,
        contractReturnValue,
      };
    }

    if (status === 'FAILED') {
      throw new Error(`Transaction confirmed as FAILED. Result XDR: ${(txStatus as any).resultXdr}`);
    }
  }

  throw new Error('Transaction confirmation timeout after 30 attempts');
}
