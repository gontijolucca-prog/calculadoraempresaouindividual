# Política do changelog público

O changelog existe para ser usado na reunião com o cliente. Só entram
alterações que o cliente consegue abrir, executar e confirmar na aplicação.

## Um item só entra se cumprir todos estes pontos

1. Tem um resultado visível na interface.
2. Pode ser testado pelo cliente sem acesso a ferramentas internas.
3. Indica onde testar e qual é o resultado esperado.
4. Continua a funcionar depois de recarregar a página.
5. Não depende de uma explicação sobre código, servidores ou base de dados.

## Não entra no changelog público

- alterações às Firestore Rules, índices ou estrutura interna da base de dados;
- refactors, testes, CI, deploys, auditorias e correções sem efeito visível;
- quotas, limites técnicos, logs, filas de sincronização e permissões internas;
- trabalho preparatório que ainda não pode ser experimentado pelo cliente.

Esse trabalho continua registado internamente em auditorias, commits e
documentação técnica.

## Formato recomendado

Cada cartão deve responder a:

- **O que mudou:** frase simples sobre o resultado visível.
- **Testar:** caminho na aplicação e ação concreta.
- **Resultado esperado:** aquilo que o cliente deve ver.

Os changelogs antigos ficam congelados. A regra aplica-se ao changelog atual e
a todas as páginas novas.
