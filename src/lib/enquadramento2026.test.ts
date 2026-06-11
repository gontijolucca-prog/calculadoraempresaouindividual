// Golden tests do motor de enquadramento 2026 (2 camadas: validação + economia).
// Correr: npx tsx src/lib/enquadramento2026.test.ts
// Valores de coeficientes/limiares calculados à mão a partir do desenho da
// contabilista; IRS progressivo composto via calculateIRS (fixado em pt2026).

import {
  compararEnquadramento2026, validarRegimes, defaultInputEnq2026,
  rendColetavelIrsSimplificado, materiaColetavelIrcSimplificado, ssIndependente,
  type InputEnq2026,
} from './enquadramento2026';
import { calculateIRS } from './pt2026';
import { DED_ESPECIFICA_CAT_A_2026 } from './fiscal';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.5) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}
function check(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); }
  else console.log(`✓ ${label}`);
}

const base: InputEnq2026 = {
  ...defaultInputEnq2026(),
  rend: { vendas: 60000, servicosProf: 30000, outrosServicos: 10000, restantes: 0 },
  faturacaoAnoAnterior: 90000, anoAtividade: 3,
  gastosReais: 40000, ivaDedutivelCompras: 3000,
  remGerenteMensal: 1500, pctLucroDistribuido: 0.5,
  totalBalanco: 120000,
  clientesParticularesPct: 0.8,
  accMensalSimplificado: 50, accMensalOrganizada: 150,
};

// ── A: coeficientes IRS simplificado por natureza ──
{
  approx('A: RC simplificado (15/75/35)', rendColetavelIrsSimplificado(base.rend, 3, 40000).rc, 35000);
  approx('A: RC 1.º ano (0,75/0,35 reduzidos 50%)', rendColetavelIrsSimplificado(base.rend, 1, 40000).rc, 22000);
  approx('A: RC 2.º ano (reduzidos 25%)', rendColetavelIrsSimplificado(base.rend, 2, 40000).rc, 28500);
  // Regra dos 15%: serviços 100k sem gastos justificados → acréscimo
  const r15 = rendColetavelIrsSimplificado({ vendas: 0, servicosProf: 100000, outrosServicos: 0, restantes: 0 }, 3, 0);
  approx('A: acréscimo regra 15% (sem gastos)', r15.acrescimo15, 15000 - DED_ESPECIFICA_CAT_A_2026);
  approx('A: RC com acréscimo', r15.rc, 75000 + 15000 - DED_ESPECIFICA_CAT_A_2026);
}

// ── B: matéria coletável IRC simplificado ──
{
  approx('B: MC IRC simplificado (4/75/10)', materiaColetavelIrcSimplificado(base.rend, 3), 25900);
  approx('B: MC 1.º ano (vendas+restantes reduzidos 50%)', materiaColetavelIrcSimplificado(base.rend, 1), 24200);
  approx('B: MC 2.º ano (reduzidos 25%)', materiaColetavelIrcSimplificado(base.rend, 2), 25050);
}

// ── C: SS independente por natureza ──
approx('C: SS independente (70% serviços + 20% vendas × 21,4%)', ssIndependente(base.rend), 8560);

