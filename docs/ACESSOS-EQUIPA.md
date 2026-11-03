# Acessos da Equipa

O dono ou um administrador cria o email e a password dentro do gabinete. Não
existe envio de email nem convite por link. A password criada no gabinete abre
apenas esse gabinete; a conta normal do mesmo email, se existir, mantém a sua
password e os seus direitos.

Uma conta normal criada depois não recebe acesso apenas por usar o mesmo email.
Para ligar essa conta ao gabinete é necessário confirmar a password secreta
criada pelo dono. Assim, alguém que registe primeiro um email alheio não entra
no gabinete sem conhecer essa password.

No ecrã de escolha de gabinete, a conta normal encontra a opção
**“Já tem um acesso criado pelo gabinete?”**. Introduz a password secreta e a
associação é confirmada pelo servidor. O mesmo email sozinho nunca cria a
associação.

O login criado pelo gabinete é técnico e não pode criar gabinetes. Ao entrar
com essas credenciais, segue diretamente para o gabinete que o criou.

## Configuração

1. Criar uma conta de serviço Firebase com acesso a Authentication e Firestore.
2. Guardar o JSON no secret `FIREBASE_SERVICE_ACCOUNT_JSON` do GitHub e do
   Cloudflare Pages.
3. Publicar as Firestore Rules.

O valor nunca deve ter prefixo `VITE_`, porque os segredos com esse prefixo
passam para o browser.

## Migração única

Primeiro, sem alterar dados:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='...' npm run migrar:equipa
```

Depois de confirmar a contagem de convites e gabinetes:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='...' npm run migrar:equipa -- --apply
```

A migração elimina os documentos antigos de `convites` e limpa os metadados de
convite dos gabinetes, sem remover membros ativos.

## Desenvolvimento

Os endpoints `/api/equipa-contas`, `/api/colaborador-login` e
`/api/vincular-conta` usam automaticamente os emuladores quando estão definidos:

```bash
VITE_FIREBASE_EMULATORS=1 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 \
npm run dev
```
