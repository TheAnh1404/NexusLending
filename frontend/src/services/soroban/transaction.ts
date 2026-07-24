import {
  TransactionBuilder,
  Account,
  rpc,
  Contract,
  scValToNative,
  Asset,
  Operation,
  type FeeBumpTransaction,
  type Transaction,
} from '@stellar/stellar-sdk';
import { freighterService } from '../wallet/freighter.service';
import { horizonServer, sorobanRpc } from './client';
import {
  EXPLORER_NETWORK,
  NETWORK_PASSPHRASE,
  STELLAR_DECIMALS,
  USDC_ASSET_CODE,
  requireUsdcAsset,
} from './config';
import { decimalToScaledBigInt, decimalToStellarAmount } from './amounts';

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

export type SwapDirection = 'XLM_TO_USDC' | 'USDC_TO_XLM';

export interface SwapQuote {
  direction: SwapDirection;
  sendAsset: string;
  receiveAsset: string;
  receiveAmount: string;
  requiredSendAmount: string;
  path: string[];
}

interface HorizonPathAsset {
  asset_code: string;
  asset_issuer: string;
  asset_type: string;
}

interface HorizonPaymentPath {
  path: HorizonPathAsset[];
  source_amount: string;
}

const explorerUrlFor = (txHash: string): string =>
  `https://stellar.expert/explorer/${EXPLORER_NETWORK}/tx/${txHash}`;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const toStellarAmount = (amount: number, rounding: 'round' | 'ceil' = 'round'): string => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Swap amount must be greater than zero.');
  }
  return decimalToStellarAmount(amount, STELLAR_DECIMALS, rounding);
};

const assetLabel = (asset: Asset): string => asset.isNative() ? 'XLM' : asset.getCode();

const getSwapAssets = (direction: SwapDirection): { sendAsset: Asset; destAsset: Asset; functionName: string } => {
  const usdcAsset = requireUsdcAsset();
  return {
    sendAsset: direction === 'XLM_TO_USDC' ? Asset.native() : usdcAsset,
    destAsset: direction === 'XLM_TO_USDC' ? usdcAsset : Asset.native(),
    functionName: direction === 'XLM_TO_USDC' ? 'swap_xlm_to_usdc' : 'swap_usdc_to_xlm',
  };
};

const pathAssetToAsset = (asset: HorizonPathAsset): Asset => {
  if (asset.asset_type === 'native') return Asset.native();
  return new Asset(asset.asset_code, asset.asset_issuer);
};

const accountHasTrustline = (account: unknown, asset: Asset): boolean => {
  if (asset.isNative()) return true;

  const balances = (account as { balances?: unknown[] }).balances;
  if (!Array.isArray(balances)) return false;

  return balances.some((balance) => {
    const item = balance as { asset_code?: string; asset_issuer?: string; asset_type?: string };
    return item.asset_type !== 'native'
      && item.asset_code === asset.getCode()
      && item.asset_issuer === asset.getIssuer();
  });
};

const findBestStrictReceivePath = async (
  sendAsset: Asset,
  destAsset: Asset,
  destAmount: string
): Promise<HorizonPaymentPath> => {
  const response = await horizonServer.strictReceivePaths([sendAsset], destAsset, destAmount).call();
  const records = (response.records ?? []) as HorizonPaymentPath[];

  if (records.length === 0) {
    throw new Error(`No Stellar DEX payment path found for ${assetLabel(sendAsset)} to ${assetLabel(destAsset)}.`);
  }

  return [...records].sort((left, right) => {
    const leftRaw = decimalToScaledBigInt(left.source_amount, STELLAR_DECIMALS, 'ceil');
    const rightRaw = decimalToScaledBigInt(right.source_amount, STELLAR_DECIMALS, 'ceil');
    if (leftRaw === rightRaw) return 0;
    return leftRaw < rightRaw ? -1 : 1;
  })[0];
};

const pathDisplay = (path: HorizonPathAsset[]): string[] =>
  path.map((asset) => asset.asset_type === 'native' ? 'XLM' : `${asset.asset_code}:${asset.asset_issuer}`);

export async function quoteStellarSwap(direction: SwapDirection, receiveAmount: number): Promise<SwapQuote> {
  const { sendAsset, destAsset } = getSwapAssets(direction);
  const destAmount = toStellarAmount(receiveAmount);
  const bestPath = await findBestStrictReceivePath(sendAsset, destAsset, destAmount);

  return {
    direction,
    sendAsset: assetLabel(sendAsset),
    receiveAsset: assetLabel(destAsset),
    receiveAmount: destAmount,
    requiredSendAmount: bestPath.source_amount,
    path: pathDisplay(bestPath.path),
  };
}

