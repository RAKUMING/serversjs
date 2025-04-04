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
            time: new Date(entry.t * 1000).toISOString(),
            long: entry.l,  // Liquidaciones LONG (traders que apostaron al alza)
            short: entry.s  // Liquidaciones SHORT (traders que apostaron a la baja)
          });
        });
      }
    });

    // Ordenamos por tiempo
    liquidations.sort((a, b) => new Date(a.time) - new Date(b.time));
    const lastUpdate = new Date().toISOString();

    // Creamos el CSV con las columnas renombradas
    const csvHeader = "time,long,short";
    const csvBody = liquidations.map(l => `${l.time},${l.long},${l.short}`).join("\n");
    const csv = `${csvHeader}\n${csvBody}`;

    // Si se solicita descarga
    if (download !== undefined) {
      res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
      res.setHeader("Content-Type", "text/csv");
      return res.send(csv);
    }

    // Mostramos HTML con tabla
    const lines = csv.split("\n");
    let html = `<h2>Liquidaciones BTC - Últimas 24h</h2>
                <p>Última actualización: ${lastUpdate}</p>
                <p><a href="/liquidaciones?download=1">Descargar CSV</a></p>
                <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
                  <thead style="background-color: #f2f2f2;">
                    <tr>${lines[0].split(',').map(col => `<th>${col}</th>`).join('')}</tr>
                  </thead>
                  <tbody>`;

    for (let i = 1; i < lines.length; i++) {
      html += `<tr>${lines[i].split(',').map(col => `<td>${col}</td>`).join('')}</tr>`;
    }

    html += `</tbody></table>`;

    res.send(html);

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send(`<h3>Error al obtener datos</h3><pre>${error.message}</pre>`);
  }
});

module.exports = app;
