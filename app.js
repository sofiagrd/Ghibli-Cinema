
const API = "https://ghibliapi.vercel.app";

const $ = (selector) => document.querySelector(selector);

const filmGrid = $("#filmGrid");
const favoriteGrid = $("#favoriteGrid");
const dialog = $("#filmDialog");

let films = [];
let favorites = loadFavorites();
let requestVersion = 0;
let toastTimer;

function loadFavorites() {
  try {
    const data = JSON.parse(localStorage.getItem("ghibli-favorites") || "[]");
    return Array.isArray(data) ? data.filter(
      id => typeof id === "string"
    ) : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem("ghibli-favorites", JSON.stringify(favorites));
  } catch {
    showToast("No se pudieron guardar los favoritos en este navegador.");
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
  return response.json();
}

function isFavorite(id) {
  return favorites.includes(id);
}

function filmPoster(film, extraClass = "poster") {
  const image = typeof film.image === "string" &&
    /^https?:\/\//i.test(film.image)
    ? film.image
    : "";

  if (!image) {
    return `<div class="poster-fallback">${escapeHTML(film.title)}</div>`;
  }

  return `<img class="${extraClass}"
    src="${escapeHTML(image)}"
    alt="Cartel de ${escapeHTML(film.title)}"
    loading="lazy">`;
}

function renderCard(film) {
  return `
    <article class="film-card">
      <div class="poster-wrap">
        ${filmPoster(film)}
        <button class="fav-button ${isFavorite(film.id) ? "active" : ""}"
          data-fav="${escapeHTML(film.id)}"
          aria-label="${isFavorite(film.id) ? "Quitar de favoritas" : "Añadir a favoritas"}"
          aria-pressed="${isFavorite(film.id)}">
          ${isFavorite(film.id) ? "♥" : "♡"}
        </button>
      </div>
      <div class="film-info">
        <span class="film-year">${escapeHTML(film.release_date || "Año desconocido")}</span>
        <h3>${escapeHTML(film.title || "Sin título")}</h3>
        <div class="film-director">
          Dirección: ${escapeHTML(film.director || "No especificado")}
        </div>
        <button class="detail-button" data-detail="${escapeHTML(film.id)}">
          Descubrir la historia ↗
        </button>
      </div>
    </article>
  `;
}

function showImageFallbacks(container) {
  container.querySelectorAll("img.poster, img.detail-poster").forEach(img => {
    img.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = img.classList.contains("detail-poster")
        ? "poster-fallback detail-poster"
        : "poster-fallback";
      fallback.textContent = img.alt.replace(/^Cartel de /, "");
      img.replaceWith(fallback);
    }, { once: true });
  });
}

function updateDirectorOptions() {
  const select = $("#directorFilter");
  const previousValue = select.value;

  const directors = [...new Set(
    films.map(film => film.director).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "es"));

  select.innerHTML =
    '<option value="">Todos los directores</option>' +
    directors.map(director =>
      `<option value="${escapeHTML(director)}">${escapeHTML(director)}</option>`
    ).join("");

  if (directors.includes(previousValue)) select.value = previousValue;
}

function getFilteredFilms() {
  const query = $("#searchInput").value.trim().toLocaleLowerCase("es");
  const director = $("#directorFilter").value;
  const favoritesOnly = $("#favoritesOnly").checked;
  const sort = $("#sortFilter").value;

  const result = films.filter(film => {
    const searchable = [
      film.title,
      film.original_title,
      film.original_title_romanised,
      film.director,
      film.description,
      film.producer
    ].filter(Boolean).join(" ").toLocaleLowerCase("es");

    return (!query || searchable.includes(query)) &&
      (!director || film.director === director) &&
      (!favoritesOnly || isFavorite(film.id));
  });

  result.sort((a, b) => {
    if (sort === "year-asc" || sort === "year-desc") {
      const yearA = Number(a.release_date) || 0;
      const yearB = Number(b.release_date) || 0;
      return sort === "year-asc" ? yearA - yearB : yearB - yearA;
    }

    const comparison = (a.title || "").localeCompare(
      b.title || "", "es"
    );

    return sort === "title-asc" ? comparison : -comparison;
  });

  return result;
}

function renderCatalog() {
  const result = getFilteredFilms();

  $("#filmCount").textContent =
    `${result.length} ${result.length === 1 ? "película" : "películas"}`;

  if (result.length === 0) {
    filmGrid.innerHTML = `
      <div class="empty-state">
        <h3>No encontramos esa historia</h3>
        <p>Prueba con otro título o director, o restablece los filtros.</p>
      </div>`;
    return;
  }

  filmGrid.innerHTML = result.map(renderCard).join("");
  showImageFallbacks(filmGrid);
}

function renderFavorites() {
  const selected = favorites
    .map(id => films.find(film => film.id === id))
    .filter(Boolean);

  $("#favoriteCount").textContent = selected.length;

  if (selected.length === 0) {
    favoriteGrid.innerHTML = `
      <div class="empty-state">
        <h3>Tu colección está esperando</h3>
        <p>Pulsa ♡ en una película para guardarla aquí.</p>
      </div>`;
    return;
  }

  favoriteGrid.innerHTML = selected.map(renderCard).join("");
  showImageFallbacks(favoriteGrid);
}