const HORIZON_RESULT_MESSAGES: Record<string, string> = {
  op_underfunded: 'Insufficient wallet balance for the swap and required XLM reserve.',
  op_too_few_offers: 'No Stellar DEX liquidity is available for this swap amount.',
  op_over_sendmax: 'Slippage limit exceeded. Increase the max send amount or try a smaller swap.',
  op_under_destmin: 'Slippage limit exceeded. Increase the max send amount or try a smaller swap.',
  op_no_trust: 'The receiving account does not have the required asset trustline.',
  op_src_no_trust: `Your wallet does not have a ${USDC_ASSET_CODE} trustline.`,
  op_low_reserve: `Your wallet needs more unlocked XLM reserve to add the ${USDC_ASSET_CODE} trustline.`,
  op_line_full: `Your ${USDC_ASSET_CODE} trustline limit is full.`,
  op_no_issuer: `${USDC_ASSET_CODE} issuer does not exist on this Stellar network.`,
  op_not_authorized: `The ${USDC_ASSET_CODE} trustline is not authorized.`,
  op_src_not_authorized: `The ${USDC_ASSET_CODE} trustline is not authorized.`,
  op_cross_self: 'This swap would cross one of your own open offers.',
  tx_bad_auth: 'Freighter did not provide a valid signature for this transaction.',
  tx_bad_seq: 'Wallet sequence number changed. Please retry the swap.',
  tx_insufficient_balance: 'Wallet does not have enough XLM to pay fees and reserve.',
  tx_insufficient_fee: 'Network fee was too low. Please retry.',
};

const normalizeHorizonSubmissionError = (error: unknown): Error => {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data as {
    extras?: {
      result_codes?: {
        transaction?: string;
        operations?: string[];
      };
      result_xdr?: string;
    };
    detail?: string;
    details?: string;
  } | undefined;

  const txCode = responseData?.extras?.result_codes?.transaction;
  const operationCodes = responseData?.extras?.result_codes?.operations ?? [];
  const failedCode = operationCodes.find((code) => code && code !== 'op_success') ?? txCode;

  if (failedCode) {
    const message = HORIZON_RESULT_MESSAGES[failedCode] ?? `Stellar transaction failed with code ${failedCode}.`;
    const codes = [txCode, ...operationCodes].filter(Boolean).join(', ');
    return new Error(`${message} (${codes})`);
  }

  if (error instanceof Error && error.message) return error;
  return new Error(responseData?.details ?? responseData?.detail ?? 'Unable to submit swap transaction to Stellar.');
};

const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
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
  28: 'Borrower cannot accept their own offer',
  29: 'Loan and collateral assets must be different',
  30: 'Vault contract not configured',
  31: 'Loan Manager contract not configured',
  32: 'Marketplace contract not configured',
  40: 'Arithmetic overflow',
};

const SOROBAN_PANIC_MESSAGES: Record<string, string> = {
  'loan is not pending collateral': 'Loan is not PendingCollateral on-chain. It may already be active or the local backend state is stale.',
  'collateral below max ltv': 'Collateral is below the max LTV requirement. Increase the collateral amount and try again.',
  'health factor below minimum': 'Initial Health Factor is below the contract minimum. Increase the collateral amount and try again.',
  'loan not found': 'Loan not found on the Loan Manager contract. The backend loan may have a missing or incorrect contractLoanId.',
  'marketplace not configured': 'Loan Manager is not initialized with the Marketplace contract address. Redeploy or re-run contract initialization.',
  'vault not configured': 'Vault contract is not configured for the Loan Manager contract.',
  'oracle not configured': 'Oracle contract is not configured for the Loan Manager contract.',
  'oracle price must be positive': 'Oracle price is missing or invalid on-chain.',
  'oracle price is stale': 'Oracle price is stale on-chain. Update the oracle price before retrying.',
  'insufficient locked lender funds': 'Vault does not have enough locked lender funds for this offer. The offer may not be funded on-chain.',
  'insufficient locked collateral': 'Vault does not have enough locked collateral for this loan.',
  'amount must be positive': 'Amount must be greater than zero.',
};

