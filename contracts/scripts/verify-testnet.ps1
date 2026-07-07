# verify-testnet.ps1
# Verify deployments by querying the Oracle for the XLM/USDC price
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

Write-Host ">>> Querying oracle contract ($oracleId) for XLM/USDC price..." -ForegroundColor Cyan
$output = stellar contract invoke --id $oracleId --network testnet --source deployer -- get_price --asset_pair "XLM/USDC" 2>&1

Write-Host ">>> Oracle response:" -ForegroundColor Green
Write-Host $output

if ($output -match "price: 1250000" -or $output -match "1250000") {
    Write-Host ">>> Verification SUCCESS! Price is 1250000 (0.125 with 7 decimals)." -ForegroundColor Green
} else {
    Write-Warning ">>> Verification failed or returned unexpected data."
}
