import React, { createContext, useContext } from 'react';
import { Download } from 'lucide-react';
import { detailSimulacao, type SimView } from './lib/simSummary';
import { resultSimulacao } from './lib/simResults';
import { calcViatura } from './lib/viaturas';
import { compararModos, ETIQUETA_MODO, MODOS, type FinanciamentoInput } from './lib/viaturasFinanciamento';
import { calcIMT, type TipoImovel, type Localizacao } from './lib/imt';
import type { ClientProfile } from './ClientProfile';
import type { OfficeSettings } from './lib/officeSettings';
import type { PreviSaState } from './previSaState';
import { PDF_COLORS as C } from './lib/pdfTheme';

export interface SimulatorPrintContextValue {
  view: SimView | null;
  state: unknown;
  profile: ClientProfile;
  office: OfficeSettings;
}

const PrintContext = createContext<SimulatorPrintContextValue | null>(null);

export function SimulatorPrintProvider({ value, children }: { value: SimulatorPrintContextValue; children: React.ReactNode }) {
  return <PrintContext.Provider value={value}>{children}</PrintContext.Provider>;
}

const PRINT_TITLES: Record<SimView, string> = {
  tax: 'Simulação Fiscal — ENI vs Sociedade',
  vehicle: 'Simulação de Viaturas',
  ticket: 'Simulação de Tickets e Benefícios',
  selfss: 'Simulação de Segurança Social — Independente',
  diagnostico: 'Diagnóstico de Gestão e Autonomia',
  imoveis: 'Simulação de Imóveis na Empresa',
  imt: 'Simulação de IMT e Imposto do Selo',
  salario: 'Simulação de Salário Líquido',
  irs: 'Simulação de IRS — Modelo 3',
  previsa: 'Simulação Previsa — IRC Modelo 22',
};

const PRINT_METHOD: Record<SimView, string> = {
  tax: 'ENI em simplificado (coeficiente do art. 31.º conforme a atividade) com TSU de 21,4% vs. sociedade com IRC de 15% até €50.000 (PME) e 19% no excedente, TSU de 23,75% + 11% e derramas. Vence o regime com maior líquido anual.',
  vehicle: 'IVA dedutível conforme a categoria e o regime da aquisição; Tributação Autónoma pela taxa do combustível e escalão de valor; limites de depreciação fiscal por tipo de viatura.',
  ticket: 'Subsídio de refeição isento até €10,46/dia em cartão (€6,15 em numerário); 60% do encargo dedutível em IRC (art. 43.º do CIRC).',
  selfss: 'Base de incidência de 70% nos serviços e 20% nos bens, taxa de 21,4%, com mínimo e teto indexados ao IAS; isenção total no 1.º ano de atividade (art. 164.º).',
  diagnostico: 'Cinco pilares pontuados de 0 a 5 a partir dos rácios do balanço: autonomia (≥40%), endividamento (≤50%), liquidez (≥1,5), margem (≥15%), concentração de clientes e dependência financeira.',
  imoveis: 'Comparativo arrendamento/comodato vs. entrada em espécie: IMT + Imposto do Selo (0,8%) + escritura na entrada, renda anual estimada de 4% e depreciação fiscal de 2% ao ano.',
  imt: 'Tabelas de IMT por tipo de imóvel e localização, mais Imposto do Selo de 0,8%; benefício IMT Jovem na primeira habitação quando aplicável.',
  salario: 'Tabelas de retenção na fonte de IRS de 2026 por estado civil, dependentes e região, com ou sem duodécimos; Segurança Social de 11% e subsídio de alimentação dentro dos limites.',
  irs: 'Taxas progressivas do CIRS sobre o rendimento englobado, com deduções por dependentes e despesas, benefício do IRS Jovem e devolução municipal até 5%.',
  previsa: 'Da Q07 (apuramento) à Q09 (matéria coletável) e Q10 (liquidação) do Modelo 22: IRC de 15% até €50.000 (PME) e 19% no excedente, tributações autónomas e pagamentos por conta.',
};

