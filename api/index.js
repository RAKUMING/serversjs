const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

app.get("/liquidaciones", async (req, res) => {
  const download = req.query.download;

  // Calculamos los timestamps
  const now = new Date();
  now.setSeconds(0);
  now.setMilliseconds(0);
  now.setMinutes(now.getMinutes() - 1);

  const toTimestamp = Math.floor(now.getTime() / 1000);
  const fromTimestamp = toTimestamp - 24 * 60 * 60;

  const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=84bd6d2d-4045-4b53-8b61-151c618d4311&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false`;

  try {
    // Siempre hacemos nueva petición a la API
    console.log("Obteniendo datos frescos de Coinalyze...");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error Coinalyze: ${response.status}`);
    const result = await response.json();

    // Procesamos los datos
    const liquidations = [];
    result.forEach(item => {
      if (item.history) {
        item.history.forEach(entry => {
          liquidations.push({
            // Usar formato más corto para la tabla, ISO para CSV
            time: new Date(entry.t * 1000).toISOString(),
            timeShort: new Date(entry.t * 1000).toLocaleString(), // Formato local para tabla
            long: entry.l,  // Liquidaciones LONG (traders que apostaron al alza)
            short: entry.s  // Liquidaciones SHORT (traders que apostaron a la baja)
          });
        });
      }
    });

    // Ordenamos por tiempo ASCENDENTE (para la tabla HTML)
    liquidations.sort((a, b) => new Date(a.time) - new Date(b.time));
    const lastUpdate = new Date().toISOString();

    // --- Inicio Cambios para CSV ---

    // Creamos el CSV con las columnas renombradas (usando ISO time)
    const csvHeader = "time,long,short";
    // Creamos el cuerpo del CSV ordenando los datos DESCENDENTE (más reciente primero)
    // Usamos slice() para no modificar el array original 'liquidations' que está ordenado ascendente para la tabla
    const csvBody = liquidations
                      .slice() // Creamos una copia superficial
                      .reverse() // Revertimos la copia (ahora es descendente)
                      .map(l => `${l.time},${l.long},${l.short}`) // Mapeamos la copia revertida
                      .join("\n");
    const csv = `${csvHeader}\n${csvBody}`;

    // --- Fin Cambios para CSV ---

    // Si se solicita descarga
    if (download !== undefined) {
      res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
      res.setHeader("Content-Type", "text/csv");
      return res.send(csv); // Enviamos el CSV ordenado descendente
    }

    // Mostramos HTML con tabla (usa el array 'liquidations' original ordenado ASCENDENTE)
    const tableHeaders = ["time", "long", "short"]; // Headers para la tabla
    let html = `<h2>Liquidaciones BTC - Últimas 24h</h2>
                <p>Última actualización: ${lastUpdate}</p>
                <p><a href="/liquidaciones?download=1">Descargar CSV</a></p>
                <table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; white-space: nowrap;">
                  <thead style="background-color: #f2f2f2;">
                    <tr>${tableHeaders.map(col => `<th style="padding: 2px 5px;">${col}</th>`).join('')}</tr>
                  </thead>
                  <tbody>`;

    // Usar los datos procesados para la tabla HTML (orden ASCENDENTE)
    liquidations.forEach(l => {
        // Usar timeShort para la tabla, mantener valores numéricos
        const rowData = [l.timeShort, l.long, l.short];
        html += `<tr>${rowData.map(col => `<td style="padding: 2px 5px;">${col}</td>`).join('')}</tr>`;
    });


    html += `</tbody></table>`;

    res.send(html); // Enviamos el HTML con la tabla ordenada ascendente

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send(`<h3>Error al obtener datos</h3><pre>${error.message}</pre>`);
  }
});

module.exports = app;
