# PowerShell API Test Suite for MiniCluster Control Center
# Comprehensive testing of all API endpoints

$BASE_URL = "http://localhost:5147"
$PASS_COUNT = 0
$FAIL_COUNT = 0

# Helper Functions
function Write-TestHeader {
    param([string]$Number, [string]$Name)
    Write-Host "`n=== TEST $Number`: $Name ===" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$Message)
    Write-Host "✓ PASS: $Message" -ForegroundColor Green
    $script:PASS_COUNT++
}

function Write-Fail {
    param([string]$Message)
    Write-Host "✗ FAIL: $Message" -ForegroundColor Red
    $script:FAIL_COUNT++
}

function Test-Api {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [int]$ExpectedCode
    )
    
    Write-TestHeader $script:TestNumber $Name
    $script:TestNumber++
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        }
        
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            UseBasicParsing = $true
        }
        
        if ($Body -and $Method -ne "GET") {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @params -ErrorAction Stop
        $statusCode = [int]$response.StatusCode
        
        if ($statusCode -eq $ExpectedCode) {
            Write-Pass "$Name (HTTP $statusCode)"
            if ($response.Content) {
                $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
            }
            return $response.Content
        } else {
            Write-Fail "$Name (Expected $ExpectedCode, got $statusCode)"
            return $null
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq $ExpectedCode) {
            Write-Pass "$Name (HTTP $statusCode)"
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $content | ConvertFrom-Json | ConvertTo-Json -Depth 5
            return $content
        } else {
            Write-Fail "$Name (Expected $ExpectedCode, got $statusCode)"
            Write-Host $_.Exception.Message -ForegroundColor Yellow
            return $null
        }
    }
}