function toggleFavorite(id) {
  const film = films.find(item => item.id === id);
  if (!film) return;

  if (isFavorite(id)) {
    favorites = favorites.filter(item => item !== id);
    showToast(`«${film.title}» se quitó de tus favoritas.`);
  } else {
    favorites.push(id);
    showToast(`«${film.title}» se guardó en tus favoritas.`);
  }

  saveFavorites();
  renderCatalog();
  renderFavorites();
}

function onCardClick(event) {
  const favoriteButton = event.target.closest("[data-fav]");
  const detailButton = event.target.closest("[data-detail]");

  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.fav);
  } else if (detailButton) {
    openFilm(detailButton.dataset.detail);
  }
}

filmGrid.addEventListener("click", onCardClick);
favoriteGrid.addEventListener("click", onCardClick);

// Búsqueda y filtros.
let searchTimer;

$("#searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderCatalog, 160);
});

$("#clearSearch").addEventListener("click", () => {
  $("#searchInput").value = "";
  renderCatalog();
  $("#searchInput").focus();
});

$("#directorFilter").addEventListener("change", renderCatalog);
$("#sortFilter").addEventListener("change", renderCatalog);
$("#favoritesOnly").addEventListener("change", renderCatalog);

$("#resetFilters").addEventListener("click", () => {
  $("#searchInput").value = "";
  $("#directorFilter").value = "";
  $("#sortFilter").value = "year-asc";
  $("#favoritesOnly").checked = false;
  renderCatalog();
});

// Ficha individual: consulta el endpoint /films/{id}.
async function openFilm(id) {
  $("#filmDetails").innerHTML =
    '<div class="loading">Abriendo las páginas de esta historia...</div>';

  dialog.showModal();

  try {
    const film = await getJSON(
      `${API}/films/${encodeURIComponent(id)}`
    );

    $("#filmDetails").innerHTML = `
      <div class="detail-layout">
        ${filmPoster(film, "detail-poster")}
        <div class="detail-content">
          <span class="eyebrow">UNA HISTORIA PARA RECORDAR</span>
          <h2>${escapeHTML(film.title || "Sin título")}</h2>
          <div class="detail-original">
            ${escapeHTML(film.original_title || "")}
            ${film.original_title_romanised
              ? ` · ${escapeHTML(film.original_title_romanised)}`
              : ""}
          </div>
          <p class="detail-fact">
            <strong>Director:</strong>
            ${escapeHTML(film.director || "No especificado")}
          </p>
          <p class="detail-fact">
            <strong>Año de estreno:</strong>
            ${escapeHTML(film.release_date || "Desconocido")}
          </p>
          <p class="detail-fact">
            <strong>Productor:</strong>
            ${escapeHTML(film.producer || "No especificado")}
          </p>
          <p class="detail-fact">
            <strong>Duración:</strong>
            ${film.running_time
              ? `${escapeHTML(film.running_time)} minutos`
              : "No disponible"}
          </p>
          <p class="detail-fact">
            <strong>Puntuación registrada:</strong>
            ${film.rt_score
              ? `${escapeHTML(film.rt_score)}/100`
              : "No disponible"}
          </p>
          <h3>La sinopsis</h3>
          <p class="detail-synopsis">
            ${escapeHTML(film.description || "La API no proporciona una sinopsis para esta película.")}
          </p>
          <button class="main-button" id="detailFavorite">
            ${isFavorite(film.id) ? "♥ En tus favoritas" : "♡ Guardar película"}
          </button>
        </div>
      </div>`;

    showImageFallbacks($("#filmDetails"));

    $("#detailFavorite").addEventListener("click", () => {
      toggleFavorite(film.id);
      $("#detailFavorite").textContent = isFavorite(film.id)
        ? "♥ En tus favoritas"
        : "♡ Guardar película";
    });
  } catch {
    $("#filmDetails").innerHTML = `
      <div class="empty-state">
        <h3>No pudimos abrir la película</h3>
        <p>Comprueba tu conexión e inténtalo de nuevo.</p>
      </div>`;
  }
}

$("#closeDialog").addEventListener("click", () => dialog.close());

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

// Tema claro y oscuro.
function setTheme(theme) {
  document.body.classList.toggle("dark-theme", theme === "dark");
  $("#themeToggle").textContent = theme === "dark" ? "☀" : "☾";
  $("#themeToggle").setAttribute(
    "aria-label",
    theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"
  );

  try {
    localStorage.setItem("ghibli-theme", theme);
  } catch {}
}

let initialTheme = "light";

try {
  initialTheme = localStorage.getItem("ghibli-theme") || "light";
} catch {}

setTheme(initialTheme);

$("#themeToggle").addEventListener("click", () => {
  setTheme(document.body.classList.contains("dark-theme") ? "light" : "dark");
});

// Inicialización.
async function init() {
  filmGrid.innerHTML =
    '<div class="loading">Los espíritus del bosque están preparando el catálogo...</div>';

  try {
    const data = await getJSON(`${API}/films`);

    if (!Array.isArray(data)) {
      throw new Error("La API no devolvió una lista de películas.");
    }

    films = data;
    updateDirectorOptions();
    renderCatalog();
    renderFavorites();
  } catch {
    filmGrid.innerHTML = `
      <div class="empty-state">
        <h3>El bosque está en silencio</h3>
        <p>No pudimos conectar con Ghibli API. Revisa tu conexión e inténtalo otra vez.</p>
        <button id="retryButton" class="main-button">Volver a intentar ↻</button>
      </div>`;

    $("#retryButton").addEventListener("click", init);
    $("#filmCount").textContent = "Catálogo no disponible";
  }
}

renderFavorites();
init();
