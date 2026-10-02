/**
 * Integração Gama — geração de apresentações via Gamma API v1 (public-api.gamma.app)
 * Docs: gamma-app/gamma-docs (endpoints create-generation / get-generation-status)
 * Fluxo async: POST /v0.2/generations -> {id} -> poll GET /v0.2/generations/:id até completed -> gammaUrl
 */

export type GamaStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GamaCreateResponse {
  id?: string;
  generationId?: string;
  status?: string;
}

export interface GamaStatusResponse {
  id?: string;
  status: GamaStatus | string;
  gammaUrl?: string;
  exportUrl?: string;
  webUrl?: string;
  error?: string;
}

const GAMMA_API_BASE = 'https://public-api.gamma.app';
const GAMMA_CREATE_PATH = '/v0.2/generations';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

function resolveApiKey(explicit?: string): string {
  const envKey = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_GAMMA_API_KEY as string | undefined;
  return (explicit?.trim() || envKey?.trim() || '').trim();
}

export function isGamaConfigured(explicit?: string): boolean {
  return !!resolveApiKey(explicit);
}

export type GamaPromptSections = {
  equipa?: boolean;
  valores?: boolean;
  beneficios?: boolean;
  observacoes?: string;
};

export function buildGamaPrompt(
  office: { nome?: string; nif?: string; morada?: string; localidade?: string; codigoPostal?: string; email?: string; telefone?: string; website?: string; cedulaProfissional?: string; numeroInscricaoOCC?: string; tipo?: string; anoFundacao?: number; historia?: string; equipaTexto?: string; valoresTexto?: string },
  honorarios?: { baseMensal?: Record<string, number>; taxaIVA?: number; mensalExemplo?: number; contratoMeses?: number },
  cliente?: { nome?: string; nif?: string },
  sections?: GamaPromptSections,
): string {
  const o = office || {};
  const h = honorarios || {};
  const s = sections || {};
  const lines: string[] = [];
  // Estrutura Ativiwise: capa → Sobre nós → Equipa → Valores → Digital → Âmbito → Benefícios → Investimento → Fecho
  const paraQuem = cliente?.nome ? `, ${cliente.nome}` : '';
  lines.push(`# Proposta de Serviços de Contabilidade — ${o.nome || 'o nosso escritório'}${paraQuem}`);
  lines.push('');
  lines.push(`${o.nome || 'O nosso escritório'} · Ao seu lado na gestão do negócio.`);
  lines.push('');
  lines.push('## Sobre nós');
  if (o.historia?.trim()) lines.push(o.historia.trim());
  else lines.push(`${o.nome || 'O nosso escritório'} é um escritório de contabilidade certificado em Portugal. Trabalhamos com proximidade, rigor e ferramentas digitais — da contabilidade do dia a dia ao apoio à decisão.`);
  if (o.anoFundacao) lines.push(`A acompanhar clientes desde ${o.anoFundacao}.`);
  lines.push('');
  if (s.equipa !== false) {
    lines.push('## A nossa equipa');
    lines.push(o.equipaTexto?.trim() || 'Equipa qualificada e certificada ao seu serviço — cada cliente com responsável dedicado.');
    lines.push('');
  }
  if (s.valores !== false) {
    lines.push('## Os nossos valores');
    lines.push(o.valoresTexto?.trim() || 'Integridade · Compromisso · Proatividade · Confidencialidade · Proximidade');
    lines.push('');
  }
  lines.push('## Mais do que um parceiro — contabilidade digital');
  lines.push('- Digitalização instantânea: envia documentos com uma foto.');
  lines.push('- Equipa multidisciplinar e ferramentas de gestão.');
  lines.push('- Contacto direto — grupo privado quando necessário.');
  lines.push('');
  lines.push('## Âmbito da proposta — Serviços incluídos');
  lines.push('- Contabilidade e impostos: processamento, conciliações mensais, IVA/IRS/SS, demonstrações financeiras, IES e declarações anuais.');
  lines.push('- Assessoria: fiscal (IRS/IVA), gestão de ativos e depreciações, reunião de reporte trimestral.');
  // Prova viva: proposta do cliente
  const mensal = (h as { mensalExemplo?: number }).mensalExemplo ?? Object.values(h.baseMensal || {})[0] as number | undefined;
  const ivaPct = h.taxaIVA != null ? ` (IVA ${Math.round((h.taxaIVA as number)*100)}% não incluído)` : '';
  if (s.beneficios !== false) {
    lines.push('');
    lines.push('## Benefícios exclusivos');
    lines.push('- Equipa multidisciplinar · Rede de parceiros · Drive partilhada · Comunidade privada e formações.');
  }
  if (cliente?.nome) {
    lines.push('');
    lines.push(`## A nossa proposta para si${cliente.nif ? ` (${cliente.nome}, NIF ${cliente.nif})` : ''}`);
    lines.push('Inclui enquadramento fiscal, calendário de obrigações e acompanhamento contínuo.');
  }
  lines.push('');
  lines.push('## Investimento — Honorários');
  if (mensal) lines.push(`Honorário mensal: ${new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(mensal)}/mês${ivaPct}.`);
  else if (h.baseMensal && Object.keys(h.baseMensal).length) {
    lines.push(`Valores mensais por tipo de entidade${ivaPct}:`);
    for (const [k,v] of Object.entries(h.baseMensal)) if (typeof v === 'number' && v>0) lines.push(`- ${k}: ${new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(v)}/mês`);
  } else lines.push('Proposta personalizada — ver valores detalhados no dossiê do cliente.');
  const contrato = (h as { contratoMeses?: number }).contratoMeses;
  if (contrato) lines.push(`${Math.round(contrato/12)} ano(s) de contrato, renovável. 60 dias de aviso prévio.`);
  if (s.observacoes?.trim()) { lines.push(''); lines.push(s.observacoes.trim()); }
  lines.push('');
  lines.push('## Agradecemos a oportunidade');
  lines.push('Ficamos ao dispor para qualquer questão — responda a esta proposta por email ou telefone.');
  const contacto = [o.email, o.telefone].filter(Boolean).join(' · ') || '—';
  lines.push(`Contacto: ${contacto}${o.website ? ` · ${o.website}` : ''}`);
  lines.push(`Sede: ${[o.morada, o.codigoPostal, o.localidade].filter(Boolean).join(', ') || '—'}`);
  const ced = o.cedulaProfissional ? ` · Cédula: ${o.cedulaProfissional}` : '';
  const occ = o.numeroInscricaoOCC ? ` · OCC: ${o.numeroInscricaoOCC}` : '';
  lines.push(`NIF: ${o.nif || '—'}${ced}${occ}`);
  lines.push('');
  lines.push('---');
  lines.push('_Proposta gerada no Estudo 360° — conteúdo editável no Gama._');
  return lines.join('\n');
}

