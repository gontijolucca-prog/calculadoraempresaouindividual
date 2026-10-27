# Convites de equipa por email (servidor)

O browser chama `POST /api/equipa-convite`; o servidor valida a sessão Firebase
(`accounts:lookup`) e envia o email. O browser nunca fala com o fornecedor.

## Configurar (uma vez)
1. Criar conta em https://resend.com (grátis até 100/dia) **ou** https://brevo.com (grátis 300/dia).
2. Adicionar o domínio `estudo360.pt` e criar os registos DNS que o Resend indica.
3. Criar uma API key e colar em **Cloudflare Pages → Settings → Environment variables**:
   - `RESEND_API_KEY` = `re_...` **ou** `BREVO_API_KEY` = `xkeysib-...`
   - `MAIL_FROM` = `Estudo360 <convites@estudo360.pt>` (opcional)

Sem chave, o endpoint devolve `email_nao_configurado` e a app mostra a mensagem
pronta para copiar. (O envio pela Cloudflare Email Routing foi testado: a conta
não tem o Email Sending beta autorizado e o Email Routing só envia para destinos
verificados — não serve para convidar pessoas novas.)

## Alternativa sem chave
Binding `SEND_EMAIL` (Cloudflare Email Routing). Requer ativar Email Routing no
domínio e adicionar a binding ao projeto Pages.

## Limites
- Só utilizadores autenticados (token Firebase verificado pelo Google).
- 30 convites/hora por utilizador (best-effort por isolate).
