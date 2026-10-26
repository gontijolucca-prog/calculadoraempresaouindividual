# Estudo 360 — como cada funcionalidade deve funcionar

Estado: ✅ = testado e provado nesta ronda · ⚠️ = existe, falta prova automática · ⛔ = bloqueado (precisa de contas/dados).

## A. Entrada e conta
| # | Funcionalidade | Como deve funcionar | Estado |
|---|---|---|---|
| A1 | Landing | Página pública, 0 erros de consola, sem overflow a 375/1024/1440 | ✅ |
| A2 | Criar conta / entrar | Email+password no Firebase; erros claros; "lembrar-me" | ⚠️ (sem conta de teste) |
| A3 | Escolher gabinete | Pergunta sempre ao entrar; sem gabinete, cria o primeiro | ✅ |
| A4 | Sair | Termina sessão e volta à landing | ⚠️ |

## B. Carteira e perfil
| # | Funcionalidade | Como deve funcionar | Estado |
|---|---|---|---|
| B1 | Lista de empresas | Cartões/lista, pesquisa, sem overflow no telemóvel | ✅ |
| B2 | Criar/editar empresa | Campos guardam; validação de NIF; perfil por cliente | ✅ |
| B3 | Selecionar cliente ativo | Passa a "A trabalhar em …"; simuladores e documentos usam esse cliente | ✅ |
| B4 | Perfil do cliente | Pré-preenche IRS/Salário; estado de conclusão visível | ✅ |
| B5 | Definições do escritório | Nome, NIF, cédula/OCC, morada, contactos, cor, logo | ✅ |
| B6 | Tabela de honorários | Preços por tipo de entidade, extras, IVA; alimenta todas as propostas | ✅ |

## C. Gabinete
| # | Funcionalidade | Como deve funcionar | Estado |
|---|---|---|---|
| C1 | Quadro de obrigações | Célula: — → ✓ → ✕ → —; 1 clique = 1 célula; grava logo | ✅ |
| C2 | Conflito entre dispositivos | Último a gravar ganha; aviso 1×; antigo vai para a Lixeira no clique | ✅ |
| C3 | Mapa de Controlo | Pilares por empresa; células isoladas; filtros por mês/trimestre | ✅ |
| C4 | Mapa RH | Idem, pilares próprios do RH | ✅ |
| C5 | Pilares por empresa | Editar copia o global só para esse cliente; os outros não mudam | ✅ |
| C6 | Obrigações | Criar/editar/concluir; filtro por cliente ativo e mês local | ✅ |
| C7 | Tarefas | Criar, concluir, apagar (pede confirmação), lixeira | ✅ |
| C8 | Agenda | Prazos de obrigações, tarefas e alertas por data | ✅ |
| C9 | Cofre | Entradas por cliente; cifra AES-GCM com passphrase; só admin/contabilista | ⚠️ (UI com duplicados responsivos; cifra testada) |
| C10 | Lixeira | Restaurar e purgar (purga só admin); nada desaparece sem rasto | ✅ |
| C11 | Equipa | Convidar por email, remover, cargos; isolamento por gabinete | ⚠️ (sem contas reais) |
| C12 | Permissões | admin > contabilista > estagiária; matriz espelhada nas rules | ✅ (matriz) / ⛔ (contas reais) |
| C13 | Offline | Grava local, sincroniza ao voltar a rede; nada falha em silêncio | ✅ |
| C14 | Imprimir mapas | Só o quadro/mapa, A4 horizontal, 1 folha | ✅ |
| C15 | Exportar PDF dos mapas | jsPDF, 1 página, símbolos ✓/✕/—, colunas do mês | ✅ |

## D. Simuladores (11)
| # | Funcionalidade | Como deve funcionar | Estado |
|---|---|---|---|
| D1–D11 | Fiscal, Viaturas, Aquisição, Tickets, SS Independente, Diagnóstico, Imóveis, IMT, Salário, IRS, PreviSa | Formulário em 2 passos, cálculo imediato, guardar por cliente, PDF numa só folha | ✅ (PDF 1 folha 11/11) · ⚠️ (valores fiscais a validar) |
| D12 | N/A nos campos opcionais | Marcar desativa e zera; nunca em campos obrigatórios | ✅ |
| D13 | Histórico de simulações | Lista por cliente, reabrir, apagar | ⚠️ |

## E. Exportações
| # | Documento | Como deve funcionar | Estado |
|---|---|---|---|
| E1–E11 | 11 relatórios de simulação | 1 folha A4, com enquadramento e escritório completos | ✅ |
| E12 | Quadro/Mapa Controlo/Mapa RH | 1 folha A4 (paisagem), filtros respeitados | ✅ |
| E13 | Proposta de Honorários | 1 folha, zoom medido, sem cortar texto | ✅ |
| E14 | Minuta de Contrato | 1 folha em versão resumida (cláusulas essenciais + nota); integral em Word | ✅ |
| E15–E21 | DR, Alterações, Fluxos, Balanço, DF, Ata, Declaração | 1 folha cada (DF completo a 0,42) | ✅ |
| E22 | Proposta comercial (deck) | 3–8 páginas (1 card por página, máx. 8) | ✅ |
| E23 | CSV/Excel | Exporta o que está no ecrã, sem perder linhas | ⚠️ |
| E24 | PDF portátil | A4 exato, fontes/imagens embutidas, sem URLs externas | ✅ |

## F. Propostas
| # | Funcionalidade | Como deve funcionar | Estado |
|---|---|---|---|
| F1 | Escolha obrigatória | Ecrã com 2 cartões: Estudo360 ou Gamma; não avança sem escolher | ✅ |
| F2 | 4 perguntas | Setor, Dimensão, Faturação, Objetivo; pré-preenchidas do perfil | ✅ |
| F3 | Proposta tailored | 7 blocos: capa, diagnóstico, âmbito, equipa/prova, investimento, plano, fecho | ✅ |
| F4 | Preço | Da tabela; ajuste manual com motivo e registo de auditoria | ✅ (unidade) |
| F5 | Editor | Cards, temas, autosave, regerar card | ✅ |
| F6 | PDF | 1 card por página, máx. 8 | ⚠️ |
| F7 | Publicar/link | `/p/<slug>` 90 dias, revogável, sem dados internos | ⚠️ (sem Firestore) |
| F8 | Gamma | Mesmo conteúdo em texto; copiar + abrir gamma.app | ✅ |

## G. AI Contabilista
| # | Funcionalidade | Como deve funcionar | Estado |
|---|---|---|---|
| G1 | Responder | Kilo (`kilo-auto/small`), 2–6 s; fallback Go/OpenRouter/Omni | ✅ |
| G2 | Privacidade | Nomes de clientes não saem; NIF/IBAN mascarados antes de providers free | ✅ |
| G3 | Timeout/fallback | 20 s por provider; nunca fica pendurado | ✅ |
| G4 | Ações/sugestões | Navegar, abrir simulador, sugerir melhoria | ⚠️ |
| G5 | Guias | "Aprender esta página" e visitas guiadas | ⚠️ |

## H. Transversal
| # | Funcionalidade | Como deve funcionar | Estado |
|---|---|---|---|
| H1 | Orbe "A trabalhar em" | Pulsa 2 s; estático com movimento reduzido | ✅ |
| H2 | 375/1024/1440 | Sem overflow em todas as vistas | ✅ (29 ecrãs) |
| H3 | Erros de consola | 0 nas vistas e fluxos testados | ✅ |
| H4 | CI | `tsc` + testes antes de publicar | ✅ |
