# Setup — Recorrido OPEN

App web para armar y correr un "Recorrido" con un cliente: el ejecutivo preselecciona
sitios (IDs OPEN), se generan en un mapa, y durante la visita el cliente (o el
ejecutivo, cada uno desde su celular) califica cada sitio con like/dislike y deja
notas. Al final se genera un resumen imprimible con los sitios que gustaron.

## 1. Crear el Sheet de datos propio de Recorrido

Este Sheet **no es** el Inventario maestro — es solo donde se guardan los
recorridos creados y las respuestas (likes/notas) de cada cliente.

1. Crea un Google Sheet nuevo y vacío, llámalo "Recorrido - Data".
2. Extensions > Apps Script.
3. Borra el contenido de `Code.gs` que trae por default y pega el contenido completo
   de [`apps-script/Code.gs`](apps-script/Code.gs) de este proyecto.
4. En la parte de arriba del script, cambia:
   - `PIN_EJECUTIVO`: pon el PIN que usarán los ejecutivos para crear recorridos
     (no es su contraseña de Google, es solo un candado simple).
5. Corre la función `setupInicial` una vez desde el editor (▶️ junto al selector de
   función, elige `setupInicial`). Te va a pedir autorización — es normal, es tu
   propio script. Esto crea las pestañas `Recorridos` y `Recorrido_Respuestas`.

## 2. Publicar el script como Web App

1. En el editor de Apps Script: **Deploy > New deployment**.
2. Tipo: **Web app**.
3. Execute as: **Me**. Who has access: **Anyone** (así el cliente puede abrir el
   link sin iniciar sesión de Google).
4. Deploy. Copia la URL que termina en `/exec`.
5. Pégala en [`js/config.js`](js/config.js) en `APPS_SCRIPT_URL`.

Cada vez que edites `Code.gs` después de este primer deploy, tienes que hacer
**Deploy > Manage deployments > ✏️ (editar) > New version** para que los cambios
se reflejen en la URL publicada (crear un deployment nuevo te daría otra URL).

## 3. Publicar el frontend

Mismo patrón que `venue-reservas` y `Dashboard Comercial`: este es un sitio estático
(`index.html` + `css/` + `js/` + `assets/`), se puede servir desde GitHub Pages o
cualquier hosting estático. Sube la carpeta `Recorrido/` completa.

## 4. Permisos sobre el Inventario maestro

El backend **lee** (nunca escribe) el spreadsheet de Inventario Open
(`14_oUt1YYOtmQyRz_e9N5EOYRAz1K4UcGZiYBRDcbKZk`, tab `Inventario`) directamente por
su ID. La cuenta de Google que hizo el deploy del script (el "Execute as: Me") debe
tener al menos acceso de **lectura** a ese Sheet.

## Decisiones de diseño a propósito

- **No se muestra Tarifa/Costo/Descuento** en ningún lado de esta app: es una
  herramienta para usarse frente al cliente durante la visita, no para negociar
  precio ahí mismo. Si en el futuro se necesita, se agrega como vista aparte solo
  para el ejecutivo.
- **El link del cliente no pide login de Google** — solo el PIN del ejecutivo al
  crear el recorrido. Así el cliente abre el link y entra directo desde su celular.
- **Tráfico estimado**: viene de `OPEN/Trafico Sitios/piloto_resultados.csv`
  (10 sitios piloto, embebido en `js/trafico_piloto.js`). Solo se muestra en los
  sitios que tienen ese dato; en el resto la caja de tráfico se oculta. Cuando el
  piloto de tráfico crezca, solo hay que actualizar ese archivo.
- **Perfil de gusto en vivo**: se calcula en el navegador a partir de los sitios con
  like (categoría/vista/medio), sin pegarle al backend — es puro gusto del momento,
  no hace falta guardarlo.

## Pendiente / ideas para v2

- Overlay de mapa de calor de tráfico general de la ciudad (no solo pines del piloto).
- "Preview de marca": subir el logo del cliente y sobreponerlo en la foto del sitio.
- Multi-usuario: comparar de forma explícita en qué coincide/discrepa el ejecutivo
  vs. el cliente cuando cada uno swipea por separado.
- Fotos reales por sitio (hoy la ficha no trae foto — está en los PDFs de "Ficha" de
  la hoja Disponibilidad, no en Inventario).
