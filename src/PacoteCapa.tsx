import React from 'react';
import type { ClientProfile } from './ClientProfile';
import type { OfficeSettings } from './lib/officeSettings';

/**
 * Capa do «Pacote cliente». Uma folha A4 autónoma, sem cabeçalho de relatório:
 * nome do cliente em grande, ano, conteúdo do pacote e identidade do escritório.
 * Impressão isolada como nos restantes documentos do pacote.
 */
export default function PacoteCapa({
  profile,
  office,
}: {
  profile: ClientProfile;
  office: OfficeSettings;
}) {
  const ano = new Date().getFullYear();
  const escritorio = office.nome?.trim() || 'Estudo 360';
  const cliente = profile.nomeCliente?.trim() || 'Cliente';
  const accent = office.corPrimaria || '#0677FF';
  const data = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(new Date());

  return (
    <div id="pacote-capa-root" className="pc-root">
      <style>{`
        .pc-root { background:#fff; color:#003B8F; width:210mm; min-height:297mm; position:relative; padding:34mm 22mm 22mm 30mm; box-sizing:border-box; font-family:Helvetica, Arial, sans-serif; }
        .pc-spine { position:absolute; left:0; top:0; bottom:0; width:6mm; background:${accent}; }
        .pc-kicker { font-size:8.2pt; letter-spacing:2.2pt; text-transform:uppercase; font-weight:700; color:#2D69B3; }
        .pc-title { margin:22mm 0 0; font-size:38pt; line-height:1.02; font-weight:700; letter-spacing:-0.6pt; color:#003B8F; }
        .pc-client { margin-top:10mm; font-size:20pt; line-height:1.15; font-weight:700; color:#003B8F; }
        .pc-meta { margin-top:3mm; font-size:10pt; color:#2D69B3; }
        .pc-rule { height:0.4pt; background:#C9DFFF; margin:14mm 0 0; }
        .pc-list { margin:8mm 0 0; padding:0; list-style:none; }
        .pc-list li { font-size:10.5pt; padding:3.2mm 0; border-bottom:0.4pt solid #EAF3FF; display:flex; justify-content:space-between; gap:8mm; }
        .pc-list b { font-weight:700; }
        .pc-list span { color:#2D69B3; }
        .pc-foot { position:absolute; left:30mm; right:22mm; bottom:20mm; display:flex; justify-content:space-between; font-size:8.4pt; color:#2D69B3; border-top:0.4pt solid #C9DFFF; padding-top:4mm; }
        @media print {
          html, body { height:auto !important; overflow:visible !important; }
          body * { visibility:hidden; }
          #pacote-capa-root, #pacote-capa-root * { visibility:visible; }
          #pacote-capa-root { position:absolute; top:0; left:0; }
          @page { size:A4; margin:0; }
        }
      `}</style>
      <div className="pc-spine" aria-hidden="true" />
      <div className="pc-kicker">{escritorio} · Pacote do cliente</div>
      <h1 className="pc-title">Proposta e contrato<br />de prestação de serviços</h1>
      <div className="pc-client">{cliente}</div>
      <div className="pc-meta">{profile.nif ? `NIF ${profile.nif} · ` : ''}Ano {ano}</div>
      <div className="pc-rule" />
      <div className="pc-kicker" style={{ marginTop: "8mm" }}>Conteúdo do pacote</div>
      <ul className="pc-list">
        <li><b>Proposta de honorários</b><span>Serviços, mensalidade e condições</span></li>
        <li><b>Contrato de prestação de serviços</b><span>Cláusulas, RGPD e assinaturas</span></li>
      </ul>
      <div className="pc-foot">
        <span>{escritorio}{office.contabilistaResponsavel ? ` · ${office.contabilistaResponsavel}` : ''}</span>
        <span>{data}</span>
      </div>
    </div>
  );
}
