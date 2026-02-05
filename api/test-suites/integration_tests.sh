#!/bin/bash
set +e  # Don't exit on errors, we want to run all tests

echo "============================================"
echo "MiniCluster API Integration Tests"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5147"
PASSED=0
FAILED=0

# Wait for server to be ready
echo -n "Waiting for server to start..."
for i in {1..30}; do
    if curl -s "$BASE_URL/api/apps" > /dev/null 2>&1; then
        echo " Ready!"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Test function
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_status="${3:-200}"
    
    echo -n "Testing: $test_name ... "
    
    response=$(eval "$command" 2>&1)
    status=$?
    
    if [ $status -eq 0 ]; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
        if [ ! -z "$4" ]; then
            echo "  Response: $response" | head -3
        fi
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Error: $response"
        ((FAILED++))
    fi
}

echo "=== Basic Endpoint Tests ==="
run_test "GET /api/apps" "curl -s -f $BASE_URL/api/apps" 200
run_test "GET /api/envs" "curl -s -f $BASE_URL/api/envs" 200
run_test "GET /health" "curl -s -f $BASE_URL/health" 200
run_test "GET /logs/stats" "curl -s -f $BASE_URL/api/logs/stats" 200

echo ""
echo "=== Environments Tests ==="
# Create environment
ENV_NAME="TestEnv"
curl -s -X POST $BASE_URL/api/envs \
  -H "Content-Type: application/json" \
  -d '{"name":"'$ENV_NAME'","description":"Test","variables":{"VAR1":"value1"},"isActive":true}' \
  > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}: Created environment: $ENV_NAME"
    ((PASSED++))
    
    run_test "GET environment by name" "curl -s -f $BASE_URL/api/envs/$ENV_NAME" 200
    run_test "GET active environment" "curl -s -f $BASE_URL/api/envs/active" 200
else
    echo -e "${RED}FAIL${NC}: Failed to create environment"
    ((FAILED++))
fi

echo ""
echo "=== App Management Tests ==="
# Create app
APP_ID=$(curl -s -X POST $BASE_URL/api/apps \
  -H "Content-Type: application/json" \
  -d '{"name":"TestApp","executablePath":"/bin/echo","arguments":"test","autoStart":false}' \
  | jq -r '.id' 2>/dev/null)

if [ ! -z "$APP_ID" ] && [ "$APP_ID" != "null" ]; then
    echo -e "${GREEN}PASS${NC}: Created app: $APP_ID"
    ((PASSED++))
    
    run_test "GET app by ID" "curl -s -f $BASE_URL/api/apps/$APP_ID" 200
    run_test "UPDATE app" "curl -s -f -X PUT $BASE_URL/api/apps/$APP_ID -H 'Content-Type: application/json' -d '{\"name\":\"TestAppUpdated\",\"executablePath\":\"/bin/echo\",\"arguments\":\"updated\",\"autoStart\":false}'" 200
    
    # Start app
    run_test "START app" "curl -s -f -X POST $BASE_URL/api/execution/start/$APP_ID" 200
    
    sleep 2
    
    # Check sessions
    run_test "GET sessions for app" "curl -s -f $BASE_URL/api/sessions/$APP_ID" 200
    
    # Stop app (may already be stopped for echo command)
    curl -s -X POST $BASE_URL/api/execution/stop/$APP_ID > /dev/null 2>&1
    
    # Delete app
    run_test "DELETE app" "curl -s -f -X DELETE $BASE_URL/api/apps/$APP_ID" 200
else
    echo -e "${RED}FAIL${NC}: Failed to create app"
    ((FAILED++))
fi

echo ""
echo "=== Import/Export Tests ==="
# Export configuration
EXPORT_FILE="/tmp/minicluster_export_$$.json"
if curl -s -f $BASE_URL/api/apps/export > "$EXPORT_FILE" 2>/dev/null; then
    if [ -s "$EXPORT_FILE" ]; then
        echo -e "${GREEN}PASS${NC}: Exported configuration"
        ((PASSED++))
        
        # Import configuration
        run_test "IMPORT configuration" "curl -s -f -X POST $BASE_URL/api/apps/import -F 'file=@$EXPORT_FILE' -F 'resolveVariables=false'" 200
    else
        echo -e "${RED}FAIL${NC}: Export file is empty"
        ((FAILED++))
    fi
    rm -f "$EXPORT_FILE"
else
    echo -e "${RED}FAIL${NC}: Failed to export configuration"
    ((FAILED++))
fi

echo ""
echo "=== Log Management Tests ==="
run_test "GET log stats" "curl -s -f $BASE_URL/api/logs/stats" 200
run_test "POST cleanup old logs" "curl -s -f -X POST $BASE_URL/api/logs/cleanup" 200

# Cleanup environment
if [ ! -z "$ENV_NAME" ]; then
    curl -s -X DELETE $BASE_URL/api/envs/$ENV_NAME > /dev/null 2>&1
fi

echo ""
echo "============================================"
echo "Test Results:"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo "============================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
