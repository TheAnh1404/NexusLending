# deploy-faucet-testnet.ps1
# Deploy a fresh Nexus faucet contract, configure USDC, pre-fund it, and update local config.
param(
    [string]$AssetCode = "USDC",
    [string]$Issuer = "",
    [string]$AssetContractId = "",
    [string]$ClaimAmountRaw = "10000000000",       # 1,000.0000000 USDC
    [string]$InitialFaucetBalanceRaw = "1000000000000", # 100,000.0000000 USDC
    [uint32]$CooldownLedgers = 8640                # ~12 hours on Stellar testnet
)

$ErrorActionPreference = "Continue"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$contractsRoot = Resolve-Path "$scriptPath\.."
$workspaceRoot = Resolve-Path "$contractsRoot\.."
$deploymentsPath = "$workspaceRoot\deployments\testnet.json"
$frontendEnvPath = "$workspaceRoot\frontend\.env"
$backendEnvPath = "$workspaceRoot\backend\.env"

function Get-DotEnvValue {
    param([string]$Path, [string]$Key)
    if (-not (Test-Path $Path)) { return "" }

    $line = Get-Content $Path | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } | Select-Object -Last 1
    if (-not $line) { return "" }

    return (($line -replace "^\s*$([regex]::Escape($Key))\s*=\s*", "").Trim().Trim('"').Trim("'"))
}

function Set-DotEnvValue {
    param([string]$Path, [string]$Key, [string]$Value)

    $line = "$Key=$Value"
    if (-not (Test-Path $Path)) {
        $line | Out-File -FilePath $Path -Encoding utf8
        return
    }

    $lines = @(Get-Content $Path)
    $updated = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$([regex]::Escape($Key))\s*=") {
            $lines[$i] = $line
            $updated = $true
        }
    }

    if (-not $updated) {
        $lines += $line
    }

    $lines | Out-File -FilePath $Path -Encoding utf8
}

function Get-ContractIdFromOutput {
    param([string[]]$Output)

    $lines = $Output | Where-Object { $_ -and $_.Trim() -ne "" }
    $found = @($lines | Where-Object { $_.Trim() -match "^C[A-Z0-9]{55}$" })
    if ($found.Count -gt 0) { return $found[-1].Trim() }

    return ""
}

if (-not (Test-Path $deploymentsPath)) {
    Write-Error "Deployment file not found: $deploymentsPath"
    exit 1
}

$deployerAddress = stellar keys address deployer
if ($LASTEXITCODE -ne 0 -or -not $deployerAddress) {
    Write-Error "Missing Stellar identity 'deployer'. Run: stellar keys generate deployer --network testnet --fund"
    exit 1
}
$deployerAddress = $deployerAddress.Trim()

if (-not $Issuer) {
    $Issuer = Get-DotEnvValue $frontendEnvPath "VITE_${AssetCode}_ISSUER"
}
if (-not $Issuer -and $AssetCode -eq "USDC") {
    $Issuer = Get-DotEnvValue $frontendEnvPath "VITE_USDC_ISSUER"
}
if (-not $Issuer) {
    Write-Error "Missing issuer. Set VITE_${AssetCode}_ISSUER in frontend/.env or pass -Issuer."
    exit 1
}

if (-not $AssetContractId) {
    $AssetContractId = Get-DotEnvValue $frontendEnvPath "VITE_${AssetCode}_CONTRACT_ID"
}
if (-not $AssetContractId) {
    Write-Host ">>> Deriving $AssetCode asset contract ID from issuer $Issuer..." -ForegroundColor Cyan
    $assetIdOutput = stellar contract id asset --asset "$AssetCode`:$Issuer" --network testnet 2>&1
    $AssetContractId = Get-ContractIdFromOutput $assetIdOutput
    if (-not $AssetContractId) {
        Write-Error "Could not derive asset contract ID. Output: $assetIdOutput"
        exit 1
    }
}

Write-Host ">>> Deployer: $deployerAddress" -ForegroundColor Cyan
Write-Host ">>> $AssetCode asset contract: $AssetContractId" -ForegroundColor Cyan

Set-Location $contractsRoot
$wasmDir = "$contractsRoot\target\wasm32v1-none\release"
$rawWasm = "$wasmDir\nexus_faucet_contract.wasm"
$optimizedWasm = "$wasmDir\nexus_faucet_contract.optimized.wasm"

if (-not (Test-Path $optimizedWasm)) {
    Write-Host ">>> Building faucet contract..." -ForegroundColor Cyan
    cargo build --target wasm32v1-none --release -p nexus-faucet-contract
    if ($LASTEXITCODE -ne 0) { exit 1 }

    Write-Host ">>> Optimizing faucet WASM..." -ForegroundColor Cyan
    stellar contract optimize --wasm $rawWasm
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host ">>> Deploying fresh faucet contract..." -ForegroundColor Cyan
$deployOutput = stellar contract deploy --wasm $optimizedWasm --network testnet --source deployer 2>&1
$faucetId = Get-ContractIdFromOutput $deployOutput
if (-not $faucetId) {
    Write-Error "Failed to deploy faucet. Output: $deployOutput"
    exit 1
}
Write-Host ">>> Faucet deployed: $faucetId" -ForegroundColor Green

Write-Host ">>> Initializing faucet admin..." -ForegroundColor Cyan
stellar contract invoke --id $faucetId --network testnet --source deployer -- initialize --admin $deployerAddress
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ">>> Enabling $AssetCode faucet config..." -ForegroundColor Cyan
stellar contract invoke --id $faucetId --network testnet --source deployer -- set_asset_config --asset $AssetContractId --claim_amount $ClaimAmountRaw --cooldown_ledgers $CooldownLedgers --enabled true
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ">>> Pre-funding faucet with $AssetCode..." -ForegroundColor Cyan
stellar contract invoke --id $AssetContractId --network testnet --source deployer -- mint --to $faucetId --amount $InitialFaucetBalanceRaw
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to pre-fund faucet. Make sure deployer is the $AssetCode issuer/admin, or fund $faucetId manually."
    exit 1
}

Write-Host ">>> Updating deployments/testnet.json and env files..." -ForegroundColor Cyan
$deployments = Get-Content -Raw $deploymentsPath | ConvertFrom-Json
$deployments.contracts | Add-Member -NotePropertyName faucet -NotePropertyValue $faucetId -Force
$deployments | Add-Member -NotePropertyName faucetDeployedAt -NotePropertyValue (Get-Date).ToString("o") -Force
$deployments | ConvertTo-Json -Depth 8 | Out-File -FilePath $deploymentsPath -Encoding utf8

Set-DotEnvValue $frontendEnvPath "VITE_FAUCET_CONTRACT_ID" $faucetId
Set-DotEnvValue $frontendEnvPath "VITE_${AssetCode}_ISSUER" $Issuer
Set-DotEnvValue $frontendEnvPath "VITE_${AssetCode}_CONTRACT_ID" $AssetContractId
Set-DotEnvValue $backendEnvPath "${AssetCode}_ISSUER" $Issuer
Set-DotEnvValue $backendEnvPath "${AssetCode}_CONTRACT_ID" $AssetContractId

Write-Host ">>> Faucet is ready." -ForegroundColor Green
Write-Host "FAUCET_CONTRACT_ID=$faucetId"
Write-Host "$AssetCode`_CONTRACT_ID=$AssetContractId"
