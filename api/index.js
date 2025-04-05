const express = require("express");
const fetch = require("node-fetch"); // Use require for node-fetch v2 if using CommonJS
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

// --- In-memory cache - Initialized as empty ---
let liquidationsCache = []; // Stores processed data {time, timeShort, long, short}
let csvCache = "";          // Stores the generated CSV string
let lastUpdateCache = null; // Stores the Date object of the last successful update

app.get("/liquidaciones", async (req, res) => {
    const download = req.query.download !== undefined; // True if download param exists

    // --- Download Request Logic ---
    if (download) {
        // If cache is empty, return error as per the example flow
        if (!csvCache || liquidationsCache.length === 0) { // Check both just in case
            console.log("DOWNLOAD request failed: Cache is empty.");
            return res.status(400).send('No hay datos de liquidaciones almacenados. Visite /liquidaciones (sin "?download") para actualizar.');
        }

        // If cache has data, serve the CSV
        console.log("SERVING CSV FROM CACHE for download.");
        res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
        res.setHeader("Content-Type", "text/csv");
        return res.send(csvCache); // Send cached CSV
    }

    // --- HTML View Request Logic ---
    // This part only runs if 'download' parameter is NOT present

    console.log("HTML VIEW request received.");

    // 1. Check if cache has data and clear it (as per example flow)
    if (liquidationsCache.length > 0 || csvCache || lastUpdateCache) {
        console.log("Cache contains data. Clearing cache before fetching...");
        liquidationsCache = [];
        csvCache = "";
        lastUpdateCache = null;
    } else {
        console.log("Cache is already empty. Proceeding to fetch...");
    }

    // 2. Always attempt to fetch new data for the HTML view
    console.log("FETCHING new data from Coinalyze for HTML view...");
    try {
        // Calculate timestamps just before the API call
        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        now.setMinutes(now.getMinutes() - 1); // Ensure last full minute
        const toTimestamp = Math.floor(now.getTime() / 1000);
        const fromTimestamp = toTimestamp - (24 * 60 * 60); // Last 24 hours

        const apiKey = "84bd6d2d-4045-4b53-8b61-151c618d4311"; // Move to env vars ideally
        const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false`;

        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Error Coinalyze: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Error Coinalyze: ${response.status} ${response.statusText}. Details: ${errorBody}`);
        }
        const result = await response.json();

        // Process data into a temporary array
        const currentLiquidations = [];
         if (result && Array.isArray(result)) {
            result.forEach(item => {
                if (item.history && Array.isArray(item.history)) {
                    item.history.forEach(entry => {
                        const entryDate = new Date(entry.t * 1000);
                        currentLiquidations.push({
                            time: entryDate.toISOString(), // ISO for CSV
                             // Using a specific locale like 'es-ES' or 'en-US' is often better for consistency
                            timeShort: entryDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium'}), // Local format for Table
                            long: entry.l,
                            short: entry.s
                        });
                    });
                }
            });
        } else {
             console.warn("Coinalyze API returned non-array or unexpected data:", result);
        }

        // Sort DESC (most recent first)
        currentLiquidations.sort((a, b) => new Date(b.time) - new Date(a.time));

        // 3. Update Cache with the NEW data
        liquidationsCache = [...currentLiquidations]; // Store processed data
        lastUpdateCache = new Date();                 // Store update time

        // Generate and cache CSV
        const csvHeader = "time,long,short";
        const csvBody = liquidationsCache
            .map(l => `${l.time},${l.long},${l.short}`)
            .join("\n");
        csvCache = `${csvHeader}\n${csvBody}`;         // Update CSV cache

        console.log(`FETCH COMPLETE: ${liquidationsCache.length} records processed. Cache updated.`);

        // 4. Respond with HTML using the NEWLY fetched data
        console.log("GENERATING HTML response with fresh data...");
        const tableHeaders = ["time (local)", "long", "short"];
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

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);

    } catch (error) {
        // Handle fetch or processing errors
        console.error("ERROR during fetch/processing for HTML view:", error);
        // Send error page, cache remains empty or as it was before the attempt
        return res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${error.message}</pre>`);
    }
});

// Export the app for environments like Vercel
module.exports = app;

// Optional: Add a local listener for testing
/*
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Test HTML view (clears cache, fetches): http://localhost:${PORT}/liquidaciones`);
    console.log(`Test CSV download (uses cache or fails): http://localhost:${PORT}/liquidaciones?download`);
});
*/
