#!/bin/bash
# Loops de verificação do sistema de guias — Estudo 360 (2026-08-13)
cd /Users/lucca/Documents/GitHub/calculadoraempresaouindividual
RES=/tmp/loops-guias.txt
echo "═══ LOOPS DE VERIFICAÇÃO — $(date '+%H:%M:%S') ═══" > $RES

echo "── Loop A: testes unitários (guias) ×10" | tee -a $RES
for i in $(seq 1 10); do
  R=$(npx tsx src/lib/guias.test.ts 2>&1 | tail -1)
  echo "  A$i: $R" | tee -a $RES
done

echo "── Loop B: E2E rápido (5 vistas + acessibilidade) ×10" | tee -a $RES
for i in $(seq 1 10); do
  R=$(node scripts/verificar-guias-rapido.cjs 2>&1 | grep "═══")
  echo "  B$i: $R" | tee -a $RES
done

echo "── Loop C: E2E completo (17 vistas) ×3" | tee -a $RES
for i in $(seq 1 3); do
  R=$(node scripts/verificar-guias.cjs 2>&1 | grep "═══")
  echo "  C$i: $R" | tee -a $RES
done

echo "── Loop D: suite completa (npm test) ×3" | tee -a $RES
for i in $(seq 1 3); do
  N=$(npm test 2>&1 | grep -cE "^✓")
  echo "  D$i: ${N} verificações ✓" | tee -a $RES
done

echo "═══ FIM — $(date '+%H:%M:%S') ═══" | tee -a $RES
