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
const API_TOKEN = ""; // Opcional: defina um token para proteger a API

// Ordem das colunas na planilha (A=0, B=1, ...)
const COLUMNS = {
  paciente_fechou: 0,
  telefone_paciente: 1,
  valor_contrato: 2,
  data_fechamento: 3,
  paciente_indicador: 4,
  telefone_indicador: 5,
  endereco: 6,
  data_ligacao_confirmacao: 7,
  data_envio_presente: 8,
  data_confirmacao_recebimento: 9,
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