const num = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const eur = (value: number): string => new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0);
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const esc = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

function diagnosticScores(s: any): number[] {
  const autonomia = num(s.ativoTotal) > 0 ? num(s.capitaisProprios) / num(s.ativoTotal) : 0;
  const endividamento = num(s.ativoTotal) > 0 ? num(s.passivoTotal) / num(s.ativoTotal) : 0;
  const p1 = ((autonomia >= 0.40 ? 5 : autonomia >= 0.25 ? 3 : 1) + (endividamento <= 0.50 ? 5 : endividamento <= 0.75 ? 3 : 1)) / 2;
  const liquidez = num(s.passivoCorrente) > 0 ? num(s.ativoCorrente) / num(s.passivoCorrente) : 5;
  const meses = num(s.custoFixoMensal) > 0 ? num(s.disponibilidades) / num(s.custoFixoMensal) : Infinity;
  const p2 = ((liquidez >= 1.5 ? 5 : liquidez >= 1 ? 3 : 1) + (meses >= 6 ? 5 : meses >= 3 ? 3 : 1)) / 2;
  const margem = num(s.volumeNegocios) > 0 ? num(s.resultadoLiquido) / num(s.volumeNegocios) : 0;
  const p3 = ((margem >= 0.15 ? 5 : margem >= 0.05 ? 3 : 1) + (s.ebitda === 'positivo' ? 5 : s.ebitda === 'marginal' ? 3 : 1)) / 2;
  const concentracao = num(s.volumeNegocios) > 0 ? num(s.faturacaoMaiorCliente) / num(s.volumeNegocios) : 0;
  const depFinanc = num(s.totalFinanciamento) > 0 ? num(s.financiamentoExterno) / num(s.totalFinanciamento) : 0;
  const p4 = ((concentracao <= 0.20 ? 5 : concentracao <= 0.40 ? 3 : 1) + (depFinanc <= 0.30 ? 5 : depFinanc <= 0.60 ? 3 : 1)) / 2;
  const p5 = [s.processosDefinidos, s.softwareGestao, s.equipaAutonoma, s.baixaDependenciaGerente, s.controlFinanceiro].filter(Boolean).length;
  return [p1, p2, p3, p4, p5];
}

function extraInputs(view: SimView, state: unknown): { label: string; valor: string }[] {
  const s = state as any;
  if (view === 'diagnostico') {
    return [
      { label: 'Capitais próprios', valor: eur(num(s.capitaisProprios)) },
      { label: 'Ativo total', valor: eur(num(s.ativoTotal)) },
      { label: 'Passivo total', valor: eur(num(s.passivoTotal)) },
      { label: 'Resultado líquido', valor: eur(num(s.resultadoLiquido)) },
      { label: 'EBITDA', valor: String(s.ebitda || '—') },
    ].filter((item) => item.valor !== eur(0) && item.valor !== '—');
  }
  return [];
}

