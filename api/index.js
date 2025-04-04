const express = require("express");
// Asegúrate de tener node-fetch v2 instalado (npm install node-fetch@2)
// o ajusta si usas una versión diferente o un polyfill.
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

// --- Middlewares ---

// 1. Configurar CORS: Permite solicitudes desde cualquier origen.
//    Ideal para una API pública. Restringe 'origin' si es necesario.
app.use(cors({ origin: "*" }));

// 2. Middleware Anti-Caché GLOBAL: Se aplica a TODAS las respuestas de este servidor.
//    Instruye a Vercel, CDNs, Proxies y Navegadores a NUNCA almacenar en caché
//    la respuesta que este servidor envía al cliente. ¡Esencial para datos frescos!
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Aplicando cabeceras NO-CACHE a la respuesta para ${req.method} ${req.path}`);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache'); // Para compatibilidad HTTP/1.0
  res.set('Expires', '0');       // Para compatibilidad con proxies antiguos
  res.set('Surrogate-Control', 'no-store'); // Específico para CDNs / Proxies intermedios como Vercel Edge
  next();
});

// --- Rutas ---

// Ruta raíz para verificación simple
app.get("/", (req, res) => {
  // La fecha aquí se actualiza en cada petición porque el código se ejecuta de nuevo.
  res.send(`Servidor Proxy Coinalyze funcionando en Vercel - ${new Date().toISOString()}`);
});

// Función ASÍNCRONA para obtener datos FRESCOS de Coinalyze *AHORA MISMO*
async function fetchFreshCoinalyzeData() {
  // Generar valores únicos para la URL (medida extra anti-cache, aunque las cabeceras son clave)
  const nonce = Math.random().toString(36).substring(2, 15);
  const cacheBuster = Date.now(); // Usar Date.now() es más simple que new Date().getTime()

  // Calcular rango de tiempo: últimas 24 horas hasta el inicio del minuto actual
  const now = new Date();
  now.setSeconds(0);
  now.setMilliseconds(0);
  const toTimestamp = Math.floor(now.getTime() / 1000);
  const fromTimestamp = toTimestamp - (24 * 60 * 60); // 24 horas antes

  // --- ¡¡¡MUY IMPORTANTE: USA VARIABLES DE ENTORNO PARA LA API KEY!!! ---
  // Nunca dejes claves secretas directamente en el código fuente.
  // Configúralas en Vercel (Project Settings -> Environment Variables).
  const apiKey = process.env.COINALYZE_API_KEY;
  if (!apiKey) {
    console.error(`[${new Date().toISOString()}] ¡ERROR CRÍTICO! La variable de entorno COINALYZE_API_KEY no está definida.`);
    // Lanzar un error aquí previene hacer la llamada sin clave
    throw new Error("Configuración incompleta: falta la API Key de Coinalyze.");
    // O puedes poner una clave de desarrollo aquí SOLO para local, pero NUNCA la subas a GitHub:
    // const apiKey = process.env.COINALYZE_API_KEY || "TU_CLAVE_DE_DESARROLLO_AQUI"; // ¡NO SUBIR A GIT!
  }
  // La clave hardcodeada original se elimina por seguridad:
  // const apiKey = process.env.COINALYZE_API_KEY || "84bd6d2d-4045-4b53-8b61-151c618d4311"; // ¡BORRADA!

  const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false&nonce=${nonce}&cache_busting=${cacheBuster}`;

  console.log(`[${new Date().toISOString()}] Iniciando fetch FRESCO a Coinalyze...`);
  console.log(`URL: ${url.replace(apiKey, '********')}`); // Ocultar API Key en logs
  console.log(`Rango calculado: ${new Date(fromTimestamp * 1000).toISOString()} a ${new Date(toTimestamp * 1000).toISOString()}`);

  try {
    const response = await fetch(url, {
      // Cabeceras para la solicitud SALIENTE: Le decimos a Coinalyze (y proxies intermedios)
      // que NO queremos una respuesta cacheada de ELLOS.
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache', // Compatibilidad
        'Expires': '0'        // Compatibilidad
      },
      // Establecer un timeout razonable (ej. 20 segundos)
      timeout: 20000 // 20 segundos en milisegundos
    });

    console.log(`[${new Date().toISOString()}] Respuesta recibida de Coinalyze: Status ${response.status}`);

    if (!response.ok) {
      let errorBody = `Status: ${response.status} ${response.statusText}`;
      try {
        const text = await response.text();
        errorBody += `. Body: ${text}`;
      } catch (e) { /* Ignorar si no se puede leer el cuerpo */ }
      throw new Error(`Error en API Coinalyze: ${errorBody}`);
    }

    const data = await response.json();
    console.log(`[${new Date().toISOString()}] Datos JSON de Coinalyze parseados correctamente.`);
    // Podrías añadir una validación básica de la estructura de 'data' aquí si quieres
    return data;

  } catch (error) {
    // Manejar errores específicos de node-fetch (como timeouts) y otros errores
    if (error.name === 'FetchError' && error.type === 'request-timeout') {
       console.error(`[${new Date().toISOString()}] Error: Timeout (${(error.timeout || 20000)/1000}s) al contactar Coinalyze.`);
       throw new Error('Timeout al contactar la API externa de Coinalyze.');
    }
    console.error(`[${new Date().toISOString()}] Error detallado en fetchFreshCoinalyzeData:`, error);
    // Re-lanzar un error más genérico o el mismo error para que la ruta lo maneje
    throw new Error(`Fallo al obtener datos de Coinalyze: ${error.message}`);
  }
}

