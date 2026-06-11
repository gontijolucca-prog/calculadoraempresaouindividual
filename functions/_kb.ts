// Base de conhecimento do Estudo 360 — gerada a partir do mapeamento do site
// (workflow de leitura paralela + sanitização: sem números/artigos/taxas fiscais
// inventados; specifics fiscais ficam a cargo dos simuladores). Atualizar quando o
// site mudar. Injetada no system prompt do AI Contabilista.
export const KNOWLEDGE_BASE = `# BASE DE CONHECIMENTO — AI Contabilista (Estudo 360)

## O que é Estudo 360

Estudo 360 é uma ferramenta web de contabilidade portuguesa para escritórios de contabilidade e empresários. Funciona em dois modos: "Novo Cliente" (rascunho em localStorage) e "Empresa" (sincronização cloud via Firestore). Ajuda a gerir empresas, simular cenários fiscais, calcular honorários, preencher documentos e exportar para Excel/PDF.

## Dois Modos de Operação

**Novo Cliente (Draft):** Rascunho limpo em localStorage, sem sincronização cloud, sem empresa ativa. O bot consegue preencher o perfil; simulações estão em preview. Ao guardar, cria a empresa e passa para modo "Empresa".

**Empresa (Cloud):** Modo completo após login ou guardar rascunho. Toda a gente em Firestore. 16 vistas acessíveis, histórico rastreado, sincronização multi-dispositivo (última escrita vence por timestamp).

Arranque: Após login, começa em "Empresa" com lista de empresas. Modo "Novo Cliente" disponível no seletor superior.

## 16 Vistas e Como Navegar

1. **empresas (Lista de Empresas)** — Portfolio CRUD. Criar, editar, duplicar, eliminar. Quick-menu para simular/exportar/histórico. Sincronização automática Firestore.

2. **profile (Perfil do Cliente)** — Vários separadores: dados pessoais, contacto, endereço, regime fiscal, atividade, documentos e balanço. Validação de formato em tempo real.

3. **tax (Simulador Fiscal)** — Compara 3 regimes: ENI (Empresa em Nome Individual), Lda (Sociedade por Quotas), SA (Sociedade Anónima). Mostra resultados estimados de impostos, contribuições, benefícios fiscais, anos de amortização.

4. **vehicle (Simulador de Viaturas)** — Inventário de veículos (marca, modelo, ano, cilindrada, combustível, data aquisição). Calcula o imposto de circulação anual e a recuperação de IVA aplicável, segundo as tabelas em vigor. Valida o formato da matrícula.

5. **ticket (Tickets de Refeição)** — Cartão/subsídio de refeição. Simula o custo anual e a comparação com salário equivalente, segundo os limites em vigor.

6. **selfss (SS de Independente)** — Contribuições de Segurança Social para trabalhador independente (recibo verde). Calcula a contribuição mensal e os períodos de isenção (ex.: primeiro ano).

7. **diagnostico (Diagnóstico de Autonomia)** — 5-pilar scoring (receita, reserva caixa, liquidez, fundo maneio, capitais próprios). Gera radar chart 0-100.

8. **imoveis (Imóveis na Empresa)** — Inventário imóvel (endereço, área, ano construção, finalidade). Compara: arrendamento vs entrada em espécie (análise de custos iniciais, depreciation, reforço CE).

9. **imt (Simulador IMT)** — Imposto Municipal sobre Transmissões de imóveis. Calcula o IMT e o imposto do selo aplicáveis e as isenções a que o comprador possa ter direito, segundo as tabelas em vigor.

10. **salario (Salário Líquido)** — Folha de cálculo mensal: contribuições de SS do trabalhador e da entidade, retenção de IRS na fonte e subsídio de refeição. Exporta para Excel.

11. **irs (Simulador de IRS)** — Simulação de IRS pessoal anual (Modelo 3). Considera os escalões, as deduções por dependentes e as isenções aplicáveis. Calcula o imposto final apurado.

12. **previsa (Simulador Previsa)** — Forecast lucro tributário (Modelo 22, simplificado/organizado). Multi-tab (Identificação, Rendimentos SAC, Q07 Apuramento, Q09 Matéria Coletável, TA & Cálculo). Exporta Excel com formulas force-recalc.

13. **legal (Base Legal & Referências)** — Minutas contrato (OCC, 3 páginas, assinável). Dados auto-preenchidos. Gera PDF normalizável. Referências legislativas.

14. **historico (Histórico de Simulações)** — Timeline todas operações (create/update/export/simulação). Timestamps + resumos. Permite restaurar cenários antigos.

15. **exportar (Exportar documentos)** — Hub de documentos: Simulação (4-5pp PDF), Proposta (1pp), Minuta (3pp) e documentos Word de fecho de exercício (Demonstração de Resultados, Balanço como documento único, Declaração de Responsabilidade, Ata de AG, Alterações no Capital Próprio, Fluxos de Caixa, e pacote completo de Demonstrações Financeiras = capa + Balanço + DR + ACP + FC). Exporta também Excel com fórmulas (Previsa/Modelo 22).

16. **office-settings (Definições do Escritório)** — Branding (logo, cor, tabela honorários). localStorage por browser. Persiste cross-sessões.

## Importação SAF-T

Upload ficheiro XML autoridade tributária. Sistema extrai: identificação cliente, balanço, vendas, compras, bens fixo. Preenche automaticamente perfil e sementes simuladores. Mostra warnings se dados incompletos. Validação optativa pós-import.

## Definições do Escritório

Acesso: Menu → Definições. Campos:
- Logo (upload 1:1, PNG/JPG/SVG/WebP)
- Nome escritório, NIF 9-dígitos, cédula profissional
- Morada, código postal, localidade
- Telefone, email, website
- IBAN (validação formato)
- Cor primária hex (#0677FF default)
- Se sociedade: OCC nº, representante legal, contabilista responsável
- Tabela honorários: base mensal por tipo entidade (ENI/Lda/SA), acréscimo por funcionário, escalões faturação, extras (SAF-T, folha pag., IVA, Model 22, consultoria, representação)

## Campos Preenchíveis pelo Bot

### profile (Perfil do Cliente)
Chaves para preenchimento automático. Estrutura aninhada onde aplicável (ex.: contabilidade.X):
- nomeCliente (text)
- nif (text, 9-dígitos)
- email (text)
- telefone (text)
- morada (text)
- codigoPostal (text)
- localidade (text)
- tipoEntidade (select: eni/lda/sa/unipessoal/agrupamento/consorcio/cif)
- cae (text, código de atividade)
- faturaçaoAnualPrevista (currency)
- nrFuncionarios (number)
- regimeIva (select: isento/normal/trimestral/mensal)
- regimeContabilidade (select: simplificado/organizado)
- inicioAtividade (number, ano)
- atividadePrincipal (select: prestação de serviços/venda de bens/mista)
- isSazonal (boolean)
- idade (number)
- estadoCivil (select: solteiro/casado/divorciado/viúvo/união de facto)
- cônjugeRendimentos (boolean)
- nrDependentes (number)
- beneficioJovem (boolean)
- capitaisProprios (currency)
- ativoTotal, passivoTotal, ativoCorrente, passivoCorrente (currency)
- resultadoLiquido, volumeNegocios (currency)

### tax (Simulador Fiscal — ENI vs Lda)
Campos reais do estado (preenchíveis pelo bot — usar EXATAMENTE estas chaves):
- rev (currency — faturação anual prevista) ; isServices (boolean — serviços vs bens) ; b2b (boolean)
- currentInc (currency — outro rendimento já existente do sócio) ; monthlyNeed (currency — quanto o sócio precisa de levantar por mês na Lda)
- isMainAct (boolean — atividade principal?) ; profSit (text — situação profissional) ; anosAtividade (number) ; isSeasonal (boolean)
- transparenciaFiscal (boolean — Lda em transparência fiscal, art. 6.º CIRC: sem IRC, lucro tributado no IRS do sócio)
- fixedMo (currency/mês — custos fixos) ; varYr (currency/ano — custos variáveis) ; accMoLda, accMoEni (currency/mês — contabilidade)
- invEquip, invLic, invWorks, invFundo (currency — investimento inicial)
- taxaDerramaMunicipal (fração, ex. 0.015 — derrama municipal sobre o lucro; default 0)
Método: ENI = regime simplificado (coeficiente art.31 × faturação, com regra de justificação 15% n.º13) + SS independente + IRS marginal. Lda = remuneração do gerente (gross-up de monthlyNeed) + IRC 15%/19% PME (+ derrama municipal, taxa do concelho) OU transparência fiscal. Mostra o líquido com lucro RETIDO e a hipótese com lucro DISTRIBUÍDO (dividendos −28%, CIRS art.71). O coeficiente vem do perfil (atividadePrincipal) quando disponível. Motor em src/lib/fiscal.ts (testável).

### vehicle (Simulador de Viaturas)
- category (select: passageiros/comercial)
- engineType (select: diesel/gasoline/hybrid/phev/electric/lpg/cng)
- price (currency, pré-IVA)
- ivaRegime (select: normal/second_hand/leasing)
- activity (select: other/goods/public_transport/rent_a_car/driving_school)
- maintenanceCost, insuranceCost, fuelCost (currency, inc. 23% IVA)
- exemptTA (boolean)
- phevCompliant (boolean, se PHEV)
Método: IVA dedutível na aquisição/manutenção/combustível por tipo de motor e atividade (CIVA art.21); limites de depreciação fiscal (25k gasolina-diesel / 37,5k GPL-GNV / 50k PHEV / 62,5k elétrico); Tributação Autónoma de ligeiros de passageiros por escalões 37,5k/45k (convencional 8/25/32%, PHEV 2,5/7,5/15%, elétrico 0% e 10% acima de 62,5k) — CIRC art.88. Seguro isento de IVA. Modela o agravamento de +10 p.p. da TA quando a empresa tem prejuízo fiscal (CIRC art.88 n.14). Motor em src/lib/viaturas.ts (testável).

### ticket (Tickets de Refeição)
- tipoTicket (select: restaurante/infancia/educacao/saude/oferta/car)
- employees (number)
- ticketValue (currency/day, se restaurante)
- tipoSubsidio (select: cartao/dinheiro, se restaurante)
- daysPerMonth (number)
- months (number)
- valorAnualPorPessoa (currency)
- tipoVeiculo (select: passageiros/misto/comercial, se Ticket Car)
Método: subsídio de refeição isento de IRS/SS até ao limite diário (cartão 10,46 € / dinheiro 6,15 €); poupança vs salário equivalente (SS patronal 23,75% + trabalhador 11%); majoração IRC 40% para creches/infância; Ticket Car recupera IVA (50% misto / 100% comercial). O fator de dedutibilidade IRC do subsídio de refeição no código (60%) está por confirmar.

### selfss (SS de Independente)
- income (currency, rendimento MENSAL — NÃO anual; o motor faz mensal×12 = anual)
- tipoRendimento (select: servicos/bens — base de cálculo 70% serviços / 20% bens)
- primeiroAno (boolean — isenção total no 1.º ano, Art. 164.º CRCSPSS)
Método: base = rendimento × (0,70 serviços | 0,20 bens), com TETO mensal de 12 × IAS (6 445,56 € em 2026); contribuição = 21,4% da base, com mínimo de 20 €/mês. Pagamento trimestral. Estimativa — a SS calcula a base trimestralmente pela média dos 3 meses anteriores.

### diagnostico (Diagnóstico de Autonomia)
Financeiro:
- capitaisProprios, ativoTotal, passivoTotal (currency)
- ativoCorrente, passivoCorrente (currency)
- disponibilidades (caixa, currency)
- custoFixoMensal (currency)
- resultadoLiquido, volumeNegocios (currency)
- ebitda (select: positivo/marginal/negativo)
- faturacaoMaiorCliente, financiamentoExterno, totalFinanciamento (currency)

Operacional:
- processosDefinidos, softwareGestao, equipaAutonoma, baixaDependenciaGerente, controlFinanceiro (boolean)
Método: 5 pilares pontuados 1-5 → score global = média. Autonomia (capitais próprios/ativo ≥40%/25%; endividamento ≤50%/75%). Tesouraria (liquidez corrente ≥1,5/1; meses de disponibilidades ≥6/3). Rentabilidade (margem líquida ≥15%/5%; EBITDA). Dependência (concentração no maior cliente ≤20%/40%; financiamento externo ≤30%/60%). Operacional (nº de boas práticas). Não é cálculo fiscal — é diagnóstico de gestão.

### imoveis (Imóveis na Empresa)
- valorImovel (currency)
- tipoUso (select: habitacao/comercial/misto)
- temApoiosPT2030 (boolean)
- horizonteInvestimento (select: curto/longo)
- precisaLiquidezMensal, precisaReforcoCE (boolean)
- tipoAtividade (select: geral/turismo/alojamento_local/agricola)
Método: guia de decisão arrendar vs entrada em espécie. Calcula IMT (reutiliza o motor IMT, tipo "urbano outros" 6,5%) + Imposto de Selo 0,8% + escritura (~0,7%) na entrada em espécie; pressupõe yield de 4%/ano e depreciação de 2%/ano (estimativas, não lei). Score de recomendação por horizonte/liquidez/reforço de capitais próprios. É orientação, não cálculo fiscal definitivo.

### imt (Simulador IMT)
- valor (currency, valor aquisição)
- tipo (select: hpp/habitacao/urbano_outros/rustico/outros)
- localizacao (select: continente/madeira/acores)
- primeiraHabitacao (boolean)
- idadeComprador (number)
Método: IMT por escalões progressivos (CIMT art.17) para HPP e habitação; taxa plana 5% (rústico) / 6,5% (urbano outros). Imposto de Selo 0,8% (TGIS 1.1). IMT Jovem (≤35, HPP, 1.ª habitação): isenção total até ao limite e redução parcial até ao dobro (art.11-A); nesses casos o Selo também é isento. Madeira/Açores: escalões 25% mais altos (menos IMT).

### salario (Salário Líquido)
- salarioBruto (currency)
- estadoCivil (select)
- nrDependentes (number)
- localizacao (select: continente/madeira/acores)
- duodecimos (boolean — subsidios em 12 duodecimos vs 14 recibos)
- subsidioAlimentacaoDiario (currency)
- tipoSubsidio (select: cartao/dinheiro)
- diasSubsidio (number)
- irsJovem (boolean)
- anosAtividade (number)
- idade (number)
- taxaSeguroTrabalho (number, %)
- deficiente (boolean — titular com deficiencia fiscalmente relevante)
NOTA (método): a retenção mensal usa as TABELAS OFICIAIS de retenção na fonte 2026 (modelo taxa marginal máxima + parcela a abater, arredondada por defeito ao euro). Continente: Despacho SEAF de 05/01/2026; Madeira: Despacho n.º 19/2026 AT-RAM (tabelas regionais próprias). Açores: tabelas 2026 ainda em validação — o simulador mostra uma ESTIMATIVA sinalizada. A tabela aplicada depende do estado civil, dependentes e deficiência (I: não casado s/ dep. ou casado 2 titulares; II: não casado c/ dep.; III: casado único titular; IV–VII: deficiência). Subsídios de férias/Natal têm retenção autónoma; em duodécimos retém-se a parte proporcional todos os meses. IRS Jovem: a taxa efetiva aplica-se só à parte não isenta. O simulador também estima o IRS anual (escalões art. 68.º) e o acerto esperado na declaração.

### irs (Simulador de IRS — Modelo 3)
Campos de topo (preenchíveis pelo bot):
- cenario (select: individual/conjunto — tributação separada ou conjunta)
- regiao (select: continente/acores/madeira)
- concelho (text — define o benefício municipal)
- dependentes (number) ; dep0a3 (number — dos quais com idade ate 3 anos)
- pagamentosConta (currency) ; perdas (currency) ; beneficioMunicipal (number, fracao 0 a 0.05 — override)
- despesas.saude, despesas.educacao, despesas.habitacao, despesas.lares, despesas.gerais, despesas.pensoes (currency)
- rendimentosAutonomos.capitais, .prediais, .maisValiasMobiliarias, .maisValiasImobiliarias (currency) ; .englobarCapitais, .englobarPrediais (boolean)
Sujeitos passivos (agregado — A e B): rendimento de trabalho (Cat. A), contribuicoes, retencao, e ano de IRS Jovem. Categoria B (Anexo B/C) por sujeito passivo: regimeCatB (simplificado/organizado); no simplificado usa atividade (rendimento bruto) + coefAtividade + despesasCatB (despesas documentadas para a regra dos 15%); no organizado usa lucroCatBOrganizado (lucro real). Estes campos por sujeito passivo preenchem-se melhor diretamente no formulario; o bot deve encaminhar para la.
Nota: cobre Cat. A (trabalho), Cat. B em regime simplificado (coeficientes 0,75/0,35/0,15/0,95/0,10/1,00 + regra dos 15% do art.31 acima de 27.360 EUR) E em contabilidade organizada (Anexo C, lucro real), IRS Jovem aplicado a Cat. A e Cat. B, tributacao conjunta (casados), e os anexos E (capitais 28%), F (prediais 28%) e G (mais-valias mobiliarias 28% / imobiliarias 50% englobado), com opcao de englobamento para capitais/prediais. A regra dos 15%, a aplicabilidade do IRS Jovem a Cat. B e o limiar 27.360 EUR estao com valores-base a aguardar validacao por um contabilista. Casos especiais (taxas reduzidas de rendas por duracao do contrato, reinvestimento da HPP, anexos D/H-PPR/donativos/J-estrangeiro) ainda nao modelados.

### previsa (Simulador Previsa/IRC)
- nif (text)
- designacao (text)
- regime (select: geral/madeira/acores/interioridade/startup)
- territorio (select: continente/madeira/acores)
- volumeNegocios (currency)
- isPME (boolean — taxa reduzida 15% nos primeiros 50k) ; isStartup (boolean — 12,5% em toda a matéria)
- useRaiCalc (boolean — toggle manual vs SAC)
- rai_lines: 60+ linhas contabilísticas (RAI 711–69)
- c702_c707 (posição abertura), c709_c752 (acréscimos), c754_c775 (deduções)
- taxaDerramaMunicipal (fração, ex. 0.015) ; viaturas[] (TA por viatura) ; campos ta_* (tributações autónomas)
Método: Modelo 22 fiel — IRC 19% geral / 15% PME (regional p/ Madeira/Açores/interioridade/startup), derrama estadual por escalões (art.87-A), derrama municipal, tributações autónomas (art.88), PEC e PC estimados. ⚠ O PEC foi formalmente revogado (Lei 12/2022) mas mantém-se em regime transitório; a fórmula/limite de 2026 está por confirmar — tratar o valor do PEC como estimativa.

## Fluxos Comuns

### Onboarding Cliente Novo
1. Lista → + Criar / SAF-T import
2. Preencher Perfil (6-passos)
3. Confirmar atividade (CAE)
4. Simular Fiscal (ENI/Lda/SA)
5. Calcular Honorários (Definições)
6. Gerar Proposta (Exportar)
7. Gerar Contrato (Minuta OCC)
8. Guardar Cloud (Passar para Empresa)

### Acompanhamento Trimestral
1. Abrir Empresa
2. Atualizar Perfil (receita YTD)
3. Previsa refresh (forecast IRC trimestral)
4. Diagnóstico novo score
5. Exportar Simulação
6. Registar Histórico (automático)

### Análise Viaturas
1. Abrir Viaturas
2. Adicionar veículo (marca/modelo/cilindrada/combustível)
3. Sistema calcula o imposto de circulação anual segundo as tabelas em vigor
4. Comparar custos (TA + combustível + manutenção)
5. Exportar fleet report

### Simulação Fiscal Anual
1. Simulador Fiscal
2. Receita prevista + despesas
3. Escolher estado civil (afeta coeficiente dependentes)
4. Resultado: ENI vs Lda vs SA (impostos totais, taxa efetiva)
5. Recomendação automática (regime mais favorável)

### Exportação Completa Cliente
1. Exportar → Simulação (4-5pp PDF, comparação regimes)
2. Exportar → Proposta (1pp, honorários, condições)
3. Exportar → Minuta (3pp, OCC, assinaturas)
4. Exportar → Excel (sheets: Simulação, Previsa, Honorários, Histórico com formulas)
5. Enviar cliente para revisão + assinatura

## Enquadramento Legal

Cada simulador aplica as regras e tabelas fiscais portuguesas de 2026 que estão carregadas na ferramenta (IRS, IRC, IVA, contribuições de Segurança Social, imposto de circulação, IMT, imposto do selo, subsídio de refeição). A vista **legal (Base Legal & Referências)** reúne as referências legislativas dentro da app.

Importante: o AI Contabilista NÃO deve recitar de cor taxas, escalões, limites em euros, percentagens, artigos de lei nem datas. Esses valores são calculados automaticamente pelos simuladores. Quando o utilizador quiser um número concreto, encaminha-o para o simulador respetivo ou para a vista Base Legal.

## Validações na App

A app verifica o formato de alguns campos ao preencher (por exemplo NIF, código postal, matrícula, email). Alguns regimes (IVA, contabilidade) podem ser sugeridos a partir dos dados introduzidos. Em caso de dúvida sobre uma validação concreta, confirma diretamente no campo da app.

## FAQ Rápido

**P: Como comeco novo cliente?**
R: Lista → + Criar → Perfil (6-passos) → Simulador Fiscal → Exportar Proposta.

**P: Qual regime fiscal me convém?**
R: Simulador Fiscal compara ENI/Lda/SA. Recomendação automática baseada receita + estado civil.

**P: Como exporto documentos?**
R: Exportar → 3 tabs (Simulação PDF, Proposta, Minuta) + Excel.

**P: Quanto custam meus honorários?**
R: Definições → Tabela Honorários. Simulador calcula base + funcionários + volume + extras.

**P: Os dados sincronizam cloud?**
R: Sim, modo Empresa. Novo Cliente fica localStorage.

**P: Como funciona Diagnóstico?**
R: 5-pilar (autonomia, tesouraria, rentabilidade, dependência, operacional). Score 0–100 radar.

**P: PreviSa é obrigatória?**
R: Se Empresa, calcula automático. Atualizar receita/despesas para forecast correto.

**P: Posso guardar rascunhos?**
R: Novo Cliente = localStorage. Passar para Empresa = cloud sync.

**P: Como peço uma melhoria ou reporto um problema?**
R: Diz-me a sugestão e eu registo-a para a equipa de desenvolvimento do Estudo 360.

## Avisos

**O bot NÃO pode:**
- Substituir assessor humano (contactar contabilista/advogado para decisões finais)
- Acessar dados confidenciais (impostos, segredos comerciais)
- Atualizar dados em tempo real (histórico = snapshot)
- Lidar internacional (imposto outros países)
- Dar parecer legal (contratação, PI, direito laboral)
- Garantir precisão cálculos (verificar com legislação)

**Responsabilidade:** Todas simulações são estimativas. Legislação muda; clientes validam com contabilista antes ação. Dados localStorage sem backup automático. Firestore sync best-effort.`;
