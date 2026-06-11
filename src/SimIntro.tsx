import { motion } from 'motion/react';
import React from 'react';
import {
  Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote,
  Receipt, TrendingUp, ArrowLeft, Play,
} from 'lucide-react';

/**
 * Ecrã-intro de cada simulador: aparece ao escolher o simulador na sidebar,
 * explica em linguagem simples para que serve, que dados pede e o que devolve.
 * Só o botão "Simular" entra no simulador — o utilizador nunca aterra num
 * formulário sem contexto.
 */

export interface SimIntroDef {
  titulo: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Para que serve, em 1–2 frases simples. */
  resumo: string;
  /** O que vais precisar de indicar. */
  dados: string[];
  /** O que recebes no fim. */
  resultado: string;
}

export const SIM_INTROS: Record<string, SimIntroDef> = {
  tax: {
    titulo: 'Enquadramento Fiscal',
    Icon: Calculator,
    resumo: 'Compara quanto sobra ao final do ano como ENI (recibos verdes) ou como sociedade (Lda/Unipessoal), com os impostos e contribuições de cada caminho.',
    dados: ['Faturação anual prevista', 'Custos fixos e variáveis', 'Quanto precisas de levantar por mês', 'Situação profissional atual'],
    resultado: 'Rendimento líquido lado a lado (ENI vs sociedade), com IRS, IRC, Segurança Social e ponto de equilíbrio de cada opção.',
  },
  vehicle: {
    titulo: 'Viaturas na Empresa',
    Icon: Car,
    resumo: 'Mostra quanto IVA consegues recuperar na compra e utilização de uma viatura e quanto pagas de Tributação Autónoma sobre os encargos.',
    dados: ['Tipo de viatura (passageiros, comercial, elétrica…)', 'Preço de aquisição', 'Custos anuais (combustível, manutenção)'],
    resultado: 'IVA dedutível, Tributação Autónoma estimada e limites de depreciação aceites fiscalmente.',
  },
  ticket: {
    titulo: 'Tickets e Benefícios',
    Icon: Ticket,
    resumo: 'Calcula a poupança de dar subsídio de alimentação (e outros vales) em vez de aumentar o salário — isento de IRS e Segurança Social até ao limite legal.',
    dados: ['Número de funcionários', 'Valor diário do ticket', 'Dias por mês'],
    resultado: 'Poupança anual em Segurança Social para a empresa e custo dedutível em IRC.',
  },
  selfss: {
    titulo: 'Segurança Social de Independente',
    Icon: User,
    resumo: 'Calcula a contribuição mensal e trimestral para a Segurança Social de quem trabalha a recibos verdes ou como ENI.',
    dados: ['Rendimento mensal médio', 'Tipo de atividade (serviços ou vendas)', 'Se estás no 1.º ano de atividade'],
    resultado: 'Contribuição mensal, trimestral e anual, com o teto da base e a isenção do 1.º ano aplicados.',
  },
  diagnostico: {
    titulo: 'Diagnóstico de Gestão',
    Icon: BarChart2,
    resumo: 'Avalia a saúde da empresa em 5 pilares: autonomia financeira, tesouraria, rentabilidade, dependência de clientes e maturidade operacional.',
    dados: ['Volume de negócios', 'Custos fixos mensais', 'Dívida e tesouraria atuais'],
    resultado: 'Nota por pilar com recomendações práticas do que melhorar primeiro.',
  },
  imoveis: {
    titulo: 'Imóveis na Empresa',
    Icon: Home,
    resumo: 'Compara os dois caminhos para usar um imóvel na empresa: arrendá-lo à empresa ou transferi-lo como entrada em espécie.',
    dados: ['Valor do imóvel', 'Renda mensal prevista', 'Quem é o proprietário atual'],
    resultado: 'Custos fiscais de cada caminho (IRS sobre rendas, IMT, Selo, depreciações) e qual tende a compensar.',
  },
  imt: {
    titulo: 'Simulador IMT',
    Icon: Building,
    resumo: 'Calcula o IMT e o Imposto do Selo na compra de um imóvel, incluindo a isenção IMT Jovem para menores de 35 anos.',
    dados: ['Valor de compra', 'Tipo de imóvel (habitação própria, secundária, rústico…)', 'Localização e idade do comprador'],
    resultado: 'IMT e Imposto do Selo a pagar, com as isenções aplicáveis já refletidas.',
  },
  salario: {
    titulo: 'Salário Líquido',
    Icon: Banknote,
    resumo: 'Calcula quanto recebe ao final do mês um trabalhador por conta de outrem — com as tabelas oficiais de retenção de IRS 2026 — e quanto custa à empresa.',
    dados: ['Salário bruto mensal', 'Estado civil e dependentes', 'Subsídio de alimentação e duodécimos'],
    resultado: 'Salário líquido mensal e anual, retenção de IRS pela tabela oficial, e custo total para o empregador.',
  },
  irs: {
    titulo: 'Simulador de IRS',
    Icon: Receipt,
    resumo: 'Estima o IRS anual (Modelo 3) do agregado: rendimentos de trabalho e empresariais, deduções, IRS Jovem e tributação conjunta.',
    dados: ['Rendimentos de cada titular', 'Dependentes e despesas dedutíveis', 'Região e benefícios aplicáveis'],
    resultado: 'Imposto final estimado — reembolso ou valor a pagar — com o detalhe por escalões e deduções.',
  },
  previsa: {
    titulo: 'Simulador Previsa (IRC)',
    Icon: TrendingUp,
    resumo: 'Prevê o IRC do exercício (Modelo 22): apuramento do lucro tributável, tributações autónomas e liquidação final. Exporta para Excel.',
    dados: ['Rendimentos e gastos do exercício', 'Correções fiscais (Q07)', 'Prejuízos anteriores e pagamentos por conta'],
    resultado: 'IRC estimado com matéria coletável, derrama e tributações autónomas — pronto a exportar no formato Previsa.',
  },
};