// ── D: camada de validação jurídica ──
{
  const v = validarRegimes(base);
  check('D: IRS simplificado elegível (90k ≤ 200k)', v.irsSimplificado.elegivel);
  check('D: IRC simplificado elegível (6 condições)', v.ircSimplificado.elegivel);
  check('D: isenção 53.º excluída (90k > 15k)', !v.ivaIsencao53.elegivel);
  check('D: IVA trimestral elegível (< 650k)', v.ivaTrimestral.elegivel);
  check('D: IVA mensal não obrigatório', !v.ivaMensalObrigatorio);

  const v2 = validarRegimes({ ...base, faturacaoAnoAnterior: 250000 });
  check('D: >200k → IRS simplificado e IRC simplificado excluídos', !v2.irsSimplificado.elegivel && !v2.ircSimplificado.elegivel);
  const v3 = validarRegimes({ ...base, totalBalanco: 600000 });
  check('D: balanço >500k → IRC simplificado excluído', !v3.ircSimplificado.elegivel);
  const v4 = validarRegimes({ ...base, revisaoLegalContas: true });
  check('D: revisão legal de contas → IRC simplificado excluído', !v4.ircSimplificado.elegivel);
  const v5 = validarRegimes({ ...base, faturacaoAnoAnterior: 700000 });
  check('D: ≥650k → trimestral excluído + mensal obrigatório', !v5.ivaTrimestral.elegivel && v5.ivaMensalObrigatorio);
  // Início de atividade: isenção avaliada pela ESTIMATIVA do próprio ano
  const v6 = validarRegimes({ ...base, anoAtividade: 1, faturacaoAnoAnterior: 0, rend: { vendas: 0, servicosProf: 12000, outrosServicos: 0, restantes: 0 } });
  check('D: 1.º ano com estimativa 12k → isenção 53.º elegível', v6.ivaIsencao53.elegivel);
}

// ── E: cenários e decomposição económica ──
{
  const r = compararEnquadramento2026(base);
  check('E: 4 regimes × 2 IVA = 8 cenários elegíveis', r.cenarios.length === 8);
  check('E: isenção 53.º aparece nos excluídos', r.excluidos.some(e => e.label.includes('53')));
  check('E: cenários ordenados por disponível desc', r.cenarios.every((c, i, a) => i === 0 || a[i - 1].disponivel >= c.disponivel));
  check('E: recomendação = 1.º cenário', r.recomendacao?.melhor.id === r.cenarios[0].id);

  const eniS = r.cenarios.find(c => c.rendimento === 'eni-simplificado' && c.iva === 'trimestral')!;
  const irsEsp = Math.max(0, calculateIRS(35000));
  approx('E: ENI simplificado — disponível', eniS.disponivel, 100000 - 40000 - 600 - 8560 - irsEsp);

  const eniO = r.cenarios.find(c => c.rendimento === 'eni-organizada' && c.iva === 'trimestral')!;
  const irsOrg = Math.max(0, calculateIRS(58200));
  approx('E: ENI organizada — disponível', eniO.disponivel, 100000 - 40000 - 1800 - 8560 - irsOrg);

  const socN = r.cenarios.find(c => c.rendimento === 'soc-irc-normal' && c.iva === 'trimestral')!;
  approx('E: sociedade — SS total MOE (23,75% + 11% de 21k)', socN.ss, 7297.5);
  // lucroContab = 100000−40000−1800−21000−4987.5 = 32212.5; IRC 15% = 4831.88
  // apósImposto = 27380.63; distribuído 50% = 13690.31 = retido
  approx('E: sociedade normal — lucro retido (50%)', socN.lucroRetido, 13690.31);
  approx('E: sociedade normal — imposto s/ dividendos (28%)', socN.impostoDividendos, 13690.31 * 0.28, 1);

  const socS = r.cenarios.find(c => c.rendimento === 'soc-irc-simplificado' && c.iva === 'trimestral')!;
  // IRC simplificado: MC 25900 × 15% = 3885 < IRC normal 4831.88 → simplificado liberta mais
  check('E: IRC simplificado disponibiliza mais que IRC normal (MC 25,9k < lucro 32,2k)', socS.disponivel > socN.disponivel);

  // IVA: tesouraria, não poupança — trimestral e mensal têm o MESMO disponível
  const socNMensal = r.cenarios.find(c => c.rendimento === 'soc-irc-normal' && c.iva === 'mensal')!;
  approx('E: IVA mensal vs trimestral — disponível IGUAL (não é poupança)', socNMensal.disponivel, socN.disponivel, 0.01);
  approx('E: saldo IVA anual (23% de 100k − 3k dedutível)', socN.ivaSaldoAnual, 20000);
  approx('E: pico tesouraria trimestral (1/4 do saldo)', socN.ivaPicoTesouraria, 5000);
  approx('E: pico tesouraria mensal (1/12 do saldo)', socNMensal.ivaPicoTesouraria, 20000 / 12, 1);
  check('E: trimestral tem menos obrigações que mensal', socN.obrigacoes < socNMensal.obrigacoes);
}