const normalizeSorobanSimulationError = (rawError: string, functionName?: string): string => {
  const lowerRawError = rawError.toLowerCase();
  const panicMessage = Object.entries(SOROBAN_PANIC_MESSAGES)
    .find(([needle]) => lowerRawError.includes(needle));

  if (panicMessage) return panicMessage[1];

  if (lowerRawError.includes('asset price not found') || lowerRawError.includes('price not found')) {
    return 'Oracle price is not initialized for the configured XLM/USDC asset contract pair. Run set_price_for_assets for the XLM and USDC contract IDs used by the frontend.';
  }

  const contractErrMatch = rawError.match(/Error\(Contract,\s*#?(\d+)\)/);
  if (contractErrMatch) {
    const code = parseInt(contractErrMatch[1], 10);
    return CONTRACT_ERROR_MESSAGES[code] ?? `Contract error #${code}`;
  }

  const diagnosticMatch = rawError.match(/data:\["([^"]+)"/);
  if (diagnosticMatch) return diagnosticMatch[1];

  if (lowerRawError.includes('contract call failed') && functionName === 'activate_loan') {
    return 'Loan activation failed during simulation. Check that the oracle has XLM/USDC set with set_price_for_assets, the offer is funded on-chain, the borrower has enough unlocked XLM, and the borrower has a USDC trustline.';
  }

  if (lowerRawError.includes('unreachablecodereached')) {
    if (functionName === 'accept_offer') {
      return 'Offer cannot be accepted on-chain. Common causes: (1) Cross-contract auth check, (2) The offer is not in Active status on-chain, (3) Borrower is the same wallet as Lender, or (4) Oracle price feed is uninitialized. Refresh marketplace or verify offer status.';
    }
    if (functionName === 'activate_loan') {
      return 'Loan cannot be activated on-chain. Common causes: (1) Loan is not PendingCollateral, (2) Borrower balance is below required XLM collateral, or (3) Missing USDC trustline.';
    }
    return 'Soroban VM simulation trapped (UnreachableCodeReached). Please verify smart contract parameters and status.';
  }

  return rawError;
};

const submitClassicTransaction = async (
  tx: Transaction,
  functionName: string,
  userWallet: string,
  networkPassphrase: string,
  onStage?: (stage: TxStage) => void,
  contractReturnValue?: unknown
): Promise<TxResult> => {
  onStage?.('wallet');
  const signed = await freighterService.signTransaction(tx.toXDR(), networkPassphrase, userWallet);
  const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, networkPassphrase) as Transaction | FeeBumpTransaction;

  onStage?.('submitting');
  let submitResponse;
  try {
    submitResponse = await horizonServer.submitTransaction(signedTx, { skipMemoRequiredCheck: true });
  } catch (error) {
    throw normalizeHorizonSubmissionError(error);
  }

  if (!submitResponse.hash) {
    throw new Error('Horizon did not return a transaction hash.');
  }

  onStage?.('confirming');
  onStage?.('confirmed');

  return {
    txHash: submitResponse.hash,
    explorerUrl: explorerUrlFor(submitResponse.hash),
    ledger: submitResponse.ledger,
    status: 'SUCCESS',
    contractId: 'stellar-classic-dex',
    functionName,
    blockTimestamp: new Date().toISOString(),
    contractReturnValue,
  };
};

export async function hasUsdcTrustline(userWallet: string): Promise<boolean> {
  const account = await horizonServer.loadAccount(userWallet);
  return accountHasTrustline(account, requireUsdcAsset());
}

export async function createUsdcTrustline(
  userWallet: string,
  onStage?: (stage: TxStage) => void
): Promise<TxResult> {
  onStage?.('preparing');
  const networkPassphrase = (await freighterService.requireExpectedNetwork()).networkPassphrase;
  const account = await horizonServer.loadAccount(userWallet);
  const usdcAsset = requireUsdcAsset();

  if (accountHasTrustline(account, usdcAsset)) {
    throw new Error(`${USDC_ASSET_CODE} trustline already exists.`);
  }

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset: usdcAsset }))
    .setTimeout(180)
    .build();

  return submitClassicTransaction(tx, `create_${USDC_ASSET_CODE.toLowerCase()}_trustline`, userWallet, networkPassphrase, onStage, {
    asset: USDC_ASSET_CODE,
    issuer: usdcAsset.getIssuer(),
  });
}

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

export async function readContractValue(
  contractId: string,
  functionName: string,
  args: any[],
  sourceWallet: string
): Promise<unknown> {
  const accountResponse = await sorobanRpc.getAccount(sourceWallet);
  const account = new Account(sourceWallet, accountResponse.sequenceNumber());

  const operation = new Contract(contractId).call(functionName, ...args);
  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  const simulated = await sorobanRpc.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    const rawError = simulated.error ?? 'Unknown simulation error';
    const friendlyMessage = normalizeSorobanSimulationError(rawError, functionName);
    throw new Error(`Simulation failed: ${friendlyMessage}`);
  }

  return parseReturnValue(simulated.result?.retval);
}

