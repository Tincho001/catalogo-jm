const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/11PyDaHItS4BU8SJmGzszvdlsd_CMBlY9b7SuTrbYtjY/export?format=csv&gid=1666562584";

const WHATSAPP_NUMBER = "542616940727";

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
    } else if (char === "," && !inQuotes) {
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

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] || "";
    });
    return item;
  });
}

function normalizeProducts(rows) {
  return rows
    .filter(row => row.modelo && row.precio)
    .map(row => ({
      marca: row.marca || "General",
      modelo: row.modelo,
      calidad: row.calidad || "",
      precio: row.precio,
      stock: row.stock || "Consultar",
      visible: (row.visible || "SI").toUpperCase(),
      orden: Number(row.orden || 9999)
    }))
    .filter(row => row.visible !== "NO");
}

function stockClass(stock) {
  const s = stock.toUpperCase();
  if (s.includes("AGOTADO")) return "no";
  if (s.includes("POCAS")) return "low";
  return "ok";
}

function formatPrice(value) {
  const cleaned = String(value).replace(/[^\d]/g, "");
  if (!cleaned) return value;
  return "$" + Number(cleaned).toLocaleString("es-AR");
}

function groupByBrand(products) {
  return products.reduce((acc, item) => {
    if (!acc[item.marca]) acc[item.marca] = [];
    acc[item.marca].push(item);
    return acc;
  }, {});
}

function renderProducts(products) {
  const container = document.getElementById("catalog");
  container.innerHTML = "";

  if (!products.length) {
    container.innerHTML = '<div class="msg">No se encontraron productos.</div>';
    return;
  }

  const grouped = groupByBrand(products);

  Object.keys(grouped).forEach(brand => {
    const title = document.createElement("div");
    title.className = "brand";
    title.textContent = brand;
    container.appendChild(title);

    grouped[brand]
      .sort((a, b) => a.orden - b.orden)
      .forEach(item => {
        const card = document.createElement("div");
        card.className = "item";

        const text = encodeURIComponent(
          `Hola, quiero consultar por ${item.marca} ${item.modelo}`
        );

        card.innerHTML = `
          <div class="row">
            <div>
              <div class="model">${item.modelo}</div>
              <div class="quality">${item.calidad}</div>
              <span class="badge ${stockClass(item.stock)}">${item.stock}</span>
            </div>
            <div class="price">${formatPrice(item.precio)}</div>
          </div>
          <a class="btn" target="_blank" href="https://wa.me/${WHATSAPP_NUMBER}?text=${text}">
            Consultar
          </a>
        `;

        container.appendChild(card);
      });
  });
}

async function loadProducts() {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error("No se pudo leer el CSV");
  const text = await res.text();
  return normalizeProducts(parseCSV(text));
}

async function init() {
  const container = document.getElementById("catalog");
  container.innerHTML = '<div class="msg">Cargando productos...</div>';

  try {
    const products = await loadProducts();
    renderProducts(products);

    const input = document.getElementById("searchInput");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      const filtered = products.filter(item =>
        `${item.marca} ${item.modelo} ${item.calidad}`.toLowerCase().includes(q)
      );
      renderProducts(filtered);
    });
  } catch (error) {
    console.error(error);
    container.innerHTML =
      '<div class="msg">No se pudieron cargar los productos. Revisá que la hoja WEB esté publicada como CSV.</div>';
  }
}

init();