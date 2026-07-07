# deploy-testnet.ps1
# Deploy all 4 contracts to Stellar Testnet and generate deployments/testnet.json
$ErrorActionPreference = "Continue"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$contractsRoot = Resolve-Path "$scriptPath\.."
$workspaceRoot = Resolve-Path "$contractsRoot\.."

Write-Host ">>> Checking if deployer identity exists..." -ForegroundColor Cyan
try {
    $deployerAddress = stellar keys address deployer 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "deployer key does not exist"
    }
} catch {
    Write-Host ">>> Generating and funding new deployer key..." -ForegroundColor Yellow
    stellar keys generate deployer --network testnet --fund
    $deployerAddress = stellar keys address deployer
}

Write-Host ">>> Deployer identity: deployer ($deployerAddress)" -ForegroundColor Green

$wasmDir = "$contractsRoot\target\wasm32v1-none\release"
$contracts = @{
    "oracle" = "$wasmDir\nexus_oracle_contract.optimized.wasm"
    "vault" = "$wasmDir\nexus_vault_contract.optimized.wasm"
    "marketplace" = "$wasmDir\nexus_marketplace_contract.optimized.wasm"
    "loanManager" = "$wasmDir\nexus_loan_manager_contract.optimized.wasm"
}

$deployments = @{}

foreach ($cName in @("oracle", "vault", "marketplace", "loanManager")) {
    $wasmFile = $contracts[$cName]
    if (-not (Test-Path $wasmFile)) {
        Write-Error "WASM file not found: $wasmFile. Make sure to run build-all.ps1 first."
        exit 1
    }

    Write-Host ">>> Deploying $cName contract..." -ForegroundColor Cyan
    $output = stellar contract deploy --wasm $wasmFile --network testnet --source deployer 2>&1
    
    # Parse last line which is contract ID
    $lines = $output -split "`r?`n" | Where-Object { $_ -ne "" }
    $contractId = $lines[-1].Trim()
    
    if ($contractId -notmatch "^C[A-Z0-9]{55}$") {
        # Search the lines for standard Contract ID
        $found = $lines | Where-Object { $_ -match "^C[A-Z0-9]{55}$" }
        if ($found) {
            $contractId = $found[-1].Trim()
        }
    }

    if (-not $contractId -or $contractId -notmatch "^C[A-Z0-9]{55}$") {
        Write-Error "Failed to deploy $cName. Output: $output"
        exit 1
    }

    Write-Host ">>> Deployed $cName successfully! Contract ID: $contractId" -ForegroundColor Green
    $deployments[$cName] = $contractId
}

$deployedAt = (Get-Date).ToString("o")
$json = @{
    "network" = "testnet"
    "rpcUrl" = "https://soroban-testnet.stellar.org:443"
    "contracts" = @{
        "oracle" = $deployments["oracle"]
        "vault" = $deployments["vault"]
        "marketplace" = $deployments["marketplace"]
        "loanManager" = $deployments["loanManager"]
    }
    "deployedAt" = $deployedAt
    "deployer" = $deployerAddress
} | ConvertTo-Json -Depth 5

$deploymentsDir = "$workspaceRoot\deployments"
if (-not (Test-Path $deploymentsDir)) {
    New-Item -ItemType Directory -Path $deploymentsDir | Out-Null
}

$jsonFile = "$deploymentsDir\testnet.json"
$json | Out-File -FilePath $jsonFile -Encoding utf8
Write-Host ">>> Saved deployment IDs to $jsonFile" -ForegroundColor Green