function extraResults(view: SimView, state: unknown, profile: ClientProfile): { label: string; valor: string }[] {
  const s = state as any;
  try {
    if (view === 'vehicle' && (num(s.price) > 0 || num(s.maintenanceCost) > 0 || num(s.fuelCost) > 0)) {
      const r = calcViatura({
        // Categoria real (passageiros/comercial/comercial_n1/moto) — não colapsar em
        // passageiros, senão o PDF mostra IVA/TA diferentes do ecrã.
        category: (['passageiros', 'comercial', 'comercial_n1', 'moto'].includes(String(s.category)) ? s.category : 'passageiros'),
        engineType: String(s.engineType || 'diesel'), price: num(s.price),
        ivaRegime: String(s.ivaRegime || 'normal'), activity: String(s.activity || 'other'),
        maintenanceCost: num(s.maintenanceCost), insuranceCost: num(s.insuranceCost), fuelCost: num(s.fuelCost),
        exemptTA: !!s.exemptTA, phevCompliant: !!s.phevCompliant, agravamentoTA: !!s.agravamentoTA,
        co2Emissions: s.co2Emissions, autonomiaEletrica: s.autonomiaEletrica, euro6eBis: !!s.euro6eBis,
        rentingDiscriminada: s.rentingDiscriminada, regimeTributario: s.regimeTributario,
        usoPercentagem: s.usoPercentagem, cilindrada: s.cilindrada,
      });
      return [
        { label: 'IVA total dedutível', valor: eur(r.ivaTotalDedutivel) },
        { label: 'Taxa de Tributação Autónoma', valor: pct(r.taRate) },
        { label: 'Tributação Autónoma estimada', valor: eur(r.taValue) },
        { label: 'Depreciação não aceite', valor: eur(r.depNaoAceite) },
      ];
    }
    if (view === 'diagnostico') {
      const labels = ['Autonomia financeira', 'Tesouraria', 'Rentabilidade', 'Dependência', 'Operacional'];
      const scores = diagnosticScores(s);
      return [
        { label: 'Score global', valor: `${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} / 5` },
        ...scores.map((score, index) => ({ label: labels[index], valor: `${score.toFixed(1)} / 5` })),
      ];
    }
    if (view === 'imoveis' && num(s.valorImovel) > 0) {
      const imt = calcIMT(num(s.valorImovel), 'urbano_outros', 'continente', false, 99);
      const impostoSelo = num(s.valorImovel) * 0.008;
      const escritura = num(s.valorImovel) * 0.007;
      const custoEspecies = impostoSelo + imt.imt + escritura;
      const renda = num(s.valorImovel) * 0.04;
      const scoreArr = 3 + (s.horizonteInvestimento === 'curto' ? 2 : 0) + (s.precisaLiquidezMensal ? 2 : 0) + (s.precisaReforcoCE ? -1 : 0) + (s.tipoAtividade === 'turismo' || s.tipoAtividade === 'alojamento_local' ? 1 : 0) + (profile.tipoEntidade === 'eni' ? -1 : 0);
      const scoreEsp = 3 + (s.horizonteInvestimento === 'curto' ? -2 : 0) + (s.precisaLiquidezMensal ? -1 : 0) + (s.precisaReforcoCE ? 2 : 0) + (num(s.valorImovel) > 500000 ? 1 : 0) + (profile.tipoEntidade === 'eni' ? -1 : 0);
      return [
        { label: 'Recomendação', valor: scoreArr > scoreEsp ? 'Arrendamento / Comodato' : scoreEsp > scoreArr ? 'Entrada em espécie' : 'Análise neutra' },
        { label: 'Custo inicial — entrada em espécie', valor: eur(custoEspecies) },
        { label: 'Renda anual estimada', valor: eur(renda) },
        { label: 'Depreciação fiscal anual', valor: eur(num(s.valorImovel) * 0.02) },
      ];
    }
    if (view === 'imt' && num(s.valor) > 0) {
      const r = calcIMT(num(s.valor), (s.tipo || 'hpp') as TipoImovel, (s.localizacao || 'continente') as Localizacao, !!s.primeiraHabitacao, num(s.idadeComprador));
      return [
        { label: 'IMT', valor: eur(r.imt) },
        { label: 'Imposto de Selo', valor: eur(r.impostoSelo) },
        { label: 'Total de impostos', valor: eur(r.total) },
        { label: 'Taxa aplicada', valor: pct(r.taxaAplicada) },
        { label: 'Benefício IMT Jovem', valor: r.isentoJovem ? (r.isento ? 'Isenção total' : 'Redução parcial') : 'Não aplicável' },
      ];
    }
  } catch {
    return [];
  }
  return [];
}

function rowsHtml(rows: { label: string; valor: string }[]): string {
  if (!rows.length) return '<p class="empty">Não foram introduzidos dados suficientes para apresentar valores calculados.</p>';
  return `<div class="rows">${rows.map((row) => `<div class="row"><span>${esc(row.label)}</span><strong>${esc(row.valor)}</strong></div>`).join('')}</div>`;
}

