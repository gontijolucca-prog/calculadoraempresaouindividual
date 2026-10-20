import React, { useMemo } from 'react';
import { Download, Scale } from 'lucide-react';
import { numInput } from './lib/inputGuards';
import ComparadorAquisicao from './components/ComparadorAquisicao';
import { NaoAplicavel, patchNaoAplicavel } from './components/NaoAplicavel';
import { compararModos, ETIQUETA_MODO, MODOS, type FinanciamentoInput, type ModoAquisicao } from './lib/viaturasFinanciamento';
import { RelatorioPdf } from './lib/reportPdf';
import { loadOfficeSettings } from './lib/officeSettings';

export interface AquisicaoState {
  categoria: 'passageiros' | 'comercial' | 'comercial_n1' | 'moto';
  motor: string;
  ivaRegime: 'normal' | 'second_hand' | 'leasing';
  activity: string;
  regimeTributario: 'irc' | 'irs';
  price: number;
  maintenanceCost: number;
  insuranceCost: number;
  fuelCost: number;
  /** Campos marcados como "não aplicável" (desativados e a 0). */
  na?: string[];
  modoAquisicao?: ModoAquisicao;
  financiamento?: Record<string, unknown>;
}

export const defaultAquisicaoState: AquisicaoState = {
  categoria: 'passageiros', motor: 'diesel', ivaRegime: 'normal', activity: 'other',
  regimeTributario: 'irc', price: 0, maintenanceCost: 0, insuranceCost: 0, fuelCost: 0,
  modoAquisicao: 'compra',
  financiamento: { entrada: 0, duracaoMeses: 48, tanPercent: 6, valorResidual: 0 },
};

const eur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
const inputCls = 'w-full rounded-[8px] border-2 border-[#E2E8F0] bg-white px-3 py-2.5 text-[13.5px] font-[600] text-[#0F172A] outline-none focus:border-[#0F172A]';
const labelCls = 'mb-1 block text-[10.5px] font-[800] uppercase tracking-[1px] text-[#64748B]';

