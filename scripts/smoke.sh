#!/usr/bin/env bash
# smoke.sh — Quick CLI validation of extaudit
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== extaudit smoke tests ==="

# Build if needed
if [ ! -d "dist" ]; then
  echo "Building..."
  npm run build
fi

PASS=0
FAIL=0

pass() { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=$((FAIL+1)); }

# 1. Version
echo "- Version command..."
OUT=$(node dist/cli.js version 2>&1) || true
echo "$OUT" | grep -q "extaudit v" && pass "version" || fail "version"

# 2. Help
echo "- Help command..."
OUT=$(node dist/cli.js help 2>&1) || true
echo "$OUT" | grep -q "extaudit" && pass "help" || fail "help"

# 3. Rules
echo "- Rules command..."
OUT=$(node dist/cli.js rules 2>&1) || true
echo "$OUT" | grep -q "Total:" && pass "rules" || fail "rules"

# 4. Scan fixtures (summary)
echo "- Scan fixtures (summary)..."
OUT=$(node dist/cli.js scan fixtures/extensions 2>&1) || true
echo "$OUT" | grep -q "extaudit" && pass "scan summary" || fail "scan summary"

# 5. Scan fixtures (json)
echo "- Scan fixtures (json)..."
OUT=$(node dist/cli.js scan fixtures/extensions --format json 2>&1) || true
echo "$OUT" | grep -q '"extensionsScanned"' && pass "scan json" || fail "scan json"

# 6. Scan fixtures (markdown)
echo "- Scan fixtures (markdown)..."
OUT=$(node dist/cli.js scan fixtures/extensions --format markdown 2>&1) || true
echo "$OUT" | grep -q "# ExtAudit" && pass "scan markdown" || fail "scan markdown"

# 7. Safe extension scores 0
echo "- Safe extension clean..."
OUT=$(node dist/cli.js scan fixtures/extensions/safe-extensions --format json 2>&1) || true
# Check that the max score is low (or 0)
echo "$OUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); const mx=Math.max(0,...d.extensions.map(e=>e.score)); if(mx<=3) process.exit(0); else process.exit(1);" 2>/dev/null && pass "safe extensions clean" || fail "safe extensions clean"

# 8. Data exfiltrator flags
echo "- Risky extension flags..."
OUT=$(node dist/cli.js scan fixtures/extensions/risky-extensions --format json 2>&1) || true
echo "$OUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); if(d.totalFindings>=1) process.exit(0); else process.exit(1);" 2>/dev/null && pass "risky extension flags" || fail "risky extension flags"

# 9. Output to file
echo "- Output to file..."
node dist/cli.js scan fixtures/extensions --format markdown -o /tmp/extaudit-test-report.md 2>&1
[ -f "/tmp/extaudit-test-report.md" ] && pass "output to file" || fail "output to file"
rm -f /tmp/extaudit-test-report.md

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
