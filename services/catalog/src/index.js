const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8082;

const products = [
  { id: "p1", name: "Camiseta", price: 49.9, description: "Camiseta básica 100% algodão" },
  { id: "p2", name: "Caneca", price: 29.9, description: "Caneca 300ml" },
  { id: "p3", name: "Boné", price: 59.9, description: "Boné ajustável" },
  { id: "p4", name: "Mochila", price: 129.9, description: "Mochila resistente à água 20L" },
  { id: "p5", name: "Fone de Ouvido", price: 199.9, description: "Fone Bluetooth com cancelamento de ruído" },
  { id: "p6", name: "Relógio Digital", price: 149.9, description: "Relógio digital com resistência à água" },
  { id: "p7", name: "Teclado Mecânico", price: 349.9, description: "Teclado mecânico RGB switch azul" },
  { id: "p8", name: "Mouse Gamer", price: 159.9, description: "Mouse gamer com sensor de alta precisão e iluminação RGB" },
  { id: "p9", name: "Cadeira Gamer", price: 899.9, description: "Cadeira gamer ergonômica com apoio lombar e ajuste de altura" },
  { id: "p10", name: "Monitor 24\"", price: 999.9, description: "Monitor Full HD 24 polegadas com painel IPS" },
  { id: "p11", name: "Webcam HD", price: 249.9, description: "Webcam HD 1080p com microfone embutido" },
  { id: "p12", name: "Headset Gamer", price: 299.9, description: "Headset gamer com som surround e microfone removível" }
];

app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ready", (req, res) => res.status(200).send("ready"));

app.get("/products", (req, res) => {
  res.json({ items: products });
});

app.get("/products/:id", (req, res) => {
  const p = products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Product not found" });
  res.json(p);
});

app.listen(PORT, () => {
  console.log(`catalog listening on :${PORT}`);
});