export default function AquisicaoSimulator({
  initialState, onStateChange, cliente, nif,
}: {
  initialState: AquisicaoState;
  onStateChange: (s: AquisicaoState) => void;
  cliente?: string;
  nif?: string;
}) {
  const s = { ...defaultAquisicaoState, ...initialState };
  const set = (patch: Partial<AquisicaoState>) => onStateChange({ ...s, ...patch });
  const naCampos = s.na ?? [];

  const base: FinanciamentoInput = useMemo(() => {
    const fin = (s.financiamento || {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return {
      preco: s.price,
      duracaoMeses: num(fin.duracaoMeses) || 48,
      entrada: num(fin.entrada),
      valorResidual: num(fin.valorResidual),
      tanPercent: fin.tanPercent !== undefined ? num(fin.tanPercent) : 6,
      mensalidadeManual: num(fin.mensalidadeManual) || undefined,
      incluiManutencao: fin.incluiManutencao !== false,
      incluiSeguro: fin.incluiSeguro !== false,
      rentingDiscriminada: fin.rentingDiscriminada !== false,
      maintenanceCost: s.maintenanceCost,
      insuranceCost: s.insuranceCost,
      fuelCost: s.fuelCost,
      fiscal: {
        category: s.categoria, engineType: s.motor, ivaRegime: s.ivaRegime,
        activity: s.activity, regimeTributario: s.regimeTributario,
      },
    };
  }, [s]);

  const { resultados, melhor } = useMemo(() => compararModos(base), [base]);

  const exportarPdf = () => {
    const office = loadOfficeSettings();
    const pdf = new RelatorioPdf({
      titulo: 'Comparação de aquisição de viatura',
      subtitulo: 'Compra · Crédito · Leasing · Renting (ALU) — valores estimados',
      cliente: cliente || '—',
      nif: nif || '—',
      escritorio: { nome: office.nome, corPrimaria: office.corPrimaria, logoDataUrl: office.logoDataUrl },
      nomeFicheiro: `Aquisicao-Viatura-${cliente || ''}`,
    });
    pdf.seccao('Dados da viatura').tabela([
      { label: 'Categoria', valor: s.categoria },
      { label: 'Motor', valor: s.motor },
      { label: 'Regime de IVA', valor: s.ivaRegime },
      { label: 'Atividade', valor: s.activity },
      { label: 'Preço', valor: eur(s.price) },
      { label: 'Manutenção anual', valor: eur(s.maintenanceCost) },
      { label: 'Seguro anual', valor: eur(s.insuranceCost) },
      { label: 'Combustível anual', valor: eur(s.fuelCost) },
    ]);
    pdf.seccao('Comparação dos modos').tabela(
      MODOS.map(m => ({
        label: ETIQUETA_MODO[m],
        valor: `Mensalidade ${resultados[m].mensalidade > 0 ? eur(resultados[m].mensalidade) : '—'} · custo total ${eur(resultados[m].custoTotal)} · líquido ${eur(resultados[m].custoLiquido)} · TA ${eur(resultados[m].taValue)}`,
      })),
    );
    pdf.seccao('Escolha recomendada').tabela([
      { label: 'Modo mais barato', valor: ETIQUETA_MODO[melhor] },
      { label: 'Custo líquido (após IVA)', valor: eur(resultados[melhor].custoLiquido) },
      { label: 'Gasto aceite fiscalmente', valor: eur(resultados[melhor].gastoAceite) },
      { label: 'IVA recuperável', valor: eur(resultados[melhor].ivaDedutivel) },
      { label: 'Tributação Autónoma', valor: eur(resultados[melhor].taValue) },
    ], { destaquePrimeira: true });
    pdf.nota('Estimativas para apoio à decisão — confirme o enquadramento e os valores com o seu Contabilista Certificado.');
    pdf.save();
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] px-4 py-8 text-[#1E293B] sm:px-6">
      <div className="mx-auto max-w-[1240px]">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-[14px] bg-[#EEF2FF] p-3 text-[#4F46E5]"><Scale className="h-6 w-6" /></div>
            <div>
              <h1 className="text-[24px] font-[800] tracking-[-0.4px] text-[#0F172A]">Aquisição de viatura</h1>
              <p className="mt-1 text-[13px] text-[#64748B]">Compara compra, crédito, leasing e renting (aluguer de longa duração) com o mesmo enquadramento fiscal.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportarPdf}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#0677FF] px-4 py-2.5 text-[13px] font-[700] text-white hover:bg-blue-600"
          >
            <Download className="h-4 w-4" /> Descarregar PDF
          </button>
        </header>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <section className="space-y-4 rounded-[18px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#64748B]">Dados da viatura</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Categoria</label>
                <select value={s.categoria} onChange={e => set({ categoria: e.target.value as AquisicaoState['categoria'] })} className={inputCls}>
                  <option value="passageiros">Ligeiro de passageiros</option>
                  <option value="comercial">Comercial isento (2-3 lugares)</option>
                  <option value="comercial_n1">Comercial N1 (4-5 lugares)</option>
                  <option value="moto">Mota / motociclo</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Motor</label>
                <select value={s.motor} onChange={e => set({ motor: e.target.value })} className={inputCls}>
                  <option value="diesel">Gasóleo</option>
                  <option value="gasoline">Gasolina</option>
                  <option value="hybrid">Híbrido</option>
                  <option value="phev">Híbrido plug-in</option>
                  <option value="electric">Elétrico</option>
                  <option value="hydrogen">Hidrogénio</option>
                  <option value="lpg">GPL</option>
                  <option value="cng">GNV</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Regime de IVA</label>
                <select value={s.ivaRegime} onChange={e => set({ ivaRegime: e.target.value as AquisicaoState['ivaRegime'] })} className={inputCls}>
                  <option value="normal">Compra nova (fatura com IVA)</option>
                  <option value="second_hand">Bens em 2.ª mão</option>
                  <option value="leasing">Locação / leasing / renting</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Atividade</label>
                <select value={s.activity} onChange={e => set({ activity: e.target.value })} className={inputCls}>
                  <option value="other">Geral / serviços / comércio</option>
                  <option value="goods">Transporte de mercadorias</option>
                  <option value="public_transport">Transporte público / táxi</option>
                  <option value="tvde">TVDE (Uber/Bolt)</option>
                  <option value="rent_a_car">Rent-a-car</option>
                  <option value="driving_school">Escola de condução</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Regime tributário</label>
                <select value={s.regimeTributario} onChange={e => set({ regimeTributario: e.target.value as AquisicaoState['regimeTributario'] })} className={inputCls}>
                  <option value="irc">Empresa — IRC</option>
                  <option value="irs">Recibos verdes — IRS</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Preço (s/ IVA) *</label>
                <input type="number" value={s.price === 0 ? '' : s.price} onChange={e => set({ price: numInput(e.target.value) })} className={inputCls} placeholder="ex: 30000" />
              </div>
            </div>

            <h3 className="pt-1 text-[12px] font-[800] uppercase tracking-[1px] text-[#64748B]">Encargos anuais (com IVA)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className={labelCls}>Manutenção <NaoAplicavel ativo={naCampos.includes('maintenanceCost')} onChange={v => set(patchNaoAplicavel(s, 'maintenanceCost', v))} /></div>
                <input type="number" disabled={naCampos.includes('maintenanceCost')} value={naCampos.includes('maintenanceCost') || s.maintenanceCost === 0 ? '' : s.maintenanceCost} onChange={e => set({ maintenanceCost: numInput(e.target.value) })} className={inputCls + (naCampos.includes('maintenanceCost') ? ' opacity-50' : '')} />
              </div>
              <div>
                <div className={labelCls}>Seguro <NaoAplicavel ativo={naCampos.includes('insuranceCost')} onChange={v => set(patchNaoAplicavel(s, 'insuranceCost', v))} /></div>
                <input type="number" disabled={naCampos.includes('insuranceCost')} value={naCampos.includes('insuranceCost') || s.insuranceCost === 0 ? '' : s.insuranceCost} onChange={e => set({ insuranceCost: numInput(e.target.value) })} className={inputCls + (naCampos.includes('insuranceCost') ? ' opacity-50' : '')} />
              </div>
              <div>
                <div className={labelCls}>Combustível <NaoAplicavel ativo={naCampos.includes('fuelCost')} onChange={v => set(patchNaoAplicavel(s, 'fuelCost', v))} /></div>
                <input type="number" disabled={naCampos.includes('fuelCost')} value={naCampos.includes('fuelCost') || s.fuelCost === 0 ? '' : s.fuelCost} onChange={e => set({ fuelCost: numInput(e.target.value) })} className={inputCls + (naCampos.includes('fuelCost') ? ' opacity-50' : '')} />
              </div>
            </div>
            <p className="text-[11px] leading-snug text-[#94A3B8]">No renting, manutenção e seguro podem estar incluídos na mensalidade (ver abaixo).</p>
          </section>

          <section className="space-y-4">
            <ComparadorAquisicao
              state={s as unknown as Record<string, unknown>}
              onChange={(p) => set(p as Partial<AquisicaoState>)}
            />
            <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 text-[12px] leading-relaxed text-[#64748B]">
              <strong className="text-[#0F172A]">Recomendação:</strong> {ETIQUETA_MODO[melhor]} — custo líquido de {eur(resultados[melhor].custoLiquido)} após IVA, com {eur(resultados[melhor].gastoAceite)} aceites fiscalmente.
              {' '}Clicar no nome de um modo usa-o como referência.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
