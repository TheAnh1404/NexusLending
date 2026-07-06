import { Prisma, PrismaClient, RiskZone, LoanStatus } from '@prisma/client';

const prisma = new PrismaClient();

const lender = 'GDLENDER000000000000000000000000000000000000000000001';
const borrower = 'GDBORROWER000000000000000000000000000000000000000001';
const liquidator = 'GDLIQUIDATOR000000000000000000000000000000000000000001';
const oracleAdmin = 'ORACLE_ADMIN';

const price = new Prisma.Decimal('0.125');
const now = new Date();
const daysFromNow = (days: number): Date => new Date(now.getTime() + days * 86_400_000);

const riskForLoan = (
  collateralAmount: string,
  outstandingDebt: string,
  liquidationThresholdBps: number
): { healthFactor: Prisma.Decimal; ltv: Prisma.Decimal; riskZone: RiskZone; status: LoanStatus } => {
  const collateralValue = new Prisma.Decimal(collateralAmount).mul(price);
  const debt = new Prisma.Decimal(outstandingDebt);
  const healthFactor = debt.lte(0)
    ? new Prisma.Decimal(99.99)
    : collateralValue.mul(liquidationThresholdBps / 10_000).div(debt).toDecimalPlaces(2);
  const ltv = collateralValue.lte(0)
    ? new Prisma.Decimal(0)
    : debt.div(collateralValue).mul(100).toDecimalPlaces(2);
  const riskZone: RiskZone = healthFactor.gte(1.4)
    ? 'SAFE'
    : healthFactor.gte(1.2)
      ? 'WARNING'
      : 'LIQUIDATION_PLANNING';
  const status: LoanStatus = riskZone === 'SAFE'
    ? 'Active'
    : riskZone === 'WARNING'
      ? 'Warning'
      : 'LiquidationPlanning';

  return { healthFactor, ltv, riskZone, status };
};

