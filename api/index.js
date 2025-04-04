let cache = {
  price: null,
  time: null
};

export default async function handler(req, res) {
  if (req.url === '/download') {
    if (!cache.price || !cache.time) {
      return res.status(400).send('No hay datos almacenados. Visita la página principal primero.');
    }

    const content = `Precio BTCUSDT: ${cache.price}\nHora: ${cache.time}`;
    res.setHeader('Content-Disposition', 'attachment; filename=btc_info.txt');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(content);
  }

  // Si no es /download, actualiza el precio desde Binance
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    if (!response.ok) {
      throw new Error('Error al obtener datos de Binance');
    }

    const data = await response.json();

    const now = new Date().toISOString();
    cache.price = data.price;
    cache.time = now;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <h2>Precio BTCUSDT actualizado:</h2>
      <p><strong>Precio:</strong> ${data.price}</p>
      <p><strong>Hora:</strong> ${now}</p>
      <p>Servidor corriendo correctamente</p>
    `);
  } catch (err) {
    res.status(500).send('Error al consultar Binance');
  }
}
