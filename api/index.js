const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
    res.send("Servidor funcionando en Vercel");
});

app.get("/liquidaciones", async (req, res) => {
    try {
        const url = "https://api.coinalyze.net/v1/liquidation-history?api_key=84bd6d2d-4045-4b53-8b61-151c618d4311&symbols=BTCUSDT_PERP.A&interval=1hour&from=1742968800&to=1743659999&convert_to_usd=false";
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener los datos" });
    }
});

module.exports = app;
