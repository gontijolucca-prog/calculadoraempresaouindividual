import React from 'react';
import { User, Building2, Briefcase, Car, Ticket, Wallet, FileText, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { cn } from './lib/utils';

export interface ClientProfile {
  nomeCliente: string;
  nif: string;
  email: string;
  telefone: string;
  regimeIva: 'isento' | 'normal_mensal' | 'normal_trimestral';
  cae: string;
  inicioAtividade: number;
  atividadePrincipal: 'servicos' | ' bens';
  isSazonal: boolean;
  idade: number;
  estadoCivil: 'solteiro' | 'casado' | 'uniao_facto' | 'divorciado' | 'viuvo';
  cônjugeRendimentos: boolean;
  nrDependentes: number;
  beneficioJovem: boolean;
  tipoEntidade: 'eni' | 'lda' | 'unipessoal' | 'sa' | 'socio_unico';
  faturaçaoAnualPrevista: number;
  nrFuncionarios: number;
  veiculos: any[];
  tipoVale: 'refeicao' | 'alimentacao' | 'social';
  valorTicket: number;
  limiteDeducao: number;
  setorTicket: 'normal' | 'construcao' | 'hotelaria' | 'outros';
  rendimentoMensalEni: number;
  regimeSs: 'general' | 'simplified';
  tipoRendimentoSs: 'servicos' | 'bens';
}

interface TaxSimulatorState {
  profSit: string;
  currentInc: number;
  age: number;
  isMainAct: boolean;
  monthlyNeed: number;
  isServices: boolean;
  b2b: boolean;
  rev: number;
  isSeasonal: boolean;
  invEquip: number;
  invLic: number;
  invWorks: number;
  invFundo: number;
  fixedMo: number;
  varYr: number;
  accMoLda: number;
  accMoEni: number;
}

interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros';
  engineType: string;
  price: number;
  ivaRegime: string;
  activity: string;
  maintenanceCost: number;
  insuranceCost: number;
  fuelCost: number;
  exemptTA: boolean;
  phevCompliant: boolean;
}

interface TicketSimulatorState {
  employees: number;
  ticketValue: number;
  daysPerMonth: number;
  months: number;
}

interface SSState {
  income: number;
  regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens';
}

interface Props {
  profile: ClientProfile;
  onChange: (profile: ClientProfile) => void;
  taxState?: TaxSimulatorState;
  vehicleState?: VehicleSimulatorState;
  ticketState?: TicketSimulatorState;
  ssState?: SSState;
}

const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

