import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { message as staticMessage, notification as staticNotification, App } from 'antd';

let message: any = staticMessage;
let notification: any = staticNotification;
import type { Loan, LoanOffer, OraclePrice, Transaction, UserRole, WalletState } from '../types';
import { initialLoanOffers, initialLoans } from '../data/mockLoans';
import { initialOraclePrices } from '../data/mockOracle';
import { initialActivities } from '../data/mockActivities';
import { isLiquidatable, isOpenLoanStatus } from '../utils/finance';
import { loansService } from '../services/loans/loans.service';
import { offersService, type CreateOfferInput } from '../services/offers/offers.service';
import { oracleService } from '../services/oracle/oracle.service';
import { transactionsService } from '../services/transactions/transactions.service';
import { DATA_MODE } from '../services/api/client';
import type { ConfirmedChainReceiptPayload } from '../services/api/client';
import { offersApi } from '../services/api/offers.api';
import { loansApi } from '../services/api/loans.api';
import { oracleApi } from '../services/api/oracle.api';
import { transactionsApi } from '../services/api/transactions.api';
import { marketplaceContract } from '../services/soroban/marketplace.contract';
import { loanManagerContract } from '../services/soroban/loanManager.contract';
import { oracleContract } from '../services/soroban/oracle.contract';
import type { TxResult, TxStage } from '../services/soroban/transaction';

const STORAGE_KEY = 'nexus_lending_state_v3';

export const clearLegacyFrontendData = () => {
  localStorage.removeItem('nexus_lending_state_v2');
  localStorage.removeItem('nexus_lending_state_v3');
  localStorage.removeItem('nexus_notification_settings');
  localStorage.removeItem('nexus_freighter_connected');
};

export const clearDemoData = clearLegacyFrontendData;

if (typeof window !== 'undefined') {
  (window as any).clearLegacyFrontendData = clearLegacyFrontendData;
  (window as any).clearDemoData = clearDemoData;
}


export interface OracleImpact {
  loanId: string;
  oldHF: number;
  newHF: number;
  oldStatus: Loan['status'];
  newStatus: Loan['status'];
}

interface LendingSnapshot {
  wallet: WalletState;
  offers: LoanOffer[];
  loans: Loan[];
  oraclePrices: OraclePrice[];
  transactions: Transaction[];
}

interface LendingContextValue {
  wallet: WalletState;
  currentUserWallet: string | null;
  offers: LoanOffer[];
  loanOffers: LoanOffer[];
  loans: Loan[];
  oraclePrices: OraclePrice[];
  transactions: Transaction[];
  activities: Transaction[];
  connectWallet: (address: string, role?: UserRole) => void;
  disconnectWallet: () => void;
  createOffer: (offer: CreateOfferInput) => Promise<LoanOffer | null>;
  createLoanOffer: (offer: CreateOfferInput) => Promise<void>;
  fundOffer: (offerId: string) => Promise<LoanOffer | null>;
  activateOffer: (offerId: string) => Promise<LoanOffer | null>;
  cancelOffer: (offerId: string) => Promise<void>;
  acceptOffer: (offerId: string, collateralAmount: number) => Promise<Loan | null>;
  activateLoan: (loanId: string) => Promise<Loan | null>;
  borrowLoan: (offerId: string, collateralAmount: number) => Promise<void>;
  addCollateral: (loanId: string, amount: number) => Promise<void>;
  partialRepay: (loanId: string, amount: number) => Promise<void>;
  fullRepay: (loanId: string) => Promise<void>;
  repayLoan: (loanId: string, amount: number, isFullRepay: boolean) => Promise<void>;
  updateOraclePrice: (newPrice: number) => Promise<OracleImpact[]>;
  recalculateAllHealthFactors: () => Promise<OracleImpact[]>;
  liquidateLoan: (loanId: string, repayAmount: number) => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
}

const disconnectedWallet: WalletState = {
  connected: false,
  address: null,
  role: null,
  balanceXLM: 0,
  balanceUSDC: 0,
};

const normalizeOffers = (offers: LoanOffer[]): LoanOffer[] => offers.map(offersService.normalize);

const getPrices = (oraclePrices: OraclePrice[]) => ({
  xlmPrice: oraclePrices.find((price) => price.asset === 'XLM')?.price ?? 0.125,
  usdcPrice: oraclePrices.find((price) => price.asset === 'USDC')?.price ?? 1,
});

const txStageLabels: Record<TxStage, string> = {
  preparing: 'Preparing Transaction...',
  wallet: 'Waiting for Wallet Signature...',
  submitting: 'Submitting Transaction...',
  confirming: 'Waiting for Blockchain Confirmation...',
  confirmed: 'Transaction Confirmed',
};

