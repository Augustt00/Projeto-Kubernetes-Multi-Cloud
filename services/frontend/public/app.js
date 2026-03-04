function getUserId() {
  return document.getElementById("userId").value.trim() || "demo";
}

async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, {
    "content-type": "application/json",
    "x-user-id": getUserId()
  });

  const res = await fetch(path, { ...opts, headers });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

function route() {
  const h = (location.hash || "").replace("#", "");
  return h || "/catalog";
}

function navigate(to) {
  location.hash = to;
}

function setActiveNav(r) {
  const map = {
    "/catalog": "navCatalog",
    "/cart": "navCart",
    "/checkout": "navCheckout",
    "/payment": "navPayment"
  };

  for (const id of ["navCatalog", "navCart", "navCheckout", "navPayment"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.remove("active");
  }

  const active = map[r];
  if (active) document.getElementById(active).classList.add("active");
}

function viewEl() {
  return document.getElementById("view");
}

function money(n) {
  try { return `R$ ${Number(n).toFixed(2)}`; } catch { return `R$ ${n}`; }
}

let lastOrder = null;
let productCache = null;

async function loadProducts() {
  const out = await api("/api/catalog/products");
  if (!out.ok) throw new Error("Falha ao carregar produtos");
  productCache = out.data.items || [];
  return productCache;
}

async function loadCart() {
  const out = await api("/api/cart/cart");
  if (!out.ok) throw new Error("Falha ao carregar carrinho");
  return out.data.items || {};
}

// NOVA FUNÇÃO HELPER ADICIONADA
async function loadCartExpanded() {
  const out = await api("/api/cart/cart/expanded");
  if (!out.ok) throw new Error("Falha ao carregar carrinho");
  return out.data; // { userId, items: [...], totals: { subtotal } }
}

function cartToLines(items) {
  const ids = Object.keys(items || {});
  if (ids.length === 0) return [{ title: "Carrinho vazio", subtitle: "Adicione itens no catálogo." }];

  return ids.map(id => ({
    id,
    title: id,
    subtitle: `Quantidade: ${items[id]}`
  }));
}

async function renderCatalog() {
  setActiveNav("/catalog");
  const el = viewEl();
  el.innerHTML = `
    <div class="panel">
      <h2>Catálogo</h2>
      <div class="muted">Clique em “Adicionar” para ir direto para o carrinho.</div>
      <div id="products" class="list" style="margin-top:12px;"></div>
    </div>
  `;

  const list = document.getElementById("products");

  let products = productCache;
  if (!products) {
    try { products = await loadProducts(); }
    catch (e) { list.innerHTML = `<div class="card">Erro: ${e.message}</div>`; return; }
  }

  list.innerHTML = "";
  for (const p of products) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${p.name}</h3>
      <div class="muted">${p.description}</div>
      <div style="margin-top:6px;"><strong>${money(p.price)}</strong></div>
      <div class="row" style="margin-top:10px;">
        <button data-id="${p.id}">Adicionar ao carrinho</button>
      </div>
    `;

    card.querySelector("button").addEventListener("click", async () => {
      await api("/api/cart/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: p.id, qty: 1 })
      });
      navigate("/cart");
    });

    list.appendChild(card);
  }
}

async function renderCart() {
  setActiveNav("/cart");
  const el = viewEl();

  el.innerHTML = `
    <div class="panel">
      <h2>Carrinho</h2>
      <div class="row" style="justify-content: space-between; margin-bottom: 10px;">
        <div class="muted">Revise os itens e continue para o checkout.</div>
        <div class="row">
          <button class="secondary" id="btnBack">Voltar ao catálogo</button>
          <button class="danger" id="btnClear">Limpar carrinho</button>
        </div>
      </div>

      <div id="cartList" class="list"></div>

      <div class="row" style="margin-top: 12px; justify-content: flex-end;">
        <button id="btnCheckout">Continuar para checkout</button>
      </div>
    </div>
  `;

  document.getElementById("btnBack").addEventListener("click", () => navigate("/catalog"));

  document.getElementById("btnClear").addEventListener("click", async () => {
    await api("/api/cart/cart/clear", { method: "POST", body: JSON.stringify({}) });
    await renderCart();
  });

  const list = document.getElementById("cartList");

  // TRECHO ATUALIZADO (NOVO RENDER DO CARRINHO)
  let data;
  try { data = await loadCartExpanded(); }
  catch (e) { list.innerHTML = `<div class="card">Erro: ${e.message}</div>`; return; }

  const expanded = data.items || [];
  if (expanded.length === 0) {
    list.innerHTML = `<div class="card">Carrinho vazio</div>`;
    document.getElementById("btnCheckout").disabled = true;
    return;
  }

  list.innerHTML = "";
  for (const it of expanded) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="row" style="justify-content: space-between;">
        <div>
          <div><strong>${it.name}</strong> <span class="muted">(${it.productId})</span></div>
          <div class="muted">Preço: ${it.price != null ? money(it.price) : "-"}</div>
          <div class="muted">Quantidade: ${it.qty}</div>
          <div style="margin-top:6px;"><strong>Total item:</strong> ${it.lineTotal != null ? money(it.lineTotal) : "-"}</div>
        </div>
        <div class="row">
          <button class="secondary" data-dec="${it.productId}">-1</button>
          <button class="secondary" data-inc="${it.productId}">+1</button>
          <button class="danger" data-del="${it.productId}">Remover</button>
        </div>
      </div>
    `;

    card.querySelector(`[data-inc="${it.productId}"]`).addEventListener("click", async () => {
      await api(`/api/cart/cart/items/${it.productId}/inc`, { method: "POST", body: JSON.stringify({}) });
      await renderCart();
    });

    card.querySelector(`[data-dec="${it.productId}"]`).addEventListener("click", async () => {
      await api(`/api/cart/cart/items/${it.productId}/dec`, { method: "POST", body: JSON.stringify({}) });
      await renderCart();
    });

    card.querySelector(`[data-del="${it.productId}"]`).addEventListener("click", async () => {
      await api(`/api/cart/cart/items/${it.productId}`, { method: "DELETE" });
      await renderCart();
    });

    list.appendChild(card);
  }

  // Mostra subtotal
  const subtotal = data.totals && data.totals.subtotal != null ? data.totals.subtotal : null;
  const subtotalCard = document.createElement("div");
  subtotalCard.className = "card";
  subtotalCard.innerHTML = `
    <div class="row" style="justify-content: space-between;">
      <div><strong>Subtotal</strong></div>
      <div><strong>${subtotal != null ? money(subtotal) : "-"}</strong></div>
    </div>
  `;
  list.appendChild(subtotalCard);

  document.getElementById("btnCheckout").addEventListener("click", () => navigate("/checkout"));
}

