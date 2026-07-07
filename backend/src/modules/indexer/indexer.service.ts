import { rpc, scValToNative } from '@stellar/stellar-sdk';
import { env } from '../../config/env';

export class IndexerService {
  private rpcServer: rpc.Server;
  private isRunning: boolean = false;
  private pollIntervalMs: number = 10000; // Poll every 10 seconds
  private lastIndexedLedger: number = 0;

  constructor() {
    this.rpcServer = new rpc.Server(env.stellarRpcUrl || 'https://soroban-testnet.stellar.org');
  }

  /**
   * Start the indexer background polling loop
   */
  public start() {
    if (this.isRunning) {
      console.warn('Indexer Service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting Soroban Event Indexer Service...');
    this.pollLoop();
  }

  /**
   * Stop the indexer loop
   */
  public stop() {
    this.isRunning = false;
    console.log('Stopping Soroban Event Indexer Service...');
  }

  private async pollLoop() {
    while (this.isRunning) {
      try {
        await this.pollEvents();
      } catch (error) {
        console.error('Error polling Soroban events:', error);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  private async pollEvents() {
    // 1. Fetch current ledger count
    const latestLedgerRes = await this.rpcServer.getLatestLedger();
    const latestLedger = latestLedgerRes.sequence;

    if (this.lastIndexedLedger === 0) {
      this.lastIndexedLedger = latestLedger - 100; // Start index 100 ledgers back
    }

    if (this.lastIndexedLedger >= latestLedger) {
      return;
    }

    console.log(`Polling Soroban events from ledger ${this.lastIndexedLedger} to ${latestLedger}...`);

    // 2. Query events filter by our contract IDs
    const contractIds = [
      env.marketplaceContractId,
      env.loanManagerContractId,
      env.oracleContractId,
      env.vaultContractId
    ].filter(Boolean);

    if (contractIds.length === 0) {
      this.lastIndexedLedger = latestLedger;
      return;
    }

    const eventsResponse = await this.rpcServer.getEvents({
      startLedger: this.lastIndexedLedger,
      filters: [
        {
          type: 'contract',
          contractIds,
        },
      ],
      limit: 100,
    });

    // 3. Process events
    for (const event of eventsResponse.events) {
      try {
        await this.processEvent(event);
      } catch (err) {
        console.error(`Failed to process event ${event.id}:`, err);
      }
    }

    this.lastIndexedLedger = latestLedger + 1;
  }

  private async processEvent(event: rpc.Api.EventResponse) {
    const topics = event.topic;
    if (topics.length === 0) return;

    // Convert topics[0] to string (the event name/type)
    const eventName = scValToNative(topics[0]);
    console.log(`Discovered event: ${eventName} on contract ${event.contractId} (Tx: ${event.txHash})`);

    // Implement parser based on topic symbol types:
    // e.g. "offer_created", "offer_funded", "offer_activated", "offer_accepted", "loan_activated", "collateral_added"
    switch (eventName) {
      case 'offer_created':
        await this.handleOfferCreated(event);
        break;
      case 'offer_funded':
        await this.handleOfferFunded(event);
        break;
      case 'offer_activated':
        await this.handleOfferActivated(event);
        break;
      case 'offer_accepted':
        await this.handleOfferAccepted(event);
        break;
      case 'loan_activated':
        await this.handleLoanActivated(event);
        break;
      case 'collateral_added':
        await this.handleCollateralAdded(event);
        break;
      case 'loan_repaid':
        await this.handleLoanRepaid(event);
        break;
      case 'loan_liquidated':
        await this.handleLoanLiquidated(event);
        break;
      default:
        console.log(`Unhandling or unneeded event type: ${eventName}`);
    }
  }

  private async handleOfferCreated(event: rpc.Api.EventResponse) {
    // Sync offer to postgres if not already present
  }

  private async handleOfferFunded(event: rpc.Api.EventResponse) {
    // Mark status = 'Funding'
  }

  private async handleOfferActivated(event: rpc.Api.EventResponse) {
    // Mark status = 'Active'
  }

  private async handleOfferAccepted(event: rpc.Api.EventResponse) {
    // Create new Loan record matched from offer
  }

  private async handleLoanActivated(event: rpc.Api.EventResponse) {
    // Mark Loan as active
  }

  private async handleCollateralAdded(event: rpc.Api.EventResponse) {
    // Increment collateral and recalculate health
  }

  private async handleLoanRepaid(event: rpc.Api.EventResponse) {
    // Record payment details
  }

  private async handleLoanLiquidated(event: rpc.Api.EventResponse) {
    // Update loan to liquidated state
  }
}

export const indexerService = new IndexerService();
