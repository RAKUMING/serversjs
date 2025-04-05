// https://serversjs.vercel.app/liquidaciones
// Esta ruta borra toda la caché y ejecuta una nueva solicitud a Coinalyze para actualizar los datos

// https://serversjs.vercel.app/liquidaciones?download
// Esta ruta sirve el archivo CSV si hay datos disponibles en caché

const express = require("express");
const fetch = require("node-fetch"); // Usar node-fetch v2
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

let liquidationsCache = [];
let csvCache = "";
let lastUpdateCache = null;

app.get("/liquidaciones", async (req, res) => {
    const download = req.query.download !== undefined;

    if (download) {
        if (!csvCache || liquidationsCache.length === 0) {
            console.log("Descarga fallida: No hay datos en caché.");
            return res
                .status(400)
                .send("No hay datos almacenados. Visita /liquidaciones primero para generarlos.");
        }

        console.log("Descargando CSV desde caché...");
        res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
        res.setHeader("Content-Type", "text/csv");
        return res.send(csvCache);
    }

    console.log("Vista HTML solicitada. Reiniciando caché...");
    // Siempre borrar caché al cargar esta ruta
    liquidationsCache = [];
    csvCache = "";
    lastUpdateCache = null;

    try {
        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        now.setMinutes(now.getMinutes() - 1);
        const to = Math.floor(now.getTime() / 1000);
        const from = to - 86400;

        const apiKey = "84bd6d2d-4045-4b53-8b61-151c618d4311";
        const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${from}&to=${to}&convert_to_usd=false`;

        const response = await fetch(url);
        const rawBody = await response.text();

        if (!response.ok) {
            console.error("Error Coinalyze:", response.status, rawBody);
            return res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${rawBody}</pre>`);
        }

        const data = JSON.parse(rawBody);
        const currentLiquidations = [];

        if (Array.isArray(data)) {
            data.forEach(item => {
                if (Array.isArray(item.history)) {
                    item.history.forEach(entry => {
                        const d = new Date(entry.t * 1000);
                        currentLiquidations.push({
                            time: d.toISOString(),
                            timeShort: d.toLocaleString('es-ES', {
                                dateStyle: 'short',
                                timeStyle: 'medium'
                            }),
                            long: entry.l,
                            short: entry.s
                        });
                    });
                }
            });
        }

        currentLiquidations.sort((a, b) => new Date(b.time) - new Date(a.time));

        liquidationsCache = [...currentLiquidations];
        lastUpdateCache = new Date();

        const csvHeader = "time,long,short";
        const csvBody = liquidationsCache.map(l => `${l.time},${l.long},${l.short}`).join("\n");
        csvCache = `${csvHeader}\n${csvBody}`;

        console.log(`Datos actualizados: ${liquidationsCache.length} registros.`);

        // Generar HTML
        const tableHeaders = ["fecha/hora (local)", "long", "short"];
        let html = `<h2>Liquidaciones BTC - Últimas 24h</h2>
                    <p>Actualizado: ${lastUpdateCache.toISOString()}</p>
                    <p><a href="/liquidaciones?download">Descargar CSV</a></p>`;

        if (liquidationsCache.length === 0) {
            html += `<p>No se encontraron datos.</p>`;
        } else {
            html += `<table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;">
                        <thead style="background-color: #f2f2f2;">
                           <tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>`;
            liquidationsCache.forEach(l => {
                html += `<tr><td>${l.timeShort}</td><td>${l.long}</td><td>${l.short}</td></tr>`;
            });
            html += `</tbody></table>`;
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(html);

    } catch (err) {
        console.error("ERROR GENERAL:", err);
        return res.status(500).send(`<h3>Error inesperado</h3><pre>${err.message}</pre>`);
    }
});

module.exports = app;
