const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8083;
const CATALOG_URL = process.env.CATALOG_URL || "http://catalog:8082";

// In-memory: userId -> { items: { productId: qty } }
const carts = new Map();

function getUserId(req) {
  return (req.header("x-user-id") || "demo").trim();
}

function getCart(userId) {
  if (!carts.has(userId)) carts.set(userId, { items: {} });
  return carts.get(userId);
}

// Cache simples do catálogo (para não chamar a cada request)
let catalogCache = { at: 0, products: [] };
const CATALOG_TTL_MS = 10_000;

async function getCatalogProducts() {
  const now = Date.now();
  if (catalogCache.products.length > 0 && now - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.products;
  }

  const resp = await fetch(`${CATALOG_URL}/products`);
  if (!resp.ok) throw new Error("Failed to fetch catalog");
  const data = await resp.json();
  const products = (data && data.items) ? data.items : [];

  catalogCache = { at: now, products };
  return products;
}

app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ready", (req, res) => res.status(200).send("ready"));

app.get("/cart", (req, res) => {
  const userId = getUserId(req);
  const cart = getCart(userId);
  res.json({ userId, items: cart.items });
});

// Retorna carrinho com nome/preço + subtotal (busca no catálogo)
app.get("/cart/expanded", async (req, res) => {
  const userId = getUserId(req);
  const cart = getCart(userId);
  const items = cart.items || {};

  let products = [];
  try {
    products = await getCatalogProducts();
  } catch (e) {
    // Se catálogo cair, ainda devolve o carrinho “cru”
    const raw = Object.keys(items).map(productId => ({
      productId,
      qty: items[productId],
      name: productId,
      price: null,
      lineTotal: null
    }));
    return res.json({ userId, items: raw, totals: { subtotal: null }, warning: "Catalog unavailable" });
  }

  const byId = new Map(products.map(p => [p.id, p]));

  const expanded = Object.keys(items).map(productId => {
    const qty = items[productId];
    const p = byId.get(productId);

    const name = p ? p.name : productId;
    const price = p ? Number(p.price) : null;
    const lineTotal = price != null ? Number((price * qty).toFixed(2)) : null;

    return { productId, qty, name, price, lineTotal };
  });

  const subtotal = expanded.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
  res.json({ userId, items: expanded, totals: { subtotal: Number(subtotal.toFixed(2)) } });
});

// Adiciona qty (incremento genérico)
app.post("/cart/items", (req, res) => {
  const userId = getUserId(req);
  const { productId, qty } = req.body || {};

  if (!productId || !Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: "Send { productId, qty } with qty > 0" });
  }

  const cart = getCart(userId);
  cart.items[productId] = (cart.items[productId] || 0) + qty;

  res.status(201).json({ userId, items: cart.items });
});

// Incrementa 1 unidade do item
app.post("/cart/items/:productId/inc", (req, res) => {
  const userId = getUserId(req);
  const productId = req.params.productId;

  const cart = getCart(userId);
  cart.items[productId] = (cart.items[productId] || 0) + 1;

  res.json({ userId, items: cart.items });
});

// Decrementa 1 unidade do item (remove se chegar a 0)
app.post("/cart/items/:productId/dec", (req, res) => {
  const userId = getUserId(req);
  const productId = req.params.productId;

  const cart = getCart(userId);
  const current = cart.items[productId];

  if (!current) {
    return res.status(404).json({ error: "Item not in cart" });
  }

  const next = current - 1;
  if (next <= 0) delete cart.items[productId];
  else cart.items[productId] = next;

  res.json({ userId, items: cart.items });
});

// Remove item por completo
app.delete("/cart/items/:productId", (req, res) => {
  const userId = getUserId(req);
  const productId = req.params.productId;

  const cart = getCart(userId);
  delete cart.items[productId];

  res.json({ userId, items: cart.items });
});

app.post("/cart/clear", (req, res) => {
  const userId = getUserId(req);
  carts.set(userId, { items: {} });
  res.json({ userId, items: {} });
});

app.listen(PORT, () => {
  console.log(`cart listening on :${PORT}`);
});
