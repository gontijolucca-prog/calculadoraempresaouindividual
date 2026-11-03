import React, { useMemo, useState } from 'react';
import type { ClientProfile } from './ClientProfile';
import type { OfficeSettings } from './lib/officeSettings';
import { calcularProposta, type HonorariosConfig } from './lib/honorarios';
import { imprimirUmaFolha } from './lib/printElement';
import { PDF_COLORS as C } from './lib/pdfTheme';

interface Props {
  profile: ClientProfile;
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  /** IDs dos serviços extra escolhidos para esta proposta. Se null, usa defaults. */
  servicosIds?: string[];
  onServicosIdsChange?: (ids: string[]) => void;
  /** ID para isolar este componente quando imprimir. */
  printRootId?: string;
}

const eur = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

const today = () =>
  new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Carta de proposta de honorários do escritório para o cliente.
 * Formato A4 imprimível — usa CSS @media print para isolar este componente.
 */
export default function Proposta({ profile, office, honorarios, servicosIds, onServicosIdsChange, printRootId = 'proposta-print-root' }: Props) {
  const [editaveis, setEditaveis] = useState({
    introducao: '',
    observacoes: '',
  });

  // Permite selecionar/desselecionar serviços extra inline.
  const [localIds, setLocalIds] = useState<string[]>(
    () => servicosIds ?? honorarios.servicosExtra.filter(s => s.ativoPorDefeito).map(s => s.id)
  );
  const idsAtuais = servicosIds ?? localIds;
  const setIds = (next: string[]) => {
    setLocalIds(next);
    onServicosIdsChange?.(next);
  };

  const proposta = useMemo(
    () => calcularProposta(profile, honorarios, idsAtuais),
    [profile, honorarios, idsAtuais]
  );

  // ── Linhas editáveis ──────────────────────────────────────────────────────
  // O documento é editável: o utilizador altera valores à mão e os totais
  // recalculam ao vivo. Linhas a 0 passam a "Serviços extra opcionais". Pode
  // ainda acrescentar serviços extra escritos à mão.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [customLinhas, setCustomLinhas] = useState<{ id: string; descricao: string; valorMensal: number }[]>([]);

  type Linha = { key: string; descricao: string; valorMensal: number; custom: boolean };
  const linhas: Linha[] = [
    ...proposta.itens.map(it => ({
      key: it.descricao,
      descricao: it.descricao,
      valorMensal: overrides[it.descricao] ?? it.valorMensal,
      custom: false,
    })),
    ...customLinhas.map(c => ({ key: c.id, descricao: c.descricao, valorMensal: c.valorMensal, custom: true })),
  ];
  // Linhas customizadas ficam sempre na tabela (para escrever nome+valor à mão);
  // só os serviços PREDEFINIDOS postos a 0 passam para "opcionais".
  const ativas = linhas.filter(l => l.custom || l.valorMensal > 0);
  const opcionais = linhas.filter(l => !l.custom && !(l.valorMensal > 0));
  const mensalSemIVA = ativas.reduce((s, l) => s + (l.valorMensal > 0 ? l.valorMensal : 0), 0);
  const iva = mensalSemIVA * honorarios.taxaIVA;
  const mensalComIVA = mensalSemIVA + iva;
  const anualComIVA = mensalComIVA * 12;

  const setValor = (linha: Linha, v: number) => {
    const n = Number.isFinite(v) && v >= 0 ? v : 0;
    if (linha.custom) setCustomLinhas(cs => cs.map(c => c.id === linha.key ? { ...c, valorMensal: n } : c));
    else setOverrides(o => ({ ...o, [linha.key]: n }));
  };
  const setDescricaoCustom = (id: string, d: string) =>
    setCustomLinhas(cs => cs.map(c => c.id === id ? { ...c, descricao: d } : c));
  const addCustom = () =>
    setCustomLinhas(cs => [...cs, { id: `c${Date.now()}${cs.length}`, descricao: 'Novo serviço', valorMensal: 0 }]);
  const removeCustom = (id: string) => setCustomLinhas(cs => cs.filter(c => c.id !== id));

  const cor = C.blue;
  const valInput: React.CSSProperties = {
    width: 96, textAlign: 'right', fontWeight: 600, fontSize: '11pt',
    border: `1px solid ${C.line}`, borderRadius: 6, padding: '3px 6px',
    background: C.white, color: C.dark, fontFamily: 'inherit',
  };

  return (
    <div id={printRootId} className="bg-white" style={{ color: C.dark }}>
      <style>{`
        #${printRootId} { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        #${printRootId} .pp-page { width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 16mm 18mm; margin: 0 auto; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        #${printRootId} .pp-band { height: 6px; background: ${cor}; }
        #${printRootId} table { border-collapse: collapse; width: 100%; }
        #${printRootId} th, #${printRootId} td { padding: 7px 10px; border-bottom: 1px solid ${C.line}; text-align: left; font-size: 10.5pt; }
        #${printRootId} th { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; color: ${C.dark}; background: ${C.light}; border-bottom: 2px solid ${cor}; }
        @media print {
          /* height:auto evita a página em branco extra: com o body escondido por
             visibility, a altura original do ecrã continuava a contar para a paginação. */
          html, body { height: auto !important; overflow: visible !important; }
          body * { visibility: hidden; }
          #${printRootId}, #${printRootId} * { visibility: visible; }
          #${printRootId} { position: absolute; top: 0; left: 0; width: 100%; }
          #${printRootId} .pp-page { box-shadow: none; margin: 0; zoom: 1 !important; min-height: 0; }
          #${printRootId} [contenteditable] { outline: none !important; }
          /* Inputs editáveis imprimem como texto limpo (sem caixa nem setas). */
          #${printRootId} input { border: none !important; padding: 0 !important; background: transparent !important; -webkit-appearance: none; appearance: none; text-align: right; }
          #${printRootId} input::-webkit-outer-spin-button,
          #${printRootId} input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          /* Quebrar a página entre blocos — nunca a meio da tabela, de uma linha,
             de uma secção ou do bloco de assinaturas. */
          #${printRootId} table, #${printRootId} tr, #${printRootId} .pp-keep { break-inside: avoid; page-break-inside: avoid; }
          @page { size: A4; margin: 0; }
        }
        /* Em ecrãs estreitos a folha A4 não cabe — mostra vista de formulário */
        @media screen and (max-width: 820px) {
          #${printRootId} .pp-page { zoom: 0.46; }
          #${printRootId} .pp-mobile-form { display: block; }
        }
        @media screen and (max-width: 480px) {
          #${printRootId} .pp-page { display: none; }
          #${printRootId} .pp-mobile-form { display: block; }
        }
      `}</style>

      {/* Dica de edição (não imprime) */}
      <div className="no-print" style={{ maxWidth: '210mm', margin: '0 auto 8px auto', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: C.light, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: '12px', color: C.dark, fontWeight: 600 }}>
        <span aria-hidden>✏️</span>
        <span>Clique em qualquer texto para o editar antes de imprimir.</span>
      </div>

      {/* Vista de formulário para mobile — layout vertical legível */}
      <div className="pp-mobile-form" style={{ display: 'none', maxWidth: 480, margin: '0 auto', padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.dark, marginBottom: 12 }}>Proposta de Honorários</h2>
        <p style={{ fontSize: 13, color: C.medium, marginBottom: 16 }}>{today()} · Ref.: {profile.nif || '(NIF)'}</p>
        <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.line}` }}>
          {ativas.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 14, color: C.dark }}>{l.descricao}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{eur(l.valorMensal)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: `2px solid ${C.dark}`, marginTop: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>Mensal c/ IVA</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: C.blue }}>{eur(mensalComIVA)}</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={() => imprimirUmaFolha(printRootId, { piso: 1 })} style={{ background: C.blue, color: C.white, border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Imprimir proposta</button>
          </div>
        </div>
      </div>

      <div className="pp-page" contentEditable suppressContentEditableWarning>
        <div className="pp-band" style={{ margin: '-16mm -18mm 12mm -18mm' }} />

        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: 31, height: 31, borderRadius: 8, background: C.blue, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '9pt', marginBottom: 7 }}>360</div>
            <div style={{ fontWeight: 800, fontSize: '14pt', color: C.dark }}>{office.nome || '— configure o nome do escritório nas Definições —'}</div>
            <div style={{ fontSize: '9pt', color: C.medium, marginTop: 2, lineHeight: 1.5 }}>
              {office.tipo === 'sociedade' ? `NIPC ${office.nif || '—'}` : `Contabilista Certificado · NIF ${office.nif || '—'}`}<br/>
              {office.cedulaProfissional && `Cédula prof. n.º ${office.cedulaProfissional}`}
              {office.tipo === 'sociedade' && office.numeroInscricaoOCC && ` · OCC n.º ${office.numeroInscricaoOCC}`}<br/>
              {office.morada}{office.codigoPostal && `, ${office.codigoPostal}`} {office.localidade}<br/>
              {office.telefone}{office.telefone && office.email && ' · '}{office.email}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '9pt', color: C.medium }}>
            <div style={{ fontSize: '10pt', fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: 2 }}>Proposta de Honorários</div>
            <div style={{ marginTop: 4 }}>{today()}</div>
            <div style={{ marginTop: 8, fontSize: '8pt' }}>Ref.: <strong>{profile.nif || '(NIF)'}</strong></div>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: `1px solid ${C.line}`, margin: '12px 0 14px 0' }} />

        {/* Destinatário */}
        <div style={{ marginBottom: 16, fontSize: '10pt' }}>
          <div style={{ color: C.medium, textTransform: 'uppercase', letterSpacing: 1, fontSize: '8pt', fontWeight: 700 }}>Para</div>
          <div style={{ fontWeight: 800, fontSize: '12pt', color: C.dark, marginTop: 2 }}>{profile.nomeCliente || '— (nome do cliente) —'}</div>
          <div style={{ color: C.medium, marginTop: 1, lineHeight: 1.5 }}>
            NIF {profile.nif || '—'}<br/>
            {profile.morada || ''}{profile.codigoPostal && `, ${profile.codigoPostal}`} {profile.localidade || ''}
          </div>
        </div>

        <div className="pp-keep" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
          {[
            ['Entidade', entidadeLabel(profile.tipoEntidade)],
            ['Volume de negócios', profile.faturaçaoAnualPrevista ? eur(profile.faturaçaoAnualPrevista) : 'Por confirmar'],
            ['Regime de IVA', profile.regimeIva === 'isento' ? 'Isento' : profile.regimeIva === 'normal_mensal' ? 'Normal mensal' : profile.regimeIva === 'pequenos_retalhistas' ? 'Pequenos retalhistas' : 'Normal trimestral'],
            ['Trabalhadores', String(profile.nrFuncionarios || 0)],
          ].map(([label, value]) => (
            <div key={label} style={{ background: C.light, border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 8px' }}>
              <div style={{ color: C.medium, fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
              <div style={{ color: C.dark, fontSize: '9pt', fontWeight: 700, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Texto introdutório editável */}
        <div style={{ marginBottom: 14, fontSize: '10.5pt', lineHeight: 1.55, color: C.dark }}>
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={e => setEditaveis(p => ({ ...p, introducao: e.currentTarget.innerText }))}
            style={{ outline: 'none', cursor: 'text' }}
          >
            {editaveis.introducao || `Exmo(a). Sr(a). ${profile.nomeCliente || '(...)'},

Na sequência da análise das informações que nos partilhou, apresentamos a proposta de prestação de serviços de contabilidade adequada ao seu enquadramento fiscal — ${entidadeLabel(profile.tipoEntidade)}${profile.faturaçaoAnualPrevista ? `, com volume de negócios anual previsto de ${eur(profile.faturaçaoAnualPrevista)}` : ''}.

Os serviços listados abaixo cobrem as obrigações contabilísticas e fiscais correntes, conforme exigido pela legislação portuguesa e pelo Estatuto da Ordem dos Contabilistas Certificados (EOCC).`}
          </div>
        </div>

        <div className="pp-keep" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ background: C.pale, border: `1px solid ${C.line}`, borderRadius: 7, padding: '8px 10px' }}>
            <div style={{ color: C.dark, fontSize: '9pt', fontWeight: 800, marginBottom: 3 }}>Incluído na mensalidade</div>
            <div style={{ color: C.medium, fontSize: '8.5pt', lineHeight: 1.45 }}>Contabilidade corrente, obrigações fiscais e de segurança social, preparação das declarações e apoio técnico dentro do âmbito contratado.</div>
          </div>
          <div style={{ background: C.pale, border: `1px solid ${C.line}`, borderRadius: 7, padding: '8px 10px' }}>
            <div style={{ color: C.dark, fontSize: '9pt', fontWeight: 800, marginBottom: 3 }}>Requer orçamento separado</div>
            <div style={{ color: C.medium, fontSize: '8.5pt', lineHeight: 1.45 }}>Constituição ou alteração de sociedades, atos jurídicos, contencioso, auditorias, deslocações e trabalhos extraordinários.</div>
          </div>
        </div>

        {/* Tabela de honorários */}
        <table>
          <thead>
            <tr>
              <th style={{ width: '70%' }}>Descrição</th>
              <th style={{ textAlign: 'right', width: '30%' }}>Valor mensal</th>
            </tr>
          </thead>
          <tbody>
            {ativas.map((linha) => (
              <tr key={linha.key}>
                <td contentEditable={false}>
                  {linha.custom ? (
                    <input
                      value={linha.descricao}
                      onChange={e => setDescricaoCustom(linha.key, e.target.value)}
                      style={{ width: '100%', border: 'none', borderBottom: `1px dashed ${C.line}`, fontSize: '11pt', fontFamily: 'inherit', color: C.dark, background: 'transparent', outline: 'none' }}
                    />
                  ) : linha.descricao}
                </td>
                <td contentEditable={false} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <input
                    type="number" min={0} step={1} value={linha.valorMensal}
                    onChange={e => setValor(linha, parseFloat(e.target.value))}
                    style={valInput} aria-label={`Valor mensal — ${linha.descricao}`}
                  /> €
                  {linha.custom && (
                    <button type="button" onClick={() => removeCustom(linha.key)} title="Remover serviço"
                      style={{ marginLeft: 6, border: 'none', background: 'transparent', color: C.medium, cursor: 'pointer', fontSize: '13pt', lineHeight: 1 }}>×</button>
                  )}
                </td>
              </tr>
            ))}
            <tr style={{ background: C.light }}>
              <td style={{ fontWeight: 700 }}>Mensalidade (sem IVA)</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{eur(mensalSemIVA)}</td>
            </tr>
            <tr>
              <td>IVA à taxa de {(honorarios.taxaIVA * 100).toFixed(0)}%</td>
              <td style={{ textAlign: 'right' }}>{eur(iva)}</td>
            </tr>
            <tr style={{ background: cor + '22' }}>
              <td style={{ fontWeight: 800, fontSize: '12pt', color: C.dark }}>Mensalidade total (c/ IVA)</td>
              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '12pt', color: C.dark }}>{eur(mensalComIVA)}</td>
            </tr>
            <tr>
              <td style={{ fontStyle: 'italic', fontSize: '10pt', color: C.medium }}>Equivalente anual (c/ IVA)</td>
              <td style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '10pt', color: C.medium }}>{eur(anualComIVA)}</td>
            </tr>
          </tbody>
        </table>

        {/* Adicionar serviço à mão (ecrã apenas) */}
        <div className="no-print" contentEditable={false} style={{ marginTop: 8 }}>
          <button type="button" onClick={addCustom}
            style={{ fontSize: '11pt', fontWeight: 600, color: cor, background: 'transparent', border: `1.5px dashed ${cor}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
            + Adicionar serviço
          </button>
          <span style={{ marginLeft: 10, fontSize: '9.5pt', color: C.medium }}>
            Põe o valor a 0 para passar um serviço a “opcional”.
          </span>
        </div>

        {/* Serviços extra opcionais — linhas a 0 (impresso, sem cobrança). */}
        {opcionais.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, color: C.dark, marginBottom: 6, fontSize: '10.5pt' }}>Serviços extra opcionais</div>
            <div style={{ fontSize: '9pt', color: C.medium, marginBottom: 6 }}>
              Disponíveis sob orçamento, não incluídos na mensalidade acima.
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: C.medium, fontSize: '10.5pt', lineHeight: 1.6 }}>
              {opcionais.map((l) => (
                <li key={l.key}>
                  {l.custom ? (
                    <input contentEditable={false}
                      value={l.descricao}
                      onChange={e => setDescricaoCustom(l.key, e.target.value)}
                      style={{ border: 'none', borderBottom: `1px dashed ${C.line}`, fontSize: '10.5pt', fontFamily: 'inherit', color: C.medium, background: 'transparent', outline: 'none', minWidth: 220 }}
                    />
                  ) : l.descricao}
                  {' '}<span style={{ color: C.medium }}>· sob orçamento</span>
                  <input contentEditable={false} type="number" min={0} step={1} value={l.valorMensal}
                    onChange={e => setValor(l, parseFloat(e.target.value))}
                    className="no-print"
                    style={{ ...valInput, width: 70, marginLeft: 8 }} aria-label={`Ativar ${l.descricao} (definir valor)`} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Toggle de serviços extra (apenas visível em ecrã, oculto na impressão).
            contentEditable={false} para continuar interactivo dentro da página editável. */}
        <div className="no-print" contentEditable={false} style={{ marginTop: 14, padding: 12, background: C.light, borderRadius: 8 }}>
          <div style={{ fontSize: '9pt', fontWeight: 700, color: C.dark, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Serviços extra a incluir (clique para alternar)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {honorarios.servicosExtra.map(s => {
              const active = idsAtuais.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setIds(active ? idsAtuais.filter(x => x !== s.id) : [...idsAtuais, s.id])}
                  className="no-print"
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: '11pt',
                    border: `1.5px solid ${active ? cor : C.line}`,
                    background: active ? cor : C.white,
                    color: active ? C.white : C.medium,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                  title={s.descricao}
                >
                  {active ? '✓ ' : '+ '}{s.nome} · {eur(s.precoMensal)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pp-keep" style={{ marginTop: 14 }}>
          <div style={{ color: C.dark, fontWeight: 800, fontSize: '10pt', marginBottom: 6 }}>Calendarização do trabalho</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              ['Até ao dia 5', 'Receção dos documentos, faturas, extratos e informação de pessoal do mês anterior.'],
              ['Até ao dia 15', 'Conferência contabilística, reconciliações, cálculo de impostos e preparação das declarações.'],
              ['Até ao prazo legal', 'Submissão das obrigações, envio das evidências ao cliente e arquivo no gabinete.'],
            ].map(([title, body]) => (
              <div key={title} style={{ background: C.pale, border: `1px solid ${C.line}`, borderRadius: 6, padding: '7px 8px' }}>
                <div style={{ color: C.blue, fontWeight: 800, fontSize: '8.5pt', marginBottom: 2 }}>{title}</div>
                <div style={{ color: C.medium, fontSize: '8pt', lineHeight: 1.4 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Condições / observações editáveis */}
        <div style={{ marginTop: 16, fontSize: '10pt', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, color: C.dark, marginBottom: 4 }}>Condições</div>
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={e => setEditaveis(p => ({ ...p, observacoes: e.currentTarget.innerText }))}
            style={{ outline: 'none', cursor: 'text', color: C.medium }}
          >
            {editaveis.observacoes || `Os honorários acima são pagos mensalmente, até ao último dia útil do mês a que respeitam, por transferência bancária para o IBAN ${office.iban || '(IBAN do escritório)'}.

A faturação será emitida no início de cada mês. Material de expediente, deslocações e serviços extraordinários não incluídos na presente proposta serão objeto de orçamento prévio.

A presente proposta é válida por 30 dias a contar da data acima e converte-se em contrato de prestação de serviços formal mediante assinatura do contrato anexo.`}
          </div>
        </div>

        <div className="pp-keep" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <div style={{ background: C.light, borderLeft: `3px solid ${C.blue}`, padding: '7px 9px' }}>
            <div style={{ color: C.dark, fontWeight: 800, fontSize: '9pt', marginBottom: 2 }}>Documentos e prazos</div>
            <div style={{ color: C.medium, fontSize: '8.5pt', lineHeight: 1.45 }}>O cliente entrega os documentos até ao dia 5 do mês seguinte e valida as declarações antes da submissão.</div>
          </div>
          <div style={{ background: C.light, borderLeft: `3px solid ${C.blue}`, padding: '7px 9px' }}>
            <div style={{ color: C.dark, fontWeight: 800, fontSize: '9pt', marginBottom: 2 }}>Próximos passos</div>
            <div style={{ color: C.medium, fontSize: '8.5pt', lineHeight: 1.45 }}>Aprovar esta proposta, assinar o contrato, confirmar os acessos e agendar a reunião inicial de integração.</div>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="pp-keep" style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <SignatureLine label={office.nome ? `${office.nome}\n${office.tipo === 'sociedade' ? `Rep. ${office.representanteLegal || '...'}` : `CC ${office.cedulaProfissional}`}` : 'Primeiro Outorgante'} />
          <SignatureLine label={profile.nomeCliente || 'Cliente'} />
        </div>

        {/* Rodapé — escondido na impressão paged.js (.pp-foot), onde as margin-boxes
            do @page já dão o nome do escritório + "Página X de Y". */}
        <div className="pp-foot" style={{ position: 'relative', marginTop: 14, paddingTop: 8, borderTop: `1px solid ${C.line}`, fontSize: '8pt', color: C.medium, display: 'flex', justifyContent: 'space-between' }}>
          <span>{office.nome || 'Escritório'}</span>
          <span>Proposta gerada em {today()} via Estudo 360</span>
        </div>
      </div>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div style={{ borderBottom: `1px solid ${C.medium}`, height: 40 }} />
      <div style={{ fontSize: '9.5pt', color: C.dark, marginTop: 4, whiteSpace: 'pre-line', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function entidadeLabel(t: string): string {
  switch (t) {
    case 'eni':         return 'Empresário em Nome Individual (ENI)';
    case 'unipessoal':  return 'Sociedade Unipessoal por Quotas';
    case 'socio_unico': return 'Unipessoal — Sócio Único';
    case 'lda':         return 'Sociedade por Quotas (Lda)';
    case 'sa':          return 'Sociedade Anónima (SA)';
    default:            return t || '—';
  }
}
