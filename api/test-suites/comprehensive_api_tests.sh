#!/bin/bash

# Comprehensive API Testing Script
# Tests all endpoints of the MiniCluster Control Center API

set -e  # Exit on any error

BASE_URL="http://localhost:5147"
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_test() {
    echo -e "\n${BLUE}=== TEST $1: $2 ===${NC}"
    ((TOTAL_COUNT++))
}

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS_COUNT++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL_COUNT++))
}

check_response() {
    local response="$1"
    local expected_code="$2"
    local test_name="$3"
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expected_code" ]; then
        pass "$test_name (HTTP $http_code)"
        echo "$body"
        return 0
    else
        fail "$test_name (Expected HTTP $expected_code, got $http_code)"
        echo "$body"
        return 1
    fi
}

# Wait for server to be ready
wait_for_server() {
    echo -e "${YELLOW}Waiting for server to start...${NC}"
    for i in {1..30}; do
        if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}Server is ready!${NC}"
            return 0
        fi
        sleep 1
    done
    echo -e "${RED}Server failed to start${NC}"
    exit 1
}

echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  COMPREHENSIVE API TESTING - MINICLUSTER   ║${NC}"
echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"

wait_for_server

# ============================================
# 1. HEALTH CHECK
# ============================================
print_test "1" "Health Check"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health")
check_response "$RESPONSE" "200" "Health endpoint"

# ============================================
# 2. APPS CONTROLLER - GET ALL (empty)
# ============================================
print_test "2" "Get All Apps (Initially Empty)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps")
check_response "$RESPONSE" "200" "Get all apps"

# ============================================
# 3. VARIABLE GROUPS - CREATE
# ============================================
print_test "3" "Create Environment"
ENV_NAME="TestVars"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/envs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'$ENV_NAME'",
    "description": "Test environment",
    "variables": {
      "JAVA_HOME": "/usr/lib/jvm/java-11",
      "APP_PORT": "8080",
      "LOG_LEVEL": "DEBUG"
    },
    "isActive": true
  }')
if check_response "$RESPONSE" "201" "Create environment"; then
    echo "Environment Name: $ENV_NAME"
fi

# ============================================
# 4. VARIABLE GROUPS - GET ALL
# ============================================
print_test "4" "Get All Environments"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/envs")
check_response "$RESPONSE" "200" "Get all environments"

# ============================================
# 5. VARIABLE GROUPS - GET VARIABLES
# ============================================
print_test "5" "Get Variables from Group"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/envs/$ENV_NAME/variables")
check_response "$RESPONSE" "200" "Get variables from group"

# ============================================
# 6. VARIABLE GROUPS - UPDATE VARIABLES
# ============================================
print_test "6" "Update Variables in Group"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/api/envs/$ENV_NAME/variables" \
  -H "Content-Type: application/json" \
  -d '{
    "JAVA_HOME": "/usr/lib/jvm/java-11",
    "APP_PORT": "9090",
    "LOG_LEVEL": "INFO",
    "NEW_VAR": "new_value"
  }')
check_response "$RESPONSE" "204" "Update variables in group"

# ============================================
# 7. APPS - CREATE APP (Valid)
# ============================================
print_test "7" "Create Valid App"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Echo Test",
    "executablePath": "/bin/echo",
    "arguments": "Hello from MiniCluster!",
    "workingDirectory": "/tmp",
    "autoStart": false,
    "environmentVariables": {},
    "isExternal": false,
    "useShellExecute": false,
    "createNoWindow": true
  }')
if check_response "$RESPONSE" "201" "Create valid app"; then
    ECHO_APP_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.id')
    echo "Echo App ID: $ECHO_APP_ID"
fi

# ============================================
# 8. APPS - CREATE APP (Ping - Long Running)
# ============================================
print_test "8" "Create Long-Running Ping App"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Continuous Ping",
    "executablePath": "/usr/bin/ping",
    "arguments": "-c 10 8.8.8.8",
    "workingDirectory": "/tmp",
    "autoStart": false
  }')
if check_response "$RESPONSE" "201" "Create ping app"; then
    PING_APP_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.id')
    echo "Ping App ID: $PING_APP_ID"
fi

# ============================================
# 9. APPS - GET ALL (Should Have 2 Apps)
# ============================================
print_test "9" "Get All Apps (Should Have 2)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps")
if check_response "$RESPONSE" "200" "Get all apps"; then
    APP_COUNT=$(echo "$RESPONSE" | sed '$d' | jq 'length')
    echo "Total Apps: $APP_COUNT"
fi

# ============================================
# 10. APPS - GET BY ID
# ============================================
print_test "10" "Get App By ID"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$ECHO_APP_ID")
check_response "$RESPONSE" "200" "Get app by ID"

# ============================================
# 11. APPS - UPDATE APP
# ============================================
print_test "11" "Update App"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/api/apps/$ECHO_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Echo Test Updated",
    "executablePath": "/bin/echo",
    "arguments": "Updated message!",
    "workingDirectory": "/tmp",
    "autoStart": false,
    "environmentVariables": {"TEST_VAR": "test_value"}
  }')
