# PowerShell Integration Test Suite for MiniCluster Control Center
# Quick integration tests for CI/CD pipelines

$BASE_URL = "http://localhost:5147"
$PASS = 0
$FAIL = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body = $null
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            Headers = @{"Accept" = "application/json"}
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params -ErrorAction Stop
        Write-Host "✓ $Name" -ForegroundColor Green
        $script:PASS++
        return $response.Content
    }
    catch {
        Write-Host "✗ $Name - $($_.Exception.Message)" -ForegroundColor Red
        $script:FAIL++
        return $null
    }
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  INTEGRATION TESTS - MINICLUSTER API  " -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# Wait for server
Write-Host "Waiting for server..." -ForegroundColor Yellow
for ($i = 1; $i -le 20; $i++) {
    try {
        Invoke-WebRequest -Uri "$BASE_URL/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
        Write-Host "Server ready!`n" -ForegroundColor Green
        break
    }
    catch {
        Start-Sleep -Seconds 1
    }
}

# Run Tests
Test-Endpoint "Health Check" "GET" "$BASE_URL/api/health"

$result = Test-Endpoint "Get All Apps" "GET" "$BASE_URL/api/apps"

$varBody = @{
    name = "QuickTestVars"
    description = "Quick test"
    variables = @{ TEST_VAR = "value" }
    isActive = $true
}
$result = Test-Endpoint "Create Variable Group" "POST" "$BASE_URL/api/variables/groups" -Body $varBody
if ($result) {
    $varGroup = $result | ConvertFrom-Json
    $VAR_ID = $varGroup.id
}

Test-Endpoint "Get Variable Groups" "GET" "$BASE_URL/api/variables/groups"

$appBody = @{
    name = "Quick Test App"
    executablePath = "/bin/echo"
    arguments = "test"
    workingDirectory = "/tmp"
    autoStart = $false
}
$result = Test-Endpoint "Create App" "POST" "$BASE_URL/api/apps" -Body $appBody
if ($result) {
    $app = $result | ConvertFrom-Json
    $APP_ID = $app.id
}

Test-Endpoint "Get App by ID" "GET" "$BASE_URL/api/apps/$APP_ID"

$updateBody = @{
    name = "Updated App"
    executablePath = "/bin/echo"
    arguments = "updated"
    workingDirectory = "/tmp"
    autoStart = $false
    environmentVariables = @{}
}
Test-Endpoint "Update App" "PUT" "$BASE_URL/api/apps/$APP_ID" -Body $updateBody

Test-Endpoint "Start App" "POST" "$BASE_URL/api/apps/$APP_ID/exec/start"
Start-Sleep -Seconds 1

Test-Endpoint "Get App Status" "GET" "$BASE_URL/api/apps/$APP_ID/exec/status"

Test-Endpoint "Get Sessions" "GET" "$BASE_URL/api/apps/$APP_ID/sessions"

Test-Endpoint "Export Config" "GET" "$BASE_URL/api/apps/export"

Test-Endpoint "Delete App" "DELETE" "$BASE_URL/api/apps/$APP_ID"

if ($VAR_ID) {
    Test-Endpoint "Delete Variable Group" "DELETE" "$BASE_URL/api/variables/groups/$VAR_ID"
}

# Summary
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
$total = $PASS + $FAIL
Write-Host "Tests: $total | Passed: " -NoNewline -ForegroundColor Cyan
Write-Host $PASS -NoNewline -ForegroundColor Green
Write-Host " | Failed: " -NoNewline -ForegroundColor Cyan
Write-Host $FAIL -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

if ($FAIL -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Some tests failed!" -ForegroundColor Red
    exit 1
}
