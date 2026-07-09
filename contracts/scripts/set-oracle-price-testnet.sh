#!/bin/bash
set -e

cd "$(dirname "$0")/.."

jsonFile="../deployments/testnet.json"
if [ ! -f "$jsonFile" ]; then
  echo "Deployment file not found at $jsonFile. Please run deploy-testnet.sh first."
  exit 1
fi

ORACLE_ID=$(node -e "console.log(require('$jsonFile').contracts.oracle)")
XLM_CONTRACT_ID="${XLM_CONTRACT_ID:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
USDC_CONTRACT_ID="${USDC_CONTRACT_ID:-CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA}"
XLM_USDC_PRICE="${XLM_USDC_PRICE:-1250000}"
ORACLE_SOURCE="${ORACLE_SOURCE:-Nexus Oracle}"

echo ">>> Oracle ID: $ORACLE_ID"
echo ">>> XLM Asset Contract: $XLM_CONTRACT_ID"
echo ">>> USDC Asset Contract: $USDC_CONTRACT_ID"
echo ">>> Setting XLM/USDC price to $XLM_USDC_PRICE with 7 decimals..."

stellar contract invoke --id "$ORACLE_ID" --network testnet --source deployer -- set_price_for_assets --base_asset "$XLM_CONTRACT_ID" --quote_asset "$USDC_CONTRACT_ID" --asset_pair "XLM/USDC" --price "$XLM_USDC_PRICE" --decimals 7 --source "$ORACLE_SOURCE"

echo ">>> Oracle asset-pair price updated successfully."
