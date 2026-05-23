#!/usr/bin/env bash
# validate.sh — Full project validation for extaudit
set -euo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

pass() { printf "  ${GREEN}✅ PASS${NC}: %s\n" "$1"; PASS=$((PASS+1)); }
fail() { printf "  ${RED}❌ FAIL${NC}: %s\n" "$1"; FAIL=$((FAIL+1)); }
warn() { printf "  ${YELLOW}⚠️  WARN${NC}: %s\n" "$1"; }

echo "========================================"
echo "  extaudit — Project Validation"
echo "========================================"
echo ""

# 1. TypeScript check
echo "1. TypeScript type check..."
npx tsc --noEmit 2>&1 && pass "tsc --noEmit clean" || fail "tsc --noEmit"

# 2. NPM test
echo "2. Unit tests..."
npm test 2>&1 && pass "all tests pass" || fail "unit tests failed"

# 3. Build
echo "3. Build..."
npm run build 2>&1 && pass "build succeeds" || fail "build failed"

# 4. CLI exists
echo "4. CLI entry point..."
[ -f "dist/cli.js" ] && pass "dist/cli.js exists" || fail "dist/cli.js missing"

# 5. Package.json sanity
echo "5. package.json validation..."
node -e "const p = require('./package.json');
  [p.name, p.version, p.bin.extaudit, p.scripts.test, p.scripts.build].forEach(v => {
    if (!v) { console.error('Missing field'); process.exit(1) }
  });" && pass "package.json valid" || fail "package.json incomplete"

# 6. Fixtures exist
echo "6. Test fixtures..."
FIXTURES=("safe-extensions/clean-linter" "safe-extensions/theme-oceanic" "safe-extensions/markdown-helper" "suspicious-extensions/network-crawler" "risky-extensions/data-exfiltrator")
ALL_OK=true
for f in "${FIXTURES[@]}"; do
  if [ ! -f "fixtures/extensions/$f/package.json" ]; then
    warn "Missing fixture: $f"
    ALL_OK=false
  fi
done
$ALL_OK && pass "all 5 fixtures present" || fail "missing fixtures"

# 7. Source files exist
echo "7. Source file completeness..."
SRC_FILES=("src/types.ts" "src/rules.ts" "src/manifest.ts" "src/scorer.ts" "src/cli.ts" "src/index.ts")
ALL_OK=true
for f in "${SRC_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    warn "Missing source: $f"
    ALL_OK=false
  fi
done
$ALL_OK && pass "all source files present" || fail "missing source files"

# 8. Documentation
echo "8. Documentation..."
ALL_OK=true
for f in "README.md" "docs/PRD.md" "docs/TASKS.md"; do
  if [ ! -f "$f" ]; then
    warn "Missing doc: $f"
    ALL_OK=false
  fi
done
$ALL_OK && pass "documentation complete" || fail "missing documentation"

# 9. Git status
echo "9. Git repository..."
git rev-parse --git-dir >/dev/null 2>&1 && pass "git initialized" || fail "no git repo"

# 10. Dependencies installed
echo "10. Dependencies..."
[ -f "node_modules/.package-lock.json" ] && pass "dependencies installed" || fail "dependencies missing"

# Summary
echo ""
echo "========================================"
printf "  Results: ${GREEN}%d passed${NC}, " "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf "${RED}%d failed${NC}" "$FAIL"
else
  printf "${GREEN}0 failed${NC}"
fi
echo ""
echo "========================================"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
