#!/usr/bin/env bash
set -euo pipefail

DEV_FRONTEND_URL="${DEV_FRONTEND_URL:-https://tricia-monitoring-dev-frontend.kindwave-0284be09.switzerlandnorth.azurecontainerapps.io}"
DEV_BACKEND_URL="${DEV_BACKEND_URL:-https://tricia-monitoring-dev-backend.kindwave-0284be09.switzerlandnorth.azurecontainerapps.io}"
DEV_ADMIN_USERNAME="${DEV_ADMIN_USERNAME:-${BOOTSTRAP_ADMIN_USERNAME:-tricia.admin}}"
DEV_ADMIN_PASSWORD="${DEV_ADMIN_PASSWORD:-${BOOTSTRAP_ADMIN_PASSWORD:-swissmedic\$01}}"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

pass() {
  echo "PASS: $1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_command curl
require_command python3

check_frontend() {
  local code
  code="$(curl -sS -o /tmp/tricia-frontend-check.html -w '%{http_code}' "$DEV_FRONTEND_URL/")"
  [[ "$code" == "200" ]] || fail "Frontend did not return HTTP 200 at $DEV_FRONTEND_URL/ (got $code)"
  grep -qi "<html\|<body\|Tricia\|Monitoring" /tmp/tricia-frontend-check.html || fail "Frontend HTML did not look like the app shell"
  pass "Frontend reachable"
}

check_backend_docs() {
  local code
  code="$(curl -sS -o /tmp/tricia-backend-docs.html -w '%{http_code}' "$DEV_BACKEND_URL/docs")"
  [[ "$code" == "200" ]] || fail "Backend docs endpoint returned $code instead of 200"
  grep -qi "Swagger\|FastAPI" /tmp/tricia-backend-docs.html || fail "Backend docs page did not render the FastAPI docs shell"
  pass "Backend docs reachable"
}

login_and_get_token() {
  local response
  response="$(curl -sS -X POST "$DEV_BACKEND_URL/api/v1/auth/session" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$DEV_ADMIN_USERNAME\",\"password\":\"$DEV_ADMIN_PASSWORD\"}")" || fail "Authentication request failed"
  python3 - "$response" <<'PY'
import json, sys
payload = json.loads(sys.argv[1])
if 'access_token' not in payload:
    raise SystemExit('Login response missing access_token')
print(payload['access_token'])
PY
}

check_auth_and_cases() {
  local token
  token="$(login_and_get_token)"
  local response code
  response="$(curl -sS -H "Authorization: Bearer $token" \
    -o /tmp/tricia-cases.json -w '%{http_code}' \
    "$DEV_BACKEND_URL/api/v1/cases?all=true&page=1&page_size=1")" || fail "Case list request failed"
  [[ "$response" == "200" ]] || fail "Case list returned HTTP $response instead of 200"
  python3 - <<'PY'
import json, sys
with open('/tmp/tricia-cases.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
if not isinstance(data, dict):
    raise SystemExit('Case list response is not an object')
if 'items' not in data or not isinstance(data['items'], list):
    raise SystemExit('Case list response missing items list')
print(f"cases={len(data['items'])} page={data.get('page', 'n/a')} total={data.get('total', 'n/a')}")
PY
  pass "Auth and case listing work"
}

check_validation() {
  local token
  token="$(login_and_get_token)"
  local response code
  response="$(curl -sS -X POST "$DEV_BACKEND_URL/api/v1/cases/validate" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d '{"vk_number":"Vk_20250101_001","device_name":"Dev Smoke Test Device","tricia_s":1,"tricia_p":1,"tricia_d":1,"user_s":1,"user_p":1,"user_d":1}' \
    -o /tmp/tricia-case-validate.json -w '%{http_code}')" || fail "Case validation request failed"
  [[ "$response" == "200" ]] || fail "Case validation returned HTTP $response instead of 200"
  python3 - <<'PY'
import json
with open('/tmp/tricia-case-validate.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
required = {'analysis_date', 'duplicate', 'auto_fill'}
missing = sorted(required - set(data.keys()))
if missing:
    raise SystemExit(f'Validation response missing keys: {missing}')
print(f"duplicate={data.get('duplicate')} inferred_user_id={data.get('inferred_user_id')} auto_fill={data.get('auto_fill')}")
PY
  pass "Case validation works"
}

main() {
  echo "Running dev functional smoke checks"
  echo "Frontend: $DEV_FRONTEND_URL"
  echo "Backend:  $DEV_BACKEND_URL"
  echo "User:     $DEV_ADMIN_USERNAME"
  check_frontend
  check_backend_docs
  check_auth_and_cases
  check_validation
  echo "All dev functional checks passed."
}

main "$@"