const toIsoTimestamp = (value: unknown): string | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  return undefined;
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
    return toIsoTimestamp(ledgerInfo?.ledgerCloseTime)
      ?? toIsoTimestamp(ledgerInfo?.ledgerClosedAt)
      ?? toIsoTimestamp(ledgerInfo?.closedAt)
      ?? toIsoTimestamp(ledgerInfo?.closeTime)
      ?? new Date().toISOString();
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
  const networkPassphrase = (await freighterService.requireExpectedNetwork()).networkPassphrase;

  const accountResponse = await sorobanRpc.getAccount(userWallet);
  const account = new Account(userWallet, accountResponse.sequenceNumber());

  const contract = new Contract(contractId);
  const operation = contract.call(functionName, ...args);

  const tx = new TransactionBuilder(account, {
    fee: '100000', // baseline base fee
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(180)
    .build();

  const simulated = await sorobanRpc.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    const rawError = simulated.error ?? 'Unknown simulation error';
    const friendlyMessage = normalizeSorobanSimulationError(rawError, functionName);
    console.error(`[Soroban] Simulation failed for ${functionName}:`, rawError);
    throw new Error(`Simulation failed: ${friendlyMessage}`);
  }

  const preparedTx = rpc.assembleTransaction(tx, simulated).build();
  const unsignedXdr = preparedTx.toXDR();

  onStage?.('wallet');
  const signResult = await freighterService.signTransaction(unsignedXdr, networkPassphrase, userWallet);
  const signedTx = TransactionBuilder.fromXDR(signResult.signedTxXdr, networkPassphrase) as any;

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
      const rawResultXdr = (txStatus as any).resultXdr;
      let resultXdrString = '';
      if (typeof rawResultXdr === 'string') {
        resultXdrString = rawResultXdr;
      } else if (rawResultXdr && typeof rawResultXdr.toXDR === 'function') {
        resultXdrString = rawResultXdr.toXDR('base64');
      } else {
        resultXdrString = JSON.stringify(rawResultXdr);
      }
      throw new Error(`Transaction confirmed as FAILED. Result XDR: ${resultXdrString}`);
    }
  }

  throw new Error('Transaction confirmation timeout after 30 attempts');
}

export async function swapXlmToUsdc(
  userWallet: string,
  usdcAmount: number,
  maxXlmToSend: number,
  onStage?: (stage: TxStage) => void
): Promise<TxResult> {
  return swapStellarAssets(userWallet, 'XLM_TO_USDC', usdcAmount, maxXlmToSend, onStage);
}

export async function swapUsdcToXlm(
  userWallet: string,
  xlmAmount: number,
  maxUsdcToSend: number,
  onStage?: (stage: TxStage) => void
): Promise<TxResult> {
  return swapStellarAssets(userWallet, 'USDC_TO_XLM', xlmAmount, maxUsdcToSend, onStage);
}

export async function swapStellarAssets(
  userWallet: string,
  direction: SwapDirection,
  receiveAmount: number,
  maxSendAmount: number,
  onStage?: (stage: TxStage) => void
): Promise<TxResult> {
  onStage?.('preparing');
  const networkPassphrase = (await freighterService.requireExpectedNetwork()).networkPassphrase;

  const { sendAsset, destAsset, functionName } = getSwapAssets(direction);
  const destAmount = toStellarAmount(receiveAmount);
  const sendMax = toStellarAmount(maxSendAmount, 'ceil');

  const [account, bestPath] = await Promise.all([
    horizonServer.loadAccount(userWallet),
    findBestStrictReceivePath(sendAsset, destAsset, destAmount),
  ]);

  const requiredSendAmountRaw = decimalToScaledBigInt(bestPath.source_amount, STELLAR_DECIMALS, 'ceil');
  if (requiredSendAmountRaw <= 0n) {
    throw new Error('Horizon returned an invalid payment path amount.');
  }

  const maxSendAmountRaw = decimalToScaledBigInt(maxSendAmount, STELLAR_DECIMALS, 'ceil');
  if (requiredSendAmountRaw > maxSendAmountRaw) {
    throw new Error(
      `Slippage limit exceeded. Current path needs ${bestPath.source_amount} ${assetLabel(sendAsset)}, `
      + `but your max send is ${sendMax} ${assetLabel(sendAsset)}.`
    );
  }

  const path = bestPath.path.map(pathAssetToAsset);
  const usdcAsset = requireUsdcAsset();
  const shouldCreateUsdcTrustline = direction === 'XLM_TO_USDC' && !accountHasTrustline(account, usdcAsset);
  const builder = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase,
  });

  if (shouldCreateUsdcTrustline) {
    builder.addOperation(Operation.changeTrust({ asset: usdcAsset }));
  }

  builder.addOperation(Operation.pathPaymentStrictReceive({
    sendAsset,
    sendMax,
    destination: userWallet,
    destAsset,
    destAmount,
    path,
  }));

  const tx = builder.setTimeout(180).build();

  return submitClassicTransaction(tx, functionName, userWallet, networkPassphrase, onStage, {
    direction,
    sendAsset: assetLabel(sendAsset),
    receiveAsset: assetLabel(destAsset),
    requiredSendAmount: bestPath.source_amount,
    maxSendAmount: sendMax,
    receiveAmount: destAmount,
    trustlineCreated: shouldCreateUsdcTrustline,
    path: pathDisplay(bestPath.path),
  });
}
