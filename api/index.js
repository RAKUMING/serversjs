const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

let cache = {
  csv: "",
  liquidations: [],
  lastUpdate: null
};

app.get("/liquidaciones", async (req, res) => {
  const download = req.query.download;

  // Resetear el caché completamente en cada visita
  cache = {
    csv: "",
    liquidations: [],
    lastUpdate: null
  };

  // Obtener datos frescos de la API
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

    const liquidations = [];

    result.forEach(item => {
      if (item.history) {
        item.history.forEach(entry => {
          liquidations.push({
            timestamp: entry.t,
            readable: new Date(entry.t * 1000).toISOString(),
            size: entry.s,
            loss: entry.l
          });
        });
      }
    });

    liquidations.sort((a, b) => a.timestamp - b.timestamp);
    cache.liquidations = liquidations;
    cache.lastUpdate = new Date().toISOString();

    // Crear CSV
    const csvHeader = "Timestamp ISO, Size, Loss";
    const csvBody = liquidations.map(l => `${l.readable}, ${l.size}, ${l.loss}`).join("\n");
    cache.csv = `${csvHeader}\n${csvBody}`;

    // Si ?download está presente, enviar CSV como archivo
    if (download !== undefined) {
      res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
      res.setHeader("Content-Type", "text/csv");
      return res.send(cache.csv);
    }

    // Mostrar HTML con tabla
    const lines = cache.csv.split("\n");
    let html = `<h2>Liquidaciones BTC - Últimas 24h</h2><p>Última actualización: ${cache.lastUpdate}</p>`;
    html += `<table border="1" cellpadding="4" cellspacing="0" style="font-family: monospace;">`;
    html += `<tr><th>${lines[0].split(", ").join("</th><th>")}</th></tr>`;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(", ");
      html += `<tr><td>${cols.join("</td><td>")}</td></tr>`;
    }
    html += `</table>`;

    res.send(html);

  } catch (error) {
    console.error("Error al obtener liquidaciones:", error);
    return res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${error.message}</pre>`);
  }
});

module.exports = app;