async function renderCheckout() {
  setActiveNav("/checkout");
  const el = viewEl();

  el.innerHTML = `
    <div class="panel">
      <h2>Checkout</h2>
      <div class="muted">Confirme os itens e siga para o pagamento.</div>

      <div class="grid" style="margin-top: 12px;">
        <div class="card">
          <h3>Entrega (mock)</h3>
          <div class="muted">Endereço e frete podem ser adicionados depois.</div>
          <div style="margin-top:10px;" class="row">
            <input id="address" placeholder="Endereço (opcional)" style="flex:1; min-width: 220px;" />
          </div>
        </div>

        <div class="card">
          <h3>Resumo</h3>
          <div id="checkoutItems" class="muted">Carregando...</div>
        </div>
      </div>

      <div class="row" style="margin-top: 12px; justify-content: flex-end;">
        <button class="secondary" id="btnBackCart">Voltar ao carrinho</button>
        <button id="btnGoPay">Ir para pagamento</button>
      </div>
    </div>
  `;

  document.getElementById("btnBackCart").addEventListener("click", () => navigate("/cart"));
  document.getElementById("btnGoPay").addEventListener("click", () => navigate("/payment"));

  // TRECHO ATUALIZADO (NOVO RENDER DO CHECKOUT)
  let data;
  try { data = await loadCartExpanded(); }
  catch (e) { document.getElementById("checkoutItems").textContent = `Erro: ${e.message}`; return; }

  const expanded = data.items || [];
  if (expanded.length === 0) {
    document.getElementById("checkoutItems").textContent = "Carrinho vazio.";
    document.getElementById("btnGoPay").disabled = true;
    return;
  }

  const lines = expanded
    .map(it => `${it.name} (${it.productId}) x${it.qty} = ${it.lineTotal != null ? money(it.lineTotal) : "-"}`)
    .join(" | ");
  
  const subtotal = data.totals && data.totals.subtotal != null ? money(data.totals.subtotal) : "-";
  
  document.getElementById("checkoutItems").textContent = `${lines} | Subtotal: ${subtotal}`;
}

