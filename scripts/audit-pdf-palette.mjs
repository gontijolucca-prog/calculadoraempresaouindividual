#!/usr/bin/env node
/**
 * Confirma visualmente que cada PDF exportado usa apenas azul e branco.
 * Renderiza a primeira página com sips e analisa as cores dominantes com ImageMagick.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.env.PDF_DIR || 'public/exemplos-exportacoes-2026-11-03');
const TMP = path.resolve('tmp/audit-pdf-palette');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const files = readdirSync(DIR).filter((file) => file.endsWith('.pdf')).sort();
const failures = [];

function hexColors(png) {
  const output = execFileSync(
    'magick',
    [png, '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-colors', '96', '-unique-colors', 'txt:-'],
    { encoding: 'utf8' },
  );
  return [...output.matchAll(/#([0-9a-f]{6})/gi)].map((match) => match[1].toUpperCase());
}

function isBlueOrWhite(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const nearWhite = min >= 244;
  const blue = b >= Math.max(r, g) - 1 && (b - r >= 5 || b - g >= 2);
  return nearWhite || blue;
}

for (const file of files) {
  const pdf = path.join(DIR, file);
  const png = path.join(TMP, file.replace(/\.pdf$/i, '.png'));
  try {
    execFileSync('sips', ['-s', 'format', 'png', pdf, '--out', png], { stdio: 'ignore' });
    const invalid = [...new Set(hexColors(png).filter((color) => !isBlueOrWhite(color)))];
    const ok = invalid.length === 0;
    console.log(`${ok ? '✓' : '✗'} ${file}: ${ok ? 'azul e branco' : `cores fora da paleta: ${invalid.slice(0, 8).join(', ')}`}`);
    if (!ok) failures.push({ file, invalid });
  } catch (error) {
    console.log(`✗ ${file}: não foi possível analisar (${error instanceof Error ? error.message : String(error)})`);
    failures.push({ file, invalid: ['erro de renderização'] });
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\n${failures.length ? 'FAIL' : 'PASS'} — ${failures.length} falha(s) em ${files.length} PDF(s)`);
if (failures.length) process.exit(1);
