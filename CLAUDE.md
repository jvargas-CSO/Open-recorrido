# Recorrido

App web para los "Recorridos" de ventas: el ejecutivo lleva a un cliente a conocer
sitios (espectaculares/pantallas) en persona, antes era con fichas técnicas impresas;
esta app lo digitaliza y le mete capas de datos y gamificación.

- Frontend estático (HTML/CSS/JS vanilla + Leaflet para el mapa), mismo patrón que
  `../venue-reservas/` y `../Dashboard Comercial/`.
- Backend: Google Apps Script bound a un Sheet propio ("Recorrido - Data", NO el
  Inventario maestro) que lee el Inventario de OPEN por ID (solo lectura) y guarda
  los recorridos + respuestas (like/dislike, notas) del cliente.
- Ver [`SETUP.md`](SETUP.md) para desplegar (hay que crear el Sheet propio y publicar
  el Apps Script como Web App — mismos pasos que venue-reservas).
- Fuente de datos de sitios: Inventario Open (Google Sheet
  `14_oUt1YYOtmQyRz_e9N5EOYRAz1K4UcGZiYBRDcbKZk`, tab `Inventario`), con Tarifa/Costo
  excluidos a propósito (ver razones en SETUP.md).
- Tráfico estimado: solo cobertura piloto (10 sitios) de `../Trafico Sitios/`.

## Estado

En desarrollo — v1 recién armada (selección de sitios, mapa, ficha técnica, swipe
like/dislike con perfil de gusto en vivo, overlay de tráfico piloto, resumen
imprimible al cierre). Falta: deploy real (crear el Sheet "Recorrido - Data" y
publicar el Apps Script — ver SETUP.md), probar en campo con un recorrido real,
fotos por sitio.
