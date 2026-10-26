/**
 * Minuta de Contrato em UMA folha A4 — versão resumida e legível.
 *
 * O contrato completo tem 2–3 páginas a 6 pt: numa folha ficaria ilegível.
 * Esta versão leva as cláusulas essenciais (partes, objeto, prazo, honorários,
 * obrigações, foro, assinaturas) e diz onde está o texto integral.
 */
import type { OfficeSettings } from './officeSettings';
import type { HonorariosConfig } from './honorarios';
import type { ClientProfile } from '../ClientProfile';
import { calcularProposta } from './honorarios';

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const eur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(v) ? v : 0);

export function buildMinutaResumoHtml(office: OfficeSettings, honorarios: HonorariosConfig, profile: ClientProfile, servicosIds?: string[]): string {
  const p = calcularProposta(profile, honorarios, servicosIds);
  const hoje = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(new Date());
  const escritorio = office.nome || 'Estudo 360';
  const cliente = profile.nomeCliente || 'Cliente';
  const nifCliente = profile.nif || '—';
  const nifEsc = office.nif || '—';
  const contacto = [office.email, office.telefone].filter(Boolean).join(' · ') || '—';
  const morada = [office.morada, office.codigoPostal, office.localidade].filter(Boolean).join(', ') || '—';
  const occ = [office.cedulaProfissional ? `Cédula ${office.cedulaProfissional}` : '', office.numeroInscricaoOCC ? `OCC ${office.numeroInscricaoOCC}` : ''].filter(Boolean).join(' · ');

  const servicos = p.itens.map((i) => `<li>${esc(i.descricao)} — ${esc(eur(i.valorMensal))}/mês</li>`).join('');

  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Minuta de Contrato — ${esc(cliente)}</title>
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1A1A18; font-size: 9.6pt; line-height: 1.42; }
  .wrap { padding: 16mm 18mm; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.4mm solid #B06D35; padding-bottom: 3mm; }
  .head .nome { font-family: Arial, Helvetica, sans-serif; font-weight: 800; font-size: 12pt; letter-spacing: .02em; }
  .head .meta { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #64748B; text-align: right; }
  h1 { font-family: Arial, Helvetica, sans-serif; font-size: 14pt; margin: 5mm 0 1mm; letter-spacing: .02em; }
  .sub { font-family: Arial, Helvetica, sans-serif; font-size: 8.4pt; color: #64748B; margin: 0 0 4mm; }
  h2 { font-family: Arial, Helvetica, sans-serif; font-size: 9.4pt; text-transform: uppercase; letter-spacing: .08em; color: #B06D35; margin: 4mm 0 1mm; }
  p { margin: 0 0 1.6mm; text-align: justify; }
  ul { margin: 0 0 1.6mm 5mm; padding: 0; }
  li { margin: 0 0 .8mm; }
  .box { border: 1px solid #E2E8F0; background: #FDFBF7; border-radius: 2mm; padding: 3mm 4mm; margin: 2mm 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 6mm; font-size: 9pt; }
  .ass { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; margin-top: 10mm; font-family: Arial, Helvetica, sans-serif; font-size: 8.4pt; text-align: center; }
  .linha { border-top: 1px solid #1A1A18; margin-bottom: 1.5mm; padding-top: 1.5mm; }
  .nota { margin-top: 4mm; font-family: Arial, Helvetica, sans-serif; font-size: 7.6pt; color: #64748B; }
</style></head><body><div class="wrap">
  <div class="head">
    <div>
      <div class="nome">${esc(escritorio)}</div>
      <div style="font-family:Arial;font-size:7.6pt;color:#64748B">Estudo 360 · Análise · Estratégia · Decisão</div>
    </div>
    <div class="meta">MINUTA DE CONTRATO<br>${esc(hoje)}<br>NIF ${esc(nifEsc)}${occ ? `<br>${esc(occ)}` : ''}</div>
  </div>

  <h1>Contrato de Prestação de Serviços de Contabilidade</h1>
  <p class="sub">Versão resumida numa folha. O texto integral está disponível na aplicação e a pedido.</p>

  <h2>Partes</h2>
  <div class="box grid">
    <div><strong>Prestador:</strong> ${esc(escritorio)}<br>NIF ${esc(nifEsc)}<br>${esc(morada)}<br>${esc(contacto)}</div>
    <div><strong>Cliente:</strong> ${esc(cliente)}<br>NIF ${esc(nifCliente)}<br>${esc(profile.localidade || '—')}<br>${esc(profile.email || profile.telefone || '—')}</div>
  </div>

  <h2>Objeto</h2>
  <p>O Prestador obriga-se a assegurar a contabilidade organizada, o cumprimento das obrigações fiscais e de segurança social e o apoio à gestão do Cliente, nos termos da proposta aceite e da legislação em vigor (CIRC, CIVA e CRCSPSS).</p>

  <h2>Serviços incluídos</h2>
  <ul>${servicos || '<li>Contabilidade e impostos — incluído</li>'}</ul>

  <h2>Honorários</h2>
  <p><strong>${esc(eur(p.mensalSemIVA))} / mês</strong> + IVA à taxa legal (${esc(eur(p.mensalComIVA))} com IVA), ${esc(eur(p.anualComIVA))} por ano. Faturação mensal, pagamento a 30 dias. Renovação automática por períodos de 12 meses; denúncia com 60 dias de aviso prévio.</p>

  <h2>Obrigações essenciais</h2>
  <p><strong>Do Prestador:</strong> sigilo profissional, diligência técnica, entrega das declarações dentro dos prazos legais e informação atempada de alterações legislativas relevantes.</p>
  <p><strong>Do Cliente:</strong> entregar os documentos até ao dia 5 do mês seguinte, manter os acessos atualizados e validar as declarações antes da submissão.</p>

  <h2>Duração e foro</h2>
  <p>O contrato produz efeitos na data da assinatura e vigora por 12 meses, renovável. Para qualquer litígio é competente o tribunal da comarca da sede do Prestador, com renúncia a outro.</p>

  <div class="ass">
    <div><div class="linha"></div>${esc(escritorio)}<br>${esc(occ || 'Contabilista Certificado')}</div>
    <div><div class="linha"></div>${esc(cliente)}<br>NIF ${esc(nifCliente)}</div>
  </div>

  <p class="nota">Documento gerado no Estudo 360. Versão resumida de 1 página; o contrato completo (com todas as cláusulas) está na aplicação, em Relatórios → Pacote cliente → Minuta de Contrato, e pode ser descarregado em Word.</p>
</div></body></html>`;
}
