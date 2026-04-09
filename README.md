# 📊 Gestão de Indicações — Dashboard

Dashboard operacional para gestão de indicações com entrada de dados integrada.  
Cadastre, edite e acompanhe indicações pelo app — tudo salva automaticamente no Google Sheets.

---

## 🚀 Deploy em Produção (3 passos)

### Passo 1 — Google Sheets + Apps Script

1. Crie uma **nova planilha** no Google Sheets
2. Vá em **Extensões → Apps Script**
3. Apague o código padrão e cole o conteúdo de `google-apps-script.js`
4. Salve (Ctrl+S)
5. No menu **Executar**, selecione a função `setupSheet` e clique em **Executar**
   - Isso cria automaticamente a aba "Indicações" com os cabeçalhos formatados
   - Autorize o acesso quando solicitado
6. Clique em **Implantar → Nova implantação**
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
7. Clique em **Implantar** e copie a URL gerada

### Passo 2 — Configurar o Dashboard

Abra o arquivo `index.html` e edite o bloco CONFIG no topo do script:

```javascript
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/SUA_URL_AQUI/exec",
  API_TOKEN: "",          // Opcional
  POLL_INTERVAL: 300000,  // 5 min
  DEMO_MODE: false,       // ← MUDE PARA false
};
```

### Passo 3 — Deploy no GitHub Pages

```bash
# Criar repositório
git init gestao-indicacoes
cd gestao-indicacoes

# Copiar arquivos
cp /caminho/para/index.html .
cp /caminho/para/google-apps-script.js .

# Commit e push
git add .
git commit -m "Dashboard de indicações v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gestao-indicacoes.git
git push -u origin main
```

No GitHub:
1. Vá em **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / pasta **/ (root)**
4. Salve

Seu dashboard estará em: `https://SEU_USUARIO.github.io/gestao-indicacoes/`

---

## 🔐 Segurança (Opcional)

Para proteger a API com token:

1. No `google-apps-script.js`, defina:
```javascript
const API_TOKEN = "meu_token_secreto_123";
```

2. No `index.html`, configure:
```javascript
API_TOKEN: "meu_token_secreto_123",
```

3. **Reimplante** o Apps Script (Nova implantação)

---

## 📁 Arquivos

| Arquivo | Onde usar | Descrição |
|---------|-----------|-----------|
| `index.html` | GitHub Pages | Dashboard completo (frontend) |
| `google-apps-script.js` | Google Apps Script | API REST com CRUD |
| `dashboard-indicacoes.jsx` | Claude.ai (preview) | Versão React para preview |

---

## ⚠️ Após Alterar o Apps Script

Sempre que modificar o `google-apps-script.js`:
1. Faça uma **Nova implantação** (não "Editar implantação")
2. Copie a **nova URL** gerada
3. Atualize o `CONFIG.API_URL` no `index.html`

Isso é necessário porque o Google cacheia a versão anterior.

---

## 📱 Funcionalidades

- **➕ Cadastrar** indicações pelo formulário no app
- **✏️ Editar** registros existentes
- **⚡ Ação rápida** para avançar status com 1 clique
- **🗑 Excluir** registros
- **📊 Dashboard** com KPIs, gráficos, funil
- **🏆 Ranking** de indicadores
- **🔍 Filtros** por status, indicador, período e busca
- **📱 Responsivo** mobile + desktop
- **⚠️ Gargalos** detectados automaticamente
# gestao-indicacoes
