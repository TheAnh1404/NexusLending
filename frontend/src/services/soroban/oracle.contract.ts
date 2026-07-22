import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { CONTRACTS, resolveAssetContractId } from './config';
import { buildAndSubmitTx } from './transaction';
import type { TxStage } from './transaction';
import { decimalToScaledBigInt } from './amounts';

export const oracleContract = {
  async updateOraclePriceTx(
    assetPair: string,
    baseAsset: string,
    quoteAsset: string,
    price: number,
    decimals: number,
    source: string,
    wallet: string,
    onStage?: (stage: TxStage) => void
  ) {
    const scPrice = decimalToScaledBigInt(price, decimals);
    const args = [
      Address.fromString(resolveAssetContractId(baseAsset)).toScVal(),
      Address.fromString(resolveAssetContractId(quoteAsset)).toScVal(),
      nativeToScVal(assetPair),
      nativeToScVal(scPrice), // i128
      nativeToScVal(decimals), // u32
      nativeToScVal(source),
    ];
    return buildAndSubmitTx(CONTRACTS.oracle, 'set_price_for_assets', args, wallet, onStage);
  }
};
