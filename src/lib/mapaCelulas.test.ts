// Testes do modelo de célula dos mapas. Correr: npx tsx src/lib/mapaCelulas.test.ts
import {
  resolverPilarLegado, correspondeCelula, obterObrigacaoCelula, estadoCelula,
  proximoEstado, construirObrigacaoDaCelula, chaveCelula, type CellKey,
} from './mapaCelulas';
import type { Obrigacao } from './gabinete';

let fails = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}
const is = (label: string, got: unknown, exp: unknown) => ok(`${label} (${String(got)})`, got === exp);

const obr = (p: Partial<Obrigacao> & Pick<Obrigacao, 'id' | 'clienteId' | 'tipo' | 'vencimento'>): Obrigacao => ({
  titulo: p.id, periodo: '2026-03', estado: 'pendente', createdAt: 1, updatedAt: 1, ...p,
});

const PIP = (id: string, tipos: Obrigacao['tipo'][]) => ({ id, label: id, tipos });

const salarios = PIP('salarios', ['retencao', 'ss']);
const pagamentos = PIP('pagamentos', ['ss', 'retencao']);
const dmrAt = PIP('dmr_at', ['retencao']);
const dmrSs = PIP('dmr_ss', ['ss']);

// ── A: célula nova identifica-se por pilarId; não acende irmãs com os mesmos tipos
{
  const o = obr({
    id: 'o1', clienteId: 'c1', tipo: 'retencao', vencimento: new Date(2026, 2, 20).getTime(),
    mapa: 'rh', pilarId: 'salarios',
  });
  const k = (refId: string): CellKey => ({ clienteId: 'c1', mapa: 'rh', refId, ano: 2026, mes: 3 });
  ok('A: pertence a Salários', correspondeCelula(o, k('salarios'), salarios.tipos));
  ok('A: NÃO pertence a Pagamentos', !correspondeCelula(o, k('pagamentos'), pagamentos.tipos));
  ok('A: NÃO pertence a DMR-AT', !correspondeCelula(o, k('dmr_at'), dmrAt.tipos));
  ok('A: NÃO pertence a DMR-SS', !correspondeCelula(o, k('dmr_ss'), dmrSs.tipos));
}

// ── B: legado sem pilarId é atribuído a um só pilar (o mais específico)
{
  const legado = obr({ id: 'leg', clienteId: 'c1', tipo: 'retencao', vencimento: new Date(2026, 2, 20).getTime() });
  const mapa = resolverPilarLegado([legado], [salarios, pagamentos, dmrAt, dmrSs]);
  is('B: legado vai para o pilar mais específico', mapa.get('leg'), 'dmr_at');
  const k = (refId: string): CellKey => ({ clienteId: 'c1', mapa: 'rh', refId, ano: 2026, mes: 3 });
  ok('B: legado só acende DMR-AT', correspondeCelula(legado, k('dmr_at'), dmrAt.tipos, mapa));
  ok('B: legado não acende Salários', !correspondeCelula(legado, k('salarios'), salarios.tipos, mapa));
}

// ── C: Quadro — catalogoId vence tipos partilhados (saft vs modelo44)
{
  const saft = obr({
    id: 's1', clienteId: 'c1', tipo: 'dossier', vencimento: new Date(2026, 2, 5).getTime(), catalogoId: 'saft',
  });
  const kSaft: CellKey = { clienteId: 'c1', mapa: 'quadro', refId: 'saft', ano: 2026, mes: 3 };
  const kM44: CellKey = { clienteId: 'c1', mapa: 'quadro', refId: 'modelo44', ano: 2026, mes: 3 };
  ok('C: SAF-T acende SAF-T', correspondeCelula(saft, kSaft, ['dossier', 'outro']));
  ok('C: SAF-T não acende Modelo 44', !correspondeCelula(saft, kM44, ['modelo22', 'dossier']));
  const m44 = obr({ id: 'm1', clienteId: 'c1', tipo: 'modelo22', vencimento: new Date(2026, 2, 20).getTime(), catalogoId: 'modelo44' });
  ok('C: Modelo 44 não acende SAF-T', !correspondeCelula(m44, kSaft, ['dossier', 'outro']));
}

// ── D: estados e ciclo do clique
{
  is('D: sem registo', estadoCelula(undefined), 'sem_dados');
  is('D: entregue', estadoCelula(obr({ id: 'x', clienteId: 'c', tipo: 'iva', vencimento: 0, estado: 'entregue' })), 'concluido');
  is('D: pendente é neutro', estadoCelula(obr({ id: 'x', clienteId: 'c', tipo: 'iva', vencimento: 0 })), 'sem_dados');
  is('D: dispensada é neutra', estadoCelula(obr({ id: 'x', clienteId: 'c', tipo: 'iva', vencimento: 0, estado: 'dispensada' })), 'sem_dados');
  is('D: ciclo ∅ → ✓', proximoEstado('sem_dados'), 'entregue');
  is('D: ciclo ✓ → ✕', proximoEstado('concluido'), 'atrasada');
  is('D: ciclo ✕ → ∅', proximoEstado('nao_concluido'), 'pendente');
  is('D: ciclo completo fecha', proximoEstado(estadoCelula({ id: 'x', clienteId: 'c', tipo: 'iva', vencimento: 0, periodo: '2026-03', titulo: 'x', estado: proximoEstado('nao_concluido'), createdAt: 1, updatedAt: 1 })), 'entregue');
}