function Wait-ForServer {
    Write-Host "`nWaiting for server to start..." -ForegroundColor Yellow
    for ($i = 1; $i -le 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "$BASE_URL/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            Write-Host "Server is ready!" -ForegroundColor Green
            return $true
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    Write-Host "Server failed to start!" -ForegroundColor Red
    exit 1
}

# Initialize test counter
$script:TestNumber = 1

Write-Host "═══════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  MINICLUSTER API COMPREHENSIVE TESTS  " -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════" -ForegroundColor Yellow

Wait-ForServer

Write-Host "`n📋 STARTING API TESTS`n" -ForegroundColor Cyan

# 1. Health Check
$result = Test-Api "Health Check" "GET" "$BASE_URL/api/health" -ExpectedCode 200

# 2. Get All Apps (Empty)
$result = Test-Api "Get All Apps (Empty)" "GET" "$BASE_URL/api/apps" -ExpectedCode 200

# 3. Create Environment
$script:ENV_NAME = "TestVars"
$varGroupBody = @{
    name = $ENV_NAME
    description = "Test environment"
    variables = @{
        VAR1 = "value1"
        VAR2 = "value2"
    }
    isActive = $true
}
$result = Test-Api "Create Environment" "POST" "$BASE_URL/api/envs" -Body $varGroupBody -ExpectedCode 201
if ($result) {
    Write-Host "Environment Name: $ENV_NAME" -ForegroundColor Magenta
}

# 4. Get Environments
$result = Test-Api "Get Environments" "GET" "$BASE_URL/api/envs" -ExpectedCode 200

# 5. Create Echo App
$echoAppBody = @{
    name = "Echo Test"
    executablePath = "/bin/echo"
    arguments = "Hello World"
    workingDirectory = "/tmp"
    autoStart = $false
    environmentVariables = @{}
}
$result = Test-Api "Create Echo App" "POST" "$BASE_URL/api/apps" -Body $echoAppBody -ExpectedCode 201
if ($result) {
    $app = $result | ConvertFrom-Json
    $script:ECHO_APP_ID = $app.id
    Write-Host "Echo App ID: $ECHO_APP_ID" -ForegroundColor Magenta
}

# 6. Create Ping App
$pingAppBody = @{
    name = "Ping Test"
    executablePath = "/usr/bin/ping"
    arguments = "-c 5 8.8.8.8"
    workingDirectory = "/tmp"
    autoStart = $false
}
$result = Test-Api "Create Ping App" "POST" "$BASE_URL/api/apps" -Body $pingAppBody -ExpectedCode 201
if ($result) {
    $app = $result | ConvertFrom-Json
    $script:PING_APP_ID = $app.id
    Write-Host "Ping App ID: $PING_APP_ID" -ForegroundColor Magenta
}

# 7. Get All Apps
$result = Test-Api "Get All Apps (Should Have 2)" "GET" "$BASE_URL/api/apps" -ExpectedCode 200

# 8. Get App By ID
$result = Test-Api "Get App By ID" "GET" "$BASE_URL/api/apps/$ECHO_APP_ID" -ExpectedCode 200

# 9. Update App
$updateBody = @{
    name = "Echo Updated"
    executablePath = "/bin/echo"
    arguments = "Updated!"
    workingDirectory = "/tmp"
    autoStart = $false
    environmentVariables = @{}
}
$result = Test-Api "Update App" "PUT" "$BASE_URL/api/apps/$ECHO_APP_ID" -Body $updateBody -ExpectedCode 200

# 10. Get Environment Variables
$result = Test-Api "Get Environment Variables" "GET" "$BASE_URL/api/apps/$ECHO_APP_ID/env" -ExpectedCode 200

# 11. Update Environment Variables
$envBody = @{
    TEST_VAR = "test_value"
    PATH = "/usr/bin"
}
$result = Test-Api "Update Environment Variables" "PUT" "$BASE_URL/api/apps/$ECHO_APP_ID/env" -Body $envBody -ExpectedCode 200

# 12. Get Arguments
$result = Test-Api "Get App Arguments" "GET" "$BASE_URL/api/apps/$ECHO_APP_ID/args" -ExpectedCode 200

# 13. Update Arguments
$argsBody = @{
    arguments = "New arguments"
}
$result = Test-Api "Update App Arguments" "PUT" "$BASE_URL/api/apps/$ECHO_APP_ID/args" -Body $argsBody -ExpectedCode 200

# 14. Start Echo App
$result = Test-Api "Start Echo App" "POST" "$BASE_URL/api/apps/$ECHO_APP_ID/exec/start" -ExpectedCode 200
Start-Sleep -Seconds 2

# 15. Get Echo Status
$result = Test-Api "Get Echo Status" "GET" "$BASE_URL/api/apps/$ECHO_APP_ID/exec/status" -ExpectedCode 200

# 16. Get Echo Sessions
$result = Test-Api "Get Echo Sessions" "GET" "$BASE_URL/api/apps/$ECHO_APP_ID/sessions" -ExpectedCode 200
if ($result) {
    $sessions = $result | ConvertFrom-Json
    if ($sessions.Count -gt 0) {
        $script:ECHO_SESSION_ID = $sessions[0].sessionId
        Write-Host "Echo Session ID: $ECHO_SESSION_ID" -ForegroundColor Magenta
    }
}

# 17. Get Session Details
if ($script:ECHO_SESSION_ID) {
    $result = Test-Api "Get Session Details" "GET" "$BASE_URL/api/apps/$ECHO_APP_ID/sessions/$ECHO_SESSION_ID" -ExpectedCode 200
}

# 18. Get Session Logs
if ($script:ECHO_SESSION_ID) {
    $result = Test-Api "Get Session Logs" "GET" "$BASE_URL/api/apps/$ECHO_APP_ID/sessions/$ECHO_SESSION_ID/logs" -ExpectedCode 200
}

# 19. Start Ping App
$result = Test-Api "Start Ping App" "POST" "$BASE_URL/api/apps/$PING_APP_ID/exec/start" -ExpectedCode 200
Start-Sleep -Seconds 2

# 20. Get Ping Status (Running)
$result = Test-Api "Get Ping Status (Running)" "GET" "$BASE_URL/api/apps/$PING_APP_ID/exec/status" -ExpectedCode 200

# 21. Stop Ping App
$result = Test-Api "Stop Ping App" "POST" "$BASE_URL/api/apps/$PING_APP_ID/exec/stop" -ExpectedCode 200
Start-Sleep -Seconds 1

# 22. Get Ping Status (Stopped)
$result = Test-Api "Get Ping Status (Stopped)" "GET" "$BASE_URL/api/apps/$PING_APP_ID/exec/status" -ExpectedCode 200

# 23. Get Ping Sessions
$result = Test-Api "Get Ping Sessions" "GET" "$BASE_URL/api/apps/$PING_APP_ID/sessions" -ExpectedCode 200

# 24. Search Logs
$result = Test-Api "Search Logs" "GET" "$BASE_URL/api/apps/$PING_APP_ID/logs/search?page=1&pageSize=10" -ExpectedCode 200

# 25. Get Lifecycle History
$result = Test-Api "Get Lifecycle History" "GET" "$BASE_URL/api/apps/$PING_APP_ID/history" -ExpectedCode 200

# 26. Create Invalid App
$invalidAppBody = @{
    name = "Invalid App"
    executablePath = "/does/not/exist"
    arguments = "test"
}
$result = Test-Api "Create Invalid App" "POST" "$BASE_URL/api/apps" -Body $invalidAppBody -ExpectedCode 201
if ($result) {
    $app = $result | ConvertFrom-Json
    $script:INVALID_APP_ID = $app.id
}

# 27. Start Invalid App (Should Fail)
if ($script:INVALID_APP_ID) {
    $result = Test-Api "Start Invalid App (Should Fail)" "POST" "$BASE_URL/api/apps/$INVALID_APP_ID/exec/start" -ExpectedCode 400
}

# 28. Start Already Running App
Invoke-WebRequest -Uri "$BASE_URL/api/apps/$PING_APP_ID/exec/start" -Method POST -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
Start-Sleep -Seconds 1
$result = Test-Api "Start Already Running App (Should Fail)" "POST" "$BASE_URL/api/apps/$PING_APP_ID/exec/start" -ExpectedCode 400
Invoke-WebRequest -Uri "$BASE_URL/api/apps/$PING_APP_ID/exec/stop" -Method POST -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null

# 29. Export Configuration
$result = Test-Api "Export Configuration" "GET" "$BASE_URL/api/apps/export" -ExpectedCode 200

# 30. Import Configuration
Write-TestHeader $script:TestNumber "Import Configuration"
$script:TestNumber++
$importData = @{
    Environments = @(
        @{
            name = "ImportedVars"
            description = "Test import"
            variables = @{
                IMP_VAR = "imp_value"
            }
            isActive = $false
        }
    )
    Apps = @(
        @{
            name = "Imported App"
            executablePath = "/bin/date"
            arguments = ""
            workingDirectory = "/tmp"
            autoStart = $false
            environmentVariables = @{}
            isExternal = $false
        }
    )
}

try {
    $jsonFile = [System.IO.Path]::GetTempFileName()
    $importData | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonFile -Encoding UTF8
    
    $boundary = [System.Guid]::NewGuid().ToString()
    $fileContent = [System.IO.File]::ReadAllBytes($jsonFile)
    $fileContentBase64 = [System.Convert]::ToBase64String($fileContent)
    
    # Using multipart/form-data with Invoke-WebRequest
    $fileBin = [System.IO.File]::ReadAllBytes($jsonFile)
    $enc = [System.Text.Encoding]::GetEncoding("iso-8859-1")
    $fileEnc = $enc.GetString($fileBin)
    
    $LF = "`r`n"
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"import.json`"",
        "Content-Type: application/json$LF",
        $fileEnc,
        "--$boundary--$LF"
    ) -join $LF

    $response = Invoke-WebRequest -Uri "$BASE_URL/api/apps/import" -Method POST `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $bodyLines -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
        Write-Pass "Import Configuration (HTTP 200)"
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
    }
    
    Remove-Item $jsonFile -ErrorAction SilentlyContinue
}
catch {
    Write-Fail "Import Configuration - $($_.Exception.Message)"
}

# 31. Verify Imported App
$result = Test-Api "Verify Imported App" "GET" "$BASE_URL/api/apps" -ExpectedCode 200

# Cleanup
Write-Host "`n🧹 CLEANUP" -ForegroundColor Yellow

if ($script:ECHO_APP_ID) {
    $result = Test-Api "Delete Echo App" "DELETE" "$BASE_URL/api/apps/$ECHO_APP_ID" -ExpectedCode 204
}

if ($script:PING_APP_ID) {
    $result = Test-Api "Delete Ping App" "DELETE" "$BASE_URL/api/apps/$PING_APP_ID" -ExpectedCode 204
}

if ($script:INVALID_APP_ID) {
    $result = Test-Api "Delete Invalid App" "DELETE" "$BASE_URL/api/apps/$INVALID_APP_ID" -ExpectedCode 204
}

if ($script:ENV_NAME) {
    $result = Test-Api "Delete Environment" "DELETE" "$BASE_URL/api/envs/$ENV_NAME" -ExpectedCode 204
}

# Summary
Write-Host "`n═══════════════════════════════════════" -ForegroundColor Yellow
Write-Host "          TEST SUMMARY" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════" -ForegroundColor Yellow
$total = $PASS_COUNT + $FAIL_COUNT
Write-Host "Total Tests: $total" -ForegroundColor Cyan
Write-Host "Passed: $PASS_COUNT" -ForegroundColor Green
Write-Host "Failed: $FAIL_COUNT" -ForegroundColor Red

if ($FAIL_COUNT -eq 0) {
    Write-Host "`n🎉 ALL TESTS PASSED! 🎉" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
