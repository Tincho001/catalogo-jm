const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Us9eguQTPAH9ysk1OpoIYZFdRWB5fuLoWzFZ3aGEZZY/export?format=csv&gid=113381149";

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
      marca: row.marca || row.marca1 || "General",
      modelo: row.modelo || "",
      calidad: row.calidad || "",
      precio: row.precio || row.precios || "",
      stock: row.stock || "Consultar"
    }))
    .filter(row => row.modelo !== "" && row.precio !== "");
}

function stockClass(stock) {
  const s = String(stock).toUpperCase();
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
    container.innerHTML = `
      <div class="msg">
        No se encontraron productos.<br><br>
        Revisá que en la hoja WEB la fila 1 tenga exactamente:<br>
        <strong>MARCA | MODELO | CALIDAD | PRECIOS | STOCK</strong>
      </div>
    `;
    return;
  }

  const grouped = groupByBrand(products);

  Object.keys(grouped).forEach(brand => {
    const title = document.createElement("div");
    title.className = "brand";
    title.textContent = brand;
    container.appendChild(title);

    grouped[brand].forEach(item => {
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

async function init() {
  const container = document.getElementById("catalog");
  container.innerHTML = '<div class="msg">Cargando productos...</div>';

  try {
    const res = await fetch(SHEET_CSV_URL);
    const text = await res.text();

    const rows = parseCSV(text);
    const products = normalizeProducts(rows);

    console.log("CSV crudo:", text);
    console.log("Filas parseadas:", rows);
    console.log("Productos finales:", products);

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
      '<div class="msg">No se pudieron cargar los productos.</div>';
  }
}

init();