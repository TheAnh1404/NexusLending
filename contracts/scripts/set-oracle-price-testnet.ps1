# set-oracle-price-testnet.ps1
# Updates the XLM/USDC oracle price using the asset contract pair consumed by Loan Manager.
$ErrorActionPreference = "Continue"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$contractsRoot = Resolve-Path "$scriptPath\.."
$workspaceRoot = Resolve-Path "$contractsRoot\.."

$jsonFile = "$workspaceRoot\deployments\testnet.json"
if (-not (Test-Path $jsonFile)) {
    Write-Error "Deployment file not found at $jsonFile. Please run deploy-testnet.ps1 first."
    exit 1
}

$deployments = Get-Content -Raw $jsonFile | ConvertFrom-Json
$oracleId = $deployments.contracts.oracle
$xlmAssetContract = if ($env:XLM_CONTRACT_ID) { $env:XLM_CONTRACT_ID } else { "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" }
$usdcAssetContract = if ($env:USDC_CONTRACT_ID) { $env:USDC_CONTRACT_ID } else { "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" }
$price = if ($env:XLM_USDC_PRICE) { $env:XLM_USDC_PRICE } else { "1250000" }
$source = if ($env:ORACLE_SOURCE) { $env:ORACLE_SOURCE } else { "Nexus Oracle" }

Write-Host ">>> Oracle ID: $oracleId" -ForegroundColor Cyan
Write-Host ">>> XLM Asset Contract: $xlmAssetContract" -ForegroundColor Cyan
Write-Host ">>> USDC Asset Contract: $usdcAssetContract" -ForegroundColor Cyan
Write-Host ">>> Setting XLM/USDC price to $price with 7 decimals..." -ForegroundColor Cyan

stellar contract invoke --id $oracleId --network testnet --source deployer -- set_price_for_assets --base_asset $xlmAssetContract --quote_asset $usdcAssetContract --asset_pair "XLM/USDC" --price $price --decimals 7 --source $source
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to set Oracle price"; exit 1 }

Write-Host ">>> Oracle asset-pair price updated successfully." -ForegroundColor Green
