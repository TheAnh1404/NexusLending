interface RawContractEvent {
  id?: string;
  contractId?: string;
  topic?: unknown;
  topics?: unknown[];
  value?: unknown;
  ledger?: number;
  txHash?: string;
}

interface IndexedEventMapping {
  eventName: string;
  entity: 'offer' | 'loan' | 'oracle' | 'unknown';
  action: string;
  event: RawContractEvent;
}

const eventActionMap: Record<string, Omit<IndexedEventMapping, 'eventName' | 'event'>> = {
  offer_created: { entity: 'offer', action: 'create' },
  offer_funded: { entity: 'offer', action: 'fund' },
  offer_activated: { entity: 'offer', action: 'activate' },
  offer_cancelled: { entity: 'offer', action: 'cancel' },
  offer_expired: { entity: 'offer', action: 'expire' },
  offer_matched: { entity: 'offer', action: 'match' },
  loan_created: { entity: 'loan', action: 'create_pending' },
  loan_activated: { entity: 'loan', action: 'activate' },
  loan_state_updated: { entity: 'loan', action: 'refresh_state' },
  collateral_added: { entity: 'loan', action: 'add_collateral' },
  partial_repaid: { entity: 'loan', action: 'partial_repay' },
  loan_repaid: { entity: 'loan', action: 'full_repay' },
  loan_liquidated: { entity: 'loan', action: 'liquidate' },
  price_updated: { entity: 'oracle', action: 'update_price' }
};

const extractEventName = (event: RawContractEvent): string => {
  const topics = event.topics ?? (Array.isArray(event.topic) ? event.topic : [event.topic]);
  const firstTopic = topics.find((topic) => topic !== undefined);
  if (typeof firstTopic === 'string') return firstTopic;
  if (firstTopic && typeof firstTopic === 'object' && 'value' in firstTopic) {
    const value = (firstTopic as { value?: unknown }).value;
    return typeof value === 'string' ? value : 'unknown';
  }
  return 'unknown';
};

export const sorobanService = {
  mapContractEvent(event: RawContractEvent): IndexedEventMapping {
    const eventName = extractEventName(event);
    const mapping = eventActionMap[eventName] ?? { entity: 'unknown' as const, action: 'ignore' };
    return { eventName, event, ...mapping };
  },

  async fetchContractEvents(): Promise<IndexedEventMapping[]> {
    return [];
  }
};
