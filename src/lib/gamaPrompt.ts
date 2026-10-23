/**
 * Texto da proposta no formato Gamma (estrutura Ativiwise).
 *
 * É a cópia que se usava no Gamma, agora dentro do Estudo 360: gera o texto,
 * copia e abre gamma.app → "Paste text". Sem API, sem chave, custo zero.
 *
 * O preço NUNCA é escrito à mão aqui: vem de `pricingFor()` — a mesma função
 * que o editor usa — para o papel e o ecrã dizerem o mesmo número.
 */
import type { OfficeSettings } from './officeSettings';
import type { HonorariosConfig } from './honorarios';
import { pricingFor, type DeckCliente } from './deck/build';

export const GAMA_URL = 'https://gamma.app/create';

export interface GamaPromptOpcoes {
  equipa?: boolean;
  valores?: boolean;
  beneficios?: boolean;
  observacoes?: string;
}

export function buildGamaPrompt(
  office: OfficeSettings,
  honorarios: HonorariosConfig,
  cliente?: DeckCliente | null,
  opcoes: GamaPromptOpcoes = {},
): string {
  const o = office || ({} as OfficeSettings);
  const s = opcoes || {};
  const linhas: string[] = [];

  // Estrutura Ativiwise: capa → Sobre nós → Equipa → Valores → Digital →
  // Âmbito → Benefícios → Investimento → Fecho.
  const paraQuem = cliente?.nome ? ` para ${cliente.nome}` : '';
  linhas.push(`# Proposta de Serviços de Contabilidade — ${o.nome || 'o nosso escritório'}${paraQuem}`);
  linhas.push('');
  linhas.push(`${o.nome || 'O nosso escritório'} · Ao seu lado na gestão do negócio.`);
  linhas.push('');

  linhas.push('## Sobre nós');
  if (o.historia?.trim()) linhas.push(o.historia.trim());
  else {
    const quem = o.tipo === 'individual' ? 'é contabilista certificado' : 'é um escritório de contabilidade certificado';
    linhas.push(`${o.nome || 'O nosso escritório'} ${quem} em Portugal. Trabalhamos com proximidade, rigor e ferramentas digitais — da contabilidade do dia a dia ao apoio à decisão.`);
  }
  if (o.anoFundacao) linhas.push(`A acompanhar clientes desde ${o.anoFundacao}.`);
  linhas.push('');

  if (s.equipa !== false) {
    linhas.push('## A nossa equipa');
    linhas.push('Equipa qualificada e certificada ao seu serviço — cada cliente com responsável dedicado.');
    linhas.push('');
  }

  if (s.valores !== false) {
    linhas.push('## Os nossos valores');
    linhas.push('Integridade · Compromisso · Proatividade · Confidencialidade · Proximidade');
    linhas.push('');
  }

  linhas.push('## Mais do que um parceiro — contabilidade digital');
  linhas.push('- Digitalização instantânea: envia documentos com uma foto.');
  linhas.push('- Equipa multidisciplinar e ferramentas de gestão.');
  linhas.push('- Contacto direto — grupo privado quando necessário.');
  linhas.push('');

  linhas.push('## Âmbito da proposta — Serviços incluídos');
  linhas.push('- Contabilidade e impostos: processamento, conciliações mensais, IVA/IRS/SS, demonstrações financeiras, IES e declarações anuais.');
  linhas.push('- Assessoria: fiscal (IRS/IVA), gestão de ativos e depreciações, reunião de reporte trimestral.');

  if (s.beneficios !== false) {
    linhas.push('');
    linhas.push('## Benefícios exclusivos');
    linhas.push('- Equipa multidisciplinar · Rede de parceiros · Drive partilhada · Comunidade privada e formações.');
  }

  if (cliente?.nome) {
    linhas.push('');
    linhas.push(`## A nossa proposta para si${cliente.nif ? ` (${cliente.nome}, NIF ${cliente.nif})` : ''}`);
    linhas.push('Inclui enquadramento fiscal, calendário de obrigações e acompanhamento contínuo.');
  }

  linhas.push('');
  linhas.push('## Investimento — Honorários');
  const preco = pricingFor({ office: o, honorarios, cliente: cliente ?? null });
  if (preco.subtitle) linhas.push(preco.subtitle);
  for (const item of preco.items) linhas.push(`- ${item.label}: ${item.value}`);
  const contrato = (honorarios as unknown as { contratoMeses?: number })?.contratoMeses;
  if (contrato) linhas.push(`${Math.round(contrato / 12)} ano(s) de contrato, renovável. 60 dias de aviso prévio.`);

  if (s.observacoes?.trim()) {
    linhas.push('');
    linhas.push(s.observacoes.trim());
  }

  linhas.push('');
  linhas.push('## Agradecemos a oportunidade');
  linhas.push('Ficamos ao dispor para qualquer questão.');

  const contacto = [o.email, o.telefone].filter(Boolean).join(' · ');
  if (contacto) linhas.push('**Próximo passo:** responda a esta proposta por email ou telefone e tratamos do arranque (documentos, acessos e calendário).');

  const sede = [o.morada, o.codigoPostal, o.localidade].filter(Boolean).join(', ');
  const ids = [
    o.nif ? `NIF: ${o.nif}` : '',
    o.cedulaProfissional ? `Cédula: ${o.cedulaProfissional}` : '',
    o.numeroInscricaoOCC ? `OCC: ${o.numeroInscricaoOCC}` : '',
  ].filter(Boolean).join(' · ');
  if (contacto) linhas.push(`Contacto: ${contacto}${o.website ? ` · ${o.website}` : ''}`);
  if (sede) linhas.push(`Sede: ${sede}`);
  if (ids) linhas.push(ids);

  linhas.push('');
  linhas.push('---');
  linhas.push('_Proposta gerada no Estudo 360° — conteúdo editável no Gamma._');
  return linhas.join('\n');
}
