const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

app.use(cors({ origin: "*" }));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

app.get("/api", async (req, res) => {
  try {
    const freshData = await fetchFreshCoinalyzeData();
    let lastTimestamp = 0;
    if (freshData && freshData.data && Array.isArray(freshData.data) && freshData.data.length > 0) {
      freshData.data.forEach(item => {
        if (item.history && Array.isArray(item.history) && item.history.length > 0) {
          const maxTsInHistory = item.history.reduce((max, current) => {
            const ts = Number(current.t);
            return !isNaN(ts) ? Math.max(max, ts) : max;
          }, 0);
          lastTimestamp = Math.max(lastTimestamp, maxTsInHistory);
        }
      });
    }
    const referenceTimestamp = lastTimestamp || Math.floor(Date.now() / 1000);
    const lastDate = new Date(referenceTimestamp * 1000);
    const formattedDate = lastDate.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    res.send(`Servidor Proxy Coinalyze funcionando en Vercel - ${new Date().toISOString()} - Última liquidación: ${lastDate.toLocaleString()}`);
  } catch (error) {
    res.status(500).json({
      error: "Error al obtener datos de Coinalyze.",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

async function fetchFreshCoinalyzeData() {
  const nonce = Math.random().toString(36).substring(2, 15);
  const cacheBuster = Date.now();
  const now = new Date();
  now.setSeconds(0);
  now.setMilliseconds(0);
  const toTimestamp = Math.floor(now.getTime() / 1000);
  const fromTimestamp = toTimestamp - (24 * 60 * 60);
  const apiKey = process.env.COINALYZE_API_KEY;
  if (!apiKey) {
    throw new Error("Configuración incompleta: falta la API Key de Coinalyze.");
  }
  const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false&nonce=${nonce}&cache_busting=${cacheBuster}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      timeout: 20000
    });
    if (!response.ok) {
      throw new Error(`Error en API Coinalyze: Status ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Error al obtener datos de Coinalyze: ${error.message}`);
  }
}

app.get("/api/liquidaciones/download", async (req, res) => {
  try {
    const freshData = await fetchFreshCoinalyzeData();
    let lastTimestamp = 0;
    if (freshData && freshData.data && Array.isArray(freshData.data) && freshData.data.length > 0) {
      freshData.data.forEach(item => {
        if (item.history && Array.isArray(item.history) && item.history.length > 0) {
          const maxTsInHistory = item.history.reduce((max, current) => {
            const ts = Number(current.t);
            return !isNaN(ts) ? Math.max(max, ts) : max;
          }, 0);
          lastTimestamp = Math.max(lastTimestamp, maxTsInHistory);
        }
      });
    }
    const referenceTimestamp = lastTimestamp || Math.floor(Date.now() / 1000);
    const lastDate = new Date(referenceTimestamp * 1000);
    const formattedDate = lastDate.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    const filename = `liquidaciones_${formattedDate}.json`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(freshData);
  } catch (error) {
    res.status(500).json({
      error: "Error interno del servidor al procesar la solicitud de liquidaciones.",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.options("*", cors());

module.exports = app;