const txReceiptFromResult = (txRes: TxResult): ConfirmedChainReceiptPayload => ({
  txHash: txRes.txHash,
  explorerUrl: txRes.explorerUrl,
  ledger: txRes.ledger,
  txStatus: txRes.status,
  contractId: txRes.contractId,
  blockTimestamp: txRes.blockTimestamp,
  contractReturnValue: txRes.contractReturnValue,
});

const contractReturnId = (txRes: TxResult, label: string): bigint => {
  if (txRes.contractReturnValue === undefined || txRes.contractReturnValue === null) {
    throw new Error(`${label} was not returned by the Soroban contract.`);
  }
  return BigInt(String(txRes.contractReturnValue));
};

const runSorobanTransaction = async (
  send: (onStage: (stage: TxStage) => void) => Promise<TxResult>
): Promise<TxResult | null> => {
  let closeStageMessage: (() => void) | undefined;
  const showStage = (stage: TxStage) => {
    closeStageMessage?.();
    closeStageMessage = message.loading(txStageLabels[stage], 0);
  };

  try {
    const txRes = await send(showStage);
    closeStageMessage?.();
    notification.success({
      message: 'Transaction Confirmed',
      description: <a href={txRes.explorerUrl} target="_blank" rel="noreferrer">View on Stellar Expert</a>,
    });
    return txRes;
  } catch (error) {
    closeStageMessage?.();
    message.error(error instanceof Error ? error.message : 'Transaction failed');
    return null;
  }
};

const normalizeLoans = (loans: Loan[], oraclePrices: OraclePrice[]): Loan[] => {
  const prices = getPrices(oraclePrices);
  return loans.map((loan) => loansService.normalize(loan, prices));
};

const getInitialSnapshot = (): LendingSnapshot => {
  const fallback: LendingSnapshot = {
    wallet: disconnectedWallet,
    offers: normalizeOffers(initialLoanOffers),
    loans: normalizeLoans(initialLoans, initialOraclePrices),
    oraclePrices: initialOraclePrices,
    transactions: initialActivities,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LendingSnapshot>;
    const oraclePrices = parsed.oraclePrices?.length ? parsed.oraclePrices : fallback.oraclePrices;
    return {
      wallet: parsed.wallet ?? fallback.wallet,
      offers: normalizeOffers(parsed.offers?.length ? parsed.offers : fallback.offers),
      loans: normalizeLoans(parsed.loans?.length ? parsed.loans : fallback.loans, oraclePrices),
      oraclePrices,
      transactions: parsed.transactions?.length ? parsed.transactions : fallback.transactions,
    };
  } catch {
    return fallback;
  }
};

const buildOracleImpacts = (previousLoans: Loan[], nextLoans: Loan[]): OracleImpact[] => {
  return nextLoans.flatMap((loan) => {
    const previous = previousLoans.find((item) => item.id === loan.id);
    if (!previous || !isOpenLoanStatus(loan.status)) return [];
    if (previous.healthFactor === loan.healthFactor && previous.status === loan.status) return [];
    return [{
      loanId: loan.id,
      oldHF: previous.healthFactor,
      newHF: loan.healthFactor,
      oldStatus: previous.status,
      newStatus: loan.status,
    }];
  });
};

const fetchWalletBalances = async (address: string): Promise<{ balanceXLM: number; balanceUSDC: number }> => {
  try {
    const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
    if (!response.ok) {
      // Account might not be created on-chain yet, return defaults
      return { balanceXLM: 0, balanceUSDC: 0 };
    }
    const data = await response.json();
    let xlm = 0;
    let usdc = 0;
    
    if (data && Array.isArray(data.balances)) {
      for (const bal of data.balances) {
        if (bal.asset_type === 'native') {
          xlm = parseFloat(bal.balance);
        } else if (bal.asset_code === 'USDC') {
          usdc = parseFloat(bal.balance);
        }
      }
    }
    return { balanceXLM: xlm, balanceUSDC: usdc };
  } catch (e) {
    console.error('Error fetching wallet balances from Horizon:', e);
    return { balanceXLM: 250000, balanceUSDC: 50000 }; // Fallback to mock balances if query fails
  }
};

const LendingContext = createContext<LendingContextValue | undefined>(undefined);

