const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Us9eguQTPAH9ysk1OpoIYZFdRWB5fuLoWzFZ3aGEZZY/export?format=csv&gid=113381149";

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map(v => v.trim());
}

function parseCSV(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter(line => line.trim() !== "");

  if (!lines.length) return [];

  const headers = parseCSVLine(lines[0]).map(h =>
    h.trim().toLowerCase().replace(/\s+/g, "")
  );

  return lines.map(line => parseCSVLine(line));

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const item = {};
    headers.forEach((header, index) => {
      item[header] = (values[index] || "").trim();
    });
    return item;
  });
}

function parseCSVFixed(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter(line => line.trim() !== "");

  if (!lines.length) return [];

  const headers = parseCSVLine(lines[0]).map(h =>
    h.trim().toLowerCase().replace(/\s+/g, "")
  );

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const item = {};
    headers.forEach((header, index) => {
      item[header] = (values[index] || "").trim();
    });
    return item;
  });
}

function normalizeProducts(rows) {
  return rows
    .map(row => ({
      marca: row.marca || "General",
      modelo: row.modelo || "",
      calidad: row.calidad || "",
      precio: row.precio || row.precios || "",
      stock: row.stock || "Consultar"
    }))
    .filter(row => row.modelo && row.precio);
}

function formatPrice(value) {
  const cleaned = String(value).replace(/[^\d]/g, "");
  if (!cleaned) return value;
  return "$" + Number(cleaned).toLocaleString("es-AR");
}

function stockClass(stock) {
  const s = String(stock).toUpperCase();
  if (s.includes("AGOTADO")) return "stock-no";
  if (s.includes("POCAS")) return "stock-low";
  return "stock-ok";
}

function groupByBrand(products) {
  return products.reduce((acc, item) => {
    if (!acc[item.marca]) acc[item.marca] = [];
    acc[item.marca].push(item);
    return acc;
  }, {});
}

let allProducts = [];
let filteredProducts = [];
let openBrand = "";

function renderBrandTabs(grouped) {
  const tabs = document.getElementById("brandTabs");
  tabs.innerHTML = "";

  Object.keys(grouped).forEach(brand => {
    const btn = document.createElement("button");
    btn.className = `brand-tab ${openBrand === brand ? "active" : ""}`;
    btn.textContent = brand;
    btn.addEventListener("click", () => {
      openBrand = brand;
      renderAll();
    });
    tabs.appendChild(btn);
  });
}

function renderCatalog(products) {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = "";

  if (!products.length) {
    catalog.innerHTML = `<div class="msg">No se encontraron productos.</div>`;
    return;
  }

  const grouped = groupByBrand(products);
  const brands = Object.keys(grouped);

  if (!openBrand && brands.length) {
    openBrand = brands[0];
  }

  renderBrandTabs(grouped);

  brands.forEach(brand => {
    const items = grouped[brand];
    const isOpen = openBrand === brand;

    const brandCard = document.createElement("div");
    brandCard.className = "brand-card";

    const bodyHtml = isOpen
      ? `
        <div class="brand-body">
          ${items.map(item => `
            <div class="product-card">
              <div class="product-row">
                <div>
                  <div class="product-model">${item.modelo}</div>
                  <div class="product-quality">${item.calidad}</div>
                  <span class="stock-badge ${stockClass(item.stock)}">${item.stock}</span>
                </div>
                <div class="product-price">${formatPrice(item.precio)}</div>
              </div>
            </div>
          `).join("")}
        </div>
      `
      : "";

    brandCard.innerHTML = `
      <button class="brand-header ${isOpen ? "open" : ""}">
        <div>
          <div class="brand-name">${brand}</div>
          <div class="brand-count">${items.length} modelos</div>
        </div>
        <div class="chevron">⌄</div>
      </button>
      ${bodyHtml}
    `;

    brandCard.querySelector(".brand-header").addEventListener("click", () => {
      openBrand = isOpen ? "" : brand;
      renderAll();
    });

    catalog.appendChild(brandCard);
  });
}

function renderAll() {
  renderCatalog(filteredProducts);
}

async function loadProducts() {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error("No se pudo leer la hoja");
  const text = await res.text();
  const rows = parseCSVFixed(text);
  return normalizeProducts(rows);
}

async function init() {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = `<div class="msg">Cargando productos...</div>`;

  try {
    allProducts = await loadProducts();
    filteredProducts = [...allProducts];
    renderAll();

    const input = document.getElementById("searchInput");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();

      filteredProducts = allProducts.filter(item =>
        `${item.marca} ${item.modelo} ${item.calidad} ${item.stock}`
          .toLowerCase()
          .includes(q)
      );

      const grouped = groupByBrand(filteredProducts);
      const brands = Object.keys(grouped);

      if (!brands.includes(openBrand)) {
        openBrand = brands[0] || "";
      }

      renderAll();
    });
  } catch (error) {
    console.error(error);
    catalog.innerHTML = `<div class="msg">No se pudieron cargar los productos.</div>`;
  }
}

init();