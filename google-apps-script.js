// ═══════════════════════════════════════════════════════════
// Google Apps Script — API REST para Dashboard de Indicações
// ═══════════════════════════════════════════════════════════
//
// INSTRUÇÕES DE DEPLOY:
// 1. Abra sua planilha Google Sheets
// 2. Vá em Extensões → Apps Script
// 3. Cole este código no editor
// 4. Clique em "Implantar" → "Nova implantação"
// 5. Tipo: "App da Web"
// 6. Executar como: "Eu"
// 7. Quem tem acesso: "Qualquer pessoa"
// 8. Copie a URL gerada e cole no CONFIG.API_URL do dashboard
//
// IMPORTANTE: Após qualquer alteração neste código,
// faça uma NOVA implantação (não "editar implantação existente").
//
// SETUP INICIAL: Execute a função setupSheet() uma vez
// para criar a aba com cabeçalhos formatados.
// ═══════════════════════════════════════════════════════════

const SHEET_NAME = "Indicações";
const RANKING_SHEET_NAME = "Ranking";
const API_TOKEN = ""; // Opcional: defina um token para proteger a API

// Ordem das colunas na planilha (A=0, B=1, ...)
// IMPORTANTE: este mapa precisa refletir EXATAMENTE a ordem dos cabeçalhos
// na planilha. Linha 1 da aba "Indicações" deve ser:
// A Colaborador_Indicação | B Paciente_Fechou | C Telefone_Paciente |
// D Valor_Contrato | E Data_Fechamento | F Presente |
// G Paciente_Indicador | H Telefone_Indicador | I Endereço |
// J Data_Ligação_Confirmação | K Data_Envio_Presente |
// L Data_Confirmação_Recebimento | M Código_Rastreio_Correios
const COLUMNS = {
  colaborador_indicacao: 0,
  paciente_fechou: 1,
  telefone_paciente: 2,
  valor_contrato: 3,
  data_fechamento: 4,
  presente: 5,
  paciente_indicador: 6,
  telefone_indicador: 7,
  endereco: 8,
  data_ligacao_confirmacao: 9,
  data_envio_presente: 10,
  data_confirmacao_recebimento: 11,
  codigo_rastreio_correios: 12,
};

const COL_KEYS = Object.keys(COLUMNS);

// ═══════════════════════════════════════════════════════════
// GET — Leitura de dados
// ═══════════════════════════════════════════════════════════
function doGet(e) {
  const callback = e.parameter.callback; // suporte a JSONP
  if (API_TOKEN && e.parameter.token !== API_TOKEN) {
    return jsonResponse({ error: "Unauthorized" }, callback);
  }
  try {
    const data = getSheetData();
    return jsonResponse({
      success: true,
      data: data,
      count: data.length,
      timestamp: new Date().toISOString(),
    }, callback);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, callback);
  }
}

