# Importar empresas/clientes do TOConline

## O que já existe
- Botão **TOConline** na Lista de Empresas → modal de importação.
- OAuth 2.0 (authorization code) feito no browser; o segredo nunca vai para o Firestore.
- Proxy `/api/toconline` no servidor: troca o código por token, renova e pagina os clientes (100/página).
- Pré-visualização com marcação dos que já existem (por NIF) e importação em lote.
- Credenciais ficam só no `localStorage` deste gabinete.

## O que a documentação diz (autenticação detalhada)
- O endereço de retorno vem **pré-fixado** pela TOConline: `https://oauth.pstmn.io/v1/callback`.
- Só muda com o procedimento do passo 1 (pedido de alteração à TOConline) — não é um campo
  que se troque à vontade na página de credenciais.
- O código de autorização obtém-se **ignorando o redirect** e lendo o `code` do cabeçalho
  `Location` (fluxo Postman). Num browser normal, o caminho prático é copiar o `code`
  do endereço da página de retorno.

## Passos para ligar (com as tuas credenciais)
1. Em TOConline → **Empresa › Configurações › Dados API**: obter **Identificador** e **Segredo**
   (não é preciso mexer no redirect).
   - Endereço OAuth: `https://app32.toconline.pt/oauth`
   - Endereço da API: `https://api32.toconline.pt`
   - Copiar **Identificador** e **Segredo**.
2. No Estudo 360 → Lista de Empresas → **TOConline** → colar OAuth, API, Identificador e Segredo.
3. **Abrir autorização TOConline** → autorizar; o browser volta a `https://oauth.pstmn.io/v1/callback`.
4. Copiar o valor de `code=` do endereço dessa página e colar em **Já tenho um código** →
   **Usar código**. A app troca por sessão e importa a lista.
4. Marcar os que quer importar → **Importar** (os que já existem por NIF ficam desativados).

## Erros comuns
| Erro | Causa | Correção |
|---|---|---|
| `unauthorized_client` / `redirect_uri_nao_registado` | O redirect guardado no TOConline não é exatamente o do site | Repetir o passo 1 com o endereço exato |
| `codigo_expirado` | O código vale poucos minutos | Clicar outra vez em Entrar |
| 0 clientes | Conta sem clientes ou sem módulo comercial ativo | Confirmar no TOConline |

## Ligação automática (funciona)
`Ligar e importar` faz tudo no servidor, como na documentação:
1. `GET /oauth/auth` com `client_id`, `redirect_uri` **fixo** (`https://oauth.pstmn.io/v1/callback`),
   `response_type=code`, `scope=commercial` — **sem seguir** o 302; o `code` vem no `Location`.
2. `POST /oauth/token` com Basic `client_id:secret`, `grant_type=authorization_code`, `code`,
   `scope=commercial` — **sem `redirect_uri`** (enviá-lo devolve `401 unauthorized_client`).
3. `GET {API}/customers?page[number]=N&page[size]=100` com Bearer.

Testado a 26/10 com a conta real: token válido (4 h) e **466 empresas** listadas em 5 páginas.

### Porque dava 403 antes
O segredo estava inválido/expirado. A troca respondia `403 access_denied`; com o segredo novo,
o mesmo pedido devolve 200. (Um `redirect_uri` diferente do fixo dá `error=invalid_request`
no 302, e enviá-lo no token dá `401 unauthorized_client`.)

## Segurança
- O segredo que foi partilhado por captura de ecrã deve ser **regenerado** no TOConline (ícone de recarregar) depois de ligar.
- O proxy só aceita origens estudo360.pt / localhost e tem limite de 30 pedidos/min por IP.
