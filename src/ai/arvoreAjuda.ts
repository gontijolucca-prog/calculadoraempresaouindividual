// Árvore de ajuda do Estudo 360 — escolha múltipla, sem LLM.
//
// Cada nó é uma pergunta com opções. As folhas têm uma resposta curta e, quase
// sempre, um destino: a vista/tab onde a função vive e o guia que a explica
// passo a passo (o mesmo motor de visitas guiadas do resto da app).
//
// Regras (protegidas por `arvoreAjuda.test.ts`):
//  - todo o `proximo` aponta para um nó existente;
//  - todo o guia referenciado existe em GUIAS;
//  - todos os ViewKey são alcançáveis a partir da raiz — se uma ferramenta não
//    tem guia, o teste falha antes de o bot prometer o que não existe.
import { GUIAS, type ViewKey } from '../lib/guias';

export interface DestinoAjuda {
  view: string;
  guia?: ViewKey;
}

export interface OpcaoAjuda {
  rotulo: string;
  /** Id do nó seguinte. */
  proximo: string;
}

export interface NoAjuda {
  id: string;
  /** Texto do bot (pergunta ou resposta). */
  texto: string;
  opcoes?: OpcaoAjuda[];
  /** Folha: destino opcional ("Ver no ecrã"). */
  destino?: DestinoAjuda;
  /** Folha: atalho para importar SAF-T. */
  saft?: 'novo' | 'empresa';
  /** Folha: lista de documentos Word/Excel do cliente ativo. */
  docs?: boolean;
  /** Folha: formulário de sugestão de melhoria. */
  sugestao?: boolean;
}

export const NO_RAIZ = 'inicio';

