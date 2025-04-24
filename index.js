const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3932;
const HOST = '192.168.100.205';
const VELA_PATH = path.join(__dirname, 'Velasguardadas', 'velas_5s.json');
const VELA_DIR = path.dirname(VELA_PATH);

if (!fs.existsSync(VELA_DIR)) {
    fs.mkdirSync(VELA_DIR, { recursive: true });
}

if (!fs.existsSync(VELA_PATH)) {
    fs.writeFileSync(VELA_PATH, '[\n]');
}

let candleData = JSON.parse(fs.readFileSync(VELA_PATH, 'utf8'));
let currentCandle = null;

function appendCandleToFile(candle) {
    try {
        candleData.push(candle);
        if (candleData.length > 1000) {
            candleData = candleData.slice(-1000);
        }
        fs.writeFileSync(VELA_PATH, '[\n' + candleData.map(c => JSON.stringify(c)).join(',\n') + '\n]');
    } catch (err) {
        console.error('Error al guardar las velas:', err);
    }
}

function updateCandle(price, timestamp) {
    const startTime = timestamp - (timestamp % 5);
    if (!currentCandle || currentCandle[0] !== startTime) {
        if (currentCandle) pushCandle();
        currentCandle = [startTime, price, price, price, price];
    } else {
        currentCandle[2] = Math.max(currentCandle[2], price);
        currentCandle[3] = Math.min(currentCandle[3], price);
        currentCandle[4] = price;
    }
}

function pushCandle() {
    if (currentCandle) {
        appendCandleToFile(currentCandle);
        currentCandle = null;
    }
}

function startWebSocket() {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

    ws.on('open', () => {
        console.log('Conectado a Binance WebSocket');
    });

    ws.on('message', (data) => {
        try {
            const trade = JSON.parse(data);
            const price = parseFloat(trade.p);
            const timestamp = Math.floor(trade.T / 1000);
            updateCandle(price, timestamp);
        } catch (err) {
            console.error('Error al procesar mensaje WebSocket:', err);
        }
    });

    ws.on('close', () => {
        console.warn('WebSocket cerrado. Reintentando conexión...');
        setTimeout(startWebSocket, 1000);
    });

    ws.on('error', (err) => {
        console.error('Error en WebSocket:', err);
        ws.terminate();
    });
}

startWebSocket();

// Interfaz HTML
const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Servidor de Velas 5s</title>
    <style>
        body {
            background: #121212;
            color: #ccc;
            font-family: sans-serif;
            text-align: center;
            padding-top: 100px;
        }
        .status {
            font-size: 2.5em;
            background: #00c853;
            display: inline-block;
            padding: 20px 40px;
            border-radius: 10px;
            color: white;
            font-weight: bold;
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0%, 75% { opacity: 1; }
            50% { opacity: 0.20; }
        }
        .desc {
            margin-top: 20px;
            font-size: 0.9em;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="status">Servidor corriendo</div>
    <div class="desc">ESTA CORRIENDO CORRECTAMENTE.....<br>Endpoint disponible en /velas_5s</div>
</body>
</html>
`;

// Servidor HTTP
const server = http.createServer((req, res) => {
    if (req.url.startsWith('/velas_5s')) {
        const url = new URL(`http://${HOST}` + req.url);
        const limit = parseInt(url.searchParams.get('limit')) || 10;
        const result = candleData.slice(-limit);

        // Log en consola con hora local de El Salvador
        const timestamp = new Date().toLocaleString('es-SV', { timeZone: 'America/El_Salvador' });
        const clientIP = req.socket.remoteAddress;
        console.log(`[${timestamp}] Petición de ${clientIP} -> /velas_5s?limit=${limit}`);

        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`http://${HOST}:${PORT}/`);
});
