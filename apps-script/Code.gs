// Backend de "Recorrido" (Open Publicidad).
// Este script debe vivir DENTRO de un Google Sheet NUEVO y vacio (el "Sheet de datos"
// de Recorrido): Extensions > Apps Script, pegar este archivo completo.
// Ese Sheet nuevo NUNCA es el Inventario maestro: este script solo LEE el Inventario
// (por ID, de otro archivo) y ESCRIBE unicamente en su propio Sheet. Ver SETUP.md.

// ===================== CONFIG =====================

// ID del Google Sheet "Inventario Open" (catalogo maestro de sitios). Es el mismo
// spreadsheet que ya usa el equipo comercial; aqui solo se lee, nunca se escribe.
var INVENTARIO_SHEET_ID = '14_oUt1YYOtmQyRz_e9N5EOYRAz1K4UcGZiYBRDcbKZk';
var INVENTARIO_TAB = 'Inventario';

// PIN simple para que un ejecutivo cree un recorrido nuevo (no es login de Google: el
// objetivo es que cualquier ejecutivo de ventas lo use desde el celular sin fricción).
// El link que ve el CLIENTE (?recorrido=XXXX) nunca pide este PIN.
var PIN_EJECUTIVO = 'CAMBIA_ESTE_PIN';

var TABS = {
  RECORRIDOS: 'Recorridos',
  RESPUESTAS: 'Recorrido_Respuestas'
};

var HEADERS = {
  Recorridos: ['recorrido_id', 'nombre_cliente', 'ejecutivo', 'ciudad', 'ids_json', 'creado', 'estado'],
  Recorrido_Respuestas: ['id', 'recorrido_id', 'id_open', 'like', 'notas', 'autor', 'actualizado']
};

// ===================== SETUP (correr una sola vez desde el editor) =====================

function setupInicial() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) sheet = ss.insertSheet(tabName);
    var headers = HEADERS[tabName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  });
  var defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0) ss.deleteSheet(defaultSheet);
  Logger.log('Setup completo. Tabs Recorridos y Recorrido_Respuestas creados.');
}

// ===================== HTTP ENTRYPOINT =====================

// Todas las acciones son publicas a proposito (el link de cliente no debe pedir login);
// 'crearRecorrido' es la unica que pide PIN_EJECUTIVO adentro del payload.
function doPost(e) {
  var response;
  try {
    var body = JSON.parse(e.postData.contents);
    var result = routeAction(body.action, body.payload || {});
    response = { ok: true, data: result };
  } catch (err) {
    response = { ok: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var response;
  try {
    var action = e.parameter.action;
    var payload = {};
    if (action === 'getRecorrido') payload.recorrido_id = e.parameter.recorrido_id;
    if (action === 'buscarSitios') {
      payload.query = e.parameter.query || '';
    }
    var result = routeAction(action, payload);
    response = { ok: true, data: result };
  } catch (err) {
    response = { ok: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function routeAction(action, payload) {
  switch (action) {
    case 'buscarSitios': return buscarSitios(payload);
    case 'crearRecorrido': return crearRecorrido(payload);
    case 'getRecorrido': return getRecorrido(payload);
    case 'guardarRespuesta': return guardarRespuesta(payload);
    case 'finalizarRecorrido': return finalizarRecorrido(payload);
    default: throw new Error('Accion desconocida: ' + action);
  }
}

// ===================== HELPERS =====================

function getSheet(tabName) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
}

function appendRow(tabName, obj) {
  var sheet = getSheet(tabName);
  var headers = HEADERS[tabName];
  var row = headers.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; });
  sheet.appendRow(row);
}

function sheetToObjects(tabName) {
  var sheet = getSheet(tabName);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i].every(function (c) { return c === '' || c === null; })) continue;
    var obj = {};
    headers.forEach(function (h, idx) { obj[h] = values[i][idx]; });
    rows.push(obj);
  }
  return rows;
}

