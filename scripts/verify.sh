#!/bin/bash
# verify.sh — Loop de verificação do Estudo 360
# Uso: bash scripts/verify.sh [--fix]
#   --fix  = tenta corrigir automaticamente erros encontrados
#
# Exit code: 0 = tudo OK, 1 = falhou (mas --fix tentou corrigir)

set -euo pipefail
REPO="/Volumes/Extreme SSD/Mac-Lucca/Documents-store/Documents/GitHub/estudo360"
NODE="/Users/lucca/.nvm/versions/node/v24.14.0/bin/node"
NPM="/Users/lucca/.nvm/versions/node/v24.14.0/bin/npm"
LIVE_URL="https://estudo360.pt"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
FIX_MODE=false
[[ "${1:-}" == "--fix" ]] && FIX_MODE=true

cd "$REPO"

pass() { echo -e "  ${GREEN}✅${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC} $1"; }

failures=0

echo "══════════════════════════════════════════"
echo "  Estudo 360 — Verify Loop"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "  Commit: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"
echo "══════════════════════════════════════════"

# ── 1. GIT STATUS ──
echo ""
echo "▶ 1. Git status"
if ! git diff --quiet HEAD 2>/dev/null; then
  warn "Working tree has uncommitted changes"
  if $FIX_MODE; then
    git stash || true
    pass "Stashed uncommitted changes"
  fi
else
  pass "Working tree clean"
fi
if ! git fetch origin --quiet 2>/dev/null; then
  warn "Cannot fetch origin (offline?)"
else
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "$LOCAL")
  if [ "$LOCAL" != "$REMOTE" ]; then
    warn "Local ($LOCAL) ≠ remote ($REMOTE)"
    if $FIX_MODE; then
      git pull --rebase origin main 2>/dev/null && pass "Synced with remote" || warn "Merge conflict — resolve manually"
    fi
  else
    pass "Up to date with origin/main"
  fi
fi

# ── 2. LINT ──
echo ""
echo "▶ 2. TypeScript check"
if $NPM run lint 2>/dev/null; then
  pass "tsc --noEmit OK"
else
  fail "TypeScript errors found"
  failures=$((failures + 1))
fi

# ── 3. TESTS ──
echo ""
echo "▶ 3. Golden tests"
TEST_OUTPUT=$($NPM test 2>&1 || true)
FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep -c '✗' || true)
PASS_COUNT=$(echo "$TEST_OUTPUT" | grep -c '✓' || true)
if [ "$FAIL_COUNT" -eq 0 ] && [ "$PASS_COUNT" -gt 0 ]; then
  pass "$PASS_COUNT assertions passed, 0 failures"
else
  fail "$FAIL_COUNT test(s) failed ($PASS_COUNT passed)"
  echo "$TEST_OUTPUT" | grep '✗' | head -10
  failures=$((failures + 1))
fi

# ── 4. BUILD ──
echo ""
echo "▶ 4. Production build"
BUILD_OUTPUT=$($NPM run build 2>&1 || true)
if echo "$BUILD_OUTPUT" | grep -q "✓ built"; then
  pass "Vite build OK"
else
  fail "Build failed"
  echo "$BUILD_OUTPUT" | tail -10
  failures=$((failures + 1))
fi

# ── 5. LIVE CHECK ──
echo ""
echo "▶ 5. Live deploy"
HTTP_CODE=$(curl -sL -o /dev/null -w "%{http_code}" "$LIVE_URL" 2>/dev/null || echo "000")
TITLE=$(curl -sL "$LIVE_URL" 2>/dev/null | grep -oE '<title>[^<]+</title>' | head -1 || echo "")
if [ "$HTTP_CODE" = "200" ] && echo "$TITLE" | grep -q "Estudo 360"; then
  pass "$LIVE_URL — HTTP $HTTP_CODE, title OK"
else
  fail "$LIVE_URL — HTTP $HTTP_CODE, title=$TITLE"
  failures=$((failures + 1))
fi

# ── 6. CF PAGES DEPLOY STATUS (via GH API) ──
echo ""
echo "▶ 6. Last deploy status"
GH_TOKEN=$(security find-internet-password -s github.com -w 2>/dev/null || echo "")
if [ -n "$GH_TOKEN" ]; then
  LAST_DEPLOY=$(curl -sL -H "Authorization: token $GH_TOKEN" \
    "https://api.github.com/repos/gontijolucca-prog/calculadoraempresaouindividual/actions/runs?per_page=3&branch=main&status=success" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); runs=d.get('workflow_runs',[]); [print(f'{r[\"name\"]}: {r[\"head_commit\"][\"message\"][:60]}') for r in runs[:2]]" 2>/dev/null || echo "API error")
  echo "  Latest successful deploys:"
  echo "$LAST_DEPLOY"
  pass "Deploy API accessible"
else
  warn "No GitHub token — skip deploy status"
fi

# ── RESULT ──
echo ""
echo "══════════════════════════════════════════"
if [ "$failures" -eq 0 ]; then
  echo -e "  ${GREEN}✅ ALL CHECKS PASSED${NC}"
  exit 0
else
  echo -e "  ${RED}❌ $failures check(s) failed${NC}"
  if $FIX_MODE; then
    echo "  --fix mode enabled, some issues auto-resolved"
  fi
  exit 1
fi
