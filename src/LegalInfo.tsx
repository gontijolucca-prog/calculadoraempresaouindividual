import React from 'react';
import { ArrowLeft, Scale, BookOpen, Car, Ticket, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { IRS_BRACKETS_2026, IAS_2026 } from './lib/pt2026';

interface Props {
  onBack: () => void;
}

const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

const SectionHeader = ({ icon: Icon, title, color = '#781D1D' }: { icon: React.ElementType; title: string; color?: string }) => (
  <div className="flex items-center gap-3 mb-5 pb-3 border-b-2" style={{ borderColor: color }}>
    <div className="p-2 rounded-[10px]" style={{ backgroundColor: `${color}15` }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <h2 className="text-[18px] font-[800] text-[#0F172A]">{title}</h2>
  </div>
);

const LegalRow = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="py-[10px] border-b border-[#F1F5F9] last:border-0">
    <div className="flex justify-between items-start gap-4">
      <span className="text-[13px] font-[700] text-[#475569] shrink-0 w-[200px]">{label}</span>
      <span className="text-[13px] font-[600] text-[#0F172A] text-right flex-1">{value}</span>
    </div>
    {note && <p className="text-[11px] text-[#94A3B8] mt-1 ml-0 font-[500]">{note}</p>}
  </div>
);

const Article = ({ code, description }: { code: string; description: string }) => (
  <div className="flex gap-3 py-[8px] border-b border-[#F1F5F9] last:border-0">
    <span className="text-[11px] font-[800] text-[#781D1D] bg-[#FDF2F2] px-2 py-1 rounded-[6px] h-fit shrink-0 whitespace-nowrap">{code}</span>
    <span className="text-[13px] font-[500] text-[#334155]">{description}</span>
  </div>
);

export default function LegalInfo({ onBack }: Props) {
  return (
    <div className="h-full bg-[#F8FAFC] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-6 md:px-10 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-[700] text-[#475569] hover:text-[#781D1D] transition-colors px-3 py-2 rounded-[8px] hover:bg-[#FDF2F2]"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="h-6 w-px bg-[#E2E8F0]" />
        <div>
          <h1 className="text-[18px] font-[800] text-[#0F172A]">Base Legal & Referências</h1>
          <p className="text-[11px] font-[600] text-[#781D1D] uppercase tracking-[1px]">Legislação • Taxas • Limites • OE 2026</p>
        </div>
        <div className="ml-auto">
          <span className="text-[11px] font-[700] bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
            ✓ Atualizado Abril 2026
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 space-y-12">

        {/* Aviso */}
        <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-5 flex gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[13px] text-amber-900 font-[500] leading-relaxed">
            <strong>Nota:</strong> Esta página apresenta a legislação em que os cálculos dos simuladores se baseiam, com dados válidos para <strong>abril de 2026</strong>. A lei fiscal pode sofrer alterações. Este simulador não substitui o aconselhamento de um <strong>contabilista certificado (OCC)</strong>.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 1. IRS — IMPOSTO SOBRE O RENDIMENTO DE PESSOAS SINGULARES  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={BookOpen} title="IRS — Imposto sobre o Rendimento (CIRS)" />

          <div className="space-y-6">
            {/* Escalões */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Escalões de IRS 2026 (Art. 68.º CIRS)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#0F172A] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Rendimento Coletável</th>
                      <th className="text-right px-4 py-2">Taxa Marginal</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">Parcela a Abater</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IRS_BRACKETS_2026.map((b, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">
                          {i === 0 ? `Até ${ptEur(b.limit)}` :
                           b.limit === Infinity ? `Acima de ${ptEur(IRS_BRACKETS_2026[i-1].limit)}` :
                           `${ptEur(IRS_BRACKETS_2026[i-1].limit)} – ${ptEur(b.limit)}`}
                        </td>
                        <td className="px-4 py-2 text-right font-[700] text-[#781D1D]">{(b.rate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right font-mono">{ptEur(b.ded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">Fonte: OE 2026 (validado abril 2026) • Aplicável a residentes em Portugal Continental</p>
            </div>

            {/* IRS Jovem */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">IRS Jovem — Art. 12.º-B CIRS (OE 2025)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-4 mb-3">
                <p className="text-[13px] text-blue-900 font-[500] leading-relaxed">
                  Aplica-se a trabalhadores até <strong>35 anos</strong>, nos primeiros 5 anos de atividade profissional. Teto máximo: <strong>5× IAS anual = {ptEur(IAS_2026 * 12 * 5)}</strong> (IAS 2026: {ptEur(IAS_2026)}).
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { ano: '1.º ano', taxa: '100%', desc: 'Isenção total do rendimento coletável' },
                  { ano: '2.º e 3.º anos', taxa: '75%', desc: 'Isenção de 75% do rendimento coletável' },
                  { ano: '4.º e 5.º anos', taxa: '50%', desc: 'Isenção de 50% do rendimento coletável' },
                ].map(({ ano, taxa, desc }) => (
                  <div key={ano} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-4 text-center">
                    <div className="text-[11px] font-[700] text-[#64748B] uppercase mb-1">{ano}</div>
                    <div className="text-[24px] font-[800] text-blue-600">{taxa}</div>
                    <div className="text-[11px] text-[#64748B] font-[500] mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regime Simplificado */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Regime Simplificado ENI — Art. 31.º CIRS</h3>
              <div className="space-y-2">
                <LegalRow label="Serviços — coeficiente" value="0,75 (rendimento coletável = 75% da faturação)" note="25% é automaticamente deduzido como despesas presumidas" />
                <LegalRow label="Bens — coeficiente" value="0,15 (rendimento coletável = 15% da faturação)" note="85% é automaticamente deduzido como custo de aquisição presumido" />
                <LegalRow label="Regra especial >€27.360 (serviços)" value="Justificação de despesas de 15% da faturação obrigatória" note="Sem justificação, o rendimento coletável é acrescido da diferença" />
              </div>
            </div>

            {/* Dependentes */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Dedução por Dependentes — Art. 78.º-A CIRS</h3>
              <div className="space-y-2">
                <LegalRow label="1.º ao 3.º dependente" value="€600 por dependente (dedução à coleta)" />
                <LegalRow label="A partir do 4.º dependente" value="€900 por dependente adicional" />
                <LegalRow label="Dependente com deficiência" value="€900 por dependente" />
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">Dedução à coleta (subtrai diretamente ao imposto calculado, não ao rendimento)</p>
            </div>

            {/* Retenção na Fonte */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Retenção na Fonte — Categoria B</h3>
              <div className="space-y-2">
                <LegalRow label="Serviços profissionais (geral)" value="11,5%" note="Aplicável quando o prestador emite fatura a entidades com contabilidade organizada" />
                <LegalRow label="Direitos de autor" value="16,5%" />
                <LegalRow label="Isenção para novos ENI" value="Primeiro ano: sem retenção obrigatória (Art. 101.º CIRS)" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 2. IRC — IMPOSTO SOBRE O RENDIMENTO DE PESSOAS COLETIVAS   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Scale} title="IRC — Imposto sobre o Rendimento das Empresas (CIRC)" color="#334155" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Taxas IRC — Art. 87.º CIRC</h3>
              <div className="space-y-2">
                <LegalRow label="PME — primeiros €50.000" value="15% (taxa reduzida para micro, pequenas e médias empresas)" note="Aplicável a PME conforme Art. 2.º da Recomendação CE 2003/361/CE" />
                <LegalRow label="Acima de €50.000" value="19% (taxa geral)" />
                <LegalRow label="Tributação mínima" value="15% de tributação mínima para empresas com volume de negócios >€2M (OE 2024)" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Tributação Autónoma (TA) — Art. 88.º CIRC</h3>
              <p className="text-[13px] text-[#64748B] font-[500] mb-3">Incide sobre encargos com viaturas ligeiras de passageiros. Base de cálculo: depreciação + manutenção + seguro + combustível.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#781D1D] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Custo Aquisição (s/ IVA)</th>
                      <th className="text-right px-4 py-2">Combustão / Híbrido</th>
                      <th className="text-right px-4 py-2">PHEV Conforme</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">Elétrico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { range: 'Até €27.500', gas: '8,5%', phev: '2,5%', elec: '0%' },
                      { range: '€27.500 – €35.000', gas: '25,5%', phev: '7,5%', elec: '0%' },
                      { range: 'Acima de €35.000', gas: '32,5%', phev: '15%', elec: '0%' },
                      { range: 'Acima de €62.500 (elétrico)', gas: '—', phev: '—', elec: '10%' },
                    ].map(({ range, gas, phev, elec }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#FDF2F2]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">{range}</td>
                        <td className="px-4 py-2 text-right font-[700]">{gas}</td>
                        <td className="px-4 py-2 text-right font-[700] text-amber-700">{phev}</td>
                        <td className="px-4 py-2 text-right font-[700] text-emerald-700">{elec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-[#94A3B8] font-[500]">PHEV Conforme: autonomia elétrica ≥50 km E emissões CO₂ &lt;50 g/km</p>
                <p className="text-[11px] text-[#94A3B8] font-[500]">Elétrico &gt;€62.500: Lei n.º 82/2023 — taxa de 10% sobre encargos (exceto atividades isentas)</p>
                <p className="text-[11px] text-[#94A3B8] font-[500]">Dispensa de TA: possível com acordo escrito de imputação de custos ao trabalhador (Art. 88.º, n.º 14)</p>
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Limites de Depreciação Fiscal (DR 25/2009 + OE 2026)</h3>
              <div className="space-y-2">
                <LegalRow label="Viaturas passageiros (geral)" value={`${ptEur(25000)} por veículo`} note="Taxa de depreciação: 25%/ano. Dep. acima do limite → não aceite fiscalmente" />
                <LegalRow label="Viaturas elétricas" value={`${ptEur(62500)} por veículo`} />
                <LegalRow label="PHEV conforme" value={`${ptEur(50000)} por veículo`} />
                <LegalRow label="GPL / GNV passageiros" value={`${ptEur(37500)} por veículo`} />
                <LegalRow label="Veículos comerciais / isentos" value="Sem limite (100% dedutível)" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 3. IVA — IMPOSTO SOBRE O VALOR ACRESCENTADO               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Scale} title="IVA — Imposto sobre o Valor Acrescentado (CIVA)" color="#1D4ED8" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Taxas de IVA em Portugal Continental</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa normal" value="23%" note="Aplica-se por defeito a todos os bens e serviços" />
                <LegalRow label="Taxa intermédia" value="13%" note="Restauração, vinho, etc." />
                <LegalRow label="Taxa reduzida" value="6%" note="Bens de primeira necessidade, livros, etc." />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Isenção PME — Art. 53.º CIVA</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-4">
                <p className="text-[13px] text-blue-900 font-[500] leading-relaxed">
                  Isenção de IVA para sujeitos passivos com <strong>volume de negócios ≤ €15.000</strong> no ano civil anterior e que <strong>não pratiquem operações de exportação ou intracomunitárias</strong>. A isenção é geralmente recomendada apenas para negócios B2C (consumidores finais não podem deduzir IVA).
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Dedução IVA — Viaturas (Art. 21.º CIVA)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#1D4ED8] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Tipo de Viatura / Combustível</th>
                      <th className="text-right px-4 py-2">IVA Aquisição</th>
                      <th className="text-right px-4 py-2">IVA Manutenção</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">IVA Combustível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tipo: 'Elétrico (passageiros, ≤€62.500)', aq: '100%', mant: '0%', comb: '100%' },
                      { tipo: 'PHEV conforme (passageiros, ≤€50.000)', aq: '100%', mant: '0%', comb: '0%' },
                      { tipo: 'Gasóleo (passageiros)', aq: '50%', mant: '0%', comb: '50%' },
                      { tipo: 'GPL / GNV (passageiros, ≤€37.500)', aq: '50%', mant: '0%', comb: '50%' },
                      { tipo: 'Gasolina / Híbrido não plug-in', aq: '0%', mant: '0%', comb: '0%' },
                      { tipo: 'Comercial (2/3 lugares)', aq: '100%', mant: '100%', comb: '100%' },
                      { tipo: 'Atividades isentas (táxi, TVDE, rent-a-car, esc. condução)', aq: '100%', mant: '100%', comb: '100%' },
                    ].map(({ tipo, aq, mant, comb }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#EFF6FF]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">{tipo}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${aq === '100%' ? 'text-emerald-600' : aq === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{aq}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${mant === '100%' ? 'text-emerald-600' : mant === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{mant}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${comb === '100%' ? 'text-emerald-600' : comb === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{comb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">O seguro automóvel está isento de IVA em Portugal (sujeito a Imposto de Selo) — dedução de IVA = 0% por natureza.</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 4. SEGURANÇA SOCIAL                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Shield} title="Segurança Social (SS)" color="#059669" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">TSU — Trabalhadores por Conta de Outrem (TCO)</h3>
              <div className="space-y-2">
                <LegalRow label="Contribuição patronal (empresa)" value="23,75% sobre remuneração ilíquida" />
                <LegalRow label="Contribuição do trabalhador" value="11% sobre remuneração ilíquida" />
                <LegalRow label="Base de incidência" value="Todas as remunerações, incluindo subsídios de férias e Natal (14 meses)" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">SS Independente — CRCSPSS Art. 162.º e ss.</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa de contribuição 2026" value="21,4% sobre rendimento relevante" />
                <LegalRow label="Base — Prestação de Serviços" value="70% do rendimento mensal declarado" note="Efetivo: 14,98% do rendimento bruto" />
                <LegalRow label="Base — Venda de Bens" value="20% do rendimento mensal declarado" note="Efetivo: 4,28% do rendimento bruto" />
                <LegalRow label="Mínimo de contribuição" value={`€20,00/mês (se rendimento > IAS — ${ptEur(IAS_2026)})`} />
                <LegalRow label="Pagamento" value="Trimestral — até dia 20 de jan, abr, jul e out" />
                <LegalRow label="Isenção 1.º ano" value="Total — Art. 164.º CRCSPSS" note="Aplica-se a novos inscritos como TI. Isenção durante 12 meses." />
                <LegalRow label="Isenção TCO secundário" value="Se rendimento ≤€20.000 e atividade não é principal: isenção de SS como TI" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Cálculo Trimestral na Prática</h3>
              <div className="bg-[#F0FDF4] border border-emerald-200 rounded-[12px] p-4">
                <p className="text-[13px] text-emerald-900 font-[500] leading-relaxed">
                  A SS calcula o <strong>rendimento relevante trimestral</strong> com base nos rendimentos do trimestre anterior (declarados na plataforma da Segurança Social Direta). A contribuição trimestral = rendimento médio mensal do trimestre anterior × base (70% ou 20%) × 21,4% × 3 meses.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 5. TICKETS DE REFEIÇÃO                                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Ticket} title="Tickets / Vales de Refeição" color="#7C3AED" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Limites e Isenções — DL 133/2024 + EBF Art. 18.º-A</h3>
              <div className="space-y-2">
                <LegalRow label="Limite diário — setor geral" value="€5,00/dia útil" note="Acima deste valor, o excedente é tributável em IRS e sujeito a SS para o trabalhador" />
                <LegalRow label="Limite diário — hotelaria/restauração/construção" value="€7,00/dia útil" note="DL 133/2024, com efeitos a partir de 1 janeiro 2024" />
                <LegalRow label="Isenção SS para o trabalhador" value="Total — até ao limite legal diário" />
                <LegalRow label="Isenção IRS para o trabalhador" value="Total — até ao limite legal diário" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Dedutibilidade para a Empresa — CIRC Art. 43.º</h3>
              <div className="space-y-2">
                <LegalRow label="Percentagem dedutível" value="60% do custo total dos tickets" note="Apenas o custo dentro do limite legal. Excedente: 0% dedutível." />
                <LegalRow label="SS patronal sobre tickets" value="Não aplicável — até ao limite legal (poupança de 23,75%)" />
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-[12px] p-4">
              <h4 className="text-[13px] font-[700] text-purple-900 mb-2">Comparação: Ticket vs Aumento Salarial Equivalente</h4>
              <p className="text-[13px] text-purple-800 font-[500] leading-relaxed">
                Se a empresa paga €5/dia × 22 dias × 12 meses = €1.320/ano por trabalhador em tickets, pouparia €1.320 × 23,75% = €313,50/trabalhador em SS patronal face a um aumento salarial equivalente. O trabalhador recebe o mesmo valor líquido (sem descontos).
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 6. REFERÊNCIAS LEGISLATIVAS COMPLETAS                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={BookOpen} title="Índice de Referências Legislativas" color="#475569" />

          <div className="space-y-1">
            <Article code="CIRS Art. 12.º-B" description="IRS Jovem — Isenção progressiva para trabalhadores ≤35 anos nos primeiros 5 anos de atividade (OE 2025)" />
            <Article code="CIRS Art. 28.º" description="Categorias de rendimento de atividade empresarial e profissional (Categoria B)" />
            <Article code="CIRS Art. 31.º" description="Regime Simplificado — coeficientes de 0,15 (bens) e 0,75 (serviços)" />
            <Article code="CIRS Art. 68.º" description="Taxas gerais de IRS 2026 — escalões progressivos de 13% a 48%" />
            <Article code="CIRS Art. 78.º-A" description="Dedução por dependentes — €600/dependente (€900 a partir do 4.º)" />
            <Article code="CIRS Art. 101.º" description="Retenção na fonte — Categoria B: 11,5% para serviços profissionais" />
            <Article code="CIRC Art. 87.º" description="Taxas de IRC: 15% (PME, primeiros €50k) / 19% (geral)" />
            <Article code="CIRC Art. 88.º, n.º 3" description="Tributação autónoma sobre encargos com viaturas ligeiras de passageiros" />
            <Article code="CIRC Art. 43.º" description="Dedutibilidade de encargos com vales de refeição: 60% do custo" />
            <Article code="CIVA Art. 21.º" description="Exclusões do direito à dedução de IVA — viaturas e combustíveis" />
            <Article code="CIVA Art. 53.º" description="Regime especial de isenção para PME com volume de negócios ≤€15.000" />
            <Article code="DR 25/2009" description="Tabelas de depreciações e amortizações fiscais" />
            <Article code="DL 110/2009" description="Código dos Regimes Contributivos do Sistema Previdencial (CRCSPSS)" />
            <Article code="CRCSPSS Art. 162.º" description="Base de incidência da SS para trabalhadores independentes" />
            <Article code="CRCSPSS Art. 164.º" description="Isenção de contribuições no 1.º ano de atividade independente" />
            <Article code="EBF Art. 18.º-A" description="Isenção de SS e IRS para vales de refeição até ao limite legal" />
            <Article code="DL 133/2024" description="Novos limites diários de vales de refeição: €5,00 (geral) / €7,00 (hotelaria/construção)" />
            <Article code="Lei n.º 82/2023" description="Tributação autónoma de 10% para viaturas elétricas com custo >€62.500" />
            <Article code="OE 2026" description="Orçamento do Estado para 2026 — referência principal para todos os valores desta ferramenta" />
          </div>
        </section>

        {/* Rodapé */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-full px-6 py-3 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[13px] font-[600] text-[#475569]">
              Informação atualizada em <strong>Abril de 2026</strong> • RECOFATIMA Contabilidade
            </span>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-3 max-w-xl mx-auto">
            Esta ferramenta é desenvolvida e mantida pela equipa RECOFATIMA. Para questões específicas sobre a sua situação fiscal, consulte sempre um contabilista certificado (OCC).
          </p>
        </div>
      </div>
    </div>
  );
}
