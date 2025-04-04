const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

// Cache temporal en memoria
let cache = {
  csv: "",
  txt: "",
  liquidations: [],
  lastUpdate: null
};

app.get("/liquidaciones", async (req, res) => {
  const download = req.query.download;

  // Si hay ?download, generar archivo .txt desde cache si ya existe
  if (download !== undefined && cache.txt) {
    res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.txt"`);
    res.setHeader("Content-Type", "text/plain");
    return res.send(cache.txt);
  }

  // Si no hay datos en cache, hacer fetch
  if (cache.liquidations.length === 0) {
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

      // Procesar datos y formatear
      const liquidations = [];

      result.forEach(item => {
        if (item.history) {
          item.history.forEach(entry => {
            liquidations.push({
              timestamp: entry.t,
              readable: new Date(entry.t * 1000).toISOString(),
              size: entry.s,
              price: entry.p,
              side: entry.m ? "SELL" : "BUY"
            });
          });
        }
      });

      // Ordenar por timestamp asc
      liquidations.sort((a, b) => a.timestamp - b.timestamp);
      cache.liquidations = liquidations;
      cache.lastUpdate = new Date().toISOString();

      // Generar CSV
      const csvHeader = "Timestamp ISO, Size, Price, Side";
      const csvBody = liquidations.map(l => `${l.readable}, ${l.size}, ${l.price}, ${l.side}`).join("\n");
      cache.csv = `${csvHeader}\n${csvBody}`;

      // Generar texto plano para ?download
      cache.txt = `Liquidaciones BTC (últimas 24h)\nGenerado: ${cache.lastUpdate}\n\n` +
                  liquidations.map(l => `${l.readable}: ${l.size} contratos [${l.side}]`).join("\n");

    } catch (error) {
      console.error("Error al obtener liquidaciones:", error);
      return res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${error.message}</pre>`);
    }
  }

  // Mostrar datos en HTML leyendo del CSV
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
});

module.exports = app;
