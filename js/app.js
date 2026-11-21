(function () {
  'use strict';

  var CONFIG = window.APP_CONFIG;
  var TRAFICO = window.TRAFICO_PILOTO || {};

  var state = {
    seleccionAdmin: {},      // id_open -> sitio (mientras el ejecutivo arma el recorrido)
    recorridoId: null,
    sitios: [],              // sitios del recorrido activo
    respuestas: {},          // id_open -> {like, notas}
    autor: null,
    map: null,
    markers: {},             // id_open -> leaflet marker
    fichaActivaId: null
  };

  // ===================== API =====================

  function apiGet(action, params) {
    var url = CONFIG.APPS_SCRIPT_URL + '?action=' + encodeURIComponent(action);
    Object.keys(params || {}).forEach(function (k) {
      url += '&' + k + '=' + encodeURIComponent(params[k]);
    });
    return fetch(url).then(function (r) { return r.json(); }).then(unwrap);
  }

  function apiPost(action, payload) {
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: action, payload: payload })
    }).then(function (r) { return r.json(); }).then(unwrap);
  }

  function unwrap(res) {
    if (!res.ok) throw new Error(res.error || 'Error desconocido.');
    return res.data;
  }

  // ===================== Util =====================

  function showView(id) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    document.getElementById(id).classList.add('active');
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function pedirAutor() {
    var guardado = localStorage.getItem('recorrido_autor');
    if (guardado) return guardado;
    var nombre = prompt('¿Cuál es tu nombre? (para identificar tus notas en el recorrido)') || 'Invitado';
    localStorage.setItem('recorrido_autor', nombre);
    return nombre;
  }

  // ===================== ADMIN: seleccion de sitios =====================

  function initAdmin() {
    var btnBuscar = document.getElementById('btn-buscar');
    btnBuscar.addEventListener('click', buscarSitios);
    document.getElementById('q-texto').addEventListener('keyup', function (e) {
      if (e.key === 'Enter') buscarSitios();
    });
    document.getElementById('btn-crear-recorrido').addEventListener('click', crearRecorridoAdmin);
    renderSeleccionChips();
  }

  function buscarSitios() {
    var query = document.getElementById('q-texto').value.trim();
    var lista = document.getElementById('resultados-lista');
    lista.innerHTML = '<div class="sitio-row">Buscando…</div>';
    apiGet('buscarSitios', { query: query }).then(function (sitios) {
      if (!sitios.length) {
        lista.innerHTML = '<div class="sitio-row">Sin resultados. Prueba otra ciudad o palabra clave.</div>';
        return;
      }
      lista.innerHTML = '';
      sitios.forEach(function (s) {
        var id = s['ID OPEN'];
        var row = document.createElement('label');
        row.className = 'sitio-row';
        var checked = state.seleccionAdmin[id] ? 'checked' : '';
        row.innerHTML =
          '<input type="checkbox" data-id="' + id + '" ' + checked + '>' +
          '<span><span class="id">' + id + '</span><br>' +
          '<span class="detalle">' + [s['Medio'], s['Soporte'], s['Vista'], s['Ciudad o Localidad']].filter(Boolean).join(' · ') + '</span></span>';
        row.querySelector('input').addEventListener('change', function (e) {
          if (e.target.checked) state.seleccionAdmin[id] = s;
          else delete state.seleccionAdmin[id];
          renderSeleccionChips();
        });
        lista.appendChild(row);
      });
    }).catch(function (err) { lista.innerHTML = '<div class="sitio-row">Error: ' + err.message + '</div>'; });
  }

  function renderSeleccionChips() {
    var ids = Object.keys(state.seleccionAdmin);
    document.getElementById('contador-seleccion').textContent = ids.length;
    document.getElementById('btn-crear-recorrido').disabled = ids.length === 0;

    var cont = document.getElementById('seleccionados-lista');
    if (!ids.length) {
      cont.innerHTML = '<div class="sitio-row">Todavía no seleccionas ningún sitio.</div>';
      return;
    }
    cont.innerHTML = ids.map(function (id) {
      var s = state.seleccionAdmin[id];
      return '<div class="sitio-row">' +
        '<button type="button" class="btn-quitar" data-id="' + id + '" title="Quitar">✕</button>' +
        '<span><span class="id">' + id + '</span><br>' +
        '<span class="detalle">' + [s['Medio'], s['Soporte'], s['Vista'], s['Ciudad o Localidad']].filter(Boolean).join(' · ') + '</span></span>' +
        '</div>';
    }).join('');
    cont.querySelectorAll('.btn-quitar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        delete state.seleccionAdmin[id];
        renderSeleccionChips();
        // Si ese sitio sigue visible en los resultados de busqueda, desmarca su checkbox.
        var checkbox = document.querySelector('#resultados-lista input[data-id="' + CSS.escape(id) + '"]');
        if (checkbox) checkbox.checked = false;
      });
    });
  }

  function crearRecorridoAdmin() {
    var nombreCliente = document.getElementById('f-cliente').value.trim();
    var ejecutivo = document.getElementById('f-ejecutivo').value.trim();
    var pin = document.getElementById('f-pin').value.trim();
    var ids = Object.keys(state.seleccionAdmin);

    if (!nombreCliente) { toast('Falta el nombre del cliente.'); return; }
    if (!ids.length) { toast('Selecciona al menos un sitio.'); return; }

    apiPost('crearRecorrido', {
      nombre_cliente: nombreCliente,
      ejecutivo: ejecutivo,
      ids_seleccionados: ids,
      pin: pin
    }).then(function (data) {
      var url = location.origin + location.pathname + '?recorrido=' + data.recorrido_id;
      var box = document.getElementById('link-generado');
      box.innerHTML = '<strong>Recorrido creado.</strong><br>Comparte este link (ejecutivo y cliente, cada uno en su celular):<br>' +
        '<div class="link-box">' + url + '</div>' +
        '<button class="btn-secondary" id="btn-copiar" style="margin-top:8px;">Copiar link</button> ' +
        '<button class="btn-secondary" id="btn-abrir" style="margin-top:8px;">Abrir ahora</button>';
      document.getElementById('btn-copiar').addEventListener('click', function () {
        navigator.clipboard.writeText(url);
        toast('Link copiado.');
      });
      document.getElementById('btn-abrir').addEventListener('click', function () {
        location.href = url;
      });
    }).catch(function (err) { toast('Error: ' + err.message); });
  }

  // ===================== RECORRIDO: mapa + swipe =====================

  function initRecorrido(recorridoId) {
    state.recorridoId = recorridoId;
    state.autor = pedirAutor();
    showView('view-recorrido');

    apiGet('getRecorrido', { recorrido_id: recorridoId }).then(function (data) {
      state.sitios = data.sitios;
      (data.respuestas || []).forEach(function (r) {
        state.respuestas[r.id_open] = { like: r.like, notas: r.notas };
      });
      document.getElementById('nombre-cliente-top').textContent = data.nombre_cliente;
      renderMapa();
      renderPerfil();
      actualizarProgreso();
    }).catch(function (err) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif;">' +
        'No se pudo cargar el recorrido.<br>' + err.message + '</div>';
    });

    document.getElementById('btn-finalizar').addEventListener('click', finalizarRecorrido);
    document.getElementById('btn-cerrar-ficha').addEventListener('click', cerrarFicha);
    document.getElementById('btn-like').addEventListener('click', function () { marcarLike(true); });
    document.getElementById('btn-dislike').addEventListener('click', function () { marcarLike(false); });
    document.getElementById('btn-duda').addEventListener('click', function () { marcarLike('duda'); });
    document.getElementById('ficha-notas').addEventListener('input', debounce(guardarNotas, 700));
    document.getElementById('btn-ver-lista').addEventListener('click', toggleLista);
  }

  function emojiPorMedio(sitio) {
    var m = String(sitio['Medio'] || '').toLowerCase();
    if (m.indexOf('pantalla') !== -1 || m.indexOf('digital') !== -1) return '📺';
    if (m.indexOf('aeropuerto') !== -1) return '✈️';
    if (m.indexOf('unipolar') !== -1 || m.indexOf('valla') !== -1) return '🪧';
    if (m.indexOf('transporte') !== -1 || m.indexOf('parabus') !== -1) return '🚌';
    return '📍';
  }

  // Tri-estado: true/'true' = like, false/'false' = dislike, 'duda' = "tengo que pensarlo
  // mas", ''/undefined = todavia sin calificar.
  function estadoDe(idOpen) {
    var r = state.respuestas[idOpen];
    if (!r || r.like === '' || r.like === undefined || r.like === null) return '';
    if (r.like === 'duda') return 'duda';
    return (r.like === true || r.like === 'true') ? 'like' : 'dislike';
  }

  function claseLike(idOpen) {
    var estado = estadoDe(idOpen);
    if (estado === 'like') return 'liked';
    if (estado === 'dislike') return 'disliked';
    if (estado === 'duda') return 'duda';
    return '';
  }

  function iconoEstado(idOpen) {
    var estado = estadoDe(idOpen);
    if (estado === 'like') return '❤️';
    if (estado === 'dislike') return '👎';
    if (estado === 'duda') return '🤔';
    return '⚪️';
  }

  function renderMapa() {
    state.map = L.map('map', { zoomControl: true }).setView([20.6597, -103.3496], 12);
    // OpenStreetMap.org bloquea su tile server para apps fuera de uso evaluativo (y desde
    // file:// sin Referer, lo bloquea seguro). CartoDB tambien empezo a pedir API key en su
    // capa gratuita. Esri/ArcGIS si sirve tiles gratis sin registro para este tipo de uso.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri — Source: Esri, HERE, Garmin, USGS, NGA, EPA, NPS',
      maxZoom: 19
    }).addTo(state.map);

    var bounds = [];
    state.sitios.forEach(function (sitio) {
      var lat = parseFloat(sitio['Latitud']);
      var lon = parseFloat(sitio['Longitud']);
      if (!lat || !lon) return;
      var idOpen = sitio['ID OPEN'];
      var icon = L.divIcon({
        className: '',
        html: '<div class="pin-emoji ' + claseLike(idOpen) + '" id="pin-' + idOpen + '">' + emojiPorMedio(sitio) + '</div>',
        iconSize: [30, 30]
      });
      var marker = L.marker([lat, lon], { icon: icon }).addTo(state.map);
      marker.on('click', function () { abrirFicha(idOpen); });
      state.markers[idOpen] = marker;
      bounds.push([lat, lon]);
    });
    if (bounds.length) state.map.fitBounds(bounds, { padding: [30, 30] });
  }

  function actualizarPin(idOpen) {
    var el = document.getElementById('pin-' + idOpen);
    if (el) el.className = 'pin-emoji ' + claseLike(idOpen);
  }

  function abrirFicha(idOpen) {
    var sitio = state.sitios.filter(function (s) { return s['ID OPEN'] === idOpen; })[0];
    if (!sitio) return;
    state.fichaActivaId = idOpen;

    document.getElementById('ficha-id').textContent = idOpen;
    document.getElementById('ficha-subtitulo').textContent =
      [sitio['Medio'], sitio['Soporte'], sitio['Vista']].filter(Boolean).join(' · ');

    var specs = [
      ['Domicilio', sitio['Domicilio'] || sitio['Referencia']],
      ['Ciudad', sitio['Ciudad o Localidad']],
      ['Material', sitio['Material']],
      ['Base', sitio['Base']],
      ['Altura', sitio['Altura']],
      ['Total M2', sitio['Total M2']],
      ['# de Medios', sitio['# de Medios']],
      ['Vigencia', sitio['Vigencia']]
    ].filter(function (p) { return p[1]; });

    document.getElementById('ficha-specs').innerHTML = specs.map(function (p) {
      return '<div class="spec"><b>' + p[0] + '</b>' + p[1] + '</div>';
    }).join('');

    var linkPdf = document.getElementById('ficha-pdf-link');
    if (sitio['URL']) {
      linkPdf.href = sitio['URL'];
      linkPdf.style.display = 'block';
    } else {
      linkPdf.style.display = 'none';
    }

    var trafico = TRAFICO[idOpen];
    var cajaTrafico = document.getElementById('ficha-trafico');
    if (trafico) {
      cajaTrafico.style.display = 'block';
      cajaTrafico.innerHTML = '<b>' + Number(trafico.impactos_dia).toLocaleString('es-MX') + ' impactos/día</b>' +
        Number(trafico.vehiculos_dia).toLocaleString('es-MX') + ' vehículos/día estimados en esta vialidad';
    } else {
      cajaTrafico.style.display = 'none';
    }

    var r = state.respuestas[idOpen] || {};
    document.getElementById('ficha-notas').value = r.notas || '';
    var estado = estadoDe(idOpen);
    document.getElementById('btn-like').classList.toggle('sel', estado === 'like');
    document.getElementById('btn-dislike').classList.toggle('sel', estado === 'dislike');
    document.getElementById('btn-duda').classList.toggle('sel', estado === 'duda');

    document.getElementById('ficha-overlay').classList.add('active');
  }

  function cerrarFicha() {
    document.getElementById('ficha-overlay').classList.remove('active');
    state.fichaActivaId = null;
  }

  function marcarLike(valor) {
    var idOpen = state.fichaActivaId;
    if (!idOpen) return;
    var actual = state.respuestas[idOpen] || {};
    var nuevo = actual.like === valor ? '' : valor; // tocar otra vez quita la marca
    state.respuestas[idOpen] = { like: nuevo, notas: actual.notas || '' };

    document.getElementById('btn-like').classList.toggle('sel', nuevo === true);
    document.getElementById('btn-dislike').classList.toggle('sel', nuevo === false);
    document.getElementById('btn-duda').classList.toggle('sel', nuevo === 'duda');
    actualizarPin(idOpen);
    renderPerfil();
    actualizarProgreso();
    renderLista();

    apiPost('guardarRespuesta', {
      recorrido_id: state.recorridoId, id_open: idOpen, like: nuevo,
      notas: state.respuestas[idOpen].notas, autor: state.autor
    }).catch(function (err) { toast('No se guardó: ' + err.message); });
  }

  function guardarNotas() {
    var idOpen = state.fichaActivaId;
    if (!idOpen) return;
    var texto = document.getElementById('ficha-notas').value;
    var actual = state.respuestas[idOpen] || {};
    state.respuestas[idOpen] = { like: actual.like, notas: texto };
    apiPost('guardarRespuesta', {
      recorrido_id: state.recorridoId, id_open: idOpen, notas: texto, autor: state.autor
    }).catch(function (err) { toast('No se guardó: ' + err.message); });
  }

  // ---------- Perfil de gusto en vivo ----------

  function renderPerfil() {
    var cuentas = {};
    state.sitios.forEach(function (sitio) {
      var r = state.respuestas[sitio['ID OPEN']];
      if (!r || !(r.like === true || r.like === 'true')) return;
      [sitio['Categorías '] || sitio['Tipo Categoría'], sitio['Vista'], sitio['Medio']].forEach(function (tag) {
        if (!tag) return;
        cuentas[tag] = (cuentas[tag] || 0) + 1;
      });
    });
    var top = Object.keys(cuentas).sort(function (a, b) { return cuentas[b] - cuentas[a]; }).slice(0, 6);
    var cont = document.getElementById('perfil-bar');
    if (!top.length) {
      cont.innerHTML = '<span class="perfil-chip">Dale ❤️ a los sitios que te gusten…</span>';
      return;
    }
    cont.innerHTML = '<span class="perfil-chip">Te gusta:</span>' +
      top.map(function (t) { return '<span class="perfil-chip">' + t + '</span>'; }).join('');
  }

  function actualizarProgreso() {
    var vistos = state.sitios.filter(function (s) { return estadoDe(s['ID OPEN']) !== ''; }).length;
    document.getElementById('progreso-top').textContent = vistos + ' de ' + state.sitios.length + ' sitios vistos';
  }

  // ---------- Lista de sitios (alterna con el mapa) ----------

  function toggleLista() {
    var lista = document.getElementById('lista-sitios');
    var mapa = document.getElementById('map');
    var activa = lista.classList.toggle('active');
    mapa.style.display = activa ? 'none' : 'block';
    document.getElementById('btn-ver-lista').textContent = activa ? '🗺️ Mapa' : '📋 Lista';
    if (activa) {
      renderLista();
      if (state.map) setTimeout(function () { state.map.invalidateSize(); }, 50);
    }
  }

  function renderLista() {
    var cont = document.getElementById('lista-sitios');
    if (!cont.classList.contains('active')) return;
    cont.innerHTML = state.sitios.map(function (s) {
      var idOpen = s['ID OPEN'];
      return '<div class="lista-item" data-id="' + idOpen + '">' +
        '<span class="estado-icono">' + iconoEstado(idOpen) + '</span>' +
        '<span><span class="info-id">' + idOpen + ' — ' + [s['Medio'], s['Soporte'], s['Vista']].filter(Boolean).join(' · ') + '</span>' +
        '<div class="info-dir">' + (s['Domicilio'] || s['Referencia'] || '') + ', ' + (s['Ciudad o Localidad'] || '') + '</div></span>' +
        '</div>';
    }).join('');
    cont.querySelectorAll('.lista-item').forEach(function (item) {
      item.addEventListener('click', function () { abrirFicha(item.getAttribute('data-id')); });
    });
  }

  // ---------- Cierre / resumen ----------

  var GRUPOS_RESUMEN = [
    { key: 'like', clase: 'like', titulo: '❤️ Les gustó', vacio: 'Ningún sitio quedó marcado con like.' },
    { key: 'duda', clase: 'duda', titulo: '🤔 Lo están pensando', vacio: 'Ningún sitio quedó en duda.' },
    { key: 'dislike', clase: 'dislike', titulo: '👎 No les gustó', vacio: 'Ningún sitio quedó descartado.' }
  ];

  function finalizarRecorrido() {
    apiPost('finalizarRecorrido', { recorrido_id: state.recorridoId }).catch(function () {});

    document.getElementById('resumen-cliente').textContent = document.getElementById('nombre-cliente-top').textContent;

    var porGrupo = { like: [], duda: [], dislike: [] };
    state.sitios.forEach(function (s) {
      var estado = estadoDe(s['ID OPEN']);
      if (porGrupo[estado]) porGrupo[estado].push(s);
    });

    document.getElementById('resumen-contenido').innerHTML = GRUPOS_RESUMEN.map(function (g) {
      var sitios = porGrupo[g.key];
      var cuerpo = sitios.length
        ? sitios.map(function (s) { return tarjetaResumen(s, g.clase); }).join('')
        : '<div class="resumen-vacio">' + g.vacio + '</div>';
      return '<div class="resumen-grupo">' +
        '<div class="resumen-grupo-header ' + g.clase + '">' + g.titulo + '<span class="n">' + sitios.length + '</span></div>' +
        cuerpo +
        '</div>';
    }).join('');

    showView('view-resumen');
  }

  function tarjetaResumen(s, clase) {
    var r = state.respuestas[s['ID OPEN']] || {};
    return '<div class="resumen-sitio ' + clase + '">' +
      '<div class="id">' + s['ID OPEN'] + ' — ' + [s['Medio'], s['Soporte'], s['Vista']].filter(Boolean).join(' · ') + '</div>' +
      '<div class="dir">' + (s['Domicilio'] || s['Referencia'] || '') + ', ' + (s['Ciudad o Localidad'] || '') + '</div>' +
      (r.notas ? '<div class="notas-txt">“' + r.notas + '”</div>' : '') +
      '</div>';
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  // ===================== Arranque =====================

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-imprimir').addEventListener('click', function () { window.print(); });

    var params = new URLSearchParams(location.search);
    var recorridoId = params.get('recorrido');
    if (recorridoId) {
      initRecorrido(recorridoId);
    } else {
      showView('view-admin');
      initAdmin();
    }
  });
})();
