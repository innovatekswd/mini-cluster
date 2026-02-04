#!/bin/bash

# Simplified Comprehensive API Testing Script

BASE="http://localhost:5147"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

test_api() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_code="$5"
    
    echo -e "\n${BLUE}TEST: $name${NC}"
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -o /tmp/response.json -w "%{http_code}" "$url")
    elif [ "$method" == "DELETE" ]; then
        response=$(curl -s -o /tmp/response.json -w "%{http_code}" -X DELETE "$url")
    else
        response=$(curl -s -o /tmp/response.json -w "%{http_code}" -X "$method" \
            -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    if [ "$response" == "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        cat /tmp/response.json | jq '.' 2>/dev/null || cat /tmp/response.json
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $response)"
        cat /tmp/response.json
        ((FAIL++))
        return 1
    fi
}

echo "═══════════════════════════════════════"
echo "  MINICLUSTER API COMPREHENSIVE TESTS  "
echo "═══════════════════════════════════════"

# Wait for server
echo "Waiting for server..."
for i in {1..20}; do
    if curl -s "$BASE/api/health" > /dev/null 2>&1; then
        echo "Server ready!"
        break
    fi
    sleep 1
done

echo -e "\n📋 STARTING API TESTS\n"

# 1. Health Check
test_api "1. Health Check" "GET" "$BASE/api/health" "" "200"

# 2. Get all apps (empty)
test_api "2. Get All Apps (Empty)" "GET" "$BASE/api/apps" "" "200"

# 3. Create Variable Group
test_api "3. Create Variable Group" "POST" "$BASE/api/variables/groups" \
    '{"name":"TestVars","description":"Test vars","variables":{"VAR1":"value1"},"isActive":true}' "201"
VAR_GROUP_ID=$(jq -r '.id' /tmp/response.json)
echo "Variable Group ID: $VAR_GROUP_ID"

# 4. Get Variable Groups
test_api "4. Get Variable Groups" "GET" "$BASE/api/variables/groups" "" "200"

# 5. Create Valid App
test_api "5. Create Echo App" "POST" "$BASE/api/apps" \
    '{"name":"Echo Test","executablePath":"/bin/echo","arguments":"Hello World","workingDirectory":"/tmp","autoStart":false}' "201"
ECHO_APP_ID=$(jq -r '.id' /tmp/response.json)
echo "Echo App ID: $ECHO_APP_ID"

# 6. Create Ping App
test_api "6. Create Ping App" "POST" "$BASE/api/apps" \
    '{"name":"Ping Test","executablePath":"/usr/bin/ping","arguments":"-c 5 8.8.8.8","workingDirectory":"/tmp","autoStart":false}' "201"
PING_APP_ID=$(jq -r '.id' /tmp/response.json)
echo "Ping App ID: $PING_APP_ID"

# 7. Get All Apps (should have 2)
test_api "7. Get All Apps (Should Have 2)" "GET" "$BASE/api/apps" "" "200"

# 8. Get App by ID
test_api "8. Get App By ID" "GET" "$BASE/api/apps/$ECHO_APP_ID" "" "200"

# 9. Update App
test_api "9. Update App" "PUT" "$BASE/api/apps/$ECHO_APP_ID" \
    '{"name":"Echo Updated","executablePath":"/bin/echo","arguments":"Updated!","workingDirectory":"/tmp","autoStart":false,"environmentVariables":{}}' "200"

# 10. Get Environment Variables
test_api "10. Get Environment Variables" "GET" "$BASE/api/apps/$ECHO_APP_ID/env" "" "200"

# 11. Update Environment Variables
test_api "11. Update Environment Variables" "PUT" "$BASE/api/apps/$ECHO_APP_ID/env" \
    '{"TEST_VAR":"test_value"}' "200"

# 12. Get Arguments
test_api "12. Get App Arguments" "GET" "$BASE/api/apps/$ECHO_APP_ID/args" "" "200"

# 13. Update Arguments
test_api "13. Update App Arguments" "PUT" "$BASE/api/apps/$ECHO_APP_ID/args" \
    '{"arguments":"New args"}' "200"

# 14. Start Echo App
test_api "14. Start Echo App" "POST" "$BASE/api/apps/$ECHO_APP_ID/exec/start" "" "200"
sleep 2

# 15. Get Status (Echo - should be stopped)
test_api "15. Get Echo Status" "GET" "$BASE/api/apps/$ECHO_APP_ID/exec/status" "" "200"

# 16. Get Echo Sessions
test_api "16. Get Echo Sessions" "GET" "$BASE/api/apps/$ECHO_APP_ID/sessions" "" "200"
ECHO_SESSION_ID=$(jq -r '.[0].sessionId' /tmp/response.json)
echo "Echo Session ID: $ECHO_SESSION_ID"

# 17. Get Session Details
test_api "17. Get Session Details" "GET" "$BASE/api/apps/$ECHO_APP_ID/sessions/$ECHO_SESSION_ID" "" "200"

