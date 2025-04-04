const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

// Cache en memoria
const cache = {
  liquidations: [],
  lastUpdate: null,
};

// Ruta principal: HTML o archivo .txt si ?download
app.get("/liquidaciones", async (req, res) => {
  const download = req.query.download;

  // Rango de tiempo: últimos 24h
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

    // Procesar liquidaciones
    const allLiquidations = [];

    result.forEach(item => {
      if (item.history) {
        item.history.forEach(entry => {
          allLiquidations.push({
            timestamp: entry.t,
            size: entry.s,
          });
        });
      }
    });

    // Ordenar y guardar en cache
    allLiquidations.sort((a, b) => a.timestamp - b.timestamp);
    cache.liquidations = allLiquidations;
    cache.lastUpdate = new Date().toISOString();

    if (download !== undefined) {
      // Descargar como archivo .txt
      let output = `Liquidaciones BTC (últimas 24h) - Generado: ${cache.lastUpdate}\n\n`;
      cache.liquidations.forEach(l => {
        const dateStr = new Date(l.timestamp * 1000).toISOString();
        output += `${dateStr}: ${l.size} contratos\n`;
      });

      res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${toTimestamp}.txt"`);
      res.setHeader("Content-Type", "text/plain");
      res.send(output);
    } else {
      // Respuesta HTML
      let html = `<h2>Liquidaciones BTC - Últimas 24h</h2>`;
      html += `<p>Consulta generada: ${cache.lastUpdate}</p>`;
      html += `<ul style="font-family: monospace;">`;
      cache.liquidations.forEach(l => {
        const dateStr = new Date(l.timestamp * 1000).toISOString();
        html += `<li>${dateStr}: ${l.size} contratos</li>`;
      });
      html += `</ul>`;
      res.send(html);
    }
  } catch (error) {
    console.error("Error al obtener liquidaciones:", error);
    res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${error.message}</pre>`);
  }
});

module.exports = app;
