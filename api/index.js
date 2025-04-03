const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

// Configurar CORS para permitir todas las conexiones
app.use(cors({ origin: "*" }));

// Middleware para prevenir la caché en todas las respuestas
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '-1');
  res.set('Surrogate-Control', 'no-store');
  res.set('X-Accel-Expires', '0');  // Para Nginx y otros proxies
  next();
});

// Ruta principal para verificar si el servidor está funcionando
app.get("/", (req, res) => {
  res.send(`Servidor funcionando en Vercel - Proxy para API Coinalyze - ${new Date().toISOString()}`);
});

// Función para obtener datos frescos de la API de Coinalyze
async function fetchCoinalyzeData() {
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const now = new Date();
  now.setSeconds(0);
  now.setMilliseconds(0);

  const toTimestamp = Math.floor(now.getTime() / 1000);
  const fromTimestamp = toTimestamp - (24 * 60 * 60);

  console.log(`Rango de tiempo calculado:`);
  console.log(`Desde: ${new Date(fromTimestamp * 1000).toISOString()}`);
  console.log(`Hasta: ${new Date(toTimestamp * 1000).toISOString()} (último minuto completo)`);

  const timestamp = new Date().getTime();  // Utilizamos un timestamp para romper la caché
  const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=84bd6d2d-4045-4b53-8b61-151c618d4311&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false&nonce=${nonce}&cache_busting=${timestamp}`;

  console.log(`Haciendo solicitud a Coinalyze [${nonce}]: ${new Date().toISOString()}`);
  console.log(`URL: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache, no-store', // Asegurarse de no cachear la respuesta
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`Error en la API de Coinalyze: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Ruta para descargar los datos frescos de liquidaciones
app.get("/liquidaciones/download", async (req, res) => {
  try {
    const responseData = await fetchCoinalyzeData();
    
    // Obtener el último timestamp de los datos de liquidaciones
    let lastTimestamp = 0;

    if (responseData.data && responseData.data.length > 0) {
      responseData.data.forEach(item => {
        if (item.history && item.history.length > 0) {
          // Ordenar por timestamp en orden descendente y tomar el más reciente
          const sortedHistory = [...item.history].sort((a, b) => b.t - a.t);
          const highestTimestamp = sortedHistory[0].t;

          if (highestTimestamp > lastTimestamp) {
            lastTimestamp = highestTimestamp;
          }
        }
      });
    }

    const lastDate = new Date(lastTimestamp * 1000);
    const formattedDate = lastDate.toISOString()
      .replace('T', '_')
      .replace(/\.\d+Z$/, '')
      .replace(/:/g, '-');

    const filename = `liquidaciones_btc_${formattedDate}.json`;

    console.log(`Nombre de archivo generado: ${filename}`);
    console.log(`Basado en el timestamp: ${lastTimestamp} (${lastDate.toISOString()})`);

    // Forzar descarga del archivo
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Enviar los datos como un archivo para descargar
    res.json(responseData);
  } catch (error) {
    console.error("Error en la solicitud:", error);
    res.status(500).json({
      error: "Error al obtener los datos para descarga",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Habilitar preflight requests para CORS (si es necesario)
app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.send();
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app;
