const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const GATEWAY_URL = process.env.GATEWAY_URL || "http://gateway:8081";

app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ready", (req, res) => res.status(200).send("ready"));

async function proxyToGateway(req, res) {
  const url = `${GATEWAY_URL}${req.originalUrl}`;

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
  try {
    res.json(JSON.parse(text));
  } catch {
    res.send(text);
  }
}

app.use("/api", proxyToGateway);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`frontend listening on :${PORT}`);
});
