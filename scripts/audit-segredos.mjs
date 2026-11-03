#!/usr/bin/env node
/**
 * Falha se encontrar segredos reais em ficheiros versionáveis.
 * Firebase Web API keys (AIza...) são identificadores públicos por desenho.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
  encoding: 'utf8',
}).split('\0').filter(Boolean);

const allowedExtensions = /\.(?:[cm]?[jt]sx?|json|md|txt|ya?ml|toml|html?|rules|example)$/i;
const ignored = [
  /^\.git\//,
  /^node_modules\//,
  /^dist\//,
  /^tmp\//,
  /(?:^|\/)\.env\.example$/,
  /\.test\.[cm]?[jt]sx?$/,
  /(?:^|\/)package-lock\.json$/,
];

const checks = [
  {
    name: 'chave privada PEM',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{200,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: 'segredo OAuth literal',
    pattern: /(?:client[_-]?secret|clientSecret)\s*[:=]\s*["'`][^"'`\s]{16,}["'`]/gi,
  },
  {
    name: 'token literal',
    pattern: /(?:access[_-]?token|refresh[_-]?token|api[_-]?secret|webhook[_-]?secret)\s*[:=]\s*["'`][A-Za-z0-9_./+=-]{24,}["'`]/gi,
  },
  {
    name: 'conta de serviço colada como JSON',
    pattern: /FIREBASE_SERVICE_ACCOUNT_JSON\s*=\s*["'`]\s*\{\s*["']type["']\s*:\s*["']service_account["']/gi,
  },
];

const findings = [];
for (const file of tracked) {
  if (!allowedExtensions.test(file) || ignored.some((rx) => rx.test(file))) continue;
  let info;
  try {
    info = statSync(file);
  } catch {
    continue;
  }
  if (!info.isFile() || info.size > 1_500_000) continue;
  const text = readFileSync(file, 'utf8');
  for (const check of checks) {
    check.pattern.lastIndex = 0;
    const match = check.pattern.exec(text);
    if (!match) continue;
    const line = text.slice(0, match.index).split('\n').length;
    findings.push(`${file}:${line} ${check.name}`);
  }
}

if (findings.length) {
  console.error('Segredos potenciais encontrados:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('OK - nenhum segredo privado literal encontrado nos ficheiros versionáveis.');
