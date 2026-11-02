import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  },
};

import { saveToStorage } from './storage';
import { defaultOfficeSettings, loadOfficeSettings, saveOfficeSettings } from './officeSettings';
import { defaultHonorariosConfig, loadHonorariosConfig, saveHonorariosConfig } from './honorarios';
import { defaultPricing, loadPricing, savePricing } from './pricing';

beforeEach(() => store.clear());

describe('definições isoladas por gabinete', () => {
  it('não reutiliza branding, honorários ou preços de outro gabinete', () => {
    saveToStorage('gabinete:activeId', 'gab_A');
    saveOfficeSettings({ ...defaultOfficeSettings, nome: 'Escritório A', iban: 'PT50A' });
    saveHonorariosConfig({ ...defaultHonorariosConfig, minimoMensal: 101 });
    savePricing({ ...defaultPricing(), contabilidadeLda: 321 });

    saveToStorage('gabinete:activeId', 'gab_B');
    assert.equal(loadOfficeSettings().nome, '');
    assert.equal(loadHonorariosConfig().minimoMensal, defaultHonorariosConfig.minimoMensal);
    assert.equal(loadPricing().contabilidadeLda, defaultPricing().contabilidadeLda);

    saveOfficeSettings({ ...defaultOfficeSettings, nome: 'Escritório B', iban: 'PT50B' });
    saveToStorage('gabinete:activeId', 'gab_A');
    assert.equal(loadOfficeSettings().nome, 'Escritório A');
    assert.equal(loadOfficeSettings().iban, 'PT50A');
    assert.equal(loadHonorariosConfig().minimoMensal, 101);
    assert.equal(loadPricing().contabilidadeLda, 321);
  });
});