export const ARVORE: Record<string, NoAjuda> = {
  // ── Raiz ────────────────────────────────────────────────────────────────
  inicio: {
    id: 'inicio',
    texto: 'Olá! Sou o assistente do Estudo 360. Em que posso ajudar?',
    opcoes: [
      { rotulo: 'Empresas e clientes', proximo: 'empresas' },
      { rotulo: 'Importar SAF-T', proximo: 'saft' },
      { rotulo: 'Simuladores', proximo: 'simuladores' },
      { rotulo: 'Gabinete do escritório', proximo: 'gabinete' },
      { rotulo: 'Documentos e propostas', proximo: 'documentos' },
      { rotulo: 'Escritório, honorários e equipa', proximo: 'escritorio' },
      { rotulo: 'Problemas e dúvidas', proximo: 'problemas' },
    ],
  },

  // ── Empresas e clientes ─────────────────────────────────────────────────
  empresas: {
    id: 'empresas',
    texto: 'Empresas e clientes. O que quer fazer?',
    opcoes: [
      { rotulo: 'Criar um cliente novo', proximo: 'empresa-criar' },
      { rotulo: 'Abrir ou trocar de cliente', proximo: 'empresa-abrir' },
      { rotulo: 'Menu rápido do cliente ativo', proximo: 'empresa-hub' },
      { rotulo: 'Editar o perfil de um cliente', proximo: 'empresa-editar' },
      { rotulo: 'Importar clientes do TOConline', proximo: 'empresa-toc' },
      { rotulo: 'Limpar empresas duplicadas', proximo: 'empresa-duplicadas' },
      { rotulo: 'Eliminar um cliente', proximo: 'empresa-apagar' },
    ],
  },
  'empresa-criar': {
    id: 'empresa-criar',
    texto: 'Na Lista de Empresas, carregue em “Novo cliente”. Pode inserir os dados à mão ou importar logo um SAF-T. O cliente só entra na carteira quando guardar.',
    destino: { view: 'empresas', guia: 'empresas' },
  },
  'empresa-abrir': {
    id: 'empresa-abrir',
    texto: 'Clique no cartão da empresa para a tornar ativa. A partir daí todos os simuladores e o gabinete passam a trabalhar com esse cliente.',
    destino: { view: 'empresas', guia: 'empresas' },
  },
  'empresa-hub': {
    id: 'empresa-hub',
    texto: 'O menu do cliente é um atalho: a partir dele salta para o perfil, os simuladores, o histórico ou os documentos do cliente ativo.',
    destino: { view: 'hub', guia: 'hub' },
  },
  'empresa-editar': {    id: 'empresa-editar',
    texto: 'Abra o cliente e vá a Perfil. Aí preenche NIF, atividade, IVA, IRS Jovem e os dados que alimentam os simuladores.',
    destino: { view: 'profile', guia: 'profile' },
  },
  'empresa-toc': {
    id: 'empresa-toc',
    texto: 'A Lista de Empresas tem o botão “Importar TOConline”. Liga a conta do gabinete e importa os clientes de uma vez, sem repetir NIFs.',
    destino: { view: 'empresas', guia: 'empresas' },
  },
  'empresa-duplicadas': {
    id: 'empresa-duplicadas',
    texto: 'Quando há empresas com o mesmo NIF, aparece um aviso no topo da lista. Carregue em “Rever e limpar”, escolha o registo que fica e confirme: o SAF-T, as simulações e as fichas do gabinete são preservados.',
    destino: { view: 'empresas', guia: 'empresas' },
  },
  'empresa-apagar': {
    id: 'empresa-apagar',
    texto: 'Dentro do cartão do cliente, use o ícone do caixote. A empresa sai da carteira; se apagar por engano, os registos do gabinete ficam na Lixeira.',
    destino: { view: 'empresas', guia: 'empresas' },
  },

  // ── SAF-T ───────────────────────────────────────────────────────────────
  saft: {
    id: 'saft',
    texto: 'Importar SAF-T. Qual é o caso?',
    opcoes: [
      { rotulo: 'Cliente novo a partir de um SAF-T', proximo: 'saft-novo' },
      { rotulo: 'Vários SAF-T de uma vez (lote)', proximo: 'saft-lote' },
      { rotulo: 'Substituir o SAF-T de um cliente', proximo: 'saft-substituir' },
      { rotulo: 'Ver o SAF-T que já está guardado', proximo: 'saft-ver' },
    ],
  },
  'saft-novo': {
    id: 'saft-novo',
    texto: 'Em “Novo cliente”, escolha “Tenho o ficheiro SAF-T”. O perfil e os campos fiscais são preenchidos a partir do ficheiro.',
    destino: { view: 'empresas', guia: 'empresas' },
    saft: 'novo',
  },
  'saft-lote': {
    id: 'saft-lote',
    texto: 'No modal “Novo cliente” há a opção de lote: selecione vários ficheiros e cada um cria (ou atualiza) a empresa do respetivo NIF. NIFs já na carteira são ignorados.',
    destino: { view: 'empresas', guia: 'empresas' },
  },
  'saft-substituir': {
    id: 'saft-substituir',
    texto: 'Abra o cliente, vá ao cartão da empresa e carregue no botão de SAF-T. O ficheiro novo substitui os dados anteriores desse cliente.',
    destino: { view: 'empresas', guia: 'empresas' },
  },
  'saft-ver': {
    id: 'saft-ver',
    texto: 'Depois de importado, o cartão do cliente mostra a opção de ver o SAF-T. Os dados ficam guardados para reexportar e voltar a calcular.',
    destino: { view: 'empresas', guia: 'empresas' },
  },

  // ── Simuladores ─────────────────────────────────────────────────────────
  simuladores: {
    id: 'simuladores',
    texto: 'Simuladores. Escolha o grupo:',
    opcoes: [
      { rotulo: 'Fiscal e património', proximo: 'sim-fiscais' },
      { rotulo: 'Pessoas e salários', proximo: 'sim-pessoal' },
    ],
  },
  'sim-fiscais': {
    id: 'sim-fiscais',
    texto: 'Simuladores fiscais e de património:',
    opcoes: [
      { rotulo: 'Simulador Fiscal (ENI vs sociedade)', proximo: 'sim-tax' },
      { rotulo: 'IRS', proximo: 'sim-irs' },
      { rotulo: 'Previsão — Modelo 22 (PreviSa)', proximo: 'sim-previsa' },
      { rotulo: 'Aquisição de viatura', proximo: 'sim-aquisicao' },
      { rotulo: 'IMT', proximo: 'sim-imt' },
      { rotulo: 'Custos diferidos', proximo: 'sim-custos' },
      { rotulo: 'Imóveis na empresa', proximo: 'sim-imoveis' },
    ],
  },
  'sim-pessoal': {
    id: 'sim-pessoal',
    texto: 'Simuladores de pessoas e salários:',
    opcoes: [
      { rotulo: 'Salário líquido', proximo: 'sim-salario' },
      { rotulo: 'Tickets de refeição', proximo: 'sim-ticket' },
      { rotulo: 'Segurança Social de independente', proximo: 'sim-selfss' },
      { rotulo: 'Diagnóstico de autonomia', proximo: 'sim-diagnostico' },
      { rotulo: 'Viaturas (custos e TA)', proximo: 'sim-vehicle' },
      { rotulo: 'Histórico de simulações', proximo: 'sim-historico' },
    ],
  },
  'sim-tax': {
    id: 'sim-tax',
    texto: 'O Simulador Fiscal compara o regime simplificado do trabalhador independente com a sociedade. Comece pelos dados do negócio e escolha o regime a comparar.',
    destino: { view: 'tax', guia: 'tax' },
  },
  'sim-irs': {
    id: 'sim-irs',
    texto: 'O Simulador de IRS calcula o imposto por escalões, com a dedução específica e as taxas de 2026. Use o perfil do cliente para pré-preencher.',
    destino: { view: 'irs', guia: 'irs' },
  },
  'sim-previsa': {
    id: 'sim-previsa',
    texto: 'O PreviSa monta o Modelo 22: proveitos, gastos, tributação autónoma e matéria coletável. Tem de estar no modo Empresa.',
    destino: { view: 'previsa', guia: 'previsa' },
  },
  'sim-aquisicao': {
    id: 'sim-aquisicao',
    texto: 'O simulador de aquisição de viatura calcula o IVA recuperável, a tributação autónoma e o custo real conforme a categoria e o regime da compra.',
    destino: { view: 'aquisicao', guia: 'aquisicao' },
  },
  'sim-imt': {
    id: 'sim-imt',
    texto: 'O Simulador de IMT aplica as tabelas por cilindrada, idade e CO₂, com o adicional de combustível.',
    destino: { view: 'imt', guia: 'imt' },
  },
  'sim-custos': {
    id: 'sim-custos',
    texto: 'Os Custos Diferidos repartem um gasto ou proveito por vários anos e mostram o saldo a 31 de dezembro.',
    destino: { view: 'custos', guia: 'custos' },
  },
  'sim-imoveis': {
    id: 'sim-imoveis',
    texto: 'O simulador de Imóveis na Empresa compara comprar em nome da empresa ou em nome pessoal, com mais-valias e amortizações.',
    destino: { view: 'imoveis', guia: 'imoveis' },
  },
  'sim-salario': {
    id: 'sim-salario',
    texto: 'O Salário Líquido parte do salário bruto e aplica IRS, Segurança Social e subsídio de refeição até chegar ao valor que o colaborador recebe.',
    destino: { view: 'salario', guia: 'salario' },
  },
  'sim-ticket': {
    id: 'sim-ticket',
    texto: 'O simulador de Tickets de Refeição mostra o limite isento (cartão e dinheiro) e o que passa a ser tributado acima dele.',
    destino: { view: 'ticket', guia: 'ticket' },
  },
  'sim-selfss': {
    id: 'sim-selfss',
    texto: 'A Segurança Social de independente calcula a contribuição mensal sobre o rendimento relevante, com o escalão e o valor a pagar.',
    destino: { view: 'selfss', guia: 'selfss' },
  },
  'sim-diagnostico': {
    id: 'sim-diagnostico',
    texto: 'O Diagnóstico de Autonomia mostra quanto tempo o negócio aguenta com a tesouraria atual.',
    destino: { view: 'diagnostico', guia: 'diagnostico' },
  },
  'sim-vehicle': {
    id: 'sim-vehicle',
    texto: 'O Simulador de Viaturas calcula os custos anuais e a tributação autónoma de cada viatura da empresa.',
    destino: { view: 'vehicle', guia: 'vehicle' },
  },
  'sim-historico': {
    id: 'sim-historico',
    texto: 'No Histórico ficam as simulações guardadas. Pode restaurar qualquer uma para voltar ao cenário dessa data.',
    destino: { view: 'historico', guia: 'historico' },
  },

  // ── Gabinete ────────────────────────────────────────────────────────────
  gabinete: {
    id: 'gabinete',
    texto: 'Gabinete do escritório. Escolha a área:',
    opcoes: [
      { rotulo: 'Visão geral do Gabinete', proximo: 'gab-inicio' },
      { rotulo: 'Ficha 360 de um cliente', proximo: 'gab-visao' },
      { rotulo: 'Obrigações Fiscais', proximo: 'gab-quadro' },
      { rotulo: 'Mapa de contabilidade', proximo: 'gab-controlo' },
      { rotulo: 'Mapa RH', proximo: 'gab-rh' },
      { rotulo: 'Tarefas', proximo: 'gab-tarefas' },
      { rotulo: 'Agenda', proximo: 'gab-agenda' },
      { rotulo: 'Lista de obrigações', proximo: 'gab-obrig' },
      { rotulo: 'Cofre de acessos', proximo: 'gab-cofre' },
      { rotulo: 'Equipa e permissões', proximo: 'gab-equipa' },
      { rotulo: 'Lixeira', proximo: 'gab-lixeira' },
    ],
  },
  'gab-inicio': {
    id: 'gab-inicio',
    texto: 'O Gabinete é o centro de operação: clientes, tarefas, obrigações, agenda e cofre num só sítio. Comece pela galeria de funções.',
    destino: { view: 'gabinete', guia: 'gabinete' },
  },
  'gab-visao': {
    id: 'gab-visao',
    texto: 'A Ficha 360 junta tudo o que existe sobre um cliente: tarefas, documentos, contactos, acessos e obrigações.',
    destino: { view: 'gab-visao-geral', guia: 'gab-visao-geral' },
  },
  'gab-quadro': {
    id: 'gab-quadro',
    texto: 'O quadro de Obrigações Fiscais mostra os 12 meses por cliente e marca se cada obrigação está concluída.',
    destino: { view: 'gab-dashboard', guia: 'gab-dashboard' },
  },
  'gab-controlo': {
    id: 'gab-controlo',
    texto: 'O Mapa de contabilidade acompanha as 7 fases da contabilidade por cliente e por mês.',
    destino: { view: 'gab-mapa-controlo', guia: 'gab-mapa-controlo' },
  },

  'gab-rh': {
    id: 'gab-rh',
    texto: 'O Mapa RH controla as entregas mensais de pessoal: salários, tickets, IRS, DMR-AT, DMR-SS e encargos.',
    destino: { view: 'gab-mapa-rh', guia: 'gab-mapa-rh' },
  },
  'gab-tarefas': {
    id: 'gab-tarefas',
    texto: 'As Tarefas vivem num quadro por colunas (A fazer, Em curso, Feito, Atrasada), com prazo e responsável.',
    destino: { view: 'gab-tarefas', guia: 'gab-tarefas' },
  },
  'gab-agenda': {
    id: 'gab-agenda',
    texto: 'A Agenda junta tarefas e obrigações no calendário do mês. Clique num dia para ver o detalhe.',
    destino: { view: 'gab-agenda', guia: 'gab-agenda' },
  },
  'gab-obrig': {
    id: 'gab-obrig',
    texto: 'Em Obrigações está o calendário fiscal por cliente e por mês, com o estado de cada entrega.',
    destino: { view: 'gab-obrigacoes', guia: 'gab-obrigacoes' },
  },
  'gab-cofre': {
    id: 'gab-cofre',
    texto: 'O Cofre guarda senhas e acessos. Só a sua conta vê os segredos e cada revelação fica registada na auditoria.',
    destino: { view: 'gab-cofre', guia: 'gab-cofre' },
  },
  'gab-equipa': {
    id: 'gab-equipa',
    texto: 'Em Equipa gere colaboradores, cargos e permissões de acesso ao gabinete.',
    destino: { view: 'gab-equipa', guia: 'gab-equipa' },
  },
  'gab-lixeira': {
    id: 'gab-lixeira',
    texto: 'A Lixeira guarda tudo o que foi apagado. Pode restaurar registos; apagar definitivamente é só para administradores.',
    destino: { view: 'gab-lixeira', guia: 'gab-lixeira' },
  },

  // ── Documentos e propostas ──────────────────────────────────────────────
  documentos: {
    id: 'documentos',
    texto: 'Documentos e propostas. O que precisa?',
    opcoes: [
      { rotulo: 'Anexar um documento ao cliente', proximo: 'doc-anexar' },
      { rotulo: 'Descarregar documentos do cliente (Word/Excel)', proximo: 'doc-word' },
      { rotulo: 'Exportar PDF de um simulador', proximo: 'doc-exportar' },
      { rotulo: 'Preparar o pacote do cliente', proximo: 'doc-pacote' },
      { rotulo: 'Gerar uma proposta de honorários', proximo: 'doc-proposta' },
    ],
  },
  'doc-anexar': {
    id: 'doc-anexar',
    texto: 'Na Ficha 360 do cliente, em “Documentos importantes”, carregue em “Adicionar”. Aceita PDF, imagens, Excel, Word, CSV, XML e ZIP até 25 MB.',
    destino: { view: 'gab-visao-geral', guia: 'gab-visao-geral' },
  },
  'doc-word': {
    id: 'doc-word',
    texto: 'Escolha o documento a gerar para o cliente ativo:',
    docs: true,
  },
  'doc-exportar': {
    id: 'doc-exportar',
    texto: 'Cada simulador tem um botão de PDF. Em Exportar documentos encontra também a Previsão — Modelo 22 e os restantes relatórios.',
    destino: { view: 'exportar', guia: 'exportar' },
  },
  'doc-pacote': {
    id: 'doc-pacote',
    texto: 'No cartão do cliente, a opção de pacote junta os relatórios do cliente num único dossiê para enviar.',
    destino: { view: 'empresas', guia: 'empresas' },
  },
  'doc-proposta': {
    id: 'doc-proposta',
    texto: 'A Proposta de Honorários gera a mensalidade, os serviços incluídos e extra, as condições e os prazos — pronta a imprimir.',
    destino: { view: 'proposta', guia: 'proposta' },
  },

  // ── Escritório, honorários e equipa ─────────────────────────────────────
  escritorio: {
    id: 'escritorio',
    texto: 'Escritório, honorários e equipa:',
    opcoes: [
      { rotulo: 'Definições e branding do escritório', proximo: 'esc-definicoes' },
      { rotulo: 'Tabela de honorários (e Excel)', proximo: 'esc-honorarios' },
      { rotulo: 'Cópia de segurança', proximo: 'esc-backup' },
      { rotulo: 'Equipa, cargos e acessos', proximo: 'gab-equipa' },
      { rotulo: 'Trocar de gabinete', proximo: 'esc-gabinetes' },
      { rotulo: 'Base legal e diplomas', proximo: 'esc-legal' },
    ],
  },
  'esc-definicoes': {
    id: 'esc-definicoes',
    texto: 'Em Definições do Escritório preenche o logo, a cor, os dados legais e a apresentação que abre as propostas.',
    destino: { view: 'office-settings', guia: 'office-settings' },
  },
  'esc-honorarios': {
    id: 'esc-honorarios',
    texto: 'A Tabela de Honorários define preços por serviço. O botão “Exportar tabela de honorários” gera um Excel para partilhar.',
    destino: { view: 'office-settings', guia: 'office-settings' },
  },
  'esc-backup': {
    id: 'esc-backup',
    texto: 'Em Definições há o separador Cópia de segurança, para exportar e restaurar os dados do escritório.',
    destino: { view: 'office-settings', guia: 'office-settings' },
  },
  'esc-gabinetes': {
    id: 'esc-gabinetes',
    texto: 'O seletor no topo troca de gabinete. Cada gabinete tem os seus clientes, tarefas e equipa — não há mistura.',
    destino: { view: 'gabinete', guia: 'gabinete' },
  },
  'esc-legal': {
    id: 'esc-legal',
    texto: 'A Base Legal reúne os diplomas e as taxas usadas nos cálculos (OE 2026), com ligação ao texto oficial.',
    destino: { view: 'legal', guia: 'legal' },
  },

  // ── Problemas ───────────────────────────────────────────────────────────
  problemas: {
    id: 'problemas',
    texto: 'Problemas e dúvidas. O que se passa?',
    opcoes: [
      { rotulo: 'Não encontro o cliente que criei', proximo: 'prob-cliente' },
      { rotulo: 'Apaguei algo por engano', proximo: 'prob-apaguei' },
      { rotulo: 'Aparecem empresas repetidas', proximo: 'empresa-duplicadas' },
      { rotulo: 'A sessão expirou ou não consigo entrar', proximo: 'prob-sessao' },
      { rotulo: 'Sugerir uma melhoria', proximo: 'prob-sugerir' },
    ],
  },
  'prob-cliente': {
    id: 'prob-cliente',
    texto: 'Veja se há um filtro ativo na pesquisa ou se o cliente ficou com outro gabinete selecionado. O seletor de cliente no topo mostra o que está ativo.',
    destino: { view: 'empresas', guia: 'empresas' },
  },
  'prob-apaguei': {
    id: 'prob-apaguei',
    texto: 'O que é apagado fica na Lixeira do Gabinete. Abra a Lixeira e carregue em Restaurar — volta ao sítio original.',
    destino: { view: 'gab-lixeira', guia: 'gab-lixeira' },
  },
  'prob-sessao': {
    id: 'prob-sessao',
    texto: 'Se a sessão expirou, recarregue a página e entre outra vez. Os dados ficam guardados na nuvem e no dispositivo — não se perde nada.',
  },
  'prob-sugerir': {
    id: 'prob-sugerir',
    texto: 'Escreva aqui a sua sugestão. Ela vai direta para a equipa que desenvolve o Estudo 360.',
    sugestao: true,
  },
};

/** Opções do nó, já resolvidas (para a UI). */
export function opcoesDe(id: string): { rotulo: string; proximo: string }[] {
  return ARVORE[id]?.opcoes ?? [];
}

/** Nós alcançáveis a partir da raiz (para o teste de cobertura). */
export function nosAlcancaveis(): Set<string> {
  const vistos = new Set<string>();
  const fila = [NO_RAIZ];
  while (fila.length) {
    const id = fila.shift()!;
    if (vistos.has(id)) continue;
    vistos.add(id);
    for (const o of ARVORE[id]?.opcoes ?? []) fila.push(o.proximo);
  }
  return vistos;
}

/** Guias referenciados por alguma folha alcançável. */
export function guiasAlcancaveis(): Set<string> {
  const out = new Set<string>();
  for (const id of nosAlcancaveis()) {
    const g = ARVORE[id]?.destino?.guia;
    if (g) out.add(g);
  }
  return out;
}

/** Vistas do guia (para o teste comparar com GUIAS). */
export const GUIAS_EXISTENTES = Object.keys(GUIAS) as ViewKey[];
