const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

let liquidations = []; // Se reinicia en cada request

// Endpoint para obtener las liquidaciones
app.get("/liquidaciones", async (req, res) => {
    try {
        // Limpiar datos al inicio de cada request
        liquidations = [];

        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        now.setMinutes(now.getMinutes() - 1);
        const to = Math.floor(now.getTime() / 1000);
        const from = to - 86400;

        const apiKey = "84bd6d2d-4045-4b53-8b61-151c618d4311";
        const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${from}&to=${to}&convert_to_usd=false&t=${Date.now()}`;

        const response = await fetch(url);
        const rawBody = await response.text();

        if (!response.ok) {
            console.error("Error Coinalyze:", response.status, rawBody);
            return res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${rawBody}</pre>`);
        }

        const data = JSON.parse(rawBody);

        if (Array.isArray(data)) {
            data.forEach(item => {
                if (Array.isArray(item.history)) {
                    item.history.forEach(entry => {
                        const d = new Date(entry.t * 1000);
                        liquidations.push({
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

        liquidations.sort((a, b) => new Date(b.time) - new Date(a.time));
        const updatedTime = liquidations.length > 0 ? liquidations[0].time : "Sin datos";

        // Encabezados para desactivar caché
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");

        // CSV si se pasa ?download
        if (req.query.download !== undefined) {
            const csvHeaders = "fecha/hora (local),long,short";
            const csvRows = liquidations.map(l =>
                `"${l.timeShort}",${l.long},${l.short}`
            );
            const csvContent = [csvHeaders, ...csvRows].join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=liquidaciones.csv");
            return res.send(csvContent);
        }

        // HTML
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        const tableHeaders = ["fecha/hora (local)", "long", "short"];
        let html = `<h2>Liquidaciones BTC - Últimas 24h</h2>
                    <p>Actualizado: ${updatedTime}</p>
                    <p><a href="/liquidaciones?download">Descargar CSV</a></p>`;

        if (liquidations.length === 0) {
            html += `<p>No se encontraron datos.</p>`;
        } else {
            html += `<table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;">
                        <thead style="background-color: #f2f2f2;">
                           <tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>`;
            liquidations.forEach(l => {
                html += `<tr><td>${l.timeShort}</td><td>${l.long}</td><td>${l.short}</td></tr>`;
            });
            html += `</tbody></table>`;
        }

        return res.status(200).send(html);

    } catch (err) {
        console.error("ERROR:", err);
        return res.status(500).send(`<h3>Error inesperado</h3><pre>${err.message}</pre>`);
    }
});

module.exports = app;
