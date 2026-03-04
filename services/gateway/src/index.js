const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8081;

const CATALOG_URL = process.env.CATALOG_URL || "http://catalog:8082";
const CART_URL = process.env.CART_URL || "http://cart:8083";
const ORDER_URL = process.env.ORDER_URL || "http://order:8084";

app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ready", (req, res) => res.status(200).send("ready"));

async function proxyJson(req, res, baseUrl, stripPrefix) {
  const path = req.originalUrl.replace(stripPrefix, "");
  const url = `${baseUrl}${path}`;

  const headers = { ...req.headers };
  delete headers.host;
  headers["content-type"] = "application/json";

  const init = {
    method: req.method,
    headers
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = JSON.stringify(req.body || {});
  }

  const upstream = await fetch(url, init);
  const text = await upstream.text();

  res.status(upstream.status);
  // repassa json quando possível, senão texto
  try {
    res.json(JSON.parse(text));
  } catch {
    res.send(text);
  }
}

app.use("/api/catalog", (req, res) => proxyJson(req, res, CATALOG_URL, "/api/catalog"));
app.use("/api/cart", (req, res) => proxyJson(req, res, CART_URL, "/api/cart"));
app.use("/api/order", (req, res) => proxyJson(req, res, ORDER_URL, "/api/order"));

app.listen(PORT, () => {
  console.log(`gateway listening on :${PORT}`);
});