export const LendingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = App.useApp();
  message = app.message;
  notification = app.notification;

  const [snapshot, setSnapshot] = useState<LendingSnapshot>(() => getInitialSnapshot());
  const isApiMode = DATA_MODE === 'api';

  useEffect(() => {
    if (!isApiMode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  }, [isApiMode, snapshot]);

  const refreshFromApi = useCallback(async (): Promise<LendingSnapshot> => {
    const address = snapshot.wallet.address;
    const [offers, loans, oraclePrices, transactions, balances] = await Promise.all([
      offersApi.list(),
      loansApi.list(),
      oracleApi.list(),
      transactionsApi.list(),
      address ? fetchWalletBalances(address) : Promise.resolve(null),
    ]);

    let updatedWallet = snapshot.wallet;
    if (address && balances) {
      updatedWallet = {
        ...snapshot.wallet,
        balanceXLM: balances.balanceXLM,
        balanceUSDC: balances.balanceUSDC,
      };
    }

    setSnapshot((prev) => {
      return {
        ...prev,
        wallet: updatedWallet,
        offers,
        loans,
        oraclePrices,
        transactions,
      };
    });

    return {
      wallet: updatedWallet,
      offers,
      loans,
      oraclePrices,
      transactions,
    };
  }, [snapshot.wallet]);

  useEffect(() => {
    if (!isApiMode) return;
    void refreshFromApi().catch((error) => {
      message.error(error instanceof Error ? error.message : 'Unable to load backend data.');
    });
  }, [isApiMode, refreshFromApi]);

  const pushTransaction = useCallback((transaction: Transaction) => {
    if (isApiMode) {
      void transactionsApi.create(transaction)
        .then(() => refreshFromApi())
        .catch((error) => {
          message.error(error instanceof Error ? error.message : 'Unable to record transaction.');
        });
      return;
    }

    setSnapshot((prev) => ({
      ...prev,
      transactions: [transaction, ...prev.transactions],
    }));
  }, [isApiMode, refreshFromApi]);

  const connectWallet = useCallback((address: string, _role?: UserRole) => {
    const nextWallet: WalletState = {
      connected: true,
      address,
      role: null, // role is now optional/null for multi-role accounts
      balanceXLM: 250000,
      balanceUSDC: 50000,
    };
    setSnapshot((prev) => ({
      ...prev,
      wallet: nextWallet,
    }));

    if (isApiMode) {
      void fetchWalletBalances(address).then((balances) => {
        setSnapshot((prev) => {
          if (!prev.wallet.connected || prev.wallet.address !== address) return prev;
          return {
            ...prev,
            wallet: {
              ...prev.wallet,
              balanceXLM: balances.balanceXLM,
              balanceUSDC: balances.balanceUSDC,
            },
          };
        });
      });
    }
  }, [isApiMode]);

  const disconnectWallet = useCallback(() => {
    setSnapshot((prev) => ({
      ...prev,
      wallet: disconnectedWallet,
    }));
  }, []);

  const createOffer = useCallback(async (offer: CreateOfferInput) => {
    const { wallet } = snapshot;
    if (!wallet.connected || !wallet.address) {
      message.error('Connect your wallet before creating a loan offer.');
      return null;
    }
    const walletAddress = wallet.address;
    if (offer.maxLTV > offer.liquidationThreshold) {
      message.error('Max LTV must be less than or equal to liquidation threshold.');
      return null;
    }

    if (isApiMode) {
      const txRes = await runSorobanTransaction((onStage) =>
        marketplaceContract.createOfferTx(offer, walletAddress, onStage)
      );
      if (!txRes) return null;
      const extra = {
        ...txReceiptFromResult(txRes),
        contractOfferId: contractReturnId(txRes, 'contractOfferId'),
      };

      const created = await offersApi.create(offer, walletAddress, extra);
      await refreshFromApi();
      notification.success({
        message: 'Draft offer created',
        description: `${offer.amount.toLocaleString()} ${offer.asset} terms are saved. Fund the offer before activation.`,
      });
      return created;
    }

    const newOffer = offersService.create(offer, wallet.address);
    const transaction = transactionsService.create({
      type: 'CREATE_OFFER',
      user: wallet.address,
      amount: offer.amount,
      asset: offer.asset,
      offerId: newOffer.id,
      details: `Created offer ${newOffer.id} for ${offer.amount.toLocaleString()} ${offer.asset} at ${offer.apr}% APR.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      offers: [newOffer, ...prev.offers],
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: 'Draft offer created',
      description: 'Fund this offer to lock lender funds before marketplace activation.',
    });

    return newOffer;
  }, [isApiMode, refreshFromApi, snapshot]);

  const fundOffer = useCallback(async (offerId: string) => {
    const walletAddress = snapshot.wallet.address;
    const offer = snapshot.offers.find((item) => item.id === offerId);
    if (!offer) {
      message.error('Offer not found.');
      return null;
    }
    if (offer.status !== 'Draft') {
      message.error('Only Draft offers can be funded.');
      return null;
    }
    if (!walletAddress || offer.lender !== walletAddress) {
      message.error('Only the offer lender can fund this offer.');
      return null;
    }
    if (snapshot.wallet.balanceUSDC < offer.amount) {
      message.error('Insufficient USDC balance to fund this offer.');
      return null;
    }

    if (isApiMode) {
      const contractOfferId = offer.contractOfferId ?? offer.id;
      const txRes = await runSorobanTransaction((onStage) =>
        marketplaceContract.fundOfferTx(contractOfferId, walletAddress, onStage)
      );
      if (!txRes) return null;

      const funded = await offersApi.fund(offerId, walletAddress, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({ message: 'Offer funded', description: 'Lender funds are locked in Vault/Escrow.' });
      return funded;
    }

    const transaction = transactionsService.create({
      type: 'FUND_OFFER',
      user: offer.lender,
      amount: offer.amount,
      asset: offer.asset,
      offerId,
      details: `Funded offer ${offerId}; ${offer.amount.toLocaleString()} ${offer.asset} locked in escrow.`,
    });
    const updatedOffer = offersService.updateStatus(offer, 'Funding');

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceUSDC: prev.wallet.balanceUSDC - offer.amount,
      },
      offers: prev.offers.map((item) => (item.id === offerId ? updatedOffer : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({ message: 'Offer funded', description: 'Activate it to list it in the marketplace.' });
    return updatedOffer;
  }, [isApiMode, refreshFromApi, snapshot]);

  const activateOffer = useCallback(async (offerId: string) => {
    const walletAddress = snapshot.wallet.address;
    const offer = snapshot.offers.find((item) => item.id === offerId);
    if (!offer) {
      message.error('Offer not found.');
      return null;
    }
    if (offer.status !== 'Funding') {
      message.error('Only Funding offers can be activated.');
      return null;
    }
    if (!walletAddress || offer.lender !== walletAddress) {
      message.error('Only the offer lender can activate this offer.');
      return null;
    }

    if (isApiMode) {
      const contractOfferId = offer.contractOfferId ?? offer.id;
      const txRes = await runSorobanTransaction((onStage) =>
        marketplaceContract.activateOfferTx(contractOfferId, walletAddress, onStage)
      );
      if (!txRes) return null;

      const active = await offersApi.activate(offerId, walletAddress, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({ message: 'Offer activated', description: 'The offer is now visible in the marketplace.' });
      return active;
    }

    const transaction = transactionsService.create({
      type: 'ACTIVATE_OFFER',
      user: offer.lender,
      amount: offer.amount,
      asset: offer.asset,
      offerId,
      details: `Activated offer ${offerId}; borrower matching is now enabled.`,
    });
    const updatedOffer = offersService.updateStatus(offer, 'Active');

    setSnapshot((prev) => ({
      ...prev,
      offers: prev.offers.map((item) => (item.id === offerId ? updatedOffer : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({ message: 'Offer activated', description: 'The offer is now listed in the marketplace.' });
    return updatedOffer;
  }, [isApiMode, refreshFromApi, snapshot]);

  const cancelOffer = useCallback(async (offerId: string) => {
    const walletAddress = snapshot.wallet.address;
    const offer = snapshot.offers.find((item) => item.id === offerId);
    if (!offer) {
      message.error('Offer not found.');
      return;
    }
    if (!['Draft', 'Funding', 'Active'].includes(offer.status ?? 'Draft')) {
      message.error('Only Draft, Funding, or Active offers can be cancelled.');
      return;
    }
    if (!walletAddress || offer.lender !== walletAddress) {
      message.error('Only the offer lender can cancel this offer.');
      return;
    }

    if (isApiMode) {
      const contractOfferId = offer.contractOfferId ?? offer.id;
      const txRes = await runSorobanTransaction((onStage) =>
        marketplaceContract.cancelOfferTx(contractOfferId, walletAddress, onStage)
      );
      if (!txRes) return;

      await offersApi.cancel(offerId, walletAddress, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({ message: 'Offer cancelled', description: `${offerId} is no longer available.` });
      return;
    }

    const transaction = transactionsService.create({
      type: 'CANCEL_OFFER',
      user: offer.lender,
      amount: offer.amount,
      asset: offer.asset,
      offerId,
      details: `Cancelled offer ${offerId} and released ${offer.amount.toLocaleString()} ${offer.asset}.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceUSDC: offer.status === 'Funding' || offer.status === 'Active'
          ? prev.wallet.balanceUSDC + offer.amount
          : prev.wallet.balanceUSDC,
      },
      offers: prev.offers.map((item) => (item.id === offerId ? offersService.updateStatus(item, 'Cancelled') : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({ message: 'Offer cancelled', description: `${offerId} is no longer available.` });
  }, [isApiMode, refreshFromApi, snapshot]);

  const acceptOffer = useCallback(async (offerId: string, collateralAmount: number) => {
    const { wallet, oraclePrices } = snapshot;
    if (!wallet.connected || !wallet.address) {
      message.error('Connect your wallet before borrowing.');
      return null;
    }
    const walletAddress = wallet.address;

    const offer = snapshot.offers.find((item) => item.id === offerId);
    if (!offer || offer.status !== 'Active') {
      message.error('This offer is no longer available.');
      return null;
    }
    if (offer.lender === walletAddress) {
      message.error('You cannot borrow from your own offer.');
      return null;
    }
    if (collateralAmount <= 0) {
      message.error('Collateral amount must be greater than zero.');
      return null;
    }
    if (wallet.balanceXLM < collateralAmount) {
      message.error('Insufficient XLM balance for collateral.');
      return null;
    }

    const prices = getPrices(oraclePrices);
    const preview = loansService.previewBorrow(offer, collateralAmount, prices);
    if (preview.healthFactor < offer.minHealthFactor) {
      message.error(`Initial Health Factor must be at least ${offer.minHealthFactor.toFixed(2)}.`);
      return null;
    }

    if (isApiMode) {
      const contractOfferId = offer.contractOfferId ?? offer.id;
      const txRes = await runSorobanTransaction((onStage) =>
        marketplaceContract.acceptOfferTx(contractOfferId, walletAddress, collateralAmount, walletAddress, onStage)
      );
      if (!txRes) return null;
      const extra = {
        ...txReceiptFromResult(txRes),
        contractLoanId: contractReturnId(txRes, 'contractLoanId'),
      };
      const loan = await loansApi.acceptOffer(offer.id, walletAddress, collateralAmount, extra);
      await refreshFromApi();
      notification.success({
        message: 'Offer accepted',
        description: 'Loan is PendingCollateral. Activate it to lock collateral and receive funds.',
      });
      return loan;
    }

    const loan = loansService.createFromOffer(offer, wallet.address, collateralAmount, prices);
    const transaction = transactionsService.create({
      type: 'ACCEPT_OFFER',
      user: wallet.address,
      amount: collateralAmount,
      asset: offer.collateralAsset,
      loanId: loan.id,
      offerId,
      details: `Accepted offer ${offerId}; loan ${loan.id} is PendingCollateral with ${collateralAmount.toLocaleString()} XLM planned collateral.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      offers: prev.offers.map((item) => (item.id === offerId ? offersService.updateStatus(item, 'Matched', loan.id) : item)),
      loans: [loan, ...prev.loans],
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: 'Offer accepted',
      description: 'Activate the pending loan to lock collateral and receive funds.',
    });

    return loan;
  }, [isApiMode, refreshFromApi, snapshot]);

  const activateLoan = useCallback(async (loanId: string) => {
    const walletAddress = snapshot.wallet.address;
    const loan = snapshot.loans.find((item) => item.id === loanId);
    if (!loan) {
      message.error('Loan not found.');
      return null;
    }
    if (loan.status !== 'PendingCollateral') {
      message.error('Only PendingCollateral loans can be activated.');
      return null;
    }
    if (!walletAddress || walletAddress !== loan.borrower) {
      message.error('Only the borrower can activate this loan.');
      return null;
    }
    if (snapshot.wallet.balanceXLM < loan.collateralAmount) {
      message.error('Insufficient XLM balance for collateral.');
      return null;
    }
    const prices = getPrices(snapshot.oraclePrices);
    const previewLoan = loansService.activateLoan(loan, prices);
    if (previewLoan.healthFactor < (loan.minHealthFactor ?? 1.4)) {
      message.error(`Initial Health Factor must be at least ${(loan.minHealthFactor ?? 1.4).toFixed(2)}.`);
      return null;
    }

    if (isApiMode) {
      const contractLoanId = loan.contractLoanId ?? loan.id;
      const txRes = await runSorobanTransaction((onStage) =>
        loanManagerContract.activateLoanTx(contractLoanId, walletAddress, onStage)
      );
      if (!txRes) return null;

      const activated = await loansApi.activate(loanId, walletAddress, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({
        message: 'Loan activated',
        description: 'Collateral locked and loan asset transferred by Vault/Escrow.',
      });
      return activated;
    }

    const updatedLoan = previewLoan;
    const transaction = transactionsService.create({
      type: 'ACTIVATE_LOAN',
      user: loan.borrower,
      amount: loan.amount,
      asset: loan.asset,
      loanId,
      offerId: loan.offerId,
      details: `Activated loan ${loanId}; ${loan.collateralAmount.toLocaleString()} ${loan.collateralAsset} locked and ${loan.amount.toLocaleString()} ${loan.asset} released.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceXLM: prev.wallet.balanceXLM - loan.collateralAmount,
        balanceUSDC: prev.wallet.balanceUSDC + loan.amount,
      },
      loans: prev.loans.map((item) => (item.id === loanId ? updatedLoan : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: 'Loan activated',
      description: `Health Factor is ${updatedLoan.healthFactor.toFixed(2)}. Funds are now available after confirmation.`,
    });
    return updatedLoan;
  }, [isApiMode, refreshFromApi, snapshot]);

  const addCollateral = useCallback(async (loanId: string, amount: number) => {
    const walletAddress = snapshot.wallet.address;
    const loan = snapshot.loans.find((item) => item.id === loanId);
    if (!loan) {
      message.error('Loan not found.');
      return;
    }
    if (!walletAddress || walletAddress !== loan.borrower) {
      message.error('Only the borrower can add collateral.');
      return;
    }
    if (amount <= 0 || amount > snapshot.wallet.balanceXLM) {
      message.error('Invalid collateral amount.');
      return;
    }

    if (isApiMode) {
      const contractLoanId = loan.contractLoanId ?? loan.id;
      const txRes = await runSorobanTransaction((onStage) =>
        loanManagerContract.addCollateralTx(contractLoanId, amount, walletAddress, onStage)
      );
      if (!txRes) return;

      await loansApi.action(loanId, 'ADD_COLLATERAL', walletAddress, amount, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({ message: 'Collateral added', description: 'Backend Health Factor has been recalculated.' });
      return;
    }

    const prices = getPrices(snapshot.oraclePrices);
    const updatedLoan = loansService.addCollateral(loan, amount, prices);
    const transaction = transactionsService.create({
      type: 'ADD_COLLATERAL',
      user: loan.borrower,
      amount,
      asset: loan.collateralAsset,
      loanId,
      details: `Added ${amount.toLocaleString()} ${loan.collateralAsset} to ${loanId}. HF ${loan.healthFactor.toFixed(2)} -> ${updatedLoan.healthFactor.toFixed(2)}.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceXLM: prev.wallet.balanceXLM - amount,
      },
      loans: prev.loans.map((item) => (item.id === loanId ? updatedLoan : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({ message: 'Collateral added', description: `Health Factor is now ${updatedLoan.healthFactor.toFixed(2)}.` });
  }, [isApiMode, refreshFromApi, snapshot]);

  const repayLoan = useCallback(async (loanId: string, amount: number, isFullRepay: boolean) => {
    const walletAddress = snapshot.wallet.address;
    const loan = snapshot.loans.find((item) => item.id === loanId);
    if (!loan) {
      message.error('Loan not found.');
      return;
    }
    if (!walletAddress || walletAddress !== loan.borrower) {
      message.error('Only the borrower can repay this loan.');
      return;
    }
    const repayAmount = isFullRepay ? loan.outstandingDebt : amount;
    if (repayAmount <= 0 || repayAmount > loan.outstandingDebt + 0.01) {
      message.error('Invalid repayment amount.');
      return;
    }
    if (snapshot.wallet.balanceUSDC < repayAmount) {
      message.error('Insufficient USDC balance.');
      return;
    }

    if (isApiMode) {
      const contractLoanId = loan.contractLoanId ?? loan.id;
      const txRes = await runSorobanTransaction((onStage) =>
        isFullRepay
          ? loanManagerContract.fullRepayTx(contractLoanId, walletAddress, onStage)
          : loanManagerContract.partialRepayTx(contractLoanId, repayAmount, walletAddress, onStage)
      );
      if (!txRes) return;

      await loansApi.action(
        loanId,
        isFullRepay ? 'FULL_REPAY' : 'PARTIAL_REPAY',
        walletAddress,
        repayAmount,
        txReceiptFromResult(txRes)
      );
      await refreshFromApi();
      notification.success({
        message: isFullRepay ? 'Loan fully repaid' : 'Partial repayment complete',
        description: 'Backend loan state has been synced.',
      });
      return;
    }

    const prices = getPrices(snapshot.oraclePrices);
    const updatedLoan = loansService.repay(loan, repayAmount, isFullRepay, prices);
    const transaction = transactionsService.create({
      type: isFullRepay ? 'FULL_REPAY' : 'PARTIAL_REPAY',
      user: loan.borrower,
      amount: repayAmount,
      asset: loan.asset,
      loanId,
      details: isFullRepay
        ? `Fully repaid ${loanId}; ${loan.collateralAmount.toLocaleString()} ${loan.collateralAsset} collateral released.`
        : `Partially repaid ${repayAmount.toLocaleString()} ${loan.asset} on ${loanId}. HF ${loan.healthFactor.toFixed(2)} -> ${updatedLoan.healthFactor.toFixed(2)}.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceUSDC: prev.wallet.balanceUSDC - repayAmount,
        balanceXLM: isFullRepay ? prev.wallet.balanceXLM + loan.collateralAmount : prev.wallet.balanceXLM,
      },
      loans: prev.loans.map((item) => (item.id === loanId ? updatedLoan : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: isFullRepay ? 'Loan fully repaid' : 'Partial repayment complete',
      description: isFullRepay ? 'Collateral has been released after confirmation.' : `Health Factor is now ${updatedLoan.healthFactor.toFixed(2)}.`,
    });
  }, [isApiMode, refreshFromApi, snapshot]);

  const recalculateAllHealthFactors = useCallback(async (): Promise<OracleImpact[]> => {
    if (isApiMode) {
      const previousLoans = snapshot.loans;
      await oracleApi.recalculateHealth();
      const nextSnapshot = await refreshFromApi();
      return buildOracleImpacts(previousLoans, nextSnapshot.loans);
    }

    const prices = getPrices(snapshot.oraclePrices);
    const impacts: OracleImpact[] = [];
    const recalculated = snapshot.loans.map((loan) => {
      if (!isOpenLoanStatus(loan.status)) return loan;
      const updated = loansService.recalculate(loan, prices);
      if (updated.healthFactor !== loan.healthFactor || updated.status !== loan.status) {
        impacts.push({
          loanId: loan.id,
          oldHF: loan.healthFactor,
          newHF: updated.healthFactor,
          oldStatus: loan.status,
          newStatus: updated.status,
        });
      }
      return updated;
    });

    setSnapshot((prev) => ({
      ...prev,
      loans: recalculated,
    }));

    return impacts;
  }, [isApiMode, refreshFromApi, snapshot]);

  const updateOraclePrice = useCallback(async (newPrice: number): Promise<OracleImpact[]> => {
    if (newPrice <= 0) {
      message.error('Oracle price must be greater than zero.');
      return [];
    }
    const walletAddress = snapshot.wallet.address;
    if (!snapshot.wallet.connected || !walletAddress) {
      message.error('Connect the oracle admin wallet before updating prices.');
      return [];
    }

    if (isApiMode) {
      const previousLoans = snapshot.loans;
      const txRes = await runSorobanTransaction((onStage) =>
        oracleContract.updateOraclePriceTx(
          'XLM/USDC',
          'XLM',
          'USDC',
          newPrice,
          7,
          'Nexus Oracle Update',
          walletAddress,
          onStage
        )
      );
      if (!txRes) return [];

      await oracleApi.updateXlmPrice(newPrice, walletAddress, txReceiptFromResult(txRes));
      const nextSnapshot = await refreshFromApi();
      const impacts = buildOracleImpacts(previousLoans, nextSnapshot.loans);
      const liquidatableCount = nextSnapshot.loans.filter((loan) => isLiquidatable(loan.healthFactor, loan.status)).length;
      notification.success({
        message: 'Oracle price updated',
        description: `${impacts.length} loans recalculated. ${liquidatableCount} loans are now liquidatable.`,
      });
      return impacts;
    }

    const nextOraclePrices = oracleService.updateXlmPrice(snapshot.oraclePrices, newPrice);
    const prices = getPrices(nextOraclePrices);
    const impacts: OracleImpact[] = [];
    const nextLoans = snapshot.loans.map((loan) => {
      if (!isOpenLoanStatus(loan.status)) return loan;
      const updated = loansService.recalculate(loan, prices);
      impacts.push({
        loanId: loan.id,
        oldHF: loan.healthFactor,
        newHF: updated.healthFactor,
        oldStatus: loan.status,
        newStatus: updated.status,
      });
      return updated;
    });

    const user = walletAddress;
    const transaction = transactionsService.create({
      type: 'UPDATE_ORACLE',
      user,
      amount: newPrice,
      asset: 'XLM',
      details: `Updated XLM/USDC oracle price to $${newPrice.toFixed(4)} and recalculated ${impacts.length} open loans.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      oraclePrices: nextOraclePrices,
      loans: nextLoans,
      transactions: [transaction, ...prev.transactions],
    }));

    const liquidatableCount = nextLoans.filter((loan) => isLiquidatable(loan.healthFactor, loan.status)).length;
    notification.success({
      message: 'Oracle price updated',
      description: `${impacts.length} loans recalculated. ${liquidatableCount} loans are now liquidatable.`,
    });

    return impacts;
  }, [isApiMode, refreshFromApi, snapshot]);

  const liquidateLoan = useCallback(async (loanId: string, repayAmount: number) => {
    const walletAddress = snapshot.wallet.address;
    const loan = snapshot.loans.find((item) => item.id === loanId);
    if (!loan) {
      message.error('Loan not found.');
      return;
    }
    if (!snapshot.wallet.connected || !walletAddress) {
      message.error('Connect as a liquidator before liquidation.');
      return;
    }
    if (!isLiquidatable(loan.healthFactor, loan.status)) {
      message.error('Loan is not eligible for liquidation.');
      return;
    }
    const closeFactorAmount = loan.outstandingDebt * 0.5;
    if (repayAmount <= 0 || repayAmount > closeFactorAmount + 0.01) {
      message.error(`Repay amount must be between 0 and ${closeFactorAmount.toFixed(2)} USDC.`);
      return;
    }
    if (snapshot.wallet.balanceUSDC < repayAmount) {
      message.error('Insufficient USDC balance to liquidate.');
      return;
    }

    if (isApiMode) {
      const contractLoanId = loan.contractLoanId ?? loan.id;
      const txRes = await runSorobanTransaction((onStage) =>
        loanManagerContract.liquidateTx(contractLoanId, walletAddress, repayAmount, walletAddress, onStage)
      );
      if (!txRes) return;

      await loansApi.action(loanId, 'LIQUIDATE', walletAddress, repayAmount, txReceiptFromResult(txRes));
      await refreshFromApi();
      notification.success({
        message: 'Liquidation executed',
        description: 'Backend loan state has been updated.',
      });
      return;
    }

    const prices = getPrices(snapshot.oraclePrices);
    const result = loansService.liquidate(loan, repayAmount, prices);
    const transaction = transactionsService.create({
      type: 'LIQUIDATE',
      user: walletAddress,
      amount: repayAmount,
      asset: loan.asset,
      loanId,
      details: `Liquidated ${repayAmount.toFixed(2)} ${loan.asset} on ${loanId}; received ${result.collateralReceived.toFixed(2)} ${loan.collateralAsset}.`,
    });

    setSnapshot((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        balanceUSDC: prev.wallet.balanceUSDC - repayAmount,
        balanceXLM: prev.wallet.balanceXLM + result.collateralReceived,
      },
      loans: prev.loans.map((item) => (item.id === loanId ? result.loan : item)),
      transactions: [transaction, ...prev.transactions],
    }));

    notification.success({
      message: 'Liquidation executed',
      description: `Received ${result.collateralReceived.toFixed(2)} ${loan.collateralAsset} collateral after confirmation.`,
    });
  }, [isApiMode, refreshFromApi, snapshot]);



  const value = useMemo<LendingContextValue>(
    () => ({
      wallet: snapshot.wallet,
      currentUserWallet: snapshot.wallet.address,
      offers: snapshot.offers,
      loanOffers: snapshot.offers,
      loans: snapshot.loans,
      oraclePrices: snapshot.oraclePrices,
      transactions: snapshot.transactions,
      activities: snapshot.transactions,
      connectWallet,
      disconnectWallet,
      createOffer,
      createLoanOffer: async (offer) => {
        await createOffer(offer);
      },
      fundOffer,
      activateOffer,
      cancelOffer,
      acceptOffer,
      activateLoan,
      borrowLoan: async (offerId, collateralAmount) => {
        await acceptOffer(offerId, collateralAmount);
      },
      addCollateral,
      partialRepay: async (loanId, amount) => {
        await repayLoan(loanId, amount, false);
      },
      fullRepay: async (loanId) => {
        await repayLoan(loanId, 0, true);
      },
      repayLoan,
      updateOraclePrice,
      recalculateAllHealthFactors,
      liquidateLoan,
      addTransaction: pushTransaction,
    }),
    [
      acceptOffer,
      activateLoan,
      activateOffer,
      addCollateral,
      cancelOffer,
      connectWallet,
      createOffer,
      disconnectWallet,
      liquidateLoan,
      fundOffer,
      pushTransaction,
      recalculateAllHealthFactors,
      repayLoan,
      snapshot,
      updateOraclePrice,
    ]
  );

  return <LendingContext.Provider value={value}>{children}</LendingContext.Provider>;
};

// oxlint-disable-next-line react/only-export-components
export const useLending = (): LendingContextValue => {
  const context = useContext(LendingContext);
  if (!context) {
    throw new Error('useLending must be used within a LendingProvider');
  }
  return context;
};
