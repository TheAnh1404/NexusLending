#!/bin/bash
set -e

# Change directory to contracts root
cd "$(dirname "$0")/.."

jsonFile="../deployments/testnet.json"
if [ ! -f "$jsonFile" ]; then
  echo "Deployment file not found at $jsonFile. Please run deploy-testnet.sh first."
  exit 1
fi

ORACLE_ID=$(node -e "console.log(require('$jsonFile').contracts.oracle)")
XLM_CONTRACT_ID="${XLM_CONTRACT_ID:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
USDC_CONTRACT_ID="${USDC_CONTRACT_ID:-CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA}"

echo ">>> Querying oracle contract ($ORACLE_ID) for XLM/USDC asset-pair price..."
OUTPUT=$(stellar contract invoke --id "$ORACLE_ID" --network testnet --source deployer -- get_price_for_assets --base_asset "$XLM_CONTRACT_ID" --quote_asset "$USDC_CONTRACT_ID" 2>&1)

echo ">>> Oracle response:"
echo "$OUTPUT"

if echo "$OUTPUT" | grep -q "1250000"; then
  echo ">>> Verification SUCCESS! Price is 1250000 (0.125 with 7 decimals)."
else
  echo ">>> Verification failed or returned unexpected data."
fi
