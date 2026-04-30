# DirectSpeed — Guia Completo de Instalação e Uso

---

## ESTRUTURA DO PROJETO

```
directspeed-extension/     ← Instalar no Edge
  manifest.json
  background.js
  content.js
  popup.html
  popup.js
  icons/

directspeed-auth/          ← Subir na nuvem (Render.com)
  server.js
  package.json
```

---

## PARTE 1 — SUBIR O SERVIDOR DE CHAVES NA NUVEM

O servidor valida quem pode usar a extensão. Use o Render.com (gratuito).

### Passo 1 — Criar conta no Render
Acesse https://render.com e crie uma conta gratuita.

### Passo 2 — Subir o servidor
1. Crie um repositório no GitHub com a pasta `directspeed-auth/`
2. No Render, clique em **New → Web Service**
3. Conecte seu repositório do GitHub
4. Configure:
   - **Name:** directspeed-auth
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
5. Clique em **Create Web Service**
6. Aguarde o deploy (2-3 minutos)
7. Anote a URL gerada — ex: `https://directspeed-auth.onrender.com`

### Passo 3 — Atualizar a URL na extensão
Abra `background.js` e na linha 7 substitua:
```
const AUTH_SERVER = "https://directspeed-auth.onrender.com";
```
pela URL real do seu servidor.

---

## PARTE 2 — GERENCIAR AS CHAVES DE ACESSO

Edite o arquivo `directspeed-auth/server.js` e localize o objeto `KEYS`:

```js
const KEYS = {
  "DS-NOME-2024-0001": {
    user: "Nome da pessoa",
    expiresAt: null,        // null = sem expiração
    active: true            // false = bloqueia o acesso
  },
  ...
};
```

### Como criar uma chave nova
Adicione uma entrada seguindo o padrão `DS-XXXX-AAAA-NNNN`.
Exemplo para adicionar Mariana:
```js
"DS-MARI-2024-0005": {
  user: "Mariana",
  expiresAt: "2025-12-31",  // expira no final do ano
  active: true
},
```

### Como bloquear um usuário
Mude `active: true` para `active: false`. O usuário não consegue mais logar.

### Como ver o log de acessos
Acesse no navegador:
```
https://SEU-SERVIDOR.onrender.com/admin/log
Header: x-admin-key: directspeed-admin
```
Ou use o Postman/Insomnia com esse header.

### Alterar a senha de admin
No `server.js`, troque `"directspeed-admin"` por uma senha sua:
```js
if (adminKey !== "minha-senha-secreta") { ... }
```

Após qualquer mudança no servidor, faça commit e push no GitHub — o Render redeploy automaticamente.

---

## PARTE 3 — INSTALAR A EXTENSÃO NO EDGE

### Passo 1 — Habilitar modo desenvolvedor
1. Abra o Edge e acesse: `edge://extensions`
2. Ative o botão **Modo de desenvolvedor** (canto superior direito)

### Passo 2 — Carregar a extensão
1. Clique em **Carregar sem compactação**
2. Selecione a pasta `directspeed-extension/`
3. A extensão aparece na barra de extensões com o ícone ciano

### Passo 3 — Fixar na barra
Clique no ícone de quebra-cabeça (extensões) e fixe o DirectSpeed para acesso rápido.

---

## PARTE 4 — USANDO A EXTENSÃO

### Login
1. Clique no ícone do DirectSpeed na barra do Edge
2. Digite a chave de acesso fornecida (formato DS-XXXX-XXXX-XXXX)
3. Clique em **Entrar** — a chave é validada no servidor
4. Se válida, o painel abre automaticamente

O login fica salvo. Na próxima abertura a extensão revalida automaticamente sem pedir a chave de novo (a menos que expire ou seja bloqueada).

---

### Aba DISPARO

**Passo a passo para enviar DMs:**

1. **Abrir o Instagram** — clique em **⬡ Instagram** (o Edge abre o Instagram na aba atual)
2. **Fazer login** no Instagram se necessário (só na primeira vez)
3. **Criar a mensagem** — escreva no campo Mensagem. Use `{user}` para mencionar automaticamente. Salve como template se quiser reutilizar.
4. **Carregar os leads** — cole os @ no campo Leads (um por linha) e clique em **+ Carregar**. O sistema remove automaticamente quem já foi enviado antes.
5. **Configurar delays** — recomendado mínimo 60s e máximo 180s para não parecer bot. Limite de 30 DMs por dia no início.
6. **Iniciar Missão** — clique no botão. O bot navega automaticamente em cada perfil, clica em Mensagem, digita e envia.
7. Para parar: clique em **⏸ Pausar**. Para retomar: **Iniciar Missão** novamente.

---

### Aba PROSPECÇÃO

**Busca por Nicho:**
1. Clique em um chip de exemplo ou digite seu nicho no campo
2. Clique em **Buscar** — o bot abre o Google e extrai @ do Instagram dos resultados
3. Perfis já enviados aparecem marcados (não são adicionados novamente)
4. Clique **+ Todos** para jogar todos na fila, ou **+** em cada card individualmente

**Validar Perfil:**
- Digite um @ para verificar se a conta existe, é pública e tem botão de mensagem ativo
- Útil antes de criar listas manualmente

---

### Aba EXTRATOR

1. Cole qualquer texto — resultado de pesquisa do Google, lista, bios, posts
2. O extrator encontra todos os @ automaticamente em tempo real
3. @ já enviados aparecem riscados
4. Ajuste filtros se quiser (mín. de caracteres, palavras para excluir)
5. Clique **→ Leads** para enviar direto para a fila de disparo

---

## DICAS IMPORTANTES

**Segurança da conta Instagram:**
- Nunca ultrapasse 40 DMs por dia
- Mantenha delays aleatórios (60-180 segundos)
- Prefira enviar em horários comerciais
- Se receber aviso do Instagram, pause por 24-48h

**Manutenção das chaves:**
- Crie chaves com data de expiração para usuários temporários
- Use `active: false` para pausar sem apagar
- Troque a senha admin regularmente

**Atualizar a extensão:**
- Edite os arquivos localmente
- Vá em `edge://extensions` e clique em ↺ (recarregar) na extensão

---

## PROBLEMAS COMUNS

| Problema | Solução |
|---|---|
| "Servidor de autenticação indisponível" | O Render free hiberna após 15 min. Aguarde 30s e tente de novo. |
| "Chave inválida" | Verifique se digitou corretamente. Chaves são case-insensitive mas devem ter o formato certo. |
| "Botão de mensagem não encontrado" | Perfil pode ser privado ou o Instagram mudou o layout. Use o Validador de Perfil. |
| Bot para sozinho | Verifique o limite diário configurado. |
| Extensão não aparece | Recarregue em `edge://extensions`. |
