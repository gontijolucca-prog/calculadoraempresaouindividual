import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, numInput, intInput, pctInput } from './inputGuards';

// ── clamp ──────────────────────────────────────────────────────────────
describe('clamp', () => {
  it('returns value when within range', () => assert.equal(clamp(5, 0, 10), 5));
  it('clamps below min', () => assert.equal(clamp(-3, 0, 10), 0));
  it('clamps above max', () => assert.equal(clamp(15, 0, 10), 10));
  it('returns 0 for NaN', () => assert.equal(clamp(NaN), 0));
  it('returns 0 for Infinity', () => assert.equal(clamp(Infinity), 0));
  it('handles no bounds', () => assert.equal(clamp(42), 42));
  it('handles only min', () => assert.equal(clamp(-5, 0), 0));
  it('handles only max', () => assert.equal(clamp(20, undefined, 10), 10));
  it('handles negative min', () => assert.equal(clamp(-3, -10, 10), -3));
});

// ── numInput ──────────────────────────────────────────────────────────
describe('numInput', () => {
  it('parses valid string', () => assert.equal(numInput('42.5'), 42.5));
  it('returns 0 for empty string', () => assert.equal(numInput(''), 0));
  it('returns 0 for NaN string', () => assert.equal(numInput('abc'), 0));
  it('clamps to min', () => assert.equal(numInput('-5', 0), 0));
  it('clamps to max', () => assert.equal(numInput('100', 0, 50), 50));
  it('preserves decimals', () => assert.equal(numInput('3.14'), 3.14));
});

// ── intInput ──────────────────────────────────────────────────────────
describe('intInput', () => {
  it('truncates decimals', () => assert.equal(intInput('3.9'), 3));
  it('returns 0 for empty', () => assert.equal(intInput(''), 0));
  it('clamps to min', () => assert.equal(intInput('-3', 0), 0));
  it('clamps to max', () => assert.equal(intInput('15', 0, 10), 10));
  it('handles negative values', () => assert.equal(intInput('-7', -10, 10), -7));
});

// ── pctInput ──────────────────────────────────────────────────────────
describe('pctInput', () => {
  it('parses valid percentage', () => assert.equal(pctInput('23'), 23));
  it('clamps to 0-100', () => assert.equal(pctInput('150'), 100));
  it('clamps negative to 0', () => assert.equal(pctInput('-10'), 0));
  it('respects custom max', () => assert.equal(pctInput('50', 30), 30));
  it('returns 0 for empty', () => assert.equal(pctInput(''), 0));
});
