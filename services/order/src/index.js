const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8084;
const CART_URL = process.env.CART_URL || "http://cart:8083";

const orders = []; // in-memory

function getUserId(req) {
  return (req.header("x-user-id") || "demo").trim();
}

app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ready", (req, res) => res.status(200).send("ready"));

app.get("/orders", (req, res) => {
  const userId = getUserId(req);
  res.json({ userId, items: orders.filter(o => o.userId === userId) });
});

app.post("/orders", async (req, res) => {
  const userId = getUserId(req);

  const cartResp = await fetch(`${CART_URL}/cart`, {
    headers: { "x-user-id": userId }
  });

  if (!cartResp.ok) {
    return res.status(502).json({ error: "Could not read cart" });
  }

  const cart = await cartResp.json();
  const items = cart.items || {};
  const productIds = Object.keys(items);

  if (productIds.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const order = {
    id: `o_${Date.now()}`,
    userId,
    createdAt: new Date().toISOString(),
    items
  };

  orders.push(order);

  // Clear cart
  await fetch(`${CART_URL}/cart/clear`, {
    method: "POST",
    headers: { "x-user-id": userId }
  });

  res.status(201).json(order);
});

app.listen(PORT, () => {
  console.log(`order listening on :${PORT}`);
});
