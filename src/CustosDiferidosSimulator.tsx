import React, { useMemo, useState } from 'react';
import { CalendarClock, Download, Info } from 'lucide-react';
import { RelatorioPdf } from './lib/reportPdf';
import { loadOfficeSettings } from './lib/officeSettings';
import { getCurrentEmpresa } from './lib/empresas';

/**
 * Acréscimos e diferimentos de gastos/proveitos.
 *
 * Reparte um valor pago (ou recebido) por um período entre a data de início e a
 * data de termo pelos anos civis que o período atravessa — o mesmo critério da
 * folha de cálculo do gabinete (dias corridos, inclusive). No fim, mostra
 * quanto fica reconhecido em cada ano e quanto está diferido a 31 de dezembro.
 */

const eur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DIA = 86400000;

function parseData(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface LinhaAno { ano: number; dias: number; valor: number; acumulado: number }

export default function CustosDiferidosSimulator() {
  const ano = new Date().getFullYear();
  const [descricao, setDescricao] = useState('');
  const [inicio, setInicio] = useState(`${ano}-01-01`);
  const [termo, setTermo] = useState(`${ano}-12-31`);
  const [valor, setValor] = useState<number>(0);
  const [tipo, setTipo] = useState<'gasto' | 'proveito'>('gasto');

  const erro = useMemo(() => {
    const i = parseData(inicio), t = parseData(termo);
    if (!i || !t) return 'Indique as datas de início e de termo.';
    if (t < i) return 'A data de termo tem de ser posterior à data de início.';
    if (!(valor > 0)) return 'Indique o valor total do contrato.';
    return null;
  }, [inicio, termo, valor]);

  const resultado = useMemo(() => {
    const i = parseData(inicio), t = parseData(termo);
    if (!i || !t || t < i || !(valor > 0)) return null;
    const totalDias = Math.floor((t.getTime() - i.getTime()) / DIA) + 1;
    const diario = valor / totalDias;
    const linhas: LinhaAno[] = [];
    let acumulado = 0;
    for (let a = i.getFullYear(); a <= t.getFullYear(); a++) {
      const iniAno = new Date(a, 0, 1);
      const fimAno = new Date(a, 11, 31);
      const de = i > iniAno ? i : iniAno;
      const ate = t < fimAno ? t : fimAno;
      const dias = Math.max(0, Math.floor((ate.getTime() - de.getTime()) / DIA) + 1);
      const v = Math.round(diario * dias * 100) / 100;
      acumulado += v;
      linhas.push({ ano: a, dias, valor: v, acumulado });
    }
    // Ajuste de arredondamento no último ano, para somar exatamente o valor.
    const diferenca = Math.round((valor - linhas.reduce((s, l) => s + l.valor, 0)) * 100) / 100;
    if (Math.abs(diferenca) >= 0.01 && linhas.length) {
      linhas[linhas.length - 1].valor = Math.round((linhas[linhas.length - 1].valor + diferenca) * 100) / 100;
    }
    let acc = 0;
    for (const l of linhas) { acc += l.valor; l.acumulado = Math.round(acc * 100) / 100; }
    return { totalDias, diario, linhas };
  }, [inicio, termo, valor]);

  const nome = descricao.trim() || (tipo === 'gasto' ? 'Custo diferido' : 'Proveito diferido');

  const pdf = () => {
    if (erro || !resultado) return;
    const office = loadOfficeSettings();
    const emp = getCurrentEmpresa();
    const doc = new RelatorioPdf({
      titulo: 'Acréscimos e Diferimentos',
      subtitulo: `${nome} — repartição pelos anos do contrato`,
      cliente: emp?.nome || emp?.profile?.nomeCliente || 'Por preencher',
      nif: emp?.nif || emp?.profile?.nif || 'Por preencher',
      escritorio: { nome: office.nome, corPrimaria: office.corPrimaria, logoDataUrl: office.logoDataUrl },
      nomeFicheiro: `Custos_Diferidos_${nome}`,
    });
    doc.seccao('Contrato').tabela([
      { label: 'Descrição', valor: nome },
      { label: 'Tipo', valor: tipo === 'gasto' ? 'Gasto (acréscimo/diferimento)' : 'Proveito (acréscimo/diferimento)' },
      { label: 'Data de início', valor: new Date(`${inicio}T00:00:00`).toLocaleDateString('pt-PT') },
      { label: 'Data de termo', valor: new Date(`${termo}T00:00:00`).toLocaleDateString('pt-PT') },
      { label: 'Total de dias', valor: String(resultado.totalDias) },
      { label: 'Valor total', valor: eur(valor) },
      { label: 'Valor por dia', valor: eur(resultado.diario) },
    ]);
    doc.seccao('Repartição por ano').tabela(
      resultado.linhas.map((l) => ({ label: `Ano ${l.ano} · ${l.dias} dias`, valor: eur(l.valor) })),
    );
    doc.seccao('Saldos a 31 de dezembro').tabela(
      resultado.linhas.map((l) => ({ label: `Diferido no fim de ${l.ano}`, valor: eur(Math.max(0, valor - l.acumulado)) })),
    );
    doc.nota('Critério: dias corridos, contando o primeiro e o último dia. O valor reconhecido em cada ano é proporcional aos dias do período que caem nesse ano; o último ano absorve diferenças de arredondamento. A conta 2812 (gastos a reconhecer) é a contrapartida habitual.');
    doc.save();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F5F7FA]">
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <header className="mb-5">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-[800] uppercase tracking-[1.2px] text-slate-500 border border-slate-200">
            <CalendarClock className="h-3.5 w-3.5" /> Acréscimos e diferimentos
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-[800] tracking-[-1px] text-[#0F172A] leading-tight">Custos Diferidos</h1>
          <p className="text-[13.5px] text-[#64748B] font-[500] mt-1">Reparte um valor pelo período do contrato e mostra o que fica reconhecido em cada ano.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
          <section className="bg-white border border-slate-200 rounded-[18px] p-5 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]" htmlFor="cd-desc">Descrição</label>
                <input id="cd-desc" type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex.: Seguro de responsabilidade civil 2026" className="w-full rounded-[8px] border-2 border-[#E2E8F0] bg-[#F5F7FA] px-3 py-2.5 text-[14px] font-[600] text-[#0F172A] outline-none focus:border-[var(--accent)]" />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]" htmlFor="cd-tipo">Tipo</label>
                <select id="cd-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as 'gasto' | 'proveito')} className="w-full rounded-[8px] border-2 border-[#E2E8F0] bg-[#F5F7FA] px-3 py-2.5 text-[14px] font-[600] text-[#0F172A] outline-none focus:border-[var(--accent)]">
                  <option value="gasto">Gasto pago antecipadamente</option>
                  <option value="proveito">Proveito recebido antecipadamente</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]" htmlFor="cd-inicio">Data de início</label>
                  <input id="cd-inicio" type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full rounded-[8px] border-2 border-[#E2E8F0] bg-[#F5F7FA] px-3 py-2.5 text-[13px] font-[600] text-[#0F172A] outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]" htmlFor="cd-termo">Data de termo</label>
                  <input id="cd-termo" type="date" required value={termo} onChange={(e) => setTermo(e.target.value)} className="w-full rounded-[8px] border-2 border-[#E2E8F0] bg-[#F5F7FA] px-3 py-2.5 text-[13px] font-[600] text-[#0F172A] outline-none focus:border-[var(--accent)]" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]" htmlFor="cd-valor">Valor total (€)</label>
                <input id="cd-valor" type="number" min={0} step={0.01} required value={valor || ''} onChange={(e) => setValor(Number(e.target.value) || 0)} placeholder="0,00" className="w-full rounded-[8px] border-2 border-[#E2E8F0] bg-[#F5F7FA] px-3 py-2.5 text-[14px] font-[600] text-[#0F172A] outline-none focus:border-[var(--accent)]" />
              </div>

              {erro && (
                <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-[600] text-amber-900">{erro}</div>
              )}

              <button type="button" onClick={pdf} disabled={!!erro || !resultado} className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] px-4 py-3 text-[13px] font-[800] text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-4 w-4" /> Descarregar PDF
              </button>
            </div>
          </section>

          <section className="min-w-0">
            {!resultado ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-[18px] border border-dashed border-slate-300 bg-white/60 p-6 text-center text-[13px] font-[500] text-slate-500">
                Preencha o período e o valor para ver a repartição por ano.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    ['Total de dias', String(resultado.totalDias)],
                    ['Valor por dia', eur(resultado.diario)],
                    ['Anos abrangidos', String(resultado.linhas.length)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-[10px] font-[800] uppercase tracking-[0.8px] text-slate-400">{label}</div>
                      <div className="mt-1 text-[20px] font-[800] tabular-nums text-[#0F172A]">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[1fr_90px_130px] gap-2 bg-slate-50 px-4 py-2 text-[10px] font-[800] uppercase tracking-[0.6px] text-slate-500">
                    <span>Ano</span><span className="text-right">Dias</span><span className="text-right">Reconhecido</span>
                  </div>
                  {resultado.linhas.map((l) => (
                    <div key={l.ano} className="grid grid-cols-[1fr_90px_130px] gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px]">
                      <span className="font-[600] text-slate-700">{l.ano}</span>
                      <span className="text-right tabular-nums text-slate-500">{l.dias}</span>
                      <span className="text-right font-[700] tabular-nums text-[#0F172A]">{eur(l.valor)}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_90px_130px] gap-2 border-t-2 border-slate-300 bg-slate-50 px-4 py-2.5 text-[13px] font-[800]">
                    <span>Total</span><span className="text-right tabular-nums">{resultado.totalDias}</span><span className="text-right tabular-nums">{eur(valor)}</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[1fr_130px] gap-2 bg-slate-50 px-4 py-2 text-[10px] font-[800] uppercase tracking-[0.6px] text-slate-500">
                    <span>Saldo a 31 de dezembro</span><span className="text-right">Diferido</span>
                  </div>
                  {resultado.linhas.map((l) => (
                    <div key={l.ano} className="grid grid-cols-[1fr_130px] gap-2 border-t border-slate-100 px-4 py-2.5 text-[13px]">
                      <span className="font-[600] text-slate-700">Fim de {l.ano}</span>
                      <span className="text-right font-[700] tabular-nums text-[#0F172A]">{eur(Math.max(0, valor - l.acumulado))}</span>
                    </div>
                  ))}
                </div>

                <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  Critério de dias corridos, com o primeiro e o último dia incluídos. O último ano absorve diferenças de arredondamento.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
