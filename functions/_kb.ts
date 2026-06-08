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

15. **exportar (Exportar documentos)** — Hub 3 documentos (Simulação 4-5pp PDF, Proposta 1pp, Minuta 3pp). Exporta também Excel com formulas.

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
- revenueAnnual (currency)
- estadoCivil (select)
- nrDependentes (number)
- custos_cogs, custos_fixos, custos_variáveis (currency)
- atividade (text, CAE — mapeia a coeficiente deductibilidade)
- investimento_inicial, financiamento (currency)

### vehicle (Simulador de Viaturas)
- category (select: passageiros/comercial)
- engineType (select: diesel/gasoline/hybrid/phev/electric/lpg/cng)
- price (currency, pré-IVA)
- ivaRegime (select: normal/second_hand/leasing)
- activity (select: other/goods/public_transport/rent_a_car/driving_school)
- maintenanceCost, insuranceCost, fuelCost (currency, inc. 23% IVA)
- exemptTA (boolean)
- phevCompliant (boolean, se PHEV)

### ticket (Tickets de Refeição)
- tipoTicket (select: restaurante/infancia/educacao/saude/oferta/car)
- employees (number)
- ticketValue (currency/day, se restaurante)
- tipoSubsidio (select: cartao/dinheiro, se restaurante)
- daysPerMonth (number)
- months (number)
- valorAnualPorPessoa (currency)
- tipoVeiculo (select: passageiros/misto/comercial, se Ticket Car)

### selfss (SS de Independente)
- rendimento (currency, receita anual)
- tipo (select: servicos/bens — afeta percentagem base cálculo)
- primeiroAno (boolean — isenção automática)

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

### imoveis (Imóveis na Empresa)
- valorImovel (currency)
- tipoUso (select: habitacao/comercial/misto)
- temApoiosPT2030 (boolean)
- horizonteInvestimento (select: curto/longo)
- precisaLiquidezMensal, precisaReforcoCE (boolean)
- tipoAtividade (select: geral/turismo/alojamento_local/agricola)

### imt (Simulador IMT)
- valor (currency, valor aquisição)
- tipo (select: hpp/habitacao/urbano_outros/rustico/outros)
- localizacao (select: continente/madeira/acores)
- primeiraHabitacao (boolean)
- idadeComprador (number)

### salario (Salário Líquido)
- salarioBruto (currency)
- estadoCivil (select)
- nrDependentes (number)
- localizacao (select: continente/madeira/acores)
- duodecimos (boolean — 14 vs 12 pagamentos)
- subsidioAlimentacaoDiario (currency)
- tipoSubsidio (select: cartao/dinheiro)
- diasSubsidio (number)
- irsJovem (boolean)
- anosAtividade (number)
- idade (number)
- taxaSeguroTrabalho (number, %)

### irs (Simulador de IRS — Modelo 3)
Campos de topo (preenchíveis pelo bot):
- cenario (select: individual/conjunto — tributação separada ou conjunta)
- regiao (select: continente/acores/madeira)
- concelho (text — define o benefício municipal)
- dependentes (number) ; dep0a3 (number — dos quais com idade ate 3 anos)
- pagamentosConta (currency) ; perdas (currency) ; beneficioMunicipal (number, fracao 0 a 0.05 — override)
- despesas.saude, despesas.educacao, despesas.habitacao, despesas.lares, despesas.gerais, despesas.pensoes (currency)
Sujeitos passivos (agregado — A e B): rendimento de trabalho, contribuicoes, retencao, rendimento Cat. B (atividade) + coeficiente, e ano de IRS Jovem. Estes campos por sujeito passivo preenchem-se melhor diretamente no formulario; o bot deve encaminhar para la.
Nota: o simulador cobre Cat. A (trabalho) e Cat. B simplificada. Os anexos de capitais (E), prediais (F), mais-valias (G) e contabilidade organizada (C) estao em desenvolvimento (Fase 2) — se o utilizador precisar deles, regista uma sugestao.

### previsa (Simulador Previsa/IRC)
- nif (text)
- designacao (text)
- regime (select: geral/madeira/acores/interioridade/startup)
- territorio (select: continente/madeira/acores)
- volumeNegocios (currency)
- useRaiCalc (boolean — toggle manual vs SAC)
- rai_lines: 60+ linhas contabilísticas (RAI 711–69)
- c702_c707 (posição abertura), c709_c752 (acréscimos), c754_c775 (deduções)

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