check_response "$RESPONSE" "200" "Update app"

# ============================================
# 12. ENVIRONMENT - GET ENV VARS
# ============================================
print_test "12" "Get Environment Variables"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$ECHO_APP_ID/env")
check_response "$RESPONSE" "200" "Get environment variables"

# ============================================
# 13. ENVIRONMENT - UPDATE ENV VARS
# ============================================
print_test "13" "Update Environment Variables"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/api/apps/$ECHO_APP_ID/env" \
  -H "Content-Type: application/json" \
  -d '{
    "PATH": "/usr/local/bin:/usr/bin:/bin",
    "CUSTOM_VAR": "custom_value"
  }')
check_response "$RESPONSE" "200" "Update environment variables"

# ============================================
# 14. ARGUMENTS - GET ARGS
# ============================================
print_test "14" "Get App Arguments"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$ECHO_APP_ID/args")
check_response "$RESPONSE" "200" "Get app arguments"

# ============================================
# 15. ARGUMENTS - UPDATE ARGS
# ============================================
print_test "15" "Update App Arguments"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/api/apps/$ECHO_APP_ID/args" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": "New arguments for testing"
  }')
check_response "$RESPONSE" "200" "Update app arguments"

# ============================================
# 16. EXECUTION - START APP (Echo)
# ============================================
print_test "16" "Start Echo App"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps/$ECHO_APP_ID/exec/start")
check_response "$RESPONSE" "200" "Start echo app"
sleep 1  # Give it time to complete

# ============================================
# 17. EXECUTION - GET STATUS (Should be Stopped)
# ============================================
print_test "17" "Get App Status (Echo - Should Be Stopped)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$ECHO_APP_ID/exec/status")
check_response "$RESPONSE" "200" "Get echo app status"

# ============================================
# 18. SESSIONS - GET SESSIONS FOR APP
# ============================================
print_test "18" "Get Sessions for Echo App"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$ECHO_APP_ID/sessions")
if check_response "$RESPONSE" "200" "Get sessions"; then
    ECHO_SESSION_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.[0].sessionId')
    echo "Echo Session ID: $ECHO_SESSION_ID"
fi

# ============================================
# 19. SESSIONS - GET SESSION DETAILS
# ============================================
print_test "19" "Get Session Details"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$ECHO_APP_ID/sessions/$ECHO_SESSION_ID")
check_response "$RESPONSE" "200" "Get session details"

# ============================================
# 20. SESSIONS - GET SESSION LOGS
# ============================================
print_test "20" "Get Session Logs"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$ECHO_APP_ID/sessions/$ECHO_SESSION_ID/logs")
if check_response "$RESPONSE" "200" "Get session logs"; then
    LOG_COUNT=$(echo "$RESPONSE" | sed '$d' | jq 'length')
    echo "Log Entries: $LOG_COUNT"
fi

# ============================================
# 21. EXECUTION - START LONG-RUNNING APP
# ============================================
print_test "21" "Start Long-Running Ping App"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps/$PING_APP_ID/exec/start")
check_response "$RESPONSE" "200" "Start ping app"
sleep 2

# ============================================
# 22. EXECUTION - GET STATUS (Should be Running)
# ============================================
print_test "22" "Get Status (Ping - Should Be Running)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$PING_APP_ID/exec/status")
check_response "$RESPONSE" "200" "Get ping app status"

# ============================================
# 23. EXECUTION - STOP RUNNING APP
# ============================================
print_test "23" "Stop Running Ping App"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps/$PING_APP_ID/exec/stop")
check_response "$RESPONSE" "200" "Stop ping app"
sleep 1

# ============================================
# 24. EXECUTION - GET STATUS (Should be Stopped)
# ============================================
print_test "24" "Get Status (Ping - Should Be Stopped)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$PING_APP_ID/exec/status")
check_response "$RESPONSE" "200" "Get ping app status after stop"

# ============================================
# 25. SESSIONS - GET PING SESSIONS
# ============================================
print_test "25" "Get Ping App Sessions"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$PING_APP_ID/sessions")
if check_response "$RESPONSE" "200" "Get ping sessions"; then
    PING_SESSION_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.[0].sessionId')
    PING_EXIT_CODE=$(echo "$RESPONSE" | sed '$d' | jq -r '.[0].exitCode')
    echo "Ping Session ID: $PING_SESSION_ID"
    echo "Exit Code: $PING_EXIT_CODE (137 = killed, 0 = normal)"
fi

# ============================================
# 26. LOGS - SEARCH LOGS
# ============================================
print_test "26" "Search Logs for Ping App"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$PING_APP_ID/logs/search?page=1&pageSize=10")
if check_response "$RESPONSE" "200" "Search logs"; then
    TOTAL_LOGS=$(echo "$RESPONSE" | sed '$d' | jq -r '.total')
    echo "Total Log Entries Found: $TOTAL_LOGS"