function nextId(prefix, tabName, idField) {
  var rows = sheetToObjects(tabName);
  var max = 0;
  rows.forEach(function (r) {
    var m = String(r[idField] || '').match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return prefix + (max + 1);
}

function isoNow() {
  return new Date().toISOString();
}

// ===================== INVENTARIO (lectura externa, solo lectura) =====================

// Fila 3 del tab "Inventario" trae los encabezados reales (las filas 1-2 son titulos de
// seccion agrupados). Nunca se expone Tarifa/Descuento/Costo: este app es para usarse
// frente al cliente durante el recorrido, no para negociar precio ahi mismo.
var CAMPOS_EXCLUIDOS_CLIENTE = ['Tarifa Proveedor', 'Descuento Proveedor %', 'Descuento Proveedor $', 'Tarifa con Descuento', 'Cuenta Costo'];

function catalogoInventario() {
  var ss = SpreadsheetApp.openById(INVENTARIO_SHEET_ID);
  var sheet = ss.getSheetByName(INVENTARIO_TAB);
  var values = sheet.getDataRange().getValues();
  var headers = values[2]; // fila 3 (indice 2)
  var rows = [];
  for (var i = 3; i < values.length; i++) {
    var fila = values[i];
    if (!fila[0]) continue; // sin ID OPEN, fila vacia o de relleno
    var obj = {};
    headers.forEach(function (h, idx) {
      // Algunos encabezados del Inventario traen espacios de mas (ej. "Latitud "):
      // se recortan aqui para que el resto del backend/frontend use nombres limpios.
      var key = String(h || '').trim();
      if (!key || CAMPOS_EXCLUIDOS_CLIENTE.indexOf(key) !== -1) return;
      obj[key] = fila[idx];
    });
    rows.push(obj);
  }
  return rows;
}

// Busqueda para la pantalla del ejecutivo (preseleccion): un solo texto libre contra ID,
// medio, soporte, vista, domicilio, referencia, ciudad y estado. Se quito el filtro de
// "Ciudad" por separado porque el Inventario guarda el municipio especifico (Zapopan, El
// Salto, Tlajomulco...) y no una zona metropolitana agrupada; con texto libre el ejecutivo
// puede escribir la ciudad si quiere, sin perder sitios por un filtro exacto equivocado.
function buscarSitios(payload) {
  var query = String(payload.query || '').toLowerCase().trim();
  var catalogo = catalogoInventario();
  if (!query) return catalogo.slice(0, 300);
  return catalogo.filter(function (s) {
    var texto = [s['ID OPEN'], s['Medio'], s['Soporte'], s['Vista'], s['Domicilio'],
      s['Referencia'], s['Ciudad o Localidad'], s['Estado']].join(' ').toLowerCase();
    return texto.indexOf(query) !== -1;
  }).slice(0, 300);
}

// ===================== RECORRIDOS =====================

function crearRecorrido(payload) {
  if (String(payload.pin || '') !== PIN_EJECUTIVO) throw new Error('PIN de ejecutivo incorrecto.');
  var idsSeleccionados = payload.ids_seleccionados || [];
  if (!idsSeleccionados.length) throw new Error('Selecciona al menos un sitio.');
  if (!payload.nombre_cliente) throw new Error('Falta el nombre del cliente.');

  var recorridoId = Utilities.getUuid().slice(0, 8);
  appendRow(TABS.RECORRIDOS, {
    recorrido_id: recorridoId,
    nombre_cliente: payload.nombre_cliente,
    ejecutivo: payload.ejecutivo || '',
    ciudad: payload.ciudad || '',
    ids_json: JSON.stringify(idsSeleccionados),
    creado: isoNow(),
    estado: 'Activo'
  });
  return { recorrido_id: recorridoId };
}

function getRecorrido(payload) {
  var recorridoId = payload.recorrido_id;
  var recorrido = sheetToObjects(TABS.RECORRIDOS).filter(function (r) {
    return String(r.recorrido_id) === String(recorridoId);
  })[0];
  if (!recorrido) throw new Error('Recorrido no encontrado. Revisa el link.');

  var idsSeleccionados = JSON.parse(recorrido.ids_json || '[]');
  var catalogo = catalogoInventario();
  var porId = {};
  catalogo.forEach(function (s) { porId[s['ID OPEN']] = s; });

  var sitios = idsSeleccionados
    .map(function (id) { return porId[id]; })
    .filter(function (s) { return !!s; });

  var respuestas = sheetToObjects(TABS.RESPUESTAS).filter(function (r) {
    return String(r.recorrido_id) === String(recorridoId);
  });

  return {
    recorrido_id: recorridoId,
    nombre_cliente: recorrido.nombre_cliente,
    ejecutivo: recorrido.ejecutivo,
    estado: recorrido.estado,
    sitios: sitios,
    respuestas: respuestas
  };
}

// Upsert: una respuesta por (recorrido_id, id_open). Cada swipe o nota nueva pisa la
// anterior del mismo sitio, para no acumular duplicados mientras el cliente cambia de
// opinion en vivo.
function guardarRespuesta(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var recorridoId = payload.recorrido_id;
    var idOpen = payload.id_open;
    if (!recorridoId || !idOpen) throw new Error('Falta recorrido_id o id_open.');

    var sheet = getSheet(TABS.RESPUESTAS);
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var colRecorrido = headers.indexOf('recorrido_id');
    var colId = headers.indexOf('id_open');

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][colRecorrido]) === String(recorridoId) && String(values[i][colId]) === String(idOpen)) {
        var updates = { like: payload.like, notas: payload.notas, autor: payload.autor, actualizado: isoNow() };
        Object.keys(updates).forEach(function (key) {
          if (updates[key] === undefined) return;
          var col = headers.indexOf(key);
          if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(updates[key]);
        });
        return { ok: true };
      }
    }

    appendRow(TABS.RESPUESTAS, {
      id: nextId('RR', TABS.RESPUESTAS, 'id'),
      recorrido_id: recorridoId,
      id_open: idOpen,
      like: payload.like === undefined ? '' : payload.like,
      notas: payload.notas || '',
      autor: payload.autor || '',
      actualizado: isoNow()
    });
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function finalizarRecorrido(payload) {
  var sheet = getSheet(TABS.RECORRIDOS);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var colId = headers.indexOf('recorrido_id');
  var colEstado = headers.indexOf('estado');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][colId]) === String(payload.recorrido_id)) {
      sheet.getRange(i + 1, colEstado + 1).setValue('Finalizado');
      return { ok: true };
    }
  }
  throw new Error('Recorrido no encontrado.');
}
