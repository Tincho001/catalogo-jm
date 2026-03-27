const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Us9eguQTPAH9ysk1OpoIYZFdRWB5fuLoWzFZ3aGEZZY/export?format=csv&gid=113381149";

let allProducts = [];
let filteredProducts = [];
let openBrand = "";

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
      stock: row.stock || "Consultar",
      orden_marca: Number(row.orden_marca || 9999),
      orden_producto:
        row.orden_producto === "" || row.orden_producto == null
          ? null
          : Number(row.orden_producto),
    }))
    .filter(row => row.marca && row.modelo && row.precio);
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
  const sortedProducts = [...products].sort((a, b) => {
    if (a.orden_marca !== b.orden_marca) {
      return a.orden_marca - b.orden_marca;
    }

    if (a.marca !== b.marca) {
      return a.marca.localeCompare(b.marca, "es");
    }

    const aHasOrder = a.orden_producto !== null && !Number.isNaN(a.orden_producto);
    const bHasOrder = b.orden_producto !== null && !Number.isNaN(b.orden_producto);

    if (aHasOrder && bHasOrder && a.orden_producto !== b.orden_producto) {
      return a.orden_producto - b.orden_producto;
    }

    if (aHasOrder && !bHasOrder) return -1;
    if (!aHasOrder && bHasOrder) return 1;

    return a.modelo.localeCompare(b.modelo, "es");
  });

  return sortedProducts.reduce((acc, item) => {
    if (!acc[item.marca]) acc[item.marca] = [];
    acc[item.marca].push(item);
    return acc;
  }, {});
}

function getOrderedBrands(grouped) {
  return Object.keys(grouped).sort((a, b) => {
    const aItem = grouped[a][0];
    const bItem = grouped[b][0];

    if (aItem.orden_marca !== bItem.orden_marca) {
      return aItem.orden_marca - bItem.orden_marca;
    }

    return a.localeCompare(b, "es");
  });
}

function scrollToBrandCard(brand) {
  requestAnimationFrame(() => {
    const target = document.querySelector(`[data-brand-card="${CSS.escape(brand)}"]`);
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function renderBrandTabs(grouped) {
  const tabs = document.getElementById("brandTabs");
  tabs.innerHTML = "";

  const brands = getOrderedBrands(grouped);

  brands.forEach(brand => {
    const btn = document.createElement("button");
    btn.className = `brand-tab ${openBrand === brand ? "active" : ""}`;
    btn.textContent = brand;

    btn.addEventListener("click", () => {
      openBrand = brand;
      renderAll();
      scrollToBrandCard(brand);
    });

    tabs.appendChild(btn);
  });
}

function renderCatalog(products) {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = "";

  if (!products.length) {
    catalog.innerHTML = `<div class="msg">No se encontraron productos.</div>`;
    document.getElementById("brandTabs").innerHTML = "";
    return;
  }

  const grouped = groupByBrand(products);
  const brands = getOrderedBrands(grouped);

  if (!openBrand && brands.length) {
    openBrand = brands[0];
  }

  renderBrandTabs(grouped);

  brands.forEach(brand => {
    const items = grouped[brand];
    const isOpen = openBrand === brand;

    const brandCard = document.createElement("div");
    brandCard.className = "brand-card";
    brandCard.setAttribute("data-brand-card", brand);

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

      if (!isOpen) {
        scrollToBrandCard(brand);
      }
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
  const rows = parseCSV(text);
  return normalizeProducts(rows);
}

async function init() {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = `<div class="msg">Cargando productos...</div>`;

  try {
    allProducts = await loadProducts();
    filteredProducts = [...allProducts];

    const grouped = groupByBrand(filteredProducts);
    const brands = getOrderedBrands(grouped);
    openBrand = brands[0] || "";

    renderAll();

    const input = document.getElementById("searchInput");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();

      filteredProducts = allProducts.filter(item =>
        `${item.marca} ${item.modelo} ${item.calidad} ${item.stock}`
          .toLowerCase()
          .includes(q)
      );

      const filteredGrouped = groupByBrand(filteredProducts);
      const filteredBrands = getOrderedBrands(filteredGrouped);

      if (!filteredBrands.includes(openBrand)) {
        openBrand = filteredBrands[0] || "";
      }

      renderAll();
    });
  } catch (error) {
    console.error(error);
    catalog.innerHTML = `<div class="msg">No se pudieron cargar los productos.</div>`;
  }
}

init();