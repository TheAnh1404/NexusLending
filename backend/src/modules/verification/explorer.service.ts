import { env } from '../../config/env';

export class ExplorerService {
  constructor(private readonly network = env.stellarNetwork) {}

  getTransactionUrl(txHash: string): string {
    const explorerNetwork = this.network === 'mainnet' || this.network === 'public'
      ? 'public'
      : 'testnet';
    return `https://stellar.expert/explorer/${explorerNetwork}/tx/${txHash}`;
  }

  getContractUrl(contractId: string): string {
    const explorerNetwork = this.network === 'mainnet' || this.network === 'public'
      ? 'public'
      : 'testnet';
    return `https://stellar.expert/explorer/${explorerNetwork}/contract/${contractId}`;
  }
}

export const explorerService = new ExplorerService();

