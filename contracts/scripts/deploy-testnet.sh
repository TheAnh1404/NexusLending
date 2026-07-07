#!/bin/bash
set -e

# Change directory to contracts root
cd "$(dirname "$0")/.."

echo ">>> Checking if deployer identity exists..."
if ! stellar keys address deployer &>/dev/null; then
  echo ">>> Generating and funding new deployer key..."
  stellar keys generate deployer --network testnet --fund
fi

DEPLOYER_ADDRESS=$(stellar keys address deployer)
echo ">>> Deployer identity: deployer ($DEPLOYER_ADDRESS)"

WASM_DIR="target/wasm32v1-none/release"
oracle_wasm="$WASM_DIR/nexus_oracle_contract.optimized.wasm"
vault_wasm="$WASM_DIR/nexus_vault_contract.optimized.wasm"
marketplace_wasm="$WASM_DIR/nexus_marketplace_contract.optimized.wasm"
loanManager_wasm="$WASM_DIR/nexus_loan_manager_contract.optimized.wasm"

echo ">>> Deploying oracle contract..."
ORACLE_ID=$(stellar contract deploy --wasm "$oracle_wasm" --network testnet --source deployer | grep -E '^C[A-Z0-9]{55}$' | tail -n 1)

echo ">>> Deploying vault contract..."
VAULT_ID=$(stellar contract deploy --wasm "$vault_wasm" --network testnet --source deployer | grep -E '^C[A-Z0-9]{55}$' | tail -n 1)

echo ">>> Deploying marketplace contract..."
MARKETPLACE_ID=$(stellar contract deploy --wasm "$marketplace_wasm" --network testnet --source deployer | grep -E '^C[A-Z0-9]{55}$' | tail -n 1)

echo ">>> Deploying loan-manager contract..."
LOAN_MANAGER_ID=$(stellar contract deploy --wasm "$loanManager_wasm" --network testnet --source deployer | grep -E '^C[A-Z0-9]{55}$' | tail -n 1)

echo ">>> Oracle ID: $ORACLE_ID"
echo ">>> Vault ID: $VAULT_ID"
echo ">>> Marketplace ID: $MARKETPLACE_ID"
echo ">>> Loan Manager ID: $LOAN_MANAGER_ID"

# Save to testnet.json
mkdir -p ../deployments
cat <<EOF > ../deployments/testnet.json
{
  "network": "testnet",
  "rpcUrl": "https://soroban-testnet.stellar.org:443",
  "contracts": {
    "oracle": "$ORACLE_ID",
    "vault": "$VAULT_ID",
    "marketplace": "$MARKETPLACE_ID",
    "loanManager": "$LOAN_MANAGER_ID"
  },
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$DEPLOYER_ADDRESS"
}
EOF

echo ">>> Saved deployment IDs to deployments/testnet.json"
