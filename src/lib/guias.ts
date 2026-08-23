/**
 * Guias interativos do Estudo 360 — conteúdo por ferramenta.
 *
 * Cada guia é opcional: pergunta ao abrir a ferramenta, pode ser saltado,
 * e pode ser desativado com "não perguntar novamente". O botão "Ativar guias"
 * (canto superior direito) volta a ativar tudo e abre o guia da ferramenta atual.
 *
 * Conteúdo validado contra os textos reais da app (agosto 2026, OE 2026).
 */

export type ViewKey =
  | 'empresas' | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'irs' | 'previsa'
  | 'legal' | 'office-settings' | 'historico' | 'exportar' | 'hub'
  | 'gabinete' | 'gab-clientes' | 'gab-tarefas' | 'gab-obrigacoes' | 'gab-cofre';

export interface GuiaPasso {
  titulo: string;
  corpo: string;
  /** Alvo do destaque: seletor CSS ou texto visível (contém). */
  alvo: { sel?: string; texto?: string };
}

export interface Guia {
  titulo: string;
  intro: string;
  /** Próxima ação sugerida no fim do tour (ativação — nunca acabar em beco). */
  acao: string;
  passos: GuiaPasso[];
}

// ── Flags (localStorage) ────────────────────────────────────────────────
const P = 'estudo360:guias:';

export function guiaDesativado(v: ViewKey): boolean {
  try { return localStorage.getItem(P + 'off:' + v) === '1'; } catch { return false; }
}
export function marcarGuiaDesativado(v: ViewKey): void {
  try { localStorage.setItem(P + 'off:' + v, '1'); } catch { /* noop */ }
}
export function reativarGuias(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(P)) localStorage.removeItem(k);
    }
    // também limpa os avisos de sessão (perguntar de novo já)
    try { sessionStorage.clear(); } catch { /* noop */ }
  } catch { /* noop */ }
}

// ── Conteúdo ────────────────────────────────────────────────────────────

