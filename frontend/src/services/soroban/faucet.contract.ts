import { Address } from '@stellar/stellar-sdk';
import { CONTRACTS, isValidContractId, resolveAssetContractId } from './config';
import { buildAndSubmitTx } from './transaction';
import type { TxStage, TxResult } from './transaction';

export const faucetContract = {
  isConfigured(): boolean {
    return isValidContractId(CONTRACTS.faucet);
  },

  /**
   * Request Faucet test tokens via direct Soroban Smart Contract invocation with Freighter signing
   */
  async requestTokensTx(
    recipientAddress: string,
    assetCode: string,
    assetContractId?: string,
    onStage?: (stage: TxStage) => void
  ): Promise<TxResult> {
    if (!this.isConfigured()) {
      throw new Error('Soroban faucet contract is not configured. Set VITE_FAUCET_CONTRACT_ID after deploying the faucet contract.');
    }

    const resolvedAssetContractId = assetContractId && isValidContractId(assetContractId)
      ? assetContractId
      : resolveAssetContractId(assetCode);

    // Matches Soroban Rust function: request_tokens(env, recipient: Address, asset: Address)
    const args = [
      Address.fromString(recipientAddress).toScVal(), // recipient: Address
      Address.fromString(resolvedAssetContractId).toScVal(), // asset: Address
    ];

    return buildAndSubmitTx(CONTRACTS.faucet, 'request_tokens', args, recipientAddress, onStage);
  },
};
