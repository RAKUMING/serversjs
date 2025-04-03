const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

// Configurar CORS para permitir todas las conexiones
app.use(cors({ origin: "*" }));

// Middleware para prevenir la caché
app.use((req, res, next) => {
  // Aseguramos que la caché no se almacene en ningún lugar
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '-1');
  res.set('Surrogate-Control', 'no-store');
  res.set('X-Accel-Expires', '0');  // Para Nginx y otros proxies
  next();
});

app.get("/", (req, res) => {
    // Confirmación de que el servidor está funcionando
    res.send(`Servidor funcionando en Vercel - Proxy para API Coinalyze - ${new Date().toISOString()}`);
});

// Función para obtener datos actualizados de la API de Coinalyze
async function fetchCoinalyzeData() {
    // Añadir un nonce aleatorio a la URL para evitar caché
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Calcular el rango de tiempo: desde hace 1 día hasta el último minuto completo
    const now = new Date();
    
    // Establecer los segundos y milisegundos a cero
    now.setSeconds(0);
    now.setMilliseconds(0);
    
    // Convertir a timestamp de Unix (segundos)
    const toTimestamp = Math.floor(now.getTime() / 1000);
    
    // Calcular timestamp de hace 1 día exacto (en segundos)
    const fromTimestamp = toTimestamp - (24 * 60 * 60);
    
    console.log(`Rango de tiempo calculado:`);
    console.log(`Desde: ${new Date(fromTimestamp * 1000).toISOString()}`);
    console.log(`Hasta: ${new Date(toTimestamp * 1000).toISOString()} (último minuto completo)`);
    
    // Agregar un parámetro "cache_busting" extra en la URL para romper la caché
    const timestamp = new Date().getTime();  // Este es un valor único basado en la hora actual
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
    
    const data = await response.json();
    
    // Añadir un timestamp a los datos
    return {
        data,
        meta: {
            requestNonce: nonce,
            requestTime: new Date().toISOString(),
            from: new Date(fromTimestamp * 1000).toISOString(),
            to: new Date(toTimestamp * 1000).toISOString(),
            interval: "1min"
        }
    };
}

// Ruta para descargar los datos frescos de liquidaciones
app.get("/liquidaciones/download", async (req, res) => {
    try {
        const responseData = await fetchCoinalyzeData();
        
        // Encontrar el último registro de liquidación de todos los símbolos
        let lastTimestamp = 0;
        
        if (responseData.data && responseData.data.length > 0) {
            responseData.data.forEach(item => {
                if (item.history && item.history.length > 0) {
                    // Ordenar el historial por timestamp (t) en orden descendente
                    const sortedHistory = [...item.history].sort((a, b) => b.t - a.t);
                    // Tomar el timestamp más alto (el más reciente)
                    const highestTimestamp = sortedHistory[0].t;
                    
                    if (highestTimestamp > lastTimestamp) {
                        lastTimestamp = highestTimestamp;
                    }
                }
            });
        }
        
        // Crear fecha a partir del último timestamp
        const lastDate = new Date(lastTimestamp * 1000);
        
        // Formatear la fecha para el nombre del archivo (YYYY-MM-DD_HH-MM-SS)
        const formattedDate = lastDate.toISOString()
            .replace('T', '_')
            .replace(/\.\d+Z$/, '')
            .replace(/:/g, '-');
            
        const filename = `liquidaciones_btc_${formattedDate}.json`;
        
        console.log(`Nombre de archivo generado: ${filename}`);
        console.log(`Basado en el timestamp: ${lastTimestamp} (${lastDate.toISOString()})`);
        
        // Encabezados para forzar la descarga y evitar caché
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

// Habilitar preflight requests para CORS
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