export default function SimIntro({ view, onSimular, onVoltar }: {
  view: string;
  onSimular: () => void;
  onVoltar: () => void;
}) {
  const def = SIM_INTROS[view];
  if (!def) return null;
  const { titulo, Icon, resumo, dados, resultado } = def;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full overflow-y-auto bg-[#F5F7FA] flex items-start sm:items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-xl bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm p-7 sm:p-9">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-[16px] bg-[#0677FF]/10 flex items-center justify-center shrink-0">
            <Icon className="w-7 h-7 text-[#0677FF]" />
          </div>
          <div>
            <p className="text-[10px] font-[800] uppercase tracking-[2px] text-[#6B7280]">Simulador</p>
            <h1 className="text-[24px] font-[800] text-[#0B1D2D] tracking-[-0.5px] leading-tight">{titulo}</h1>
          </div>
        </div>

        <p className="text-[14.5px] text-[#334155] font-[500] leading-relaxed mb-6">{resumo}</p>

        <div className="grid sm:grid-cols-2 gap-4 mb-7">
          <div className="bg-[#F5F7FA] rounded-[14px] p-4">
            <h2 className="text-[11px] font-[800] uppercase tracking-[1px] text-[#0677FF] mb-2">Vais precisar de</h2>
            <ul className="space-y-1.5">
              {dados.map((d, i) => (
                <li key={i} className="text-[13px] text-[#475569] font-[500] flex gap-2">
                  <span className="text-[#0677FF] font-[800]">·</span>{d}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#F5F7FA] rounded-[14px] p-4">
            <h2 className="text-[11px] font-[800] uppercase tracking-[1px] text-[#0677FF] mb-2">No fim recebes</h2>
            <p className="text-[13px] text-[#475569] font-[500] leading-relaxed">{resultado}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSimular}
            autoFocus
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0677FF] text-white px-5 py-3.5 rounded-[12px] text-[15px] font-[800] hover:bg-[#0556CC] active:scale-[0.98] transition-all shadow-md shadow-[#0677FF]/25"
          >
            <Play className="w-4 h-4" strokeWidth={2.6} /> Simular
          </button>
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex items-center gap-1.5 px-4 py-3.5 rounded-[12px] text-[13px] font-[700] text-[#64748B] bg-white border border-[#E2E8F0] hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>
      </div>
    </motion.div>
  );
}