export default function ClientProfile({ profile, onChange, taxState, vehicleState, ticketState, ssState }: Props) {
  const updateProfile = (field: keyof ClientProfile, value: any) => {
    onChange({ ...profile, [field]: value });
  };

  const currentYear = new Date().getFullYear();

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header with logo
    doc.setFillColor(120, 29, 29);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOFATIMA', 20, 25);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Contabilidade', 20, 33);
    doc.setFontSize(10);
    doc.text('Abril 2026', pageWidth - 30, 25, { align: 'right' });

    y = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Simulações Fiscais', 20, y);
    y += 15;

    // Dados do Cliente
    doc.setFillColor(248, 250, 252);
    doc.rect(15, y - 5, pageWidth - 30, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 29, 29);
    doc.text('Dados do Cliente', 20, y);
    y += 12;

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const clientData = [
      ['Nome:', profile.nomeCliente || '—'],
      ['NIF:', profile.nif || '—'],
      ['Tipo Entidade:', profile.tipoEntidade.toUpperCase()],
      ['Regime IVA:', profile.regimeIva === 'isento' ? 'Isento (Art. 53º)' : profile.regimeIva === 'normal_mensal' ? 'Normal Mensal' : 'Normal Trimestral'],
      ['Atividade Principal:', profile.atividadePrincipal === 'servicos' ? 'Prestação de Serviços' : 'Venda de Bens'],
      ['Faturação Anual:', ptEur(profile.faturaçaoAnualPrevista)],
      ['Ano Início:', profile.inicioAtividade.toString()],
    ];

    clientData.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 70, y);
      y += 7;
    });

    y += 10;

    // Enquadramento Fiscal
    if (taxState) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 5, pageWidth - 30, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 29, 29);
      doc.text('Enquadramento Fiscal (IRS / IRC / SS)', 20, y);
      y += 12;

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Faturação: ${ptEur(taxState.rev)}`, 20, y); y += 7;
      doc.text(`Idade: ${taxState.age} anos`, 20, y); y += 7;
      doc.text(`Atividade: ${taxState.isServices ? 'Serviços' : 'Bens'}`, 20, y); y += 7;
      doc.text(`Recomendação: ${taxState.rev > 30000 ? 'Sociedade (Lda)' : 'ENI'}`, 20, y); y += 10;
    }

    // Viaturas
    if (vehicleState) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 5, pageWidth - 30, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 29, 29);
      doc.text('Viaturas Ligeiras', 20, y);
      y += 12;

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Categoria: ${vehicleState.category}`, 20, y); y += 7;
      doc.text(`Combustível: ${vehicleState.engineType}`, 20, y); y += 7;
      doc.text(`Preço s/IVA: ${ptEur(vehicleState.price)}`, 20, y); y += 10;
    }

    // Tickets
    if (ticketState) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 5, pageWidth - 30, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 29, 29);
      doc.text('Tickets de Refeição', 20, y);
      y += 12;

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nr. Funcionários: ${ticketState.employees}`, 20, y); y += 7;
      doc.text(`Valor Ticket: ${ptEur(ticketState.ticketValue)}`, 20, y); y += 7;
      doc.text(`Dias/Mês: ${ticketState.daysPerMonth}`, 20, y); y += 10;
    }

    // SS Independente
    if (ssState) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 5, pageWidth - 30, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 29, 29);
      doc.text('Segurança Social Independente', 20, y);
      y += 12;

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Rendimento Mensal: ${ptEur(ssState.income)}`, 20, y); y += 7;
      doc.text(`Regime: ${ssState.regime}`, 20, y); y += 7;
      doc.text(`Base Cálculo: ${ssState.tipoRendimento === 'servicos' ? '70%' : '20%'}`, 20, y); y += 10;
    }

    // Footer
    y += 10;
    doc.setFillColor(120, 29, 29);
    doc.rect(0, y, pageWidth, 0.5, 'F');
    y += 8;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Gerado por Recofatima Simuladores • Dados atualizados conforme OE 2026', pageWidth / 2, y, { align: 'center' });

    // Save the PDF
    doc.save(`Relatorio_Recofatima_${profile.nomeCliente || 'Cliente'}_2026.pdf`);
  };

  return (
    <div className="h-full flex flex-col xl:flex-row bg-[#F8FAFC]">
      {/* LEFT PANEL */}
      <div className="xl:w-[480px] shrink-0 bg-white border-r border-[#E2E8F0] overflow-y-auto h-full flex flex-col">
        <div className="p-6 md:p-8 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-[20px] font-[800] tracking-[-0.5px] text-[#0F172A]">Perfil do Cliente</h2>
            <div className="text-[11px] font-[700] uppercase tracking-[1px] text-[#4F46E5] mt-1">Parâmetros Master</div>
          </div>
          <button onClick={generatePDF} className="flex shrink-0 items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-[10px] text-[13px] font-[700] hover:bg-[#781D1D] transition-colors shadow-lg">
            <Download size={16} />
            Exportar PDF
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          <section>
            <h3 className="text-[14px] font-[800] text-[#0F172A] mb-4 text-[#781D1D] flex items-center border-b pb-2">
              <User className="w-5 h-5 opacity-80 mr-2" />
              Identificação do Cliente
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="col-span-2">
                <label className={labelClass}>Nome do Cliente / Empresa</label>
                <input
                  type="text"
                  value={profile.nomeCliente}
                  onChange={e => updateProfile('nomeCliente', e.target.value)}
                  className={inputClass}
                  placeholder="Nome completo ou denominação social"
                />
              </div>
              <div>
                <label className={labelClass}>NIF</label>
                <input
                  type="text"
                  value={profile.nif}
                  onChange={e => updateProfile('nif', e.target.value)}
                  className={inputClass}
                  placeholder="123456789"
                  maxLength={9}
                />
              </div>
              <div>
                <label className={labelClass}>Telefone</label>
                <input
                  type="tel"
                  value={profile.telefone}
                  onChange={e => updateProfile('telefone', e.target.value)}
                  className={inputClass}
                  placeholder="912345678"
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={e => updateProfile('email', e.target.value)}
                  className={inputClass}
                  placeholder="email@empresa.pt"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[14px] font-[800] text-[#0F172A] mb-4 text-[#781D1D] flex items-center border-b pb-2">
              <Building2 className="w-5 h-5 opacity-80 mr-2" />
              Dados Empresariais
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className={labelClass}>Tipo de Entidade</label>
                <select
                  value={profile.tipoEntidade}
                  onChange={e => updateProfile('tipoEntidade', e.target.value)}
                  className={inputClass}
                >
                  <option value="eni">ENI (Recibos Verdes)</option>
                  <option value="lda">Lda (Sociedade)</option>
                  <option value="unipessoal">Unipessoal Lda</option>
                  <option value="sa">S.A.</option>
                  <option value="socio_unico">Socio Único</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>CAE</label>
                <input
                  type="text"
                  value={profile.cae}
                  onChange={e => updateProfile('cae', e.target.value)}
                  className={inputClass}
                  placeholder="62020"
                />
              </div>
              <div>
                <label className={labelClass}>Faturação Anual Prevista</label>
                <input
                  type="number"
                  value={profile.faturaçaoAnualPrevista}
                  onChange={e => updateProfile('faturaçaoAnualPrevista', Number(e.target.value))}
                  className={inputClass}
                  placeholder="60000"
                />
              </div>
              <div>
                <label className={labelClass}>Nr. Funcionários</label>
                <input
                  type="number"
                  value={profile.nrFuncionarios}
                  onChange={e => updateProfile('nrFuncionarios', Number(e.target.value))}
                  className={inputClass}
                  placeholder="5"
                />
              </div>
              <div>
                <label className={labelClass}>Regime IVA</label>
                <select
                  value={profile.regimeIva}
                  onChange={e => updateProfile('regimeIva', e.target.value)}
                  className={inputClass}
                >
                  <option value="isento">Isento (Art. 53º)</option>
                  <option value="normal_mensal">Normal Mensal</option>
                  <option value="normal_trimestral">Normal Trimestral</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Ano Início Atividade</label>
                <input
                  type="number"
                  value={profile.inicioAtividade}
                  onChange={e => updateProfile('inicioAtividade', Number(e.target.value))}
                  className={inputClass}
                  min={2000}
                  max={currentYear}
                />
              </div>
              <div>
                <label className={labelClass}>Atividade Principal</label>
                <select
                  value={profile.atividadePrincipal}
                  onChange={e => updateProfile('atividadePrincipal', e.target.value)}
                  className={inputClass}
                >
                  <option value="servicos">Prestação de Serviços</option>
                  <option value="bens">Venda de Bens</option>
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.isSazonal}
                  onChange={e => updateProfile('isSazonal', e.target.checked)}
                  className="w-4 h-4 accent-[#781D1D]"
                />
                <span className="text-[13px] font-[600] text-slate-700">Atividade Sazonal</span>
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-[14px] font-[800] text-[#0F172A] mb-4 text-[#781D1D] flex items-center border-b pb-2">
              <FileText className="w-5 h-5 opacity-80 mr-2" />
              Dados Fiscais e Família
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className={labelClass}>Idade</label>
                <input
                  type="number"
                  value={profile.idade}
                  onChange={e => updateProfile('idade', Number(e.target.value))}
                  className={inputClass}
                  min={18}
                  max={100}
                />
              </div>
              <div>
                <label className={labelClass}>Estado Civil</label>
                <select
                  value={profile.estadoCivil}
                  onChange={e => updateProfile('estadoCivil', e.target.value)}
                  className={inputClass}
                >
                  <option value="solteiro">Solteiro</option>
                  <option value="casado">Casado</option>
                  <option value="uniao_facto">União de Facto</option>
                  <option value="divorciado">Divorciado</option>
                  <option value="viuvo">Viúvo</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Nr. Dependentes</label>
                <input
                  type="number"
                  value={profile.nrDependentes}
                  onChange={e => updateProfile('nrDependentes', Number(e.target.value))}
                  className={inputClass}
                  min={0}
                  max={10}
                />
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.cônjugeRendimentos}
                  onChange={e => updateProfile('cônjugeRendimentos', e.target.checked)}
                  className="w-4 h-4 accent-[#781D1D]"
                />
                <span className="text-[13px] font-[600] text-slate-700">Cônjuge c/ Rendimentos</span>
              </label>
              <label className="col-span-2 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-[8px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.beneficioJovem}
                  onChange={e => updateProfile('beneficioJovem', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-[13px] font-[600] text-blue-900">Benefício Jovem (≤35 anos)</span>
              </label>
            </div>
          </section>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto w-full flex flex-col gap-8 relative max-w-7xl mx-auto">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-[800] tracking-[-1.5px] text-[#0F172A] leading-[1.1]">Resumo de Parâmetros</h1>
          <p className="text-[15px] font-[500] text-[#64748B] mt-1">Estes valores são aplicados automaticamente nos simuladores.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#781D1D]" />
              Dados Fiscais
            </h4>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Regime IVA:</span>
                <span className="font-[600] text-slate-800">
                  {profile.regimeIva === 'isento' ? 'Isento' :
                   profile.regimeIva === 'normal_mensal' ? 'Normal Mensal' : 'Normal Trimestral'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tipo Entidade:</span>
                <span className="font-[600] text-slate-800 uppercase">{profile.tipoEntidade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Atividade:</span>
                <span className="font-[600] text-slate-800">{profile.atividadePrincipal === 'servicos' ? 'Serviços' : 'Bens'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Faturação Prevista:</span>
                <span className="font-[600] text-slate-800">{ptEur(profile.faturaçaoAnualPrevista)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-[#781D1D]" />
              Dados Familiares
            </h4>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Idade:</span>
                <span className="font-[600] text-slate-800">{profile.idade} anos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estado Civil:</span>
                <span className="font-[600] text-slate-800 capitalize">{profile.estadoCivil.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dependentes:</span>
                <span className="font-[600] text-slate-800">{profile.nrDependentes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Benefício Jovem:</span>
                <span className="font-[600] text-slate-800">{profile.beneficioJovem ? 'Sim' : 'Não'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-[#781D1D]" />
              Tickets / Vales
            </h4>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Nr. Funcionários:</span>
                <span className="font-[600] text-slate-800">{profile.nrFuncionarios}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor Unitário:</span>
                <span className="font-[600] text-slate-800">{ptEur(profile.valorTicket)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Limite Deducão:</span>
                <span className="font-[600] text-slate-800">{profile.limiteDeducao}€ /dia</span>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#781D1D]" />
              SS Independente
            </h4>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Rendimento Mensal:</span>
                <span className="font-[600] text-slate-800">{ptEur(profile.rendimentoMensalEni)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Regime:</span>
                <span className="font-[600] text-slate-800 capitalize">{profile.regimeSs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Anos Atividade:</span>
                <span className="font-[600] text-slate-800">{currentYear - profile.inicioAtividade}</span>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-4 bg-amber-50 border border-amber-200 rounded-[20px] p-6">
          <h4 className="text-[16px] font-[800] text-amber-900 mb-4 flex items-center gap-2">
            💡 Notas para o Contabilista
          </h4>
          <div className="space-y-3 text-[14px] text-amber-800">
            <p><strong>• Regra IVA:</strong> Se a faturação é ≤15.000€ e só B2C, considere o regime isento (Art. 53º).</p>
            <p><strong>• Benefício Jovem:</strong> Aplicável até 35 anos. Reduz IRS nos primeiros anos de atividade.</p>
            <p><strong>• Tickets:</strong> Limite de 5€ dia (7€ em hotelaria/construção). Dedutível a 60% para a empresa.</p>
            <p><strong>• SS Independente:</strong> Taxa de 21.4% sobre 70% do rendimento (serviços) ou 20% (bens).</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export const defaultProfile: ClientProfile = {
  nomeCliente: '',
  nif: '',
  email: '',
  telefone: '',
  regimeIva: 'normal_trimestral',
  cae: '',
  inicioAtividade: new Date().getFullYear(),
  atividadePrincipal: 'servicos',
  isSazonal: false,
  idade: 30,
  estadoCivil: 'solteiro',
  cônjugeRendimentos: false,
  nrDependentes: 0,
  beneficioJovem: false,
  tipoEntidade: 'eni',
  faturaçaoAnualPrevista: 60000,
  nrFuncionarios: 5,
  veiculos: [],
  tipoVale: 'refeicao',
  valorTicket: 10,
  limiteDeducao: 5,
  setorTicket: 'normal',
  rendimentoMensalEni: 800,
  regimeSs: 'general',
  tipoRendimentoSs: 'servicos'
};
