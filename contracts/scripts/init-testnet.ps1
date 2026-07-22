# init-testnet.ps1
# Initialize all 4 contracts and set the initial price in the oracle
$ErrorActionPreference = "Continue"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$contractsRoot = Resolve-Path "$scriptPath\.."
$workspaceRoot = Resolve-Path "$contractsRoot\.."

$jsonFile = "$workspaceRoot\deployments\testnet.json"
if (-not (Test-Path $jsonFile)) {
    Write-Error "Deployment file not found at $jsonFile. Please run deploy-testnet.ps1 first."
    exit 1
}

Write-Host ">>> Loading deployments from $jsonFile..." -ForegroundColor Cyan
$deployments = Get-Content -Raw $jsonFile | ConvertFrom-Json

$oracleId = $deployments.contracts.oracle
$vaultId = $deployments.contracts.vault
$marketplaceId = $deployments.contracts.marketplace
$loanManagerId = $deployments.contracts.loanManager
$deployer = $deployments.deployer
$xlmAssetContract = if ($env:XLM_CONTRACT_ID) { $env:XLM_CONTRACT_ID } else { "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" }
$usdcAssetContract = if ($env:USDC_CONTRACT_ID) { $env:USDC_CONTRACT_ID } else { "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" }

Write-Host ">>> Deployer identity: $deployer" -ForegroundColor Cyan
Write-Host ">>> Oracle ID: $oracleId" -ForegroundColor Cyan
Write-Host ">>> Vault ID: $vaultId" -ForegroundColor Cyan
Write-Host ">>> Marketplace ID: $marketplaceId" -ForegroundColor Cyan
Write-Host ">>> Loan Manager ID: $loanManagerId" -ForegroundColor Cyan
Write-Host ">>> XLM Asset Contract: $xlmAssetContract" -ForegroundColor Cyan
Write-Host ">>> USDC Asset Contract: $usdcAssetContract" -ForegroundColor Cyan

# Step 1: Initialize Oracle
Write-Host ">>> Initializing Oracle contract..." -ForegroundColor Cyan
stellar contract invoke --id $oracleId --network testnet --source deployer -- initialize --admin $deployer
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to initialize Oracle"; exit 1 }

# Step 2: Initialize Vault
Write-Host ">>> Initializing Vault contract..." -ForegroundColor Cyan
stellar contract invoke --id $vaultId --network testnet --source deployer -- initialize --admin $deployer --marketplace_contract $marketplaceId --loan_manager_contract $loanManagerId
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to initialize Vault"; exit 1 }

# Step-3: Initialize Marketplace
Write-Host ">>> Initializing Marketplace contract..." -ForegroundColor Cyan
stellar contract invoke --id $marketplaceId --network testnet --source deployer -- initialize --admin $deployer --vault_contract $vaultId --loan_manager_contract $loanManagerId
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to initialize Marketplace"; exit 1 }

# Step 4: Initialize Loan Manager
Write-Host ">>> Initializing Loan Manager contract..." -ForegroundColor Cyan
stellar contract invoke --id $loanManagerId --network testnet --source deployer -- initialize --admin $deployer --marketplace_contract $marketplaceId --vault_contract $vaultId --oracle_contract $oracleId
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to initialize Loan Manager"; exit 1 }

# Step 5: Set Oracle price for XLM/USDC by asset contract pair
Write-Host ">>> Setting initial oracle price for XLM/USDC (0.125)..." -ForegroundColor Cyan
stellar contract invoke --id $oracleId --network testnet --source deployer -- set_price_for_assets --base_asset $xlmAssetContract --quote_asset $usdcAssetContract --asset_pair "XLM/USDC" --price 1250000 --decimals 7 --source "Nexus Oracle"
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to set Oracle price"; exit 1 }

Write-Host ">>> Initialization successfully completed!" -ForegroundColor Green