fi

# ============================================
# 27. LIFECYCLE - GET APP HISTORY
# ============================================
print_test "27" "Get App Lifecycle History"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/$PING_APP_ID/history")
check_response "$RESPONSE" "200" "Get lifecycle history"

# ============================================
# 28. ERROR TEST - Start Non-Existent Executable
# ============================================
print_test "28" "Error Test: Non-Existent Executable"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid App",
    "executablePath": "/does/not/exist",
    "arguments": "test"
  }')
if check_response "$RESPONSE" "201" "Create invalid app"; then
    INVALID_APP_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.id')
    
    # Try to start it
    print_test "28b" "Start Invalid App (Should Fail with Error Details)"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps/$INVALID_APP_ID/exec/start")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "400" ]; then
        ERROR_MSG=$(echo "$BODY" | jq -r '.error')
        ERROR_DETAILS=$(echo "$BODY" | jq -r '.details')
        pass "Invalid app returned proper error"
        echo -e "  Error: $ERROR_MSG"
        echo -e "  Details: $ERROR_DETAILS"
    else
        fail "Expected HTTP 400 with error details, got $HTTP_CODE"
        echo "$BODY"
    fi
fi

# ============================================
# 29. ERROR TEST - Start Already Running App
# ============================================
print_test "29" "Error Test: Start Already Running App"
# First start the ping app
curl -s -X POST "$BASE_URL/api/apps/$PING_APP_ID/exec/start" > /dev/null
sleep 1

# Try to start it again
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps/$PING_APP_ID/exec/start")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "400" ]; then
    ERROR_MSG=$(echo "$BODY" | jq -r '.error')
    pass "Already running app returned proper error"
    echo -e "  Error: $ERROR_MSG"
else
    fail "Expected HTTP 400 for already running app, got $HTTP_CODE"
    echo "$BODY"
fi

# Stop it for cleanup
curl -s -X POST "$BASE_URL/api/apps/$PING_APP_ID/exec/stop" > /dev/null
sleep 1

# ============================================
# 30. IMPORT/EXPORT - Export Config
# ============================================
print_test "30" "Export Configuration"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps/export")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    pass "Export configuration"
    echo "$BODY" > /tmp/minicluster_export.json
    echo "Exported to /tmp/minicluster_export.json"
else
    fail "Export failed with HTTP $HTTP_CODE"
fi

# ============================================
# 31. IMPORT/EXPORT - Import Config
# ============================================
print_test "31" "Import Configuration"

# Create a test import file
cat > /tmp/minicluster_import.json << 'EOF'
{
  "Environments": [
    {
      "name": "ImportedVars",
      "description": "Imported environment",
      "variables": {
        "IMPORTED_VAR": "imported_value"
      },
      "isActive": false
    }
  ],
  "Apps": [
    {
      "name": "Imported Echo",
      "executablePath": "/bin/echo",
      "arguments": "Imported app test",
      "workingDirectory": "/tmp",
      "autoStart": false,
      "environmentVariables": {},
      "isExternal": false
    }
  ]
}
EOF

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/apps/import" \
  -F "file=@/tmp/minicluster_import.json")
check_response "$RESPONSE" "200" "Import configuration"

# ============================================
# 32. VERIFY IMPORT - Check if imported app exists
# ============================================
print_test "32" "Verify Imported App Exists"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/apps")
if check_response "$RESPONSE" "200" "Get apps after import"; then
    IMPORTED_APP=$(echo "$RESPONSE" | sed '$d' | jq '.[] | select(.name == "Imported Echo")')
    if [ -n "$IMPORTED_APP" ]; then
        pass "Imported app found in database"
        echo "$IMPORTED_APP"
    else
        fail "Imported app not found"
    fi
fi

# ============================================
# 33. CLEANUP - Delete Apps
# ============================================
print_test "33" "Cleanup: Delete Test Apps"
for APP_ID in $ECHO_APP_ID $PING_APP_ID $INVALID_APP_ID; do
    RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/apps/$APP_ID")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [ "$HTTP_CODE" == "204" ]; then
        pass "Deleted app $APP_ID"
    else
        fail "Failed to delete app $APP_ID (HTTP $HTTP_CODE)"
    fi
done

# ============================================
# 34. CLEANUP - Delete Environment
# ============================================
print_test "34" "Cleanup: Delete Environment"
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/envs/$ENV_NAME")
check_response "$RESPONSE" "204" "Delete environment"

# ============================================
# SUMMARY
# ============================================
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║              TEST SUMMARY                  ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════╝${NC}"
echo -e "Total Tests: ${BLUE}$TOTAL_COUNT${NC}"
echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "Failed: ${RED}$FAIL_COUNT${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    exit 0
else
    echo -e "\n${RED}❌ SOME TESTS FAILED${NC}"
    exit 1
fi
