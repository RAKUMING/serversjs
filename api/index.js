const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));




// Página principal ("/")
app.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>API de Liquidaciones BTC - Coinalyze</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    margin: 0;
                    padding: 0;
                    color: #333;
                    background-color: #f8f9fa;
                }
                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }
                header {
                    background-color: #1a1a2e;
                    color: white;
                    padding: 30px 0;
                    border-radius: 8px 8px 0 0;
                    text-align: center;
                    margin-bottom: 30px;
                }
                h1 {
                    margin: 0;
                    font-size: 2.5em;
                }
                .subtitle {
                    color: #e2b714;
                    font-weight: 300;
                }
                h2 {
                    border-bottom: 2px solid #e2b714;
                    padding-bottom: 10px;
                    margin-top: 40px;
                    color: #1a1a2e;
                }
                .description {
                    background-color: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .endpoint-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .endpoint-card {
                    background-color: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .endpoint-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }
                .endpoint-title {
                    font-size: 1.2em;
                    color: #1a1a2e;
                    margin-top: 0;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                .endpoint-url {
                    background-color: #f8f9fa;
                    padding: 10px;
                    border-radius: 5px;
                    margin-bottom: 15px;
                    font-family: monospace;
                    word-break: break-all;
                }
                .endpoint-url a {
                    color: #0066cc;
                    text-decoration: none;
                }
                .endpoint-url a:hover {
                    text-decoration: underline;
                }
                .endpoint-description {
                    color: #555;
                    font-size: 0.95em;
                }
                .download-option {
                    margin-top: 10px;
                    font-size: 0.9em;
                    color: #666;
                }
                .download-option code {
                    background-color: #f1f1f1;
                    padding: 2px 5px;
                    border-radius: 3px;
                }
                footer {
                    margin-top: 50px;
                    text-align: center;
                    color: #777;
                    font-size: 0.9em;
                    padding: 20px;
                    background-color: #1a1a2e;
                    color: white;
                    border-radius: 0 0 8px 8px;
                }
                .btc-icon {
                    color: #e2b714;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>API de Liquidaciones BTC <span class="btc-icon">₿</span></h1>
                    <p class="subtitle">Datos en tiempo real de Coinalyze para BTCUSDT en Binance</p>
                </header>
                
                <div class="description">
                    <p>Este servicio proporciona acceso a datos de <strong>liquidaciones long y short</strong> 
                    de BTCUSDT en Binance (futuros perpetuos) extraídos de la API pública de 
                    <a href="https://coinalyze.net" target="_blank">Coinalyze</a>.</p>
                    
                    <p>Utiliza los endpoints a continuación para consultar datos en diferentes intervalos de tiempo.</p>
                </div>
                
                <h2>Endpoints Disponibles</h2>
                
                <div class="endpoint-grid">
                    <div class="endpoint-card">
                        <h3 class="endpoint-title">Liquidaciones por Minuto</h3>
                        <div class="endpoint-url">
                            <a href="https://liquidacionesjs.vercel.app/liquidaciones1min" target="_blank">
                                /liquidaciones1min
                            </a>
                        </div>
                        <div class="endpoint-description">
                            Resumen de liquidaciones minuto a minuto durante los últimos 500 minutos.
                            <div class="download-option">
                                Descargar como CSV: <code><a href="https://liquidacionesjs.vercel.app/liquidaciones1min?download" target="_blank">/liquidaciones1min?download</a></code>
                            </div>
                        </div>
                    </div>
                    
                    <div class="endpoint-card">
                        <h3 class="endpoint-title">Liquidaciones cada 5 Minutos</h3>
                        <div class="endpoint-url">
                            <a href="https://liquidacionesjs.vercel.app/liquidaciones5min" target="_blank">
                                /liquidaciones5min
                            </a>
                        </div>
                        <div class="endpoint-description">
                            Datos consolidados por intervalos de 5 minutos.
                            <div class="download-option">
                                Descargar como CSV: <code><a href="https://liquidacionesjs.vercel.app/liquidaciones5min?download" target="_blank">/liquidaciones5min?download</a></code>
                            </div>
                        </div>
                    </div>
                    
                    <div class="endpoint-card">
                        <h3 class="endpoint-title">Liquidaciones cada 15 Minutos</h3>
                        <div class="endpoint-url">
                            <a href="https://liquidacionesjs.vercel.app/liquidaciones15min" target="_blank">
                                /liquidaciones15min
                            </a>
                        </div>
                        <div class="endpoint-description">
                            Datos consolidados por intervalos de 15 minutos.
                            <div class="download-option">
                                Descargar como CSV: <code><a href="https://liquidacionesjs.vercel.app/liquidaciones15min?download" target="_blank">/liquidaciones15min?download</a></code>
                            </div>
                        </div>
                    </div>
                    
                    <div class="endpoint-card">
                        <h3 class="endpoint-title">Liquidaciones Horarias</h3>
                        <div class="endpoint-url">
                            <a href="https://liquidacionesjs.vercel.app/liquidaciones1hour" target="_blank">
                                /liquidaciones1hour
                            </a>
                        </div>
                        <div class="endpoint-description">
                            Resumen de liquidaciones por hora.
                            <div class="download-option">
                                Descargar como CSV: <code><a href="https://liquidacionesjs.vercel.app/liquidaciones1hour?download" target="_blank">/liquidaciones1hour?download</a></code>
                            </div>
                        </div>
                    </div>
                    
                    <div class="endpoint-card">
                        <h3 class="endpoint-title">Liquidaciones cada 4 Horas</h3>
                        <div class="endpoint-url">
                            <a href="https://liquidacionesjs.vercel.app/liquidaciones4hour" target="_blank">
                                /liquidaciones4hour
                            </a>
                        </div>
                        <div class="endpoint-description">
                            Datos consolidados por bloques de 4 horas.
                            <div class="download-option">
                                Descargar como CSV: <code><a href="https://liquidacionesjs.vercel.app/liquidaciones4hour?download" target="_blank">/liquidaciones4hour?download</a></code>
                            </div>
                        </div>
                    </div>
                    
                    <div class="endpoint-card">
                        <h3 class="endpoint-title">Liquidaciones Diarias</h3>
                        <div class="endpoint-url">
                            <a href="https://liquidacionesjs.vercel.app/liquidacionesdaily" target="_blank">
                                /liquidacionesdaily
                            </a>
                        </div>
                        <div class="endpoint-description">
                            Resumen de liquidaciones por día.
                            <div class="download-option">
                                Descargar como CSV: <code><a href="https://liquidacionesjs.vercel.app/liquidacionesdaily?download" target="_blank">/liquidacionesdaily?download</a></code>
                            </div>
                        </div>
                    </div>
                </div>
                
                <footer>
                    <p>API de Liquidaciones Bitcoin &copy; 2025 | Desarrollado con Node.js + Express | Datos proporcionados por Coinalyze</p>
                </footer>
            </div>
        </body>
        </html>
    `);
});




app.get("/liquidaciones", async (req, res) => {
    try {
        console.log(`Llamo a Coinalyze: ${new Date().toISOString()}`);

        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        now.setMinutes(now.getMinutes() - 1); // 1 minuto antes del actual

        const to = Math.floor(now.getTime() / 1000); // Timestamp del minuto anterior
        const from = to - 30000; // 500 minutos atrás

        console.log("From:", new Date(from * 1000).toString());
        console.log("To:  ", new Date(to * 1000).toString());

        const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=84bd6d2d-4045-4b53-8b61-151c618d4311&symbols=BTCUSDT_PERP.A&interval=1min&from=${from}&to=${to}&convert_to_usd=true`;

        const response = await fetch(url);
        const rawBody = await response.text();

        if (!response.ok) {
            console.error("Error Coinalyze:", response.status, rawBody);
            return res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${rawBody}</pre>`);
        }

        const data = JSON.parse(rawBody);
        const liquidationMap = new Map();

        if (Array.isArray(data)) {
            data.forEach(item => {
                if (Array.isArray(item.history)) {
                    item.history.forEach(entry => {
                        const timestamp = entry.t * 1000;
                        liquidationMap.set(timestamp, {
                            long: entry.l,
                            short: entry.s
                        });
                    });
                }
            });
        }

        // Procesar todos los minutos entre from y to
        const processedLiquidations = [];
        for (let t = from * 1000; t <= to * 1000; t += 60000) {
            const date = new Date(t);
            const entry = liquidationMap.get(t) || { long: 0.01, short: 0.01 };

            processedLiquidations.push({
                timestamp: t,
                time: date.toISOString(),
                timeShort: date.toLocaleString('es-ES', {
                    dateStyle: 'short',
                    timeStyle: 'medium'
                }),
                long: entry.long,
                short: entry.short
            });
        }

        const updatedTime = processedLiquidations.length > 0 ? processedLiquidations.at(-1).time : "Sin datos";

        // Headers para evitar cache
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");

        // CSV
        if (req.query.download !== undefined) {
            const csvHeaders = "fecha/hora (local),long,short";
            const csvRows = processedLiquidations.map(l =>
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

        if (processedLiquidations.length === 0) {
            html += `<p>No se encontraron datos.</p>`;
        } else {
            html += `<table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;">
                        <thead style="background-color: #f2f2f2;">
                           <tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>`;
            processedLiquidations.forEach(l => {
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
