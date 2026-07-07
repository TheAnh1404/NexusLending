#!/bin/bash
set -e

# Change directory to contracts root
cd "$(dirname "$0")/.."

echo ">>> Building Soroban contracts in release mode for target wasm32v1-none..."
cargo build --target wasm32v1-none --release

echo ">>> Optimizing built WASMs..."
WASM_DIR="target/wasm32v1-none/release"
CONTRACTS=("nexus_oracle_contract" "nexus_vault_contract" "nexus_marketplace_contract" "nexus_loan_manager_contract")

for contract in "${CONTRACTS[@]}"; do
  wasm_path="$WASM_DIR/$contract.wasm"
  if [ -f "$wasm_path" ]; then
    echo "Optimizing $contract.wasm..."
    stellar contract optimize --wasm "$wasm_path"
  else
    echo "Warning: WASM not found at $wasm_path"
  fi
done

echo ">>> Build and optimization completed successfully!"
