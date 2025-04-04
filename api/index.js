const fetch = require("node-fetch");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.COINALYZE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API Key missing" });
  }

  const now = new Date();
  now.setSeconds(0);
  now.setMilliseconds(0);
  const toTimestamp = Math.floor(now.getTime() / 1000);
  const fromTimestamp = toTimestamp - 24 * 60 * 60;

  const nonce = Math.random().toString(36).substring(2, 15);
  const cacheBuster = Date.now();

  const url = `https://api.coinalyze.net/v1/liquidation-history?api_key=${apiKey}&symbols=BTCUSDT_PERP.A&interval=1min&from=${fromTimestamp}&to=${toTimestamp}&convert_to_usd=false&nonce=${nonce}&cache_busting=${cacheBuster}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: "Coinalyze error", details: text });
    }

    const data = await response.json();

    let lastTimestamp = 0;
    if (data?.data?.length > 0) {
      data.data.forEach(item => {
        if (Array.isArray(item.history)) {
          const maxTs = item.history.reduce((max, entry) => {
            const ts = Number(entry.t);
            return !isNaN(ts) ? Math.max(max, ts) : max;
          }, 0);
          lastTimestamp = Math.max(lastTimestamp, maxTs);
        }
      });
    }

    const referenceTimestamp = lastTimestamp || Math.floor(Date.now() / 1000);
    const formattedDate = new Date(referenceTimestamp * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", "_")
      .replace(/:/g, "-");

    const filename = `liquidaciones_${formattedDate}.json`;

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};