export function SimulatorPrintButton({ compact = false }: { compact?: boolean }) {
  const ctx = useContext(PrintContext);
  if (!ctx?.view) return null;

  const onPdf = async () => {
    const [{ RelatorioPdf }, previsaPdf] = await Promise.all([
      import('./lib/reportPdf'),
      import('./lib/previsaPdf'),
    ]);
    const v = ctx.view!;
    const txt = PRINT_TITLES[v];
    const office = ctx.office || ({} as OfficeSettings);
    const profile = ctx.profile || ({} as ClientProfile);
    if (v === 'previsa') {
      void previsaPdf.downloadPrevisaPdf(
        ctx.state as PreviSaState,
        profile.nomeCliente?.trim() || 'Empresa',
        {
          nome: office.nome,
          nif: office.nif,
          cedulaProfissional: office.cedulaProfissional,
          numeroInscricaoOCC: office.numeroInscricaoOCC,
          email: office.email,
          telefone: office.telefone,
          morada: office.morada,
          codigoPostal: office.codigoPostal,
          localidade: office.localidade,
        },
      );
      return;
    }
    const pdf = new RelatorioPdf({
      titulo: txt,
      subtitulo: 'Relatório resumido da simulação efetuada.',
      cliente: profile.nomeCliente?.trim() || 'Por preencher',
      nif: profile.nif?.trim() || 'Por preencher',
      escritorio: { nome: office.nome, corPrimaria: office.corPrimaria, logoDataUrl: office.logoDataUrl },
      nomeFicheiro: `Estudo360_${txt}_${profile.nomeCliente || ''}`,
    });
    const inputs = [...detailSimulacao(v, ctx.state), ...extraInputs(v, ctx.state)];
    const results = [...resultSimulacao(v, ctx.state, profile), ...extraResults(v, ctx.state, profile)];
    // Três números-chave: os primeiros resultados com valor, dando prioridade
    // a líquidos/totais/diferenças — a abertura que se lê em 3 segundos.
    const vistos = new Set<string>();
    const comValor = results.filter((r) => {
      const chave = String(r.label).trim().toLowerCase();
      if (!/\d/.test(r.valor) || !chave || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
    const preferidos = comValor.filter((r) => /l[ií]quido|total|diferen|poupan|custo|mensalidade|imposto|resultado/i.test(r.label));
    const escolhidos = (preferidos.length >= 3 ? preferidos : [...preferidos, ...comValor]).slice(0, 3);
    if (escolhidos.length === 3) pdf.destaques(escolhidos);
    pdf.seccao('Parâmetros da simulação').tabela(inputs);
    pdf.seccao('Resultado da simulação').tabela(results);

    if (v === 'vehicle') {
      const s = (ctx.state || {}) as Record<string, unknown>;
      const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
      const fin = (s.financiamento || {}) as Record<string, unknown>;
      const input: FinanciamentoInput = {
        preco: num(s.price),
        duracaoMeses: fin.duracaoMeses !== undefined ? num(fin.duracaoMeses) : 48,
        entrada: fin.entrada !== undefined ? num(fin.entrada) : num(s.price) * 0.2,
        valorResidual: num(fin.valorResidual),
        tanPercent: fin.tanPercent !== undefined ? num(fin.tanPercent) : 6,
        mensalidadeManual: num(fin.mensalidadeManual) || undefined,
        incluiManutencao: fin.incluiManutencao !== false,
        incluiSeguro: fin.incluiSeguro !== false,
        rentingDiscriminada: fin.rentingDiscriminada !== false,
        maintenanceCost: num(s.maintenanceCost),
        insuranceCost: num(s.insuranceCost),
        fuelCost: num(s.fuelCost),
        fiscal: {
          category: String(s.category || 'passageiros'),
          engineType: String(s.engineType || 'diesel'),
          ivaRegime: String(s.ivaRegime || 'normal'),
          activity: String(s.activity || 'other'),
          exemptTA: !!s.exemptTA,
          phevCompliant: !!s.phevCompliant,
          agravamentoTA: !!s.agravamentoTA,
          usoPercentagem: (s.usoPercentagem as number | undefined) ?? 100,
        },
      };
      if (input.preco > 0) {
        const { resultados } = compararModos(input);
        const linhas = [
          { label: 'Mensalidade', valor: MODOS.map(m => `${ETIQUETA_MODO[m]}: ${resultados[m].mensalidade > 0 ? eur(resultados[m].mensalidade) : '—'}`).join(' · ') },
          { label: 'Custo total', valor: MODOS.map(m => `${ETIQUETA_MODO[m]}: ${eur(resultados[m].custoTotal)}`).join(' · ') },
          { label: 'Custo líquido após IVA', valor: MODOS.map(m => `${ETIQUETA_MODO[m]}: ${eur(resultados[m].custoLiquido)}`).join(' · ') },
          { label: 'Gasto aceite', valor: MODOS.map(m => `${ETIQUETA_MODO[m]}: ${eur(resultados[m].gastoAceite)}`).join(' · ') },
          { label: 'Tributação Autónoma', valor: MODOS.map(m => `${ETIQUETA_MODO[m]}: ${eur(resultados[m].taValue)}`).join(' · ') },
        ];
        pdf.seccao('Comparação de aquisição (compra · crédito · leasing · renting)').tabela(linhas);
      }
    }

    // Enquadramento e identificação: informação que faltava nos PDFs.
    const o = office as unknown as Record<string, string | undefined>;
    const p = profile as unknown as Record<string, unknown>;
    const eurOuTraco = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0
      ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(x)
      : 'Por preencher');
    pdf.seccao('Enquadramento da empresa').tabela([
      { label: 'Tipo de entidade', valor: String(p.tipoEntidade || 'Por definir').toUpperCase() },
      { label: 'Regime de contabilidade', valor: p.regimeContabilidade ? String(p.regimeContabilidade) : 'Por definir' },
      { label: 'Atividade principal', valor: p.atividadePrincipal ? String(p.atividadePrincipal) : 'Por definir' },
      { label: 'Faturação anual prevista', valor: eurOuTraco(p['faturaçaoAnualPrevista'] ?? p['faturacaoAnualPrevista']) },
      { label: 'Nº de funcionários', valor: String(p.nrFuncionarios ?? '—') },
      { label: 'Ano fiscal', valor: '2026 (OE 2026)' },
    ]);

    pdf.seccao('Escritório').tabela([
      { label: 'Nome', valor: o.nome || 'Estudo 360' },
      { label: 'NIF', valor: o.nif || 'Por preencher' },
      { label: 'Cédula / OCC', valor: [o.cedulaProfissional, o.numeroInscricaoOCC].filter(Boolean).join(' · ') || 'Por preencher' },
      { label: 'Contacto', valor: [o.email, o.telefone].filter(Boolean).join(' · ') || 'Por preencher' },
      { label: 'Morada', valor: [o.morada, o.codigoPostal, o.localidade].filter(Boolean).join(', ') || 'Por preencher' },
    ]);

    pdf.seccao('Como se calcula').paragrafo(PRINT_METHOD[v]);
    pdf.nota('Pressupostos: valores calculados com as taxas e escalões de 2026 e com os dados introduzidos na simulação. Cálculos indicativos — confirme os valores e o enquadramento com o seu Contabilista Certificado.');
    pdf.save();
  };

  return (
    <>
      <button
        type="button"
        onClick={onPdf}
        title="Descarregar esta simulação em PDF"
        aria-label="Descarregar simulação em PDF"
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[9px] bg-[var(--accent)] px-3 py-2.5 text-[12px] font-[700] text-white transition-colors hover:bg-blue-600 ${compact ? 'sm:px-2.5' : ''}`}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Descarregar PDF</span>
      </button>
    </>
  );
}