async function main() {
  await prisma.transaction.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.loanOffer.deleteMany();
  await prisma.oraclePrice.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { wallet: lender, role: 'LENDER', displayName: 'Demo Lender' },
      { wallet: borrower, role: 'BORROWER', displayName: 'Demo Borrower' },
      { wallet: liquidator, role: 'LIQUIDATOR', displayName: 'Demo Liquidator' }
    ]
  });

  await prisma.oraclePrice.create({
    data: {
      assetPair: 'XLM/USDC',
      baseAsset: 'XLM',
      quoteAsset: 'USDC',
      price,
      decimals: 7,
      source: 'Nexus Demo Oracle',
      updatedAt: now
    }
  });

  await prisma.loanOffer.createMany({
    data: [
      {
        id: 'seed_offer_funding',
        lenderWallet: lender,
        loanAsset: 'USDC',
        loanAmount: '5000',
        fixedAprBps: 800,
        durationDays: 60,
        collateralAsset: 'XLM',
        maxLtvBps: 6000,
        liquidationThresholdBps: 7500,
        liquidationBonusBps: 500,
        gracePeriodDays: 3,
        minHealthFactorBps: 14000,
        status: 'Funding',
        description: 'Funded by lender and waiting for activation.'
      },
      {
        id: 'seed_offer_active',
        lenderWallet: lender,
        loanAsset: 'USDC',
        loanAmount: '8500',
        fixedAprBps: 950,
        durationDays: 90,
        collateralAsset: 'XLM',
        maxLtvBps: 5500,
        liquidationThresholdBps: 7500,
        liquidationBonusBps: 500,
        gracePeriodDays: 4,
        minHealthFactorBps: 14000,
        status: 'Active',
        description: 'Active marketplace offer ready for a borrower.'
      },
      {
        id: 'seed_offer_pending_matched',
        lenderWallet: lender,
        loanAsset: 'USDC',
        loanAmount: '1000',
        fixedAprBps: 1000,
        durationDays: 30,
        collateralAsset: 'XLM',
        maxLtvBps: 6500,
        liquidationThresholdBps: 7500,
        liquidationBonusBps: 500,
        gracePeriodDays: 3,
        minHealthFactorBps: 14000,
        status: 'Matched',
        description: 'Accepted offer with loan still PendingCollateral.'
      },
      {
        id: 'seed_offer_active_loan_matched',
        lenderWallet: lender,
        loanAsset: 'USDC',
        loanAmount: '3000',
        fixedAprBps: 800,
        durationDays: 60,
        collateralAsset: 'XLM',
        maxLtvBps: 6000,
        liquidationThresholdBps: 7500,
        liquidationBonusBps: 500,
        gracePeriodDays: 3,
        minHealthFactorBps: 14000,
        status: 'Matched',
        description: 'Matched offer backing an Active loan.'
      },
      {
        id: 'seed_offer_warning_matched',
        lenderWallet: lender,
        loanAsset: 'USDC',
        loanAmount: '5000',
        fixedAprBps: 850,
        durationDays: 75,
        collateralAsset: 'XLM',
        maxLtvBps: 6000,
        liquidationThresholdBps: 7500,
        liquidationBonusBps: 500,
        gracePeriodDays: 3,
        minHealthFactorBps: 14000,
        status: 'Matched',
        description: 'Matched offer backing a Warning loan.'
      },
      {
        id: 'seed_offer_liquidation_matched',
        lenderWallet: lender,
        loanAsset: 'USDC',
        loanAmount: '4000',
        fixedAprBps: 900,
        durationDays: 45,
        collateralAsset: 'XLM',
        maxLtvBps: 6000,
        liquidationThresholdBps: 7500,
        liquidationBonusBps: 500,
        gracePeriodDays: 3,
        minHealthFactorBps: 14000,
        status: 'Matched',
        description: 'Matched offer backing a LiquidationPlanning loan.'
      }
    ]
  });

  const seededLoans = [
    {
      id: 'seed_pending_collateral_loan',
      offerId: 'seed_offer_pending_matched',
      principal: '1000',
      outstandingDebt: '1008.22',
      fixedAprBps: 1000,
      collateralAmount: '16000',
      durationDays: 30,
      status: 'PendingCollateral' as LoanStatus
    },
    {
      id: 'seed_active_loan',
      offerId: 'seed_offer_active_loan_matched',
      principal: '3000',
      outstandingDebt: '3039.45',
      fixedAprBps: 800,
      collateralAmount: '50000',
      durationDays: 60
    },
    {
      id: 'seed_warning_loan',
      offerId: 'seed_offer_warning_matched',
      principal: '5000',
      outstandingDebt: '5080.00',
      fixedAprBps: 850,
      collateralAmount: '68000',
      durationDays: 75
    },
    {
      id: 'seed_liquidation_planning_loan',
      offerId: 'seed_offer_liquidation_matched',
      principal: '4000',
      outstandingDebt: '4075.00',
      fixedAprBps: 900,
      collateralAmount: '48000',
      durationDays: 45
    }
  ];

  for (const loan of seededLoans) {
    const risk = riskForLoan(loan.collateralAmount, loan.outstandingDebt, 7500);
    const isPending = loan.status === 'PendingCollateral';

    await prisma.loan.create({
      data: {
        id: loan.id,
        offerId: loan.offerId,
        lenderWallet: lender,
        borrowerWallet: borrower,
        loanAsset: 'USDC',
        principal: loan.principal,
        outstandingDebt: loan.outstandingDebt,
        fixedAprBps: loan.fixedAprBps,
        collateralAsset: 'XLM',
        collateralAmount: loan.collateralAmount,
        startTime: isPending ? null : now,
        dueTime: isPending ? null : daysFromNow(loan.durationDays),
        maxLtvBps: 6000,
        liquidationThresholdBps: 7500,
        liquidationBonusBps: 500,
        minHealthFactorBps: 14000,
        gracePeriodDays: 3,
        ...risk,
        status: loan.status ?? risk.status
      }
    });
  }

  await prisma.transaction.createMany({
    data: [
      {
        txHash: 'seed_tx_create_offer_active',
        type: 'CREATE_OFFER',
        wallet: lender,
        offerId: 'seed_offer_active',
        asset: 'USDC',
        amount: '8500',
        metadata: { details: 'Seeded Active offer created.' }
      },
      {
        txHash: 'seed_tx_fund_offer_funding',
        type: 'FUND_OFFER',
        wallet: lender,
        offerId: 'seed_offer_funding',
        asset: 'USDC',
        amount: '5000',
        metadata: { details: 'Seeded lender funds locked in Vault/Escrow.' }
      },
      {
        txHash: 'seed_tx_activate_offer_active',
        type: 'ACTIVATE_OFFER',
        wallet: lender,
        offerId: 'seed_offer_active',
        asset: 'USDC',
        amount: '8500',
        metadata: { details: 'Seeded offer moved to Active marketplace status.' }
      },
      {
        txHash: 'seed_tx_accept_offer_pending',
        type: 'ACCEPT_OFFER',
        wallet: borrower,
        offerId: 'seed_offer_pending_matched',
        loanId: 'seed_pending_collateral_loan',
        asset: 'XLM',
        amount: '16000',
        metadata: { details: 'Seeded borrower accepted an Active offer; loan is PendingCollateral.' }
      },
      {
        txHash: 'seed_tx_activate_loan_active',
        type: 'ACTIVATE_LOAN',
        wallet: borrower,
        offerId: 'seed_offer_active_loan_matched',
        loanId: 'seed_active_loan',
        asset: 'USDC',
        amount: '3000',
        metadata: { details: 'Seeded loan activation after HF >= 1.4.' }
      },
      {
        txHash: 'seed_tx_oracle_1',
        type: 'UPDATE_ORACLE',
        wallet: oracleAdmin,
        asset: 'XLM',
        amount: '0.125',
        metadata: { details: 'Seeded XLM/USDC oracle price.' }
      },
      {
        txHash: 'seed_tx_liquidation_candidate',
        type: 'HEALTH_RECALCULATION',
        wallet: oracleAdmin,
        loanId: 'seed_liquidation_planning_loan',
        asset: 'XLM',
        amount: '0.125',
        metadata: { details: 'Seeded LiquidationPlanning loan health factor.' }
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