// ── E: construção da obrigação preserva identidade e grava a célula
{
  const existente = obr({ id: 'keep', clienteId: 'c1', tipo: 'ss', vencimento: 0, createdAt: 111, estado: 'entregue' });
  const novo = construirObrigacaoDaCelula(
    { clienteId: 'c1', mapa: 'controlo', refId: 'banco', ano: 2026, mes: 2 },
    { id: 'banco', label: 'Banco', labelFull: 'Rec. Bancária', tipos: ['dossier', 'outro'] },
    { id: 'c1', nome: 'Empresa A' }, existente, 999,
  );
  is('E: preserva id', novo.id, 'keep');
  is('E: preserva createdAt', novo.createdAt, 111);
  is('E: mapa', novo.mapa, 'controlo');
  is('E: pilarId', novo.pilarId, 'banco');
  ok('E: sem catalogoId', novo.catalogoId === undefined);
  is('E: tipo do pilar', novo.tipo, 'dossier');
  is('E: período', novo.periodo, '2026-02');
  is('E: vencimento dia 20', new Date(novo.vencimento).getDate(), 20);
  is('E: título com pilar completo', novo.titulo, 'Rec. Bancária 02/2026 — Empresa A');
  is('E: estado seguinte', novo.estado, 'atrasada');
  is('E: updatedAt', novo.updatedAt, 999);
}

// ── F: quadro sem pilarId grava catalogoId e limpa campos de mapa
{
  const novo = construirObrigacaoDaCelula(
    { clienteId: 'c1', mapa: 'quadro', refId: 'iva', ano: 2026, mes: 8 },
    { id: 'iva', label: 'IVA', tipos: ['iva'] },
    { id: 'c1', nome: 'Empresa A' }, undefined, 500,
  );
  is('F: catalogoId', novo.catalogoId, 'iva');
  ok('F: sem mapa', novo.mapa === undefined);
  ok('F: sem pilarId', novo.pilarId === undefined);
  is('F: título do quadro', novo.titulo, 'IVA 08/2026 — Empresa A');
}

// ── G: legado do Quadro não é reclamado por células de mapa
{
  const legadoMapa = obr({ id: 'lm', clienteId: 'c1', tipo: 'retencao', vencimento: new Date(2026, 2, 20).getTime(), mapa: 'rh', pilarId: 'salarios' });
  ok('G: célula de mapa não cai no Quadro', !correspondeCelula(legadoMapa, { clienteId: 'c1', mapa: 'quadro', refId: 'ss', ano: 2026, mes: 3 }, ['ss', 'retencao']));
}

// ── H: apagado e mês errado não contam
{
  const apagado = obr({ id: 'd', clienteId: 'c1', tipo: 'iva', vencimento: new Date(2026, 2, 20).getTime(), catalogoId: 'iva', deletedAt: 5 });
  ok('H: apagado ignorado', !correspondeCelula(apagado, { clienteId: 'c1', mapa: 'quadro', refId: 'iva', ano: 2026, mes: 3 }, ['iva']));
  const c = obr({ id: 'c', clienteId: 'c1', tipo: 'iva', vencimento: new Date(2026, 11, 20).getTime(), catalogoId: 'iva' });
  ok('H: dezembro não é janeiro', !correspondeCelula(c, { clienteId: 'c1', mapa: 'quadro', refId: 'iva', ano: 2027, mes: 1 }, ['iva']));
  ok('H: dezembro é dezembro', correspondeCelula(c, { clienteId: 'c1', mapa: 'quadro', refId: 'iva', ano: 2026, mes: 12 }, ['iva']));
}

// ── I: desempate estável e chave
{
  const p = obr({ id: 'p', clienteId: 'c1', tipo: 'iva', vencimento: new Date(2026, 2, 20).getTime(), catalogoId: 'iva', estado: 'pendente', updatedAt: 10 });
  const e = obr({ id: 'e', clienteId: 'c1', tipo: 'iva', vencimento: new Date(2026, 2, 20).getTime(), catalogoId: 'iva', estado: 'entregue', updatedAt: 5 });
  const best = obterObrigacaoCelula([p, e], { clienteId: 'c1', mapa: 'quadro', refId: 'iva', ano: 2026, mes: 3 }, ['iva']);
  is('I: entregue vence pendente', best?.id, 'e');
  is('I: chave', chaveCelula({ clienteId: 'c1', mapa: 'rh', refId: 'dmr_at', ano: 2026, mes: 3 }), 'c1|rh|dmr_at|2026-03');
}

// ── J: legado do Quadro com tipos partilhados acende SÓ uma linha
{
  const legadoDossier = obr({
    id: 'q-leg', clienteId: 'c1', tipo: 'dossier', vencimento: new Date(2026, 2, 20).getTime(),
  });
  const catalogo = [
    { id: 'modelo44', label: 'Modelo 44', tipos: ['modelo22', 'dossier'] as Obrigacao['tipo'][] },
    { id: 'saft', label: 'Envio SAFT', tipos: ['dossier', 'outro'] as Obrigacao['tipo'][] },
    { id: 'banco', label: 'Banco', tipos: ['dossier', 'outro'] as Obrigacao['tipo'][] },
  ];
  const mapa = resolverPilarLegado([legadoDossier], catalogo);
  is('J: legado do Quadro vai para uma linha', mapa.get('q-leg'), 'modelo44');
  const k = (refId: string): CellKey => ({ clienteId: 'c1', mapa: 'quadro', refId, ano: 2026, mes: 3 });
  ok('J: acende Modelo 44', correspondeCelula(legadoDossier, k('modelo44'), catalogo[0].tipos, mapa));
  ok('J: NÃO acende SAFT', !correspondeCelula(legadoDossier, k('saft'), catalogo[1].tipos, mapa));
  ok('J: NÃO acende Banco', !correspondeCelula(legadoDossier, k('banco'), catalogo[2].tipos, mapa));
}

if (fails > 0) { console.error(`\n${fails} falha(s)`); process.exit(1); }
console.log('\nTodos os testes de célula passaram.');