// ═══════════════════════════════════════════════════════════
// POST — Criar, atualizar, deletar registros
// ═══════════════════════════════════════════════════════════
function doPost(e) {
  try {
    // Suporta tanto JSON puro quanto URLSearchParams com campo "payload"
    let body;
    if (e.postData.type === "application/x-www-form-urlencoded") {
      body = JSON.parse(e.parameter.payload || "{}");
    } else {
      body = JSON.parse(e.postData.contents);
    }
    if (API_TOKEN && body.token !== API_TOKEN) {
      return jsonResponse({ error: "Unauthorized" });
    }

    switch (body.action) {
      case "create":
        return handleCreate(body.record);
      case "update":
        return handleUpdate(body.rowIndex, body.record);
      case "update_field":
        return handleUpdateField(body.rowIndex, body.field, body.value);
      case "delete":
        return handleDelete(body.rowIndex);
      default:
        return jsonResponse({ success: false, error: "Ação desconhecida: " + body.action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ─── CRIAR NOVO REGISTRO ──────────────────────────────────
function handleCreate(record) {
  if (!record || !record.paciente_fechou) {
    return jsonResponse({ success: false, error: "Campo 'paciente_fechou' é obrigatório." });
  }

  const sheet = getSheet();
  const row = [];

  for (const key of COL_KEYS) {
    let val = record[key] || "";

    if (key === "valor_contrato" && val !== "") {
      val = parseFloat(String(val).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
    }

    if (key.startsWith("data_") && val && typeof val === "string") {
      const parts = val.split("-");
      if (parts.length === 3) {
        val = new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }

    row.push(val);
  }

  sheet.appendRow(row);
  const newRowIndex = sheet.getLastRow() - 2;

  return jsonResponse({
    success: true,
    message: "Registro criado com sucesso.",
    rowIndex: newRowIndex,
  });
}

// ─── ATUALIZAR REGISTRO COMPLETO ──────────────────────────
function handleUpdate(rowIndex, record) {
  if (rowIndex === undefined || rowIndex === null) {
    return jsonResponse({ success: false, error: "rowIndex é obrigatório." });
  }

  const sheet = getSheet();
  const sheetRow = rowIndex + 2;

  if (sheetRow < 2 || sheetRow > sheet.getLastRow()) {
    return jsonResponse({ success: false, error: "Índice fora do intervalo." });
  }

  for (const key of COL_KEYS) {
    if (record.hasOwnProperty(key)) {
      let val = record[key];
      const col = COLUMNS[key] + 1;

      if (key === "valor_contrato" && val !== "") {
        val = parseFloat(String(val).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      }

      if (key.startsWith("data_") && val && typeof val === "string") {
        const parts = val.split("-");
        if (parts.length === 3) val = new Date(parts[0], parts[1] - 1, parts[2]);
      }

      sheet.getRange(sheetRow, col).setValue(val === undefined ? "" : val);
    }
  }

  return jsonResponse({ success: true, message: "Registro atualizado com sucesso." });
}

// ─── ATUALIZAR CAMPO INDIVIDUAL ───────────────────────────
function handleUpdateField(rowIndex, field, value) {
  if (rowIndex === undefined || !field) {
    return jsonResponse({ success: false, error: "rowIndex e field são obrigatórios." });
  }
  if (!COLUMNS.hasOwnProperty(field)) {
    return jsonResponse({ success: false, error: "Campo inválido: " + field });
  }

  const sheet = getSheet();
  const sheetRow = rowIndex + 2;

  if (sheetRow < 2 || sheetRow > sheet.getLastRow()) {
    return jsonResponse({ success: false, error: "Índice fora do intervalo." });
  }

  let val = value;
  if (field === "valor_contrato" && val !== "") {
    val = parseFloat(String(val).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  }
  if (field.startsWith("data_") && val && typeof val === "string") {
    const parts = val.split("-");
    if (parts.length === 3) val = new Date(parts[0], parts[1] - 1, parts[2]);
  }

  sheet.getRange(sheetRow, COLUMNS[field] + 1).setValue(val || "");
  return jsonResponse({ success: true, message: `Campo '${field}' atualizado.` });
}

// ─── DELETAR REGISTRO ─────────────────────────────────────
function handleDelete(rowIndex) {
  if (rowIndex === undefined || rowIndex === null) {
    return jsonResponse({ success: false, error: "rowIndex é obrigatório." });
  }

  const sheet = getSheet();
  const sheetRow = rowIndex + 2;

  if (sheetRow < 2 || sheetRow > sheet.getLastRow()) {
    return jsonResponse({ success: false, error: "Índice fora do intervalo." });
  }

  sheet.deleteRow(sheetRow);
  return jsonResponse({ success: true, message: "Registro removido." });
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Aba "' + SHEET_NAME + '" não encontrada.');
  return sheet;
}

function getSheetData() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const range = sheet.getRange(2, 1, lastRow - 1, COL_KEYS.length);
  const values = range.getValues();

  return values
    .map((row, idx) => {
      if (!row[COLUMNS.paciente_fechou]) return null;

      const obj = { _rowIndex: idx };

      for (const [key, col] of Object.entries(COLUMNS)) {
        let val = row[col];

        if (key.startsWith("data_") && val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else if (key.startsWith("data_")) {
          val = val ? String(val) : "";
        }

        if (key === "valor_contrato") {
          val = parseFloat(String(val).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        }

        obj[key] = val;
      }
      return obj;
    })
    .filter(Boolean);
}

function jsonResponse(data, callback) {
  if (callback) {
    // JSONP: envolve a resposta com o nome da função callback
    const output = callback + "(" + JSON.stringify(data) + ");";
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── SETUP INICIAL: Rodar 1x para criar aba formatada ────
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  sheet.getRange(1, 1, 1, COL_KEYS.length).setValues([COL_KEYS]);

  const headerRange = sheet.getRange(1, 1, 1, COL_KEYS.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#4285F4");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setHorizontalAlignment("center");

  for (let i = 1; i <= COL_KEYS.length; i++) {
    sheet.setColumnWidth(i, 180);
  }

  sheet.setFrozenRows(1);
  Logger.log("Planilha configurada com sucesso!");
}

function testAPI() {
  const data = getSheetData();
  Logger.log("Total: " + data.length);
  if (data.length > 0) Logger.log(JSON.stringify(data[0], null, 2));
}

// ═══════════════════════════════════════════════════════════
// MENU CUSTOMIZADO + ABA RANKING
// ═══════════════════════════════════════════════════════════
//
// onOpen() é executado automaticamente quando alguém abre a planilha.
// Ele adiciona o menu "🎁 Reconhecimento" na barra do Sheets para
// que a Juliana possa atualizar a aba Ranking com 1 clique.
// ═══════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🎁 Reconhecimento")
    .addItem("Criar / atualizar aba Ranking", "setupRankingSheet")
    .addSeparator()
    .addItem("Configurar aba Indicações (1ª vez)", "setupSheet")
    .addToUi();
}

// ─── CRIA OU ATUALIZA A ABA "Ranking" ─────────────────────
// Gera cabeçalho + 3 fórmulas que se atualizam sozinhas:
//   A: Indicador (lista única ordenada A→Z)
//   B: Qtd Indicações (COUNTIF)
//   C: Faturamento (SUMIF — formatado como R$)
// Pode ser rodada quantas vezes quiser; sobrescreve a aba.
function setupRankingSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RANKING_SHEET_NAME);

  if (sheet) {
    sheet.clear();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(RANKING_SHEET_NAME);
  }

  // Detecta separador correto: pt-BR usa ";", en-US usa ","
  const locale = (ss.getSpreadsheetLocale() || "").toLowerCase();
  const sep = locale.indexOf("en") === 0 ? "," : ";";

  // Aspas simples no nome da aba para suportar acento ("Indicações")
  const src = "'" + SHEET_NAME.replace(/'/g, "''") + "'";

  // Cabeçalhos
  sheet.getRange(1, 1, 1, 3)
    .setValues([["Indicador", "Qtd Indicações", "Faturamento"]]);

  // Fórmulas
  sheet.getRange("A2").setFormula(
    '=SORT(UNIQUE(FILTER(' + src + '!G2:G' + sep + ' ' + src + '!G2:G<>""))' + sep + ' 1' + sep + ' TRUE)'
  );
  sheet.getRange("B2").setFormula(
    '=ARRAYFORMULA(IF(A2:A=""' + sep + ' ""' + sep + ' COUNTIF(' + src + '!G:G' + sep + ' A2:A)))'
  );
  sheet.getRange("C2").setFormula(
    '=ARRAYFORMULA(IF(A2:A=""' + sep + ' ""' + sep + ' SUMIF(' + src + '!G:G' + sep + ' A2:A' + sep + ' ' + src + '!D:D)))'
  );

  // Estilo do cabeçalho
  sheet.getRange(1, 1, 1, 3)
    .setFontWeight("bold")
    .setBackground("#4285F4")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  // Coluna C como moeda
  sheet.getRange("C2:C").setNumberFormat('"R$" #,##0.00');

  // Larguras + congelar topo
  sheet.setColumnWidth(1, 320);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 160);
  sheet.setFrozenRows(1);
  sheet.setActiveSelection(sheet.getRange("A1"));

  // Feedback (só funciona se chamado pela UI; ignora se rodado pelo editor)
  try {
    SpreadsheetApp.getUi().alert(
      'Aba "Ranking" pronta! Os números se atualizam automaticamente quando você adicionar linhas em "Indicações".'
    );
  } catch (e) {
    Logger.log('Aba "Ranking" criada/atualizada com sucesso.');
  }
}
