// Testes de prazos/notificações. Correr: npx tsx src/lib/notificacoes.test.ts
import {
  diasAte, diaChave, severidadeDe, prazosNotificaveis, resumoBadge, porLer,
  proximosSaft, marcarLida, lerLidas,
} from './notificacoes';
import type { AlertaGabinete, GabineteCliente, Obrigacao } from './gabinete';

let fails = 0;
function is(label: string, got: unknown, exp: unknown) {
  if (got !== exp) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got}`); }
  else console.log(`✓ ${label}`);
}
function ok(label: string, cond: boolean) { if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

// 2026-03-10 12:00 local
const HOJE = new Date(2026, 2, 10, 12, 0, 0).getTime();
const dia = (d: number) => new Date(2026, 2, d, 9, 0, 0).getTime();

const cli = (id: string, nome: string): GabineteCliente => ({
  id, nome, nif: '123456789', tipoEntidade: 'LDA', regimeIva: 'trimestral', estado: 'ativo', createdAt: 1, updatedAt: 1,
});

const obr = (p: Partial<Obrigacao> & Pick<Obrigacao, 'id' | 'clienteId' | 'vencimento'>): Obrigacao => ({
  tipo: 'iva', titulo: `Obrigação ${p.id}`, periodo: '2026-03', estado: 'pendente', createdAt: 1, updatedAt: 1, ...p,
});

const clientes = [cli('c1', 'Empresa A'), cli('c2', 'Empresa B')];

// ── A: matemática de dias por data local
{
  is('A: hoje = 0', diasAte(dia(10), HOJE), 0);
  is('A: ontem = -1', diasAte(dia(9), HOJE), -1);
  is('A: amanhã = 1', diasAte(dia(11), HOJE), 1);
  is('A: 7 dias', diasAte(dia(17), HOJE), 7);
  is('A: atrasado', severidadeDe(-1), 'atrasado');
  is('A: hoje', severidadeDe(0), 'hoje');
  is('A: próximo', severidadeDe(3), 'proximo');
  is('A: futuro', severidadeDe(8), 'futuro');
  is('A: chave do dia', diaChave(HOJE), '2026-03-10');
}

// ── B: lista junta obrigações e alertas, ignora concluídas/calendário/fora da janela
{
  const obrigacoes = [
    obr({ id: 'o1', clienteId: 'c1', vencimento: dia(12) }),                                     // 2 dias
    obr({ id: 'o2', clienteId: 'c1', vencimento: dia(8), estado: 'atrasada' }),                   // atrasada
    obr({ id: 'o3', clienteId: 'c2', vencimento: dia(9), estado: 'entregue' }),                   // ignorada
    obr({ id: 'o4', clienteId: 'c2', vencimento: dia(10), estado: 'dispensada' }),                // ignorada
    obr({ id: 'o5', clienteId: 'c2', vencimento: dia(30) }),                                      // fora
    obr({ id: 'o6', clienteId: 'c2', vencimento: dia(11), origem: 'calendario_fiscal' }),         // ignorada
    obr({ id: 'o7', clienteId: 'c2', vencimento: dia(10), catalogoId: 'saft' }),                  // SAF-T hoje
  ];
  const alertas: AlertaGabinete[] = [
    { id: 'a1', clienteId: 'c1', texto: 'Confirmar NIF', vencimento: dia(11), estado: 'aberto' } as AlertaGabinete,
    { id: 'a2', clienteId: 'c1', texto: 'Resolvido', vencimento: dia(10), estado: 'resolvido' } as AlertaGabinete,
    { id: 'a3', clienteId: 'c2', texto: 'Sem prazo' } as AlertaGabinete,
  ];
  const lista = prazosNotificaveis({ clientes, obrigacoes, alertas, hoje: HOJE, janelaDias: 7 });
  is('B: total', lista.length, 4);
  is('B: primeiro é a atrasada', lista[0].id, 'o2');
  is('B: tipo SAF-T', lista.find(p => p.id === 'o7')?.tipo, 'saft');
  is('B: cliente preenchido', lista.find(p => p.id === 'o1')?.cliente, 'Empresa A');
  is('B: alerta incluído', !!lista.find(p => p.id === 'a1'), true);
  is('B: ordenado por vencimento', lista.map(p => p.id).join(','), 'o2,o7,a1,o1');
  const badge = resumoBadge(lista);
  is('B: atrasados no badge', badge.atrasados, 1);
  is('B: hoje no badge', badge.hoje, 1);
}

// ── C: dedupe diário
{
  const lista = prazosNotificaveis({
    clientes,
    obrigacoes: [obr({ id: 'o1', clienteId: 'c1', vencimento: dia(11) })],
    hoje: HOJE,
  });
  is('C: sem lidas → 1', porLer(lista, {}, HOJE).length, 1);
  const lidas = { [lista[0].chave]: diaChave(HOJE) };
  is('C: lida hoje → 0', porLer(lista, lidas, HOJE).length, 0);
  is('C: lida ontem → 1', porLer(lista, { [lista[0].chave]: '2026-03-09' }, HOJE).length, 1);
}

// ── D: SAF-T dia 5 do mês seguinte
{
  const saftFev = obr({
    id: 's1', clienteId: 'c1', tipo: 'dossier', catalogoId: 'saft', periodo: '2026-02',
    vencimento: new Date(2026, 2, 5).getTime(), titulo: 'SAF-T Faturação 02/2026 — Empresa A',
  });
  const saftMar = obr({
    id: 's2', clienteId: 'c1', tipo: 'dossier', catalogoId: 'saft', periodo: '2026-03',
    vencimento: new Date(2026, 3, 5).getTime(), titulo: 'SAF-T Faturação 03/2026 — Empresa A',
  });
  const prox = proximosSaft([saftFev, saftMar], HOJE, 3);
  is('D: próxima SAF-T é a de março', prox[0].id, 's2');
  is('D: dias até 05/04', prox[0].dias, 26);
  ok('D: a de fevereiro já passou e não entra', !prox.some(p => p.id === 's1'));
}

// ── E: marcar como lida persiste (localStorage do node não existe → não rebenta)
{
  marcarLida({ chave: 'obrigacao|x', tipo: 'obrigacao', id: 'x', titulo: 'T', vencimento: HOJE, dias: 0, severidade: 'hoje' }, HOJE);
  ok('E: leitura de lidas sobrevive sem localStorage', typeof lerLidas() === 'object');
}

if (fails > 0) { console.error(`\n${fails} falha(s)`); process.exit(1); }
console.log('\nTodos os testes de notificações passaram.');
