import { Address, StrKey } from '@stellar/stellar-sdk';
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

    const cleanRecipient = (recipientAddress ?? '').trim();
    if (!StrKey.isValidEd25519PublicKey(cleanRecipient)) {
      throw new Error(`Invalid wallet address format: '${recipientAddress}'. Must be a valid Stellar public key (56 characters starting with G).`);
    }

    const rawContractId = (assetContractId ?? '').trim();
    const resolvedAssetContractId = rawContractId && isValidContractId(rawContractId)
      ? rawContractId
      : resolveAssetContractId(assetCode);

    if (!isValidContractId(resolvedAssetContractId)) {
      throw new Error(`Invalid asset contract ID for ${assetCode}: '${resolvedAssetContractId}'.`);
    }

    // Matches Soroban Rust function: request_tokens(env, recipient: Address, asset: Address)
    const args = [
      Address.fromString(cleanRecipient).toScVal(),
      Address.fromString(resolvedAssetContractId).toScVal(),
    ];

    return buildAndSubmitTx(CONTRACTS.faucet, 'request_tokens', args, cleanRecipient, onStage);
  },
};