// Ruta para descargar los datos FRESCOS de liquidaciones
app.get("/liquidaciones/download", async (req, res) => {
  console.log(`\n[${new Date().toISOString()}] Petición RECIBIDA en /liquidaciones/download. Iniciando proceso...`);
  try {
    // 1. Llamar a la función que SIEMPRE hace la petición LIVE a Coinalyze *AHORA*
    //    Esta es la clave: la función se ejecuta CADA VEZ que se llama a esta ruta.
    console.log(`[${new Date().toISOString()}] Llamando a fetchFreshCoinalyzeData()...`);
    const freshData = await fetchFreshCoinalyzeData();
    console.log(`[${new Date().toISOString()}] Datos frescos recibidos de fetchFreshCoinalyzeData().`);

    // 2. Procesar la respuesta para generar el nombre del archivo
    let lastTimestamp = 0;
    // Añadir comprobaciones para asegurarse de que freshData y freshData.data existen
    if (freshData && freshData.data && Array.isArray(freshData.data) && freshData.data.length > 0) {
      freshData.data.forEach(item => {
        if (item.history && Array.isArray(item.history) && item.history.length > 0) {
          const maxTsInHistory = item.history.reduce((max, current) => {
            // Asegurarse de que current.t es un número válido
            const ts = Number(current.t);
            return !isNaN(ts) ? Math.max(max, ts) : max;
          }, 0);
          lastTimestamp = Math.max(lastTimestamp, maxTsInHistory);
        }
      });
    }

    // Si no se encontraron datos o timestamps válidos, usar la hora actual como fallback
    const referenceTimestamp = lastTimestamp || Math.floor(Date.now() / 1000);
    const lastDate = new Date(referenceTimestamp * 1000);

    // Formatear fecha para el nombre de archivo de forma segura
    const formattedDate = lastDate.toISOString()
      .slice(0, 19) // Tomar hasta los segundos YYYY-MM-DDTHH:mm:ss
      .replace('T', '_')
      .replace(/:/g, '-'); // Reemplazar ':' por '-'

    const filename = `liquidaciones_${formattedDate}.json`;

    console.log(`[${new Date().toISOString()}] Nombre de archivo generado: ${filename} (Timestamp base: ${referenceTimestamp})`);

    // 3. Establecer cabeceras para forzar la descarga en el navegador
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    // Las cabeceras anti-cache ya se aplicaron globalmente, no hace falta repetirlas.

    // 4. Enviar los datos FRESCOS obtenidos de Coinalyze como respuesta JSON
    console.log(`[${new Date().toISOString()}] Enviando respuesta JSON FRESCA para descarga.`);
    res.status(200).json(freshData); // Usar status 200 explícitamente

  } catch (error) {
    // Capturar cualquier error ocurrido durante el fetch o el procesamiento
    console.error(`[${new Date().toISOString()}] ERROR en el manejador /liquidaciones/download:`, error.message);
    // Enviar una respuesta de error clara al cliente
    res.status(500).json({
      error: "Error interno del servidor al procesar la solicitud de liquidaciones.",
      details: error.message, // Enviar el mensaje de error puede ayudar a depurar
      timestamp: new Date().toISOString()
    });
  }
});

// Manejador para solicitudes OPTIONS (Preflight de CORS)
// Esencial si el navegador necesita verificar permisos antes de la petición real GET/POST etc.
app.options("*", cors()); // Permite que el middleware 'cors' maneje estas peticiones automáticamente.

// Exportar la app para Vercel (Vercel es quien llama a `app.listen` internamente)
module.exports = app;

// --- Bloque para Desarrollo Local (Opcional) ---
// Este bloque NO se ejecuta en Vercel porque Vercel define NODE_ENV=production
// Puedes ejecutarlo localmente con `node api/index.js` (o como llames al archivo)
// Recuerda definir COINALYZE_API_KEY en tu terminal local o usar un archivo .env con `dotenv`
/*
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001; // Usar 3001 para evitar conflictos si tienes otro server en 3000
  require('dotenv').config(); // Si usas un archivo .env para la API Key localmente (npm install dotenv)

  if (!process.env.COINALYZE_API_KEY) {
     console.warn("ADVERTENCIA: COINALYZE_API_KEY no está definida localmente. Las llamadas a la API fallarán.");
  }

  app.listen(PORT, () => {
    console.log(`\n--- Servidor de Desarrollo Local ---`);
    console.log(`Corriendo en http://localhost:${PORT}`);
    console.log(`Prueba la ruta: http://localhost:${PORT}/liquidaciones/download`);
    console.log(`Asegúrate de tener la variable de entorno COINALYZE_API_KEY configurada.`);
    console.log(`-------------------------------------\n`);
  });
}
*/

// BORRAR estas líneas si aún existen, son restos de la GitHub Action:
// // Auto-updated at Fri Apr  4 01:46:07 UTC 2025
// console.log('File updated at Fri Apr  4 01:46:07 UTC 2025');
