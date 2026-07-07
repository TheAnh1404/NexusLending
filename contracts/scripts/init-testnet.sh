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
VAULT_ID=$(node -e "console.log(require('$jsonFile').contracts.vault)")
MARKETPLACE_ID=$(node -e "console.log(require('$jsonFile').contracts.marketplace)")
LOAN_MANAGER_ID=$(node -e "console.log(require('$jsonFile').contracts.loanManager)")
DEPLOYER=$(node -e "console.log(require('$jsonFile').deployer)")

echo ">>> Deployer identity: $DEPLOYER"
echo ">>> Oracle ID: $ORACLE_ID"
echo ">>> Vault ID: $VAULT_ID"
echo ">>> Marketplace ID: $MARKETPLACE_ID"
echo ">>> Loan Manager ID: $LOAN_MANAGER_ID"

echo ">>> Initializing Oracle contract..."
stellar contract invoke --id "$ORACLE_ID" --network testnet --source deployer -- initialize --admin "$DEPLOYER"

echo ">>> Initializing Vault contract..."
stellar contract invoke --id "$VAULT_ID" --network testnet --source deployer -- initialize --admin "$DEPLOYER" --marketplace_contract "$MARKETPLACE_ID" --loan_manager_contract "$LOAN_MANAGER_ID"

echo ">>> Initializing Marketplace contract..."
stellar contract invoke --id "$MARKETPLACE_ID" --network testnet --source deployer -- initialize --admin "$DEPLOYER" --vault_contract "$VAULT_ID" --loan_manager_contract "$LOAN_MANAGER_ID"

echo ">>> Initializing Loan Manager contract..."
stellar contract invoke --id "$LOAN_MANAGER_ID" --network testnet --source deployer -- initialize --admin "$DEPLOYER" --vault_contract "$VAULT_ID" --oracle_contract "$ORACLE_ID"

echo ">>> Setting initial oracle price for XLM/USDC (0.125)..."
stellar contract invoke --id "$ORACLE_ID" --network testnet --source deployer -- set_price --asset_pair "XLM/USDC" --price 1250000 --decimals 7 --source "Nexus Oracle"

echo ">>> Initialization successfully completed!"