// ── F: isenção 53.º — o IVA das compras vira custo ──
{
  const peq: InputEnq2026 = {
    ...defaultInputEnq2026(),
    rend: { vendas: 0, servicosProf: 14000, outrosServicos: 0, restantes: 0 },
    faturacaoAnoAnterior: 14000, anoAtividade: 3,
    gastosReais: 2000, ivaDedutivelCompras: 460,
    accMensalSimplificado: 0, accMensalOrganizada: 100,
  };
  const r = compararEnquadramento2026(peq);
  const isen = r.cenarios.find(c => c.rendimento === 'eni-simplificado' && c.iva === 'isencao53')!;
  const trim = r.cenarios.find(c => c.rendimento === 'eni-simplificado' && c.iva === 'trimestral')!;
  approx('F: isenção — IVA das compras vira custo (460)', isen.custoIvaNaoDeduzido, 460);
  approx('F: trimestral − isenção = exatamente o IVA não deduzido', trim.disponivel - isen.disponivel, 460);
  approx('F: isenção — saldo e pico IVA a zero', isen.ivaSaldoAnual + isen.ivaPicoTesouraria, 0);
  check('F: alerta de proximidade do limite de 15k (14k > 90%)', r.alertas.some(a => a.includes('próxima')));
}

// ── G: alertas ──
{
  const saida = compararEnquadramento2026({
    ...defaultInputEnq2026(),
    rend: { vendas: 0, servicosProf: 19000, outrosServicos: 0, restantes: 0 },
    faturacaoAnoAnterior: 14000, anoAtividade: 3,
  });
  check('G: previsão >18 750 € com isenção → alerta de saída IMEDIATA', saida.alertas.some(a => a.includes('IMEDIATA')));

  const margem = compararEnquadramento2026({ ...base, gastosReais: 30000 });
  check('G: gastos >25% da faturação → alerta contabilidade organizada', margem.alertas.some(a => a.includes('25%')));

  const divid = compararEnquadramento2026({ ...base, pctLucroDistribuido: 1 });
  check('G: distribuição quase total → alerta dividendos', divid.alertas.some(a => a.includes('dividendos')));

  check('G: TA a zero com gastos → alerta validar tributações autónomas', base.taManual === 0 && compararEnquadramento2026(base).alertas.some(a => a.toLowerCase().includes('autónomas')));
  check('G: clientes particulares ≥50% → alerta impacto comercial do IVA', compararEnquadramento2026(base).alertas.some(a => a.includes('particulares')));

  const salto = compararEnquadramento2026({ ...base, rend: { vendas: 260000, servicosProf: 0, outrosServicos: 0, restantes: 0 } });
  check('G: previsão >250k (limite +25%) → alerta organizada obrigatória no seguinte', salto.alertas.some(a => a.includes('25%') && a.includes('seguinte')));
}

// ── H: obrigações declarativas estimadas ──
{
  const peq = compararEnquadramento2026({
    ...defaultInputEnq2026(),
    rend: { vendas: 0, servicosProf: 13000, outrosServicos: 0, restantes: 0 },
    faturacaoAnoAnterior: 14000, anoAtividade: 3,
  });
  const isen = peq.cenarios.find(c => c.rendimento === 'eni-simplificado' && c.iva === 'isencao53')!;
  approx('H: ENI simplificado + isenção = 5 obrigações (Mod3 + 4×SS)', isen.obrigacoes, 5);
  const r = compararEnquadramento2026(base);
  const socM = r.cenarios.find(c => c.rendimento === 'soc-irc-normal' && c.iva === 'mensal')!;
  approx('H: sociedade + IVA mensal = 26 obrigações', socM.obrigacoes, 26);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden do Enquadramento 2026 passaram.');