export const GUIAS: Record<ViewKey, Guia> = {
  empresas: {
    titulo: 'Lista de Empresas',
    intro: 'A carteira de clientes do escritório. Cada empresa guarda o seu perfil fiscal, os simuladores, o SAF-T e o histórico de simulações.',
    acao: 'Cria o primeiro cliente à mão ou importa um SAF-T — leva menos de 1 minuto.',
    passos: [
      { titulo: 'A carteira de clientes', corpo: 'Aqui estão todas as empresas do escritório. Cada uma tem o seu perfil e os seus dados — não há mistura entre clientes.', alvo: { texto: 'CRM · Carteira' } },
      { titulo: 'Criar cliente à mão', corpo: 'Regista um cliente novo sem ficheiros: preenche o perfil (nome, NIF, atividade) e os simuladores ficam prontos a trabalhar.', alvo: { texto: 'Inserir à mão' } },
      { titulo: 'Importar do SAF-T', corpo: 'Importa a contabilidade real do cliente a partir do ficheiro SAF-T. O perfil e campos como NIF, morada e atividade são preenchidos automaticamente.', alvo: { texto: 'A partir de SAF-T' } },
      { titulo: 'Abrir um cliente', corpo: 'Ao abrir, carregas o perfil, o PreviSa e o estado de todos os simuladores daquele cliente — como ficaram na última sessão.', alvo: { texto: 'Abrir' } },
      { titulo: 'Histórico de simulações', corpo: 'Cada simulação guardada fica no histórico do cliente e pode ser restaurada — útil para comparar cenários (ex: antes/depois de alterações).', alvo: { texto: 'Histórico de simulações' } },
    ],
  },

  profile: {
    titulo: 'Perfil do Cliente',
    intro: 'Os dados fiscais do cliente que alimentam todos os simuladores. Preenche uma vez — os cálculos usam estes valores automaticamente.',
    acao: 'Preenche o NIF e a atividade do cliente para os simuladores usarem esses dados.',
    passos: [
      { titulo: 'Notas internas', corpo: 'Zona reservada ao contabilista: observações, pendências ou contexto do cliente. Não entra nos cálculos.', alvo: { texto: 'Análise Interna (notas do contabilista)' } },
      { titulo: 'Subsídio de refeição', corpo: 'Limites 2026 já pré-preenchidos: €10,46/dia em cartão e €6,15/dia em dinheiro. Usado no simulador de salários e nos custos da empresa.', alvo: { texto: 'Subsídio refeição 2026' } },
      { titulo: 'IRS Jovem', corpo: 'Indica se o cliente é elegível (Art. 12.º-B CIRS) e há quantos anos de atividade. Afeta o simulador de IRS e o salário líquido.', alvo: { texto: 'IRS Jovem (Art. 12º-B CIRS)' } },
      { titulo: 'Enquadramento de IVA', corpo: 'Regra do Art. 53.º CIVA (isenção até €15.000 de volume de negócios) ou regime normal. Os simuladores respeitam o regime escolhido.', alvo: { texto: 'Regra IVA (Art. 53º CIVA)' } },
      { titulo: 'Segurança Social', corpo: 'Regime de SS do cliente (independente/empresa) — usado no cálculo de custos e de salário líquido.', alvo: { texto: 'SS Independente' } },
    ],
  },

  tax: {
    titulo: 'Simulador Fiscal',
    intro: 'Compara enquadramentos (ENI vs sociedade) e estima a carga fiscal total do negócio. O ponto de partida de qualquer estudo.',
    acao: 'Preenche o volume de negócios e compara o ENI com a sociedade.',
    passos: [
      { titulo: 'O negócio', corpo: 'Preenche o volume de negócios, as despesas e o enquadramento (trabalhador independente em regime simplificado ou empresa). É a base de tudo.', alvo: { texto: 'Folha 2 — O Negócio' } },
      { titulo: 'Regimes em comparação', corpo: 'O simulador compara o regime simplificado do ENI com o enquadramento societário, para veres qual é mais eficiente para o cliente.', alvo: { texto: 'Trabalhador Independente (ENI — simplificado)' } },
      { titulo: 'Repor valores', corpo: 'O botão "Repor" volta a colocar os valores iniciais — útil para recomeçar o cenário sem perder o perfil do cliente.', alvo: { texto: 'Repor' } },
    ],
  },

  vehicle: {
    titulo: 'Simulador de Viaturas',
    intro: 'Tributação autónoma (TA) e deduções de IVA de viaturas da empresa. As regras mudam consoante o tipo de viatura, o valor e o combustível.',
    acao: 'Escolhe o tipo de viatura e vê a tributação autónoma na hora.',
    passos: [
      { titulo: 'Tipo de viatura', corpo: 'Escolhe a viatura (ligeira, elétrica, PHEV, comercial…) — a taxa de tributação autónoma e o limite de dedução de IVA dependem disto.', alvo: { texto: 'Como foi adquirida a viatura?' } },
      { titulo: 'Motor e combustível', corpo: 'Gasolina, gasóleo, elétrico ou híbrido: cada um tem tratamento diferente na TA e na dedução do IVA do combustível (o gasóleo tem limites próprios).', alvo: { texto: 'Motor / Combustível' } },
      { titulo: 'Custos anuais', corpo: 'Seguro, portagens, manutenção e combustível com IVA — o simulador separa o que é dedutível e aplica a TA sobre o valor de aquisição.', alvo: { texto: 'Seguro & Portagens (anual c/ IVA)' } },
      { titulo: 'Resultados', corpo: 'Vês a TA devida, o IVA dedutível e o custo fiscal real da viatura — incluindo limites de depreciação (ex: €25.000/€50.000 consoante o tipo).', alvo: { texto: 'Combustível / Carga (anual c/ IVA)' } },
    ],
  },

  ticket: {
    titulo: 'Simulador de Tickets',
    intro: 'Compara o custo de atribuir tickets de refeição/educação/saúde aos colaboradores com o equivalente em salário. O ticket é isento de IRS e SS (dentro dos limites).',
    acao: 'Indica o número de funcionários e compara ticket vs salário.',
    passos: [
      { titulo: 'Equipa', corpo: 'Indica o número de funcionários e o número de viaturas (para o caso de optares por outra forma de compensação).', alvo: { texto: 'Número de funcionários' } },
      { titulo: 'Tipo de ticket', corpo: 'Ticket Restaurant, Educação, Infância, Saúde, Oferta ou Car — cada um tem regras próprias de isenção e beneficiários.', alvo: { texto: 'Tipo de Ticket e Beneficiários' } },
      { titulo: 'Comparação salarial', corpo: 'A grande mais-valia: o custo para a empresa do ticket vs. o custo de dar o mesmo valor em salário (com IRS e SS).', alvo: { texto: 'Ticket vs. Equivalente Salarial' } },
      { titulo: 'Resultados', corpo: 'Vês o custo anual total e a poupança por colaborador. Os valores respeitam os limites 2026 (ex: €10,46/dia em cartão).', alvo: { texto: 'Resultados do Simulador de Tickets' } },
    ],
  },

  selfss: {
    titulo: 'Simulador de SS de Independente',
    intro: 'Segurança Social dos trabalhadores independentes: escalões, taxa (21,4% em 2026) e o benefício do primeiro ano de atividade.',
    acao: 'Indica o rendimento mensal para ver o escalão de SS a pagar.',
    passos: [
      { titulo: 'Primeiro ano', corpo: 'No primeiro ano de atividade há redução: o rendimento relevante é calculado sobre metade do valor (ou isenção nos primeiros 12 meses, conforme o caso).', alvo: { texto: 'Primeiro Ano de Atividade' } },
      { titulo: 'Rendimento relevante', corpo: 'A SS incide sobre o rendimento relevante (70% do rendimento, com regras para prestação de serviços e para quem tem atividade comercial).', alvo: { sel: '[data-view="selfss"]' } },
      { titulo: 'Resultado mensal', corpo: 'O simulador devolve o escalão aplicável e a contribuição mensal — útil para o cliente saber quanto descontar por mês.', alvo: { sel: '[data-view="selfss"]' } },
    ],
  },

  diagnostico: {
    titulo: 'Diagnóstico de Autonomia',
    intro: 'Rácios financeiros a partir dos dados do PreviSa: autonomia financeira, margem líquida e meses de autonomia — o "estado de saúde" da empresa.',
    acao: 'Abre o PreviSa do cliente — os rácios usam os dados de lá.',
    passos: [
      { titulo: 'Autonomia financeira', corpo: 'Percentagem do ativo financiada por capitais próprios. Quanto maior, menos dependente de dívida. Valores saudáveis acima de ~30%.', alvo: { texto: 'Autonomia Financeira' } },
      { titulo: 'Margem líquida', corpo: 'Resultado líquido sobre o volume de negócios — diz quanto sobra de cada euro vendido depois de todos os custos e impostos.', alvo: { texto: 'Margem Líquida' } },
      { titulo: 'Meses de autonomia', corpo: 'Quantos meses a empresa consegue operar só com a tesouraria atual, sem novas receitas — o clássico teste de sobrevivência.', alvo: { texto: 'Meses de Autonomia' } },
    ],
  },

  imoveis: {
    titulo: 'Imóveis na Empresa',
    intro: 'Simula a aquisição de imóveis pela empresa (vs. pessoalmente) — com as vantagens de proteção patrimonial e os custos de transmissão.',
    acao: 'Introduz o valor do imóvel para comparar comprar na empresa vs a título pessoal.',
    passos: [
      { titulo: 'Valor e tipo de imóvel', corpo: 'Define o valor de aquisição e o tipo de imóvel (habitação, comércio/serviços, outros) — cada tipo tem regras de IMT e imposto de selo diferentes.', alvo: { texto: 'Introduza o valor do imóvel' } },
      { titulo: 'Proteção patrimonial', corpo: 'Imóvel da empresa fica protegido de credores pessoais do sócio — uma das grandes vantagens de comprar pela sociedade.', alvo: { texto: 'Imóvel protegido de credores pessoais do sócio' } },
      { titulo: 'Custos de transmissão', corpo: 'O simulador compara os custos (IMT, selo, registo) de comprar pela empresa vs. a título pessoal.', alvo: { texto: 'Sem custos iniciais de transmissão' } },
    ],
  },

  imt: {
    titulo: 'Simulador de IMT',
    intro: 'Calcula o IMT e o Imposto de Selo na compra de imóveis, incluindo isenções (habitação própria e permanente, IMT Jovem) e prédios urbanos.',
    acao: 'Introduz o valor e a finalidade para ver o IMT e o imposto de selo.',
    passos: [
      { titulo: 'Valor e tipo de imóvel', corpo: 'Escolhe o valor e a finalidade (habitação, comércio, terrenos…). As taxas de IMT são progressivas e por escalões.', alvo: { texto: 'Valor e Tipo de Imóvel' } },
      { titulo: 'Isenções', corpo: 'Isenção de IMT e selo na compra de habitação própria e permanente (com limites de valor) e reduções do IMT Jovem.', alvo: { texto: 'Isento de IMT e Imposto de Selo' } },
      { titulo: 'Resultado', corpo: 'O simulador devolve o IMT, o imposto de selo (0,8% + taxas adicionais conforme o caso) e o custo total da aquisição.', alvo: { texto: 'IMT Jovem — Redução parcial' } },
    ],
  },

  salario: {
    titulo: 'Simulador de Salário Líquido',
    intro: 'Do bruto ao líquido: IRS (retenção na fonte, com IRS Jovem e estado civil), Segurança Social (11%) e subsídios — incluindo o custo total para o empregador.',
    acao: 'Preenche o bruto anual e o estado civil para ver o líquido mês a mês.',
    passos: [
      { titulo: 'Salário e estado civil', corpo: 'Bruto anual, estado civil (1 ou 2 titulares) e dependentes — a retenção de IRS depende de tudo isto.', alvo: { texto: 'Salário Bruto e Estado Civil' } },
      { titulo: 'Subsídios e duodécimos', corpo: 'Subsídios de férias e Natal (pagos juntos ou em duodécimos) alteram a retenção e o líquido mensal.', alvo: { texto: 'Subsídios' } },
      { titulo: 'Composição mensal', corpo: 'Repartição mês a mês: bruto, IRS retido, SS (11% para o trabalhador) e líquido final.', alvo: { texto: 'Composição Mensal' } },
      { titulo: 'Custo para o empregador', corpo: 'A empresa paga mais 23,75% de TSU sobre o bruto (+ seguro de trabalho). Vês o custo total real do colaborador.', alvo: { texto: 'Custo Total Mensal' } },
      { titulo: 'IRS Jovem', corpo: 'Se elegível, o benefício do IRS Jovem reduz a retenção — o simulador mostra o efeito mensal.', alvo: { texto: 'Benefício IRS Jovem (mensal)' } },
    ],
  },

  irs: {
    titulo: 'Simulador de IRS',
    intro: 'Apuramento do IRS anual: rendimento coletável, coleta (escalões 2026), deduções à coleta, retenções e o resultado final (a pagar ou reembolso).',
    acao: 'Preenche os rendimentos para ver se fica a pagar ou com reembolso.',
    passos: [
      { titulo: 'Rendimento coletável', corpo: 'Parte do rendimento que é efetivamente tributada, depois das deduções específicas (ex: €4.587,09 na Categoria A em 2026).', alvo: { texto: 'Coletável' } },
      { titulo: 'Deduções à coleta', corpo: 'Despesas de saúde, educação, habitação, lares e dependentes reduzem a coleta — até aos limites legais por categoria.', alvo: { texto: 'Deduções' } },
      { titulo: 'Retenções e PPC', corpo: 'O que já foi retido na fonte (e pagamentos por conta) abate ao imposto devido no fim do ano.', alvo: { texto: 'Retenções' } },
      { titulo: 'Resultado', corpo: 'A pagar ou reembolso — o número que o cliente quer saber. Inclui estimativa com as regras 2026.', alvo: { texto: 'Estimativa de reembolso' } },
    ],
  },

  previsa: {
    titulo: 'Simulador PreviSa (IRC)',
    intro: 'Previsão de IRC/Modelo 22 para o período: parte-se do resultado contabilístico, ajusta-se (acréscimos e deduções) e apura-se a matéria coletável e o imposto.',
    acao: 'Preenche o ponto de partida para apurar o IRC estimado do período.',
    passos: [
      { titulo: 'Ponto de partida', corpo: 'Resultado contabilístico (ou lucro tributável do exercício anterior) + acréscimos e deduções extracontabilísticas — o coração do apuramento.', alvo: { texto: 'Ponto de partida, acréscimos e deduções.' } },
      { titulo: 'Matéria coletável', corpo: 'Sobre o lucro tributável aplicam-se os prejuízos fiscais dedutíveis (com limites) e a taxa de IRC por ano (2026: 20% continente + derrama).', alvo: { texto: 'Apuramento da Matéria Coletável' } },
      { titulo: 'Prejuízos por ano de origem', corpo: 'Os prejuízos fiscais são deduzidos por ordem de antiguidade (regra FIFO) — o simulador respeita os limites por ano de origem.', alvo: { texto: 'Prejuízos fiscais e benefícios.' } },
      { titulo: 'Imposto final', corpo: 'IRC + derrama estadual + derrama municipal, menos retenções e pagamentos por conta → IRC a pagar ou a recuperar.', alvo: { texto: 'Cálculo do Imposto (IRC a pagar / a recuperar)' } },
      { titulo: 'Alertas de validação', corpo: 'O PreviSa avisa quando há valores inconsistentes (ex: prejuízo que excede o limite) antes de fechares o cenário.', alvo: { texto: 'Alertas validação' } },
    ],
  },

  legal: {
    titulo: 'Base Legal & Referências',
    intro: 'A fundamentação jurídica por trás de cada cálculo: artigos do CIRS, CIRC e CIVA com os valores aplicados. Para confirmares qualquer número.',
    acao: 'Procura o artigo que quiseres confirmar (CIRS, CIRC, CIVA).',
    passos: [
      { titulo: 'Enquadramentos e contabilidade organizada', corpo: 'Art. 28.º CIRS / Art. 86.º-A CIRC — limiar dos €200.000 que obriga a contabilidade organizada (ENI ou sociedade).', alvo: { texto: 'Art. 28.º CIRS / Art. 86.º-A CIRC' } },
      { titulo: 'Isenção de IVA', corpo: 'Art. 53.º CIVA — isenção até €15.000 de volume de negócios no ano anterior. Confirma se o cliente se enquadra.', alvo: { texto: 'Art. 53.º CIVA' } },
      { titulo: 'IRC', corpo: 'Art. 6.º CIRC — incidência e territorialidade do IRC, base de todo o PreviSa.', alvo: { texto: 'Art. 6.º CIRC' } },
    ],
  },

  'office-settings': {
    titulo: 'Definições do Escritório',
    intro: 'A identidade e os custos do escritório: dados da empresa, contabilista responsável, funcionários e honorários. Usados nos documentos e propostas.',
    acao: 'Confirma os dados do escritório — entram automaticamente nos documentos.',
    passos: [
      { titulo: 'Dados do escritório', corpo: 'Nome, NIF, contactos e morada — aparecem automaticamente nos documentos e propostas gerados.', alvo: { texto: 'Dados do Escritório' } },
      { titulo: 'Contabilista responsável', corpo: 'Diretor técnico/contabilista certificado que assina — incluído na declaração de responsabilidade.', alvo: { texto: 'Contabilista Responsável (Diretor Técnico)' } },
      { titulo: 'Funcionários e honorários', corpo: 'Custo mensal por funcionário e catálogo de serviços com preços — usados para estimar honorários nas propostas.', alvo: { texto: 'Funcionários' } },
      { titulo: 'Branding', corpo: 'A cor principal personaliza os documentos gerados com a identidade do escritório.', alvo: { texto: 'Cor primária do branding' } },
    ],
  },

  historico: {
    titulo: 'Histórico de Simulações',
    intro: 'Todas as simulações guardadas do cliente, com resumo e data — para comparar cenários ou restaurar um estado anterior.',
    acao: 'Restaura uma simulação anterior para comparar cenários.',
    passos: [
      { titulo: 'Simulações guardadas', corpo: 'Cada simulação guardada pelo botão flutuante aparece aqui com o seu resumo e data.', alvo: { sel: '[data-view="historico"]' } },
      { titulo: 'Restaurar', corpo: 'Ao restaurar, o perfil e o estado dos simuladores voltam ao momento em que a simulação foi guardada.', alvo: { sel: '[data-view="historico"]' } },
    ],
  },

  exportar: {
    titulo: 'Relatórios e Documentos',
    intro: 'Geração de documentos do cliente: escolhe a empresa, depois o documento (balanço, DR, fluxos, declaração, ata…) e exporta em Word/PDF ou Excel.',
    acao: 'Gera o primeiro documento — por exemplo, o Balanço ou a Demonstração de Resultados.',
    passos: [
      { titulo: '1 · Empresa', corpo: 'Escolhe o cliente a que o documento diz respeito — os dados vêm do perfil e do PreviSa dele.', alvo: { texto: '1 · Empresa' } },
      { titulo: '2 · Documento', corpo: 'Seleciona o documento (Demonstração de Resultados, Balanço, Fluxos de Caixa, Ata de AG, Declaração de Responsabilidade…) e exporta.', alvo: { texto: '2 · Documento' } },
      { titulo: 'Modelo 22 em Excel', corpo: 'O PreviSa também exporta a previsão do Modelo 22 para Excel — pronto a enviar para o cliente ou para a AT.', alvo: { texto: 'Previsa — Modelo 22 (Excel)' } },
    ],
  },

  hub: {
    titulo: 'Menu do Cliente',
    intro: 'O ponto de entrada do cliente ativo: acesso rápido ao perfil, simuladores, documentos e histórico.',
    acao: 'Escolhe uma ferramenta e começa a trabalhar no cliente.',
    passos: [
      { titulo: 'Navegação do cliente', corpo: 'A partir daqui saltas diretamente para qualquer ferramenta do cliente ativo — perfil, simuladores, histórico e documentos.', alvo: { sel: '[data-view="hub"]' } },
      { titulo: 'Voltar à lista', corpo: 'A lista de empresas continua a um clique — o menu do cliente é só um atalho, nunca uma página à parte.', alvo: { sel: '[data-view="hub"]' } },
    ],
  },

  gabinete: {
    titulo: 'Gabinete',
    intro: 'A gestão do dia do escritório: tarefas, obrigações dos clientes, cofre de senhas e visão do que está atrasado — tudo num só sítio, sempre atualizado.',
    acao: 'Cria a primeira tarefa ou guarda o primeiro acesso no cofre.',
    passos: [
      { titulo: 'Visão do dia', corpo: 'KPIs no topo: tarefas que vencem hoje, atrasadas, obrigações vencidas e clientes sem tarefa há 30 dias — o que precisa de atenção hoje.', alvo: { texto: 'Tarefas hoje' } },
      { titulo: 'Próximos 7 dias', corpo: 'Lista do que vence na semana: obrigações e tarefas juntas, por data. Clica em "Ver tudo" para ir às tarefas.', alvo: { texto: 'Próximos 7 dias' } },
      { titulo: 'Atalhos', corpo: 'Novo cliente, nova tarefa e guardar acesso — atalhos diretos para as ações mais frequentes do escritório.', alvo: { texto: 'Atalhos' } },
    ],
  },

  'gab-clientes': {
    titulo: 'Clientes 360',
    intro: 'A ficha centralizada do cliente no gabinete: dados, regime de IVA, território e ligação ao perfil de simulações. Ao guardar, as obrigações fiscais do ano são geradas sozinhas.',
    acao: 'Cria um cliente de teste e vê as obrigações a aparecerem automaticamente.',
    passos: [
      { titulo: 'Pesquisar e filtrar', corpo: 'Procura por nome/NIF/email e filtra por estado (ativo/arquivado). A lista fica atualizada em tempo real.', alvo: { texto: 'Pesquisar nome, NIF, email' } },
      { titulo: 'Novo cliente', corpo: 'Nome, NIF, regime de IVA e território. Ao guardar, o sistema cria as obrigações do ano (IVA, PPC, IES, Modelo 22).', alvo: { texto: 'Novo cliente' } },
      { titulo: 'Migrar de EmpresasList', corpo: 'Importa as empresas já existentes do Estudo 360 para o gabinete — não precisas de as recriar à mão.', alvo: { texto: 'Migrar de EmpresasList' } },
      { titulo: 'Gerar obrigações', corpo: 'O ícone do calendário gera (ou completa) as obrigações fiscais do cliente para o ano — idempotente, não duplica.', alvo: { texto: 'Gerar obrigações' } },
    ],
  },

  'gab-tarefas': {
    titulo: 'Tarefas',
    intro: 'O quadro Kanban do gabinete: A fazer / Em curso / Feito / Atrasada. Cada tarefa pode ter cliente, prazo, prioridade e responsável.',
    acao: 'Cria uma tarefa com prazo e muda-a de coluna — vê como fica instantâneo.',
    passos: [
      { titulo: 'Colunas do Kanban', corpo: 'Arrasta o trabalho pela vida útil: A fazer → Em curso → Feito. A coluna Atrasada marca o que passou do prazo.', alvo: { texto: 'A fazer' } },
      { titulo: 'Criar tarefa', corpo: 'Título, cliente (opcional), prazo, prioridade e tipo. O botão "Feito" fecha a tarefa com registo de data.', alvo: { texto: 'Nova tarefa' } },
      { titulo: 'Obrigações automáticas', corpo: 'As obrigações fiscais geradas dos clientes aparecem aqui como tarefas do tipo obrigação — não precisas de as criar à mão.', alvo: { texto: 'obrigacao' } },
    ],
  },

  'gab-obrigacoes': {
    titulo: 'Obrigações',
    intro: 'O calendário fiscal do gabinete: IVA, PPC, IES e Modelo 22 por cliente e por mês — para nunca falhar uma entrega.',
    acao: 'Navega nos meses e marca uma obrigação como entregue.',
    passos: [
      { titulo: 'Mês e cliente', corpo: 'Escolhe o mês (YYYY-MM) e filtra por cliente. As obrigações listam vencimento, tipo e estado.', alvo: { texto: 'Todos clientes' } },
      { titulo: 'Estados', corpo: 'Pendente (âmbar), Entregue (verde), Atrasada (vermelho) ou Dispensada — atualizas com um clique.', alvo: { texto: 'Entregue' } },
      { titulo: 'Geração automática', corpo: 'Cada cliente em Clientes 360 gera IVA mensal/trimestral + 3 PPC (jul/set/15 dez) + Modelo 22 e IES — com prazos reais.', alvo: { texto: 'Obrigações são geradas automaticamente' } },
    ],
  },

  'gab-cofre': {
    titulo: 'Cofre',
    intro: 'Senhas e acessos do escritório cifrados no browser (AES-GCM) — ninguém, nem mesmo a plataforma, vê os segredos em texto limpo.',
    acao: 'Define uma passphrase do cofre e guarda o primeiro acesso.',
    passos: [
      { titulo: 'Passphrase', corpo: 'A chave do cofre. Sem ela não consegues revelar nada — guarda-a no gestor de senhas do escritório (perdê-la = perder o cofre).', alvo: { texto: 'Passphrase do cofre' } },
      { titulo: 'Guardar acesso', corpo: 'Título, categoria (AT/SS/Banco/…), cliente opcional, username e o segredo. Tudo cifrado antes de ir para a base de dados.', alvo: { texto: 'Guardar acesso' } },
      { titulo: 'Revelar', corpo: 'Clica em "Revelar" com a passphrase para ver a senha, copiar e registar a vista (audit: quem viu e quando).', alvo: { texto: 'Revelar (re-auth)' } },
    ],
  },
};
