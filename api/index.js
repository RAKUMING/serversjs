let cache = {
  liquidations: null,
  time: null
};

export default async function handler(req, res) {
  // Si se accede con ?download en la URL, se descarga el archivo
  if (req.query.download !== undefined) {
    if (!cache.liquidations || !cache.time) {
      return res.status(400).send('No hay datos almacenados. Visita la página principal primero.');
    }

    // Convertimos las liquidaciones a un formato de texto
    const content = `Liquidaciones de BTC en las últimas 24 horas:\n${cache.liquidations.join('\n')}\nHora: ${cache.time}`;
    res.setHeader('Content-Disposition', 'attachment; filename=liquidaciones_btc.txt');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(content);
  }

  // Verifica si ya hay datos y los borra antes de obtener nuevos
  if (cache.liquidations !== null || cache.time !== null) {
    cache.liquidations = null;
    cache.time = null;
  }

  // Si ambos valores están vacíos, llama a la API
  if (cache.liquidations === null && cache.time === null) {
    try {
      // Generamos los valores necesarios para la consulta
      const nonce = Math.random().toString(36).substring(2, 15);
      const cacheBuster = Date.now();
      const now = new Date();
      now.setSeconds(0);
      now.setMilliseconds(0);
      const toTimestamp = Math.floor(now.getTime() / 1000);
      const fromTimestamp = toTimestamp - (24 * 60 * 60); // 24 horas atrás
      const apiKey = process.env.COINALYZE_API_KEY;

      if (!apiKey) {
        throw new Error("Configuración incompleta: falta la API Key de Coinalyze.");
      }

      // URL para obtener los datos de liquidación de BTC
      const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false`;

      // Realizamos la solicitud a la API de Coinalyze desde el backend
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Error al obtener los datos de liquidaciones de Coinalyze');
      }

      const data = await response.json();
      const nowStr = new Date().toISOString();

      // Almacenamos las liquidaciones y la hora actual
      cache.liquidations = data.data.map(item => `${item.timestamp}: ${item.size} contratos`);
      cache.time = nowStr;

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`
        <h2>Último descargado:</h2>
        <p><strong>Liquidaciones:</strong></p>
        <ul>
          ${cache.liquidations.map(liquidation => `<li>${liquidation}</li>`).join('')}
        </ul>
        <p><strong>Hora:</strong> ${nowStr}</p>
        <p>Servidor corriendo correctamente..</p>
      `);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error al consultar Coinalyze');
    }
  }
}
