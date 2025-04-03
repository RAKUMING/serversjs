const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

// Configurar CORS para permitir todas las conexiones
app.use(cors({ origin: "*" }));

app.get("/", (req, res) => {
    res.send("Servidor funcionando en Vercel");
});

app.get("/liquidaciones", async (req, res) => {
    try {
        // Calcular el rango de tiempo: desde hace 1 día hasta el último minuto completo
        const now = new Date();
        
        // Establecer los segundos y milisegundos a cero para obtener el último minuto completo
        now.setSeconds(0);
        now.setMilliseconds(0);
        
        // Convertir a timestamp de Unix (segundos)
        const toTimestamp = Math.floor(now.getTime() / 1000);
        
        // Calcular timestamp de hace 1 día exacto (en segundos)
        const fromTimestamp = toTimestamp - (24 * 60 * 60);
        
        const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=84bd6d2d-4045-4b53-8b61-151c618d4311&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false`;
        
        const response = await fetch(url);
        const data = await response.json();

        // Agregar encabezados CORS manualmente
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        // Agregar información sobre el rango de tiempo utilizado (opcional)
        const responseData = {
            data,
            timeRange: {
                from: new Date(fromTimestamp * 1000).toISOString(),
                to: new Date(toTimestamp * 1000).toISOString(),
                interval: "1min"
            }
        };

        res.json(responseData);
    } catch (error) {
        console.error("Error en la solicitud:", error);
        res.status(500).json({ error: "Error al obtener los datos", details: error.message });
    }
});

// Habilitar preflight requests
app.options("*", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.send();
});

module.exports = app;