async function renderPayment() {
  setActiveNav("/payment");
  const el = viewEl();

  el.innerHTML = `
    <div class="panel">
      <h2>Pagamento (mock)</h2>
      <div class="muted">Ao clicar “Pagar”, o pedido será criado e o carrinho será limpo.</div>

      <div class="card" style="margin-top: 12px;">
        <div class="row">
          <label for="method" class="muted">Método:</label>
          <select id="method">
            <option value="pix">PIX</option>
            <option value="card">Cartão (fake)</option>
            <option value="boleto">Boleto (fake)</option>
          </select>
          <button id="btnPay">Pagar</button>
          <button class="secondary" id="btnBackCheckout">Voltar</button>
        </div>
        <pre id="payResult"></pre>
      </div>
    </div>
  `;

  document.getElementById("btnBackCheckout").addEventListener("click", () => navigate("/checkout"));

  document.getElementById("btnPay").addEventListener("click", async () => {
    const pre = document.getElementById("payResult");
    pre.textContent = "Processando...";

    const out = await api("/api/order/orders", { method: "POST", body: JSON.stringify({ method: document.getElementById("method").value }) });
    if (!out.ok) {
      pre.textContent = JSON.stringify(out.data, null, 2);
      return;
    }

    lastOrder = out.data;
    pre.textContent = JSON.stringify(lastOrder, null, 2);
    navigate("/success");
  });
}

function renderSuccess() {
  setActiveNav("/success");
  const el = viewEl();

  const data = lastOrder
    ? `<pre>${escapeHtml(JSON.stringify(lastOrder, null, 2))}</pre>`
    : `<div class="card">Nenhum pedido recente. Volte ao catálogo e finalize um pedido.</div>`;

  el.innerHTML = `
    <div class="panel">
      <h2>Pagamento aprovado</h2>
      <div class="muted">Pedido criado com sucesso.</div>

      <div style="margin-top:12px;">
        ${data}
      </div>

      <div class="row" style="margin-top: 12px; justify-content: flex-end;">
        <button id="btnNew">Voltar ao catálogo</button>
      </div>
    </div>
  `;

  document.getElementById("btnNew").addEventListener("click", () => navigate("/catalog"));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function render() {
  const r = route();

  if (r === "/catalog") return renderCatalog();
  if (r === "/cart") return renderCart();
  if (r === "/checkout") return renderCheckout();
  if (r === "/payment") return renderPayment();
  if (r === "/success") return renderSuccess();

  // fallback
  navigate("/catalog");
}

document.getElementById("reload").addEventListener("click", async () => {
  productCache = null;
  await render();
});

window.addEventListener("hashchange", render); // troca de “telas” via #/rota [web:92]

if (!location.hash) navigate("/catalog");
render();