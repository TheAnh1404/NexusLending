# build-all.ps1
# Build and optimize all 4 contracts: oracle, vault, marketplace, loan-manager
$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Resolve-Path "$scriptPath\.."

Write-Host ">>> Changing directory to workspace root: $workspaceRoot" -ForegroundColor Cyan
Set-Location $workspaceRoot

Write-Host ">>> Building Soroban contracts in release mode for target wasm32v1-none..." -ForegroundColor Cyan
cargo build --target wasm32v1-none --release

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build contracts"
    exit 1
}

Write-Host ">>> Optimizing built WASMs..." -ForegroundColor Cyan
$contracts = @("nexus_oracle_contract", "nexus_vault_contract", "nexus_marketplace_contract", "nexus_loan_manager_contract")
$wasmDir = "$workspaceRoot\target\wasm32v1-none\release"

foreach ($contract in $contracts) {
    $wasmFile = "$wasmDir\$contract.wasm"
    if (Test-Path $wasmFile) {
        Write-Host "Optimizing $contract.wasm..." -ForegroundColor Yellow
        stellar contract optimize --wasm $wasmFile
    } else {
        Write-Warning "Could not find WASM file for $contract at $wasmFile"
    }
}

Write-Host ">>> Build and optimization completed successfully!" -ForegroundColor Green
