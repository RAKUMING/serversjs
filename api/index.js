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
        const url = "https://api.coinalyze.net/v1/liquidation-history?api_key=84bd6d2d-4045-4b53-8b61-151c618d4311&symbols=BTCUSDT_PERP.A&interval=1hour&from=1742968800&to=1743659999&convert_to_usd=false";
        const response = await fetch(url);
        const data = await response.json();

        // Agregar encabezados CORS manualmente
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener los datos" });
    }
});

// Habilitar preflight requests (opcional pero recomendado)
app.options("*", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.send();
});

module.exports = app;
