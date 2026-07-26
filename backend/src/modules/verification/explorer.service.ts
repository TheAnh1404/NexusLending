import { env, normalizeStellarNetworkName } from '../../config/env.js';

export class ExplorerService {
  constructor(private readonly network: string = env.stellarNetwork) {}

  getTransactionUrl(txHash: string): string {
    const explorerNetwork = normalizeStellarNetworkName(this.network) === 'public'
      ? 'public'
      : 'testnet';
    return `https://stellar.expert/explorer/${explorerNetwork}/tx/${txHash}`;
  }

  getContractUrl(contractId: string): string {
    const explorerNetwork = normalizeStellarNetworkName(this.network) === 'public'
      ? 'public'
      : 'testnet';
    return `https://stellar.expert/explorer/${explorerNetwork}/contract/${contractId}`;
  }
}

export const explorerService = new ExplorerService();
