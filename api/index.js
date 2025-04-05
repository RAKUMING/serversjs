const express = require("express");
const fetch = require("node-fetch"); // Usa require para node-fetch v2 si usas CommonJS
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

// --- Caché en memoria - Inicializada vacía ---
let liquidationsCache = []; // Almacena datos procesados {time, timeShort, long, short}
let csvCache = "";          // Almacena la cadena CSV generada
let lastUpdateCache = null; // Almacena el objeto Date de la última actualización exitosa

app.get("/liquidaciones", async (req, res) => {
    const download = req.query.download !== undefined; // Verdadero si el parámetro download existe

    // --- Lógica de Solicitud de Descarga ---
    if (download) {
        // Si la caché está vacía, devuelve error según el flujo de ejemplo
        if (!csvCache || liquidationsCache.length === 0) { // Comprobar ambos por si acaso
            console.log("Solicitud de DESCARGA fallida: La caché está vacía.");
            return res.status(400).send('No hay datos de liquidaciones almacenados. Visite /liquidaciones (sin "?download") para actualizar.');
        }

        // Si la caché tiene datos, sirve el CSV
        console.log("SIRVIENDO CSV DESDE CACHÉ para descarga.");
        res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
        res.setHeader("Content-Type", "text/csv");
        return res.send(csvCache); // Enviar CSV cacheado
    }

    // --- Lógica de Solicitud de Vista HTML ---
    // Esta parte solo se ejecuta si el parámetro 'download' NO está presente

    console.log("Solicitud de VISTA HTML recibida.");

    // 1. Comprobar si la caché tiene datos y limpiarla (según el flujo de ejemplo)
    if (liquidationsCache.length > 0 || csvCache || lastUpdateCache) {
        console.log("La caché contiene datos. Limpiando caché antes de buscar...");
        liquidationsCache = [];
        csvCache = "";
        lastUpdateCache = null;
    } else {
        console.log("La caché ya está vacía. Procediendo a buscar...");
    }

    // 2. Siempre intentar obtener nuevos datos para la vista HTML
    console.log("OBTENIENDO nuevos datos de Coinalyze para la vista HTML...");
    try {
        // Calcular marcas de tiempo justo antes de la llamada a la API
        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        now.setMinutes(now.getMinutes() - 1); // Asegurar el último minuto completo
        const toTimestamp = Math.floor(now.getTime() / 1000);
        const fromTimestamp = toTimestamp - (24 * 60 * 60); // Últimas 24 horas

        const apiKey = "84bd6d2d-4045-4b53-8b61-151c618d4311"; // Mover a variables de entorno idealmente
        const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false`;

        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Error Coinalyze: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Error Coinalyze: ${response.status} ${response.statusText}. Detalles: ${errorBody}`);
        }
        const result = await response.json();

        // Procesar datos en un array temporal
        const currentLiquidations = [];
         if (result && Array.isArray(result)) {
            result.forEach(item => {
                if (item.history && Array.isArray(item.history)) {
                    item.history.forEach(entry => {
                        const entryDate = new Date(entry.t * 1000);
                        currentLiquidations.push({
                            time: entryDate.toISOString(), // ISO para CSV
                             // Usar un locale específico como 'es-ES' o 'en-US' suele ser mejor para la consistencia
                            timeShort: entryDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium'}), // Formato local para la tabla
                            long: entry.l,
                            short: entry.s
                        });
                    });
                }
            });
        } else {
             console.warn("La API de Coinalyze devolvió datos no array o inesperados:", result);
        }

        // Ordenar DESC (más recientes primero)
        currentLiquidations.sort((a, b) => new Date(b.time) - new Date(a.time));

        // 3. Actualizar Caché con los NUEVOS datos
        liquidationsCache = [...currentLiquidations]; // Almacenar datos procesados
        lastUpdateCache = new Date();                 // Almacenar hora de actualización

        // Generar y cachear CSV
        const csvHeader = "time,long,short";
        const csvBody = liquidationsCache
            .map(l => `${l.time},${l.long},${l.short}`)
            .join("\n");
        csvCache = `${csvHeader}\n${csvBody}`;         // Actualizar caché CSV

        console.log(`OBTENCIÓN COMPLETA: ${liquidationsCache.length} registros procesados. Caché actualizada.`);

        // 4. Responder con HTML usando los datos RECIÉN OBTENIDOS
        console.log("GENERANDO respuesta HTML con datos frescos...");
        const tableHeaders = ["fecha/hora (local)", "long", "short"]; // Cambiado header a español
        let html = `<h2>Liquidaciones BTC - Últimas 24h (Datos Actualizados)</h2>
                    <p>Última actualización (datos de esta carga): ${lastUpdateCache.toISOString()}</p>
                    <p><a href="/liquidaciones?download">Descargar CSV</a></p>`;

        if (liquidationsCache.length === 0) {
             html += `<p>No se encontraron datos de liquidaciones en la API para el período solicitado.</p>`;
        } else {
            html += `<table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; white-space: nowrap;">
                        <thead style="background-color: #f2f2f2;">
                           <tr>${tableHeaders.map(col => `<th style="padding: 2px 5px;">${col}</th>`).join('')}</tr>
                        </thead>
                        <tbody>`;
            liquidationsCache.forEach(l => {
                const rowData = [l.timeShort, l.long, l.short];
                 html += `<tr>${rowData.map(col => `<td style="padding: 2px 5px;">${col !== null && col !== undefined ? col : ''}</td>`).join('')}</tr>`;
            });
            html += `</tbody></table>`;
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8'); // Añadido charset=utf-8 para HTML
        return res.status(200).send(html);

    } catch (error) {
        // Manejar errores de obtención o procesamiento
        console.error("ERROR durante la obtención/procesamiento para la vista HTML:", error);
        // Enviar página de error, la caché permanece vacía o como estaba antes del intento
        return res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${error.message}</pre>`);
    }
});

// Exportar la app para entornos como Vercel
module.exports = app;
