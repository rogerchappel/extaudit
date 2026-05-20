#!/usr/bin/env bash
# Smoke test: scan fixture extensions and verify output
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

FIXTURES_DIR="fixtures/example-extensions"

echo "=== extaudit smoke test ==="

if [ ! -d "$FIXTURES_DIR" ]; then
  echo "FAIL: fixtures directory not found"
  exit 1
fi

# Test 1: JSON output
echo "Testing JSON output..."
JSON_OUTPUT=$(node dist/index.js scan "$FIXTURES_DIR" --json 2>&1 || true)
if echo "$JSON_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('Extensions:', d.totalExtensions); process.exit(d.totalExtensions >= 4 ? 0 : 1)"; then
  echo "PASS: JSON scan found 4+ extensions"
else
  echo "FAIL: JSON scan did not find expected extensions"
  exit 1
fi

# Test 2: Detect suspicious extension
echo "Testing suspicious extension detection..."
if echo "$JSON_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const s=d.extensions.find(e=>e.extensionName==='suspicious-extension'); process.exit(s && s.score > 0 ? 0 : 1)"; then
  echo "PASS: Suspicious extension flagged with non-zero score"
else
  echo "FAIL: Suspicious extension not flagged"
  exit 1
fi

# Test 3: Benign extension is clean
echo "Testing benign extension is clean..."
if echo "$JSON_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const b=d.extensions.find(e=>e.extensionName==='benign-extension'); process.exit(b && b.score === 0 ? 0 : 1)"; then
  echo "PASS: Benign extension has score 0"
else
  echo "FAIL: Benign extension should have score 0"
  exit 1
fi

# Test 4: Markdown output
echo "Testing Markdown output..."
MD_OUTPUT=$(node dist/index.js scan "$FIXTURES_DIR" --markdown 2>&1 || true)
if echo "$MD_OUTPUT" | grep -q "# extaudit Security Report"; then
  echo "PASS: Markdown report generated"
else
  echo "FAIL: Markdown report not generated"
  exit 1
fi

# Test 5: Rules listing
echo "Testing rules command..."
RULES_OUTPUT=$(node dist/index.js rules 2>&1)
if echo "$RULES_OUTPUT" | grep -q "permissions"; then
  echo "PASS: Rules command works"
else
  echo "FAIL: Rules command output unexpected"
  exit 1
fi

echo ""
echo "=== All smoke tests passed ==="
