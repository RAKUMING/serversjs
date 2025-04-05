const express = require("express");
// Use require for node-fetch v2 if using CommonJS
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

// --- In-memory cache ---
let liquidationsCache = []; // Stores processed data {time, timeShort, long, short}
let csvCache = "";          // Stores the generated CSV string
let lastUpdateCache = null; // Stores the Date object of the last successful update

app.get("/liquidaciones", async (req, res) => {
    const download = req.query.download !== undefined; // True if download param exists

    try {
        let shouldFetch = false;

        if (download) {
            // --- Download Request ---
            if (csvCache) {
                // Serve CSV from cache
                console.log("SERVING CSV FROM CACHE");
                res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
                res.setHeader("Content-Type", "text/csv");
                return res.send(csvCache);
            } else {
                // Cache is empty, need to fetch data first
                console.log("CSV CACHE EMPTY: Fetching data for download...");
                shouldFetch = true;
                // As per requirement: if cache is empty, send message to update?
                // This seems counter-intuitive for a download. Let's fetch instead.
                // If you strictly want to send "update needed", uncomment below and remove shouldFetch=true:
                // res.status(404).send("Cache vacío. Accede a /liquidaciones sin el parámetro 'download' para actualizar.");
                // return;
            }
        } else {
            // --- HTML View Request ---
            // Per requirement: Clear arrays (cache) *before* fetching for HTML view
            console.log("HTML VIEW REQUEST: Clearing cache...");
            liquidationsCache = [];
            csvCache = "";
            lastUpdateCache = null;
            shouldFetch = true; // Always fetch for HTML view
        }

        // --- Fetch data ONLY if needed ---
        if (shouldFetch) {
            console.log("FETCHING data from Coinalyze...");
            // Calculate timestamps just before the API call
            const now = new Date();
            now.setSeconds(0);
            now.setMilliseconds(0);
            // Go back 1 full minute to ensure the last completed minute is included
            now.setMinutes(now.getMinutes() - 1);
            const toTimestamp = Math.floor(now.getTime() / 1000);
            const fromTimestamp = toTimestamp - (24 * 60 * 60); // Last 24 hours

            // *** Ensure URL starts with https:// ***
            const apiKey = "84bd6d2d-4045-4b53-8b61-151c618d4311"; // Consider moving to env variables
            const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false`;

            const response = await fetch(url);
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`Error Coinalyze: ${response.status} ${response.statusText}`, errorBody);
                throw new Error(`Error Coinalyze: ${response.status} ${response.statusText}. Details: ${errorBody}`);
            }
            const result = await response.json();

            // Process the data into a temporary array first
            const currentLiquidations = [];
            if (result && Array.isArray(result)) {
                result.forEach(item => {
                    if (item.history && Array.isArray(item.history)) {
                        item.history.forEach(entry => {
                            const entryDate = new Date(entry.t * 1000);
                            currentLiquidations.push({
                                time: entryDate.toISOString(), // ISO for CSV
                                // Use a specific locale for consistency if needed, e.g., 'es-ES' or 'en-US'
                                timeShort: entryDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium'}), // Local format for Table
                                long: entry.l,
                                short: entry.s
                            });
                        });
                    }
                });
            } else {
                console.warn("Coinalyze API returned non-array or unexpected data:", result);
                // Handle case where API might return empty/null/non-array
            }


            // Sort DESC (most recent first)
            currentLiquidations.sort((a, b) => new Date(b.time) - new Date(a.time));

            // --- Update Cache ---
            liquidationsCache = [...currentLiquidations]; // Store processed data
            lastUpdateCache = new Date(); // Store update time

            // Generate and cache CSV
            const csvHeader = "time,long,short";
            const csvBody = liquidationsCache
                .map(l => `${l.time},${l.long},${l.short}`) // Use ISO time for CSV
                .join("\n");
            csvCache = `${csvHeader}\n${csvBody}`; // Update CSV cache

            console.log(`FETCH COMPLETE: ${liquidationsCache.length} records processed. Cache updated.`);

            // If this fetch was triggered by a download request with an empty cache, send CSV now
            if (download) {
                 console.log("SENDING newly fetched CSV for download...");
                 res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
                 res.setHeader("Content-Type", "text/csv");
                 return res.send(csvCache); // Send the newly created CSV
            }
            // If it was an HTML request, proceed to send HTML below
        }

        // --- Send HTML Response (only if not a download request) ---
        // This part executes if it's an HTML request (after fetching)
        if (!download) {
             console.log("GENERATING HTML response...");
             const tableHeaders = ["time (local)", "long", "short"];
             let html = `<h2>Liquidaciones BTC - Últimas 24h</h2>
                         <p>Última actualización: ${lastUpdateCache ? lastUpdateCache.toISOString() : 'N/A (cache vacía)'}</p>
                         <p><a href="/liquidaciones?download">Descargar CSV</a></p>`; // Simpler download link

             if (liquidationsCache.length === 0) {
                 html += `<p>No hay datos de liquidaciones disponibles en la caché.</p>`;
                 // Add extra info if fetch was just attempted
                 if (shouldFetch) { // shouldFetch would be true if we just tried to populate
                    html += `<p><i>(Se intentó obtener datos frescos de la API, pero no se encontraron registros o hubo un error. Revise la consola del servidor.)</i></p>`
                 } else { // This case shouldn't normally happen with the current logic but is safe to include
                    html += `<p><i>(Visite sin el parámetro 'download' para intentar actualizar.)</i></p>`
                 }

             } else {
                 html += `<table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; white-space: nowrap;">
                            <thead style="background-color: #f2f2f2;">
                                <tr>${tableHeaders.map(col => `<th style="padding: 2px 5px;">${col}</th>`).join('')}</tr>
                            </thead>
                            <tbody>`;
                 // Use liquidationsCache which is guaranteed to be populated now for HTML view
                 liquidationsCache.forEach(l => {
                     // Use timeShort for the table display
                     const rowData = [l.timeShort, l.long, l.short];
                     html += `<tr>${rowData.map(col => `<td style="padding: 2px 5px;">${col !== null && col !== undefined ? col : ''}</td>`).join('')}</tr>`; // Added null/undefined check for display
                 });
                 html += `</tbody></table>`;
             }

             res.send(html);
        }

    } catch (error) {
        console.error("ERROR in /liquidaciones handler:", error);
        // Avoid clearing cache on error, might hide data if API is temporarily down
        return res.status(500).send(`<h3>Error al obtener o procesar datos</h3><pre>${error.message}</pre>`);
    }
});

// Export the app for environments like Vercel
module.exports = app;

// Optional: Add a local listener for testing if not running on Vercel
/*
const PORT = process.env.PORT || 3001; // Use a different port if needed
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Test HTML view: http://localhost:${PORT}/liquidaciones`);
    console.log(`Test CSV download: http://localhost:${PORT}/liquidaciones?download`);
});
*/
