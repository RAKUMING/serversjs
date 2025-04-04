const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

// --- Middlewares ---

// 1. Configurar CORS para permitir solicitudes desde cualquier origen.
//    Ajusta 'origin' si quieres restringirlo a dominios específicos.
app.use(cors({ origin: "*" }));

// 2. Middleware ESENCIAL para prevenir el caché en TODAS las respuestas del servidor.
//    Instruye a Vercel, CDNs, Proxies y Navegadores a NO almacenar la respuesta.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache'); // Compatibilidad HTTP/1.0
  res.set('Expires', '0'); // Compatibilidad Proxies antiguos
  res.set('Surrogate-Control', 'no-store'); // Para CDNs / Proxies intermediarios
  // 'X-Accel-Expires': '0' // Específico para Nginx (opcional si no usas Nginx directamente)
  next();
});

// --- Rutas ---

// Ruta raíz para verificación simple
app.get("/", (req, res) => {
  res.send(`Servidor Proxy Coinalyze funcionando en Vercel - ${new Date().toISOString()}`);
});

// Función para obtener datos FRESCOS de la API de Coinalyze
async function fetchCoinalyzeData() {
  // Generar valores únicos para romper caché en la URL (aunque las cabeceras son lo principal)
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const cacheBuster = new Date().getTime();

  // Calcular rango de tiempo: últimas 24 horas hasta el inicio del minuto actual
  const now = new Date();
  now.setSeconds(0);
  now.setMilliseconds(0);
  const toTimestamp = Math.floor(now.getTime() / 1000);
  const fromTimestamp = toTimestamp - (24 * 60 * 60); // 24 horas antes

  // IMPORTANTE: Usar variable de entorno para la API Key en producción
  const apiKey = process.env.COINALYZE_API_KEY || "84bd6d2d-4045-4b53-8b61-151c618d4311"; // ¡Mejor usar variable de entorno!

  const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false&nonce=${nonce}&cache_busting=${cacheBuster}`;

  console.log(`[${new Date().toISOString()}] Iniciando fetch a Coinalyze...`);
  console.log(`URL: ${url}`);
  console.log(`Rango calculado: ${new Date(fromTimestamp * 1000).toISOString()} a ${new Date(toTimestamp * 1000).toISOString()}`);

  try {
    const response = await fetch(url, {
      // Cabeceras para la solicitud SALIENTE a Coinalyze (instrucción adicional anti-cache)
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      // Establecer un timeout razonable (ej. 15 segundos)
      timeout: 15000 // 15 segundos en milisegundos
    });

    console.log(`[${new Date().toISOString()}] Respuesta recibida de Coinalyze: Status ${response.status}`);

    if (!response.ok) {
      // Intentar leer el cuerpo del error si existe
      let errorBody = 'No details';
      try {
        errorBody = await response.text();
      } catch (e) { /* Ignorar si no se puede leer el cuerpo */ }
      throw new Error(`Error en API Coinalyze: ${response.status} ${response.statusText}. Body: ${errorBody}`);
    }

    const data = await response.json();
    console.log(`[${new Date().toISOString()}] Datos JSON de Coinalyze parseados.`);
    return data;

  } catch (error) {
    // Manejar errores de red o timeouts
    if (error.type === 'request-timeout') {
       console.error(`[${new Date().toISOString()}] Error: Timeout al contactar Coinalyze.`);
       throw new Error('Timeout al contactar la API de Coinalyze.');
    }
     console.error(`[${new Date().toISOString()}] Error en fetchCoinalyzeData:`, error);
    // Re-lanzar el error para que sea capturado por el manejador de la ruta
    throw error;
  }
}

// Ruta para descargar los datos FRESCOS de liquidaciones
app.get("/liquidaciones/download", async (req, res) => {
  console.log(`\n[${new Date().toISOString()}] Petición recibida en /liquidaciones/download`);
  try {
    // 1. Llamar a la función que SIEMPRE hace la petición LIVE a Coinalyze
    const responseData = await fetchCoinalyzeData();

    // 2. Procesar la respuesta para generar el nombre del archivo
    let lastTimestamp = 0;
    if (responseData && responseData.data && responseData.data.length > 0) {
      responseData.data.forEach(item => {
        if (item.history && item.history.length > 0) {
          // Encontrar el timestamp más reciente en el historial de este item
          const maxTsInHistory = item.history.reduce((max, current) => Math.max(max, current.t), 0);
          if (maxTsInHistory > lastTimestamp) {
            lastTimestamp = maxTsInHistory;
          }
        }
      });
    }

    // Usar timestamp 0 si no se encontraron datos, o el más reciente encontrado
    const lastDate = new Date((lastTimestamp || Math.floor(Date.now() / 1000)) * 1000);
    const formattedDate = lastDate.toISOString()
      .replace('T', '_')
      .replace(/\.\d+Z$/, '') // Eliminar milisegundos y Z
      .replace(/:/g, '-'); // Reemplazar ':' por '-' para compatibilidad

    const filename = `@liquidaciones_${formattedDate}.json`;

    console.log(`[${new Date().toISOString()}] Nombre de archivo generado: ${filename} (Timestamp base: ${lastTimestamp})`);

    // 3. Establecer cabeceras para forzar la descarga
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    // Las cabeceras anti-cache ya están aplicadas por el middleware global,
    // pero se pueden repetir aquí por claridad o especificidad si fuera necesario.
    // res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    // res.setHeader('Pragma', 'no-cache');
    // res.setHeader('Expires', '0');

    // 4. Enviar los datos FRESCOS obtenidos de Coinalyze como respuesta JSON
    console.log(`[${new Date().toISOString()}] Enviando respuesta JSON para descarga.`);
    res.json(responseData);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR en /liquidaciones/download:`, error);
    res.status(500).json({
      error: "Error al obtener o procesar los datos de liquidaciones",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manejador para solicitudes OPTIONS (Preflight de CORS)
// Necesario si el cliente (navegador) envía cabeceras personalizadas o usa métodos complejos.
app.options("*", cors()); // Dejar que el middleware cors maneje las opciones

// Exportar la app para Vercel (Vercel maneja el `listen`)
module.exports = app;

// --- Para desarrollo local ---
// Descomenta estas líneas si quieres probarlo localmente con `node tu_archivo.js`
/*
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') { // Evitar que se ejecute en Vercel
  app.listen(PORT, () => {
    console.log(`Servidor local corriendo en http://localhost:${PORT}`);
    console.log("¡IMPORTANTE! La API Key está hardcodeada. Usa una variable de entorno (COINALYZE_API_KEY) en producción.");
  });
}
*/
// Auto-updated at Fri Apr  4 01:46:07 UTC 2025
console.log('File updated at Fri Apr  4 01:46:07 UTC 2025');
