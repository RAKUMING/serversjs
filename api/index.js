// https://serversjs.vercel.app/liquidaciones
// Este endpoint obtiene los datos desde Coinalyze y los muestra directamente en HTML

const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

app.get("/liquidaciones", async (req, res) => {
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
        const liquidations = [];

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

        // Generar HTML
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

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(html);

    } catch (err) {
        console.error("ERROR:", err);
        return res.status(500).send(`<h3>Error inesperado</h3><pre>${err.message}</pre>`);
    }
});

module.exports = app;
