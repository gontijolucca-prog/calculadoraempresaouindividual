# Importar empresas/clientes do TOConline

## O que já existe
- Botão **TOConline** na Lista de Empresas → modal de importação.
- OAuth 2.0 (authorization code) feito no browser; o segredo nunca vai para o Firestore.
- Proxy `/api/toconline` no servidor: troca o código por token, renova e pagina os clientes (100/página).
- Pré-visualização com marcação dos que já existem (por NIF) e importação em lote.
- Credenciais ficam só no `localStorage` deste gabinete.

## Passos para ligar (com as tuas credenciais)
1. Em TOConline → **Empresa › Configurações › Dados API**:
   - **Endereço URI de redirect**: `https://estudo360.pt/` (em desenvolvimento: `http://localhost:3000/`) e **gravar**.
   - Endereço OAuth: `https://app32.toconline.pt/oauth`
   - Endereço da API: `https://api32.toconline.pt`
   - Copiar **Identificador** e **Segredo**.
2. No Estudo 360 → Lista de Empresas → **TOConline** → colar os 4 campos → **Entrar com TOConline**.
3. Autorizar no site do TOConline; volta sozinho e mostra a lista de clientes.
4. Marcar os que quer importar → **Importar** (os que já existem por NIF ficam desativados).

## Erros comuns
| Erro | Causa | Correção |
|---|---|---|
| `unauthorized_client` / `redirect_uri_nao_registado` | O redirect guardado no TOConline não é exatamente o do site | Repetir o passo 1 com o endereço exato |
| `codigo_expirado` | O código vale poucos minutos | Clicar outra vez em Entrar |
| 0 clientes | Conta sem clientes ou sem módulo comercial ativo | Confirmar no TOConline |

## Caminho sem mudar o redirect (já disponível)
1. Autorize no TOConline: o browser vai parar ao endereço registado (p. ex. a página
   do Postman) e o endereço dessa página tem `?code=...`.
2. Copie só o valor de `code`.
3. No modal, abra **«Já tenho um código de autorização»**, cole e carregue em
   **Usar código**. A app troca o código por sessão e importa a lista.
   O campo **Endereço de retorno registado** tem de ter exatamente o mesmo valor
   que está no TOConline.

## Segurança
- O segredo que foi partilhado por captura de ecrã deve ser **regenerado** no TOConline (ícone de recarregar) depois de ligar.
- O proxy só aceita origens estudo360.pt / localhost e tem limite de 30 pedidos/min por IP.
