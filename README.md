# 🎁 Programa de Reconhecimento por Indicação

Sistema de acompanhamento para o programa de reconhecimento a pacientes que indicam novos pacientes que fecham contrato. A Juliana alimenta semanalmente e o dashboard permite acompanhar todo o fluxo de agradecimento.

## 📋 O Processo

Quando um paciente indicado **fecha contrato**, inicia-se o fluxo de reconhecimento ao indicador:

1. **📞 Ligar e parabenizar** — Ligar para o indicador, agradecer pela indicação e confirmar o endereço
2. **🎁 Enviar presente** — Enviar o presente de reconhecimento
3. **📦 Confirmar entrega** — Ligar para saber se o indicador recebeu o presente
4. **✅ Concluído** — Reconhecimento finalizado

---

## 🚀 Como Configurar

### 1. Google Sheets + Apps Script
1. Crie uma planilha → **Extensões → Apps Script**
2. Cole o código de `google-apps-script.js`
3. Execute `setupSheet` (cria a aba com cabeçalhos)
4. **Implantar → Nova implantação → App da Web**
5. Copie a URL gerada

### 2. Conectar o Dashboard
No `index.html`, edite:
```javascript
const CONFIG = {
  API_URL: "SUA_URL_AQUI",
  DEMO_MODE: false,
};
```

### 3. GitHub Pages
Push para o repositório e ative Pages em Settings → Pages → main / root.

---

## 📁 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Dashboard completo (frontend) |
| `google-apps-script.js` | API REST para Google Sheets |