export async function createGamaPresentation(inputText: string, apiKeyExplicit?: string): Promise<{ generationId: string }> {
  const apiKey = resolveApiKey(apiKeyExplicit);
  if (!apiKey) throw new Error('Gama API key em falta. Configura em Definições do Escritório ou VITE_GAMMA_API_KEY.');
  const res = await fetch(`${GAMMA_API_BASE}${GAMMA_CREATE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputText,
      textMode: 'generate',
      format: 'presentation',
      cardOptions: { dimensions: '16x9' },
      sharingOptions: { workspaceAccess: 'view' },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`Gama create falhou (${res.status}): ${txt.slice(0,500)}`);
  }
  const data = await res.json() as GamaCreateResponse & Record<string, unknown>;
  const id = (data.generationId || data.id || (data as unknown as { generation_id?: string }).generation_id || '') as string;
  if (!id) throw new Error('Gama: resposta sem generationId');
  return { generationId: String(id) };
}

export async function getGamaGenerationStatus(generationId: string, apiKeyExplicit?: string): Promise<GamaStatusResponse> {
  const apiKey = resolveApiKey(apiKeyExplicit);
  if (!apiKey) throw new Error('Gama API key em falta');
  const res = await fetch(`${GAMMA_API_BASE}${GAMMA_CREATE_PATH}/${encodeURIComponent(generationId)}`, {
    headers: {
      'X-API-KEY': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`Gama status falhou (${res.status}): ${txt.slice(0,500)}`);
  }
  const data = await res.json() as GamaStatusResponse;
  return data;
}

export async function pollGamaGeneration(generationId: string, apiKeyExplicit?: string, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<GamaStatusResponse> {
  const interval = opts?.intervalMs ?? POLL_INTERVAL_MS;
  const timeout = opts?.timeoutMs ?? POLL_TIMEOUT_MS;
  const t0 = Date.now();
  while (true) {
    const st = await getGamaGenerationStatus(generationId, apiKeyExplicit);
    const s = String(st.status || '').toLowerCase();
    if (s === 'completed' || s === 'complete' || s === 'done' || st.gammaUrl || st.exportUrl || st.webUrl) return st;
    if (s === 'failed' || s === 'error') throw new Error(st.error || 'Gama: geração falhou');
    if (Date.now() - t0 > timeout) throw new Error('Gama: timeout a aguardar geração (tenta abrir o Gama manualmente)');
    await new Promise(r => setTimeout(r, interval));
  }
}

export async function generateGamaPresentation(inputText: string, apiKeyExplicit?: string, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<GamaStatusResponse & { generationId: string }> {
  const { generationId } = await createGamaPresentation(inputText, apiKeyExplicit);
  const final = await pollGamaGeneration(generationId, apiKeyExplicit, opts);
  return { ...final, generationId };
}

export function resolveGamaUrl(status: GamaStatusResponse): string | null {
  return (status.gammaUrl || status.exportUrl || status.webUrl || null) as string | null;
}
