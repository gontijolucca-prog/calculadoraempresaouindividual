# Aplicação Windows para Simuladores Recofátima

Foram criadas duas formas de transformar esta aplicação web numa experiência nativa para Windows:

## 1. Solução Instantânea (Script PowerShell)
O ficheiro `abrir-simuladores.ps1` permite abrir a aplicação imediatamente no Windows como se fosse uma app nativa (sem barras de navegação).

**Como usar:**
1. Envie o ficheiro `abrir-simuladores.ps1` para quem desejar.
2. No Windows, clique com o botão direito no ficheiro e escolha **"Executar com o PowerShell"**.

---

## 2. Aplicação Portátil Profissional (.exe)
Configurámos o **Tauri** para gerar um ficheiro `.exe` real de aproximadamente 3-5MB.

### Como gerar o ficheiro .exe:
1. **GitHub Actions (Recomendado):**
   - Ao fazer "Push" deste código para o seu repositório GitHub, um processo automático será iniciado (ver aba "Actions" no GitHub).
   - Após alguns minutos, será criado um "Draft Release" com o ficheiro `.exe` pronto para download.
   - **Nota:** O build pode falhar na primeira vez se não existirem ícones em `src-tauri/icons`.

2. **Gerar ícones:**
   - Se tiver o Node.js instalado, coloque uma imagem (ex: `logo.png`) na raiz do projeto e corra:
     ```bash
     npm install
     npx tauri icon logo.png
     ```
   - Isto criará automaticamente todos os formatos necessários na pasta `src-tauri/icons`.

### Vantagens da App (.exe):
- Um único ficheiro que pode ser enviado pelo WhatsApp.
- Ícone personalizado na barra de tarefas.
- Janela dedicada sem as distrações do browser.
- Sempre atualizada: a app carrega automaticamente a versão mais recente do seu site no GitHub.