# 18. Get Session Logs
test_api "18. Get Session Logs" "GET" "$BASE/api/apps/$ECHO_APP_ID/sessions/$ECHO_SESSION_ID/logs" "" "200"

# 19. Start Ping App
test_api "19. Start Ping App" "POST" "$BASE/api/apps/$PING_APP_ID/exec/start" "" "200"
sleep 2

# 20. Get Ping Status (should be running)
test_api "20. Get Ping Status (Running)" "GET" "$BASE/api/apps/$PING_APP_ID/exec/status" "" "200"

# 21. Stop Ping App
test_api "21. Stop Ping App" "POST" "$BASE/api/apps/$PING_APP_ID/exec/stop" "" "200"
sleep 1

# 22. Get Ping Status (should be stopped)
test_api "22. Get Ping Status (Stopped)" "GET" "$BASE/api/apps/$PING_APP_ID/exec/status" "" "200"

# 23. Get Ping Sessions
test_api "23. Get Ping Sessions" "GET" "$BASE/api/apps/$PING_APP_ID/sessions" "" "200"

# 24. Search Logs
test_api "24. Search Logs" "GET" "$BASE/api/apps/$PING_APP_ID/logs/search?page=1&pageSize=10" "" "200"

# 25. Get Lifecycle History
test_api "25. Get Lifecycle History" "GET" "$BASE/api/apps/$PING_APP_ID/history" "" "200"

# 26. ERROR TEST: Create app with invalid executable
test_api "26. Create Invalid App" "POST" "$BASE/api/apps" \
    '{"name":"Invalid","executablePath":"/does/not/exist","arguments":"test"}' "201"
INVALID_APP_ID=$(jq -r '.id' /tmp/response.json)

# 27. ERROR TEST: Try to start invalid app (should fail with detailed error)
echo -e "\n${BLUE}TEST: 27. Start Invalid App (Should Fail)${NC}"
response=$(curl -s -o /tmp/response.json -w "%{http_code}" -X POST "$BASE/api/apps/$INVALID_APP_ID/exec/start")
if [ "$response" == "400" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Correctly returned HTTP 400)"
    echo "Error response:"
    cat /tmp/response.json | jq '.'
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC} (Expected 400, got $response)"
    ((FAIL++))
fi

# 28. ERROR TEST: Try to start already running app
curl -s -X POST "$BASE/api/apps/$PING_APP_ID/exec/start" > /dev/null
sleep 1
echo -e "\n${BLUE}TEST: 28. Start Already Running App (Should Fail)${NC}"
response=$(curl -s -o /tmp/response.json -w "%{http_code}" -X POST "$BASE/api/apps/$PING_APP_ID/exec/start")
if [ "$response" == "400" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Correctly returned HTTP 400)"
    echo "Error response:"
    cat /tmp/response.json | jq '.'
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC} (Expected 400, got $response)"
    ((FAIL++))
fi
curl -s -X POST "$BASE/api/apps/$PING_APP_ID/exec/stop" > /dev/null

# 29. Export Configuration
test_api "29. Export Configuration" "GET" "$BASE/api/apps/export" "" "200"

# 30. Import Configuration
echo -e "\n${BLUE}TEST: 30. Import Configuration${NC}"
cat > /tmp/import_test.json << 'EOF'
{
  "VariableGroups": [{
    "name": "ImportedVars",
    "description": "Test import",
    "variables": {"IMP_VAR": "imp_value"},
    "isActive": false
  }],
  "Apps": [{
    "name": "Imported App",
    "executablePath": "/bin/date",
    "arguments": "",
    "workingDirectory": "/tmp",
    "autoStart": false,
    "environmentVariables": {},
    "isExternal": false
  }]
}
EOF
response=$(curl -s -o /tmp/response.json -w "%{http_code}" -X POST "$BASE/api/apps/import" -F "file=@/tmp/import_test.json")
if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
    cat /tmp/response.json | jq '.'
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC} (Expected 200, got $response)"
    ((FAIL++))
fi

# 31. Verify Imported App
test_api "31. Verify Imported App" "GET" "$BASE/api/apps" "" "200"

# Cleanup
test_api "32. Delete Echo App" "DELETE" "$BASE/api/apps/$ECHO_APP_ID" "" "204"
test_api "33. Delete Ping App" "DELETE" "$BASE/api/apps/$PING_APP_ID" "" "204"
test_api "34. Delete Invalid App" "DELETE" "$BASE/api/apps/$INVALID_APP_ID" "" "204"
test_api "35. Delete Variable Group" "DELETE" "$BASE/api/variables/groups/$VAR_GROUP_ID" "" "204"

echo ""
echo "═══════════════════════════════════════"
echo "          TEST SUMMARY"
echo "═══════════════════════════════════════"
echo -e "Total: $((PASS + FAIL))"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    exit 1
fi
