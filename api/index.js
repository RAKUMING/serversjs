const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

// --- Variables para caché en memoria ---
let liquidationsCache = []; // Almacena los datos procesados [{time, timeShort, long, short}, ...]
let csvCache = "";          // Almacena el string CSV generado
let lastUpdateCache = null; // Almacena la fecha de la última actualización exitosa

// --- Función para obtener y procesar datos (reutilizable) ---
async function fetchAndProcessData() {
  console.log("Intentando obtener datos frescos de Coinalyze...");

  // Calculamos los timestamps (igual que antes)
  const now = new Date();
  now.setSeconds(0);
  now.setMilliseconds(0);
  now.setMinutes(now.getMinutes() - 1);
  const toTimestamp = Math.floor(now.getTime() / 1000);
  const fromTimestamp = toTimestamp - 24 * 60 * 60;
  const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=84bd6d2d-4045-4b53-8b61-151c618d4311&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error Coinalyze: ${response.status}`);
    const result = await response.json();

    // Procesamos los datos
    const newLiquidations = [];
    result.forEach(item => {
      if (item.history) {
        item.history.forEach(entry => {
          newLiquidations.push({
            time: new Date(entry.t * 1000).toISOString(),
            timeShort: new Date(entry.t * 1000).toLocaleString(),
            long: entry.l,
            short: entry.s
          });
        });
      }
    });

    // Ordenamos por tiempo DESCENDENTE
    newLiquidations.sort((a, b) => new Date(b.time) - new Date(a.time));

    // Creamos el CSV
    const csvHeader = "time,long,short";
    const csvBody = newLiquidations
                      .map(l => `${l.time},${l.long},${l.short}`)
                      .join("\n");
    const newCsv = `${csvHeader}\n${csvBody}`;

    // --- Actualizamos la caché ---
    liquidationsCache = newLiquidations;
    csvCache = newCsv;
    lastUpdateCache = new Date(); // Guardamos la fecha/hora de la actualización

    console.log(`Datos actualizados y cacheados. ${liquidationsCache.length} registros.`);
    return true; // Indica éxito

  } catch (error) {
    console.error("Error al obtener/procesar datos de Coinalyze:", error);
    // No limpiamos la caché aquí, podríamos seguir sirviendo datos viejos si es preferible a un error total
    return false; // Indica fallo
  }
}

// --- Ruta principal ---
app.get("/liquidaciones", async (req, res) => {
  const download = req.query.download;

  try {
    // --- PASO 2: Si se pide descargar ---
    if (download !== undefined) {
      console.log("Solicitud de descarga recibida.");
      // Si la caché CSV está vacía, intentar llenarla primero
      if (!csvCache) {
        console.log("Caché de descarga vacía, intentando obtener datos...");
        const success = await fetchAndProcessData();
        if (!success || !csvCache) { // Si falla la carga o sigue vacío
          return res.status(500).send("Error: No se pudieron obtener los datos para la descarga.");
        }
      } else {
        console.log("Sirviendo descarga desde caché.");
      }
      // Enviar el CSV cacheado
      res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
      res.setHeader("Content-Type", "text/csv");
      return res.send(csvCache);
    }

    // --- PASO 3: Si NO se pide descargar, verificar caché ---
    // Solo buscar datos nuevos si la caché de liquidaciones está vacía
    if (!liquidationsCache || liquidationsCache.length === 0) {
        // La línea "primero se borran los arrays" del flujo original no tiene sentido si ya están vacíos.
        // Simplemente procedemos a llenarlos si están vacíos.
        console.log("Caché de visualización vacía. Intentando obtener datos...");
        const success = await fetchAndProcessData();
         // Si falló la carga y la caché sigue vacía, mostrar error
        if (!success && (!liquidationsCache || liquidationsCache.length === 0)) {
             return res.status(500).send(`<h3>Error al obtener datos iniciales</h3><pre>No se pudo contactar a la API o procesar los datos.</pre>`);
        }
         // Si después de intentar cargar sigue vacía (caso raro, ej: API devuelve array vacío)
        if (!liquidationsCache || liquidationsCache.length === 0) {
             return res.send("<h2>Liquidaciones BTC - Últimas 24h</h2><p>No se encontraron datos de liquidaciones en el período consultado.</p>");
        }
    } else {
      console.log("Sirviendo visualización desde caché.");
    }

    // --- PASO 5: Responder con HTML (usando la caché) ---
    const tableHeaders = ["time", "long", "short"];
    let html = `<h2>Liquidaciones BTC - Últimas 24h</h2>
                <p>Última actualización de datos: ${lastUpdateCache ? lastUpdateCache.toISOString() : 'N/A'}</p>
                <p><a href="/liquidaciones?download=1">Descargar CSV</a></p>
                <table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; white-space: nowrap;">
                  <thead style="background-color: #f2f2f2;">
                    <tr>${tableHeaders.map(col => `<th style="padding: 2px 5px;">${col}</th>`).join('')}</tr>
                  </thead>
                  <tbody>`;

    liquidationsCache.forEach(l => {
        const rowData = [l.timeShort, l.long, l.short];
        html += `<tr>${rowData.map(col => `<td style="padding: 2px 5px;">${col}</td>`).join('')}</tr>`;
    });

    html += `</tbody></table>`;
    res.send(html);

  } catch (error) {
    // --- PASO 6: Manejo de errores generales ---
    console.error("Error general en /liquidaciones:", error);
    return res.status(500).send(`<h3>Error Interno del Servidor</h3><pre>${error.message}</pre>`);
  }
});

module.exports = app; // Asegúrate de exportar si es necesario para Vercel u otros entornos
