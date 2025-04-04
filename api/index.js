let cache = {
  price: null,
  time: null
};

export default async function handler(req, res) {
  // Si se accede con ?download en la URL, se descarga el archivo
  if (req.query.download !== undefined) {
    if (!cache.price || !cache.time) {
      return res.status(400).send('No hay datos almacenados. Visita la página principal primero.');
    }

    const content = `Precio BTC: ${cache.price}\nHora: ${cache.time}`;
    res.setHeader('Content-Disposition', 'attachment; filename=btc_info.txt');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(content);
  }

  // Cada vez que se accede, actualiza el precio
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');

    if (!response.ok) {
      throw new Error('Error al obtener datos de CoinGecko');
    }

    const data = await response.json();
    const now = new Date().toISOString();

    cache.price = data.bitcoin.usd;
    cache.time = now;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <h2>Precio BTC actualizado:</h2>
      <p><strong>Precio:</strong> $${data.bitcoin.usd}</p>
      <p><strong>Hora:</strong> ${now}</p>
      <p>Servidor corriendo correctamente</p>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al consultar CoinGecko');
  }
}
