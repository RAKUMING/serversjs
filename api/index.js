// https://serversjs.vercel.app/liquidaciones
// Esta ruta borra toda la caché existente (array y CSV) y ejecuta un nuevo llamado a la API de Coinalyze
// para luego servir una tabla HTML con los datos actualizados

// https://serversjs.vercel.app/liquidaciones?download
// Esta ruta sirve directamente un archivo CSV usando los datos en caché, si existen.
// Si no hay caché disponible, devuelve un error indicando que primero se debe visitar la ruta sin '?download'.

app.get("/liquidaciones", async (req, res) => {
    const download = req.query.download !== undefined; // Verdadero si el parámetro download existe

    // --- Lógica de Solicitud de Descarga ---
    if (download) {
        if (!csvCache || liquidationsCache.length === 0) {
            console.log("Solicitud de DESCARGA fallida: La caché está vacía.");
            return res.status(400).send('No hay datos de liquidaciones almacenados. Visite /liquidaciones (sin "?download") para actualizar.');
        }

        console.log("SIRVIENDO CSV DESDE CACHÉ para descarga.");
        res.setHeader("Content-Disposition", `attachment; filename="liquidaciones_btc_${Date.now()}.csv"`);
        res.setHeader("Content-Type", "text/csv");
        return res.send(csvCache);
    }

    // --- Lógica de Solicitud de Vista HTML ---
    console.log("Solicitud de VISTA HTML recibida.");

    // Borrar caché siempre que se entra a esta ruta
    console.log("LIMPIANDO TODA LA CACHÉ antes de llamar a la API...");
    liquidationsCache = [];
    csvCache = "";
    lastUpdateCache = null;

    // Intentar obtener nuevos datos de la API
    console.log("OBTENIENDO nuevos datos de Coinalyze para la vista HTML...");
    try {
        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        now.setMinutes(now.getMinutes() - 1);
        const toTimestamp = Math.floor(now.getTime() / 1000);
        const fromTimestamp = toTimestamp - (24 * 60 * 60);

        const apiKey = "84bd6d2d-4045-4b53-8b61-151c618d4311"; // Mejor usar variables de entorno
        const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false`;

        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Error Coinalyze: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Error Coinalyze: ${response.status} ${response.statusText}. Detalles: ${errorBody}`);
        }
        const result = await response.json();

        const currentLiquidations = [];
        if (result && Array.isArray(result)) {
            result.forEach(item => {
                if (item.history && Array.isArray(item.history)) {
                    item.history.forEach(entry => {
                        const entryDate = new Date(entry.t * 1000);
                        currentLiquidations.push({
                            time: entryDate.toISOString(),
                            timeShort: entryDate.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium'}),
                            long: entry.l,
                            short: entry.s
                        });
                    });
                }
            });
        } else {
            console.warn("La API de Coinalyze devolvió datos no array o inesperados:", result);
        }

        currentLiquidations.sort((a, b) => new Date(b.time) - new Date(a.time));

        // Actualizar caché
        liquidationsCache = [...currentLiquidations];
        lastUpdateCache = new Date();

        const csvHeader = "time,long,short";
        const csvBody = liquidationsCache
            .map(l => `${l.time},${l.long},${l.short}`)
            .join("\n");
        csvCache = `${csvHeader}\n${csvBody}`;

        console.log(`OBTENCIÓN COMPLETA: ${liquidationsCache.length} registros procesados. Caché actualizada.`);

        // Generar HTML
        console.log("GENERANDO respuesta HTML con datos frescos...");
        const tableHeaders = ["fecha/hora (local)", "long", "short"];
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

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);

    } catch (error) {
        console.error("ERROR durante la obtención/procesamiento para la vista HTML:", error);
        return res.status(500).send(`<h3>Error al obtener datos de Coinalyze</h3><pre>${error.message}</pre>`);
    }
});
