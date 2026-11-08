
"use strict";

// ============================================
// 1. CONFIGURATION & APP STATE
// ============================================

const API_BASE = "https://nutriplan-api.vercel.app/api/meals";
const PRODUCT_API = "https://world.openfoodfacts.org";
const STORAGE_KEY = "nutriplan-foodlog-v1";

const goals = {
  calories: 2000,
  protein: 50,
  carbs: 250,
  fat: 65
};

let allMeals = [];
let currentMeals = [];
let currentMeal = null;
let categories = [];
let foodLog = loadFoodLog();
let currentProducts = [];
let activeProductGrade = "";

// ============================================
// 2. DOM ELEMENTS
// ============================================

const $ = (selector) => document.querySelector(selector);

const sections = {
  search: $("#search-filters-section"),
  categories: $("#meal-categories-section"),
  recipes: $("#all-recipes-section"),
  details: $("#meal-details"),
  products: $("#products-section"),
  foodlog: $("#foodlog-section")
};

const recipesGrid = $("#recipes-grid");
const recipesCount = $("#recipes-count");
const categoriesGrid = $("#categories-grid");
const searchInput = $("#search-input");

// ============================================
// 3. HELPERS
// ============================================

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  return response.json();
}

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function showMessage(container, message) {
  if (!container) return;

  const paragraph = createElement(
    "p",
    "col-span-full text-center py-10 text-gray-500",
    message
  );

  container.replaceChildren(paragraph);
}

function formatNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toFixed(digits)
    : "N/A";
}

function getTodayKey() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function loadFoodLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveFoodLog() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(foodLog));
}

// ============================================
// 4. PAGE NAVIGATION
// ============================================

function showPage(page) {
  Object.values(sections).forEach(section => {
    section?.classList.add("hidden");
  });

  if (page === "meals") {
    sections.search?.classList.remove("hidden");
    sections.categories?.classList.remove("hidden");
    sections.recipes?.classList.remove("hidden");
  }

  if (page === "details") {
    sections.details?.classList.remove("hidden");
  }

  if (page === "products") {
    sections.products?.classList.remove("hidden");
  }

  if (page === "foodlog") {
    sections.foodlog?.classList.remove("hidden");
    renderFoodLog();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================
// 5. FETCH ALL MEALS
// ============================================

async function getMeals() {
  showMessage(recipesGrid, "Loading meals...");

  try {
    const data = await fetchJSON(API_BASE);

    allMeals = Array.isArray(data.results)
      ? data.results
      : [];

    currentMeals = allMeals;

    renderMeals(currentMeals);

  } catch (error) {
    console.error("Failed to load meals:", error);
    showMessage(recipesGrid, "Unable to load meals.");
  }
}

// ============================================
// 6. RENDER MEAL CARDS
// ============================================

function renderMeals(meals) {
  recipesGrid.replaceChildren();

  recipesCount.textContent =
    `Showing ${meals.length} recipes`;

  if (!meals.length) {
    showMessage(recipesGrid, "No recipes found.");
    return;
  }

  const fragment = document.createDocumentFragment();

  meals.forEach(meal => {
    const card = createElement(
      "article",
      "recipe-card bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group"
    );

    card.dataset.mealId = meal.id;

    const imageWrapper = createElement(
      "div",
      "relative h-48 overflow-hidden bg-gray-100"
    );

    const image = document.createElement("img");
    image.src = meal.thumbnail || "";
    image.alt = meal.name || "Meal";
    image.loading = "lazy";
    image.className =
      "w-full h-full object-cover group-hover:scale-110 transition-transform duration-500";

    imageWrapper.appendChild(image);

    const content = createElement("div", "p-4");

    const title = createElement(
      "h3",
      "text-base font-bold text-gray-900 mb-1 line-clamp-1",
      meal.name || "Unknown meal"
    );

    const description = Array.isArray(meal.instructions)
      ? meal.instructions.join(" ")
      : meal.instructions || "View recipe details";

    const paragraph = createElement(
      "p",
      "text-xs text-gray-600 mb-3 line-clamp-2",
      description
    );

    const metadata = createElement(
      "div",
      "flex items-center justify-between gap-2 text-xs"
    );

    const category = createElement(
      "span",
      "font-semibold text-emerald-700",
      meal.category || "Unknown"
    );

    const area = createElement(
      "span",
      "font-semibold text-gray-500",
      meal.area || "Unknown"
    );

    metadata.append(category, area);
    content.append(title, paragraph, metadata);
    card.append(imageWrapper, content);

    card.addEventListener("click", () => {
      getMealDetails(meal.id);
    });

    fragment.appendChild(card);
  });

  recipesGrid.appendChild(fragment);
}

// ============================================
// 7. FETCH & RENDER CATEGORIES
// ============================================

async function getCategories() {
  try {
    const data = await fetchJSON(`${API_BASE}/categories`);

    const rawCategories =
      data.results ?? data.categories ?? [];

    categories = rawCategories
      .map(item => typeof item === "string"
        ? item
        : item.name ?? item.category ?? "")
      .filter(Boolean);

    renderCategories(categories);

  } catch (error) {
    console.warn("Categories endpoint unavailable:", error);

    // Fallback to categories from loaded meals
    categories = [
      ...new Set(allMeals.map(meal => meal.category).filter(Boolean))
    ];

    renderCategories(categories);
  }
}

function renderCategories(items) {
  categoriesGrid.replaceChildren();

  const fragment = document.createDocumentFragment();

  items.forEach(name => {
    const card = createElement(
      "button",
      "category-card text-left bg-emerald-50 rounded-xl p-4 border border-emerald-200 hover:border-emerald-500 transition-all",
      name
    );

    card.dataset.category = name;

    card.addEventListener("click", () => {
      filterByCategory(name);
    });

    fragment.appendChild(card);
  });

  categoriesGrid.appendChild(fragment);
}

// ============================================
// 8. SEARCH & FILTER MEALS
// ============================================

function searchMeals(query) {
  const term = query.trim().toLowerCase();

  currentMeals = allMeals.filter(meal => {
    const searchable = [
      meal.name,
      meal.category,
      meal.area,
      ...(Array.isArray(meal.ingredients)
        ? meal.ingredients.map(item =>
            typeof item === "string"
              ? item
              : item.ingredient ?? "")
        : [])
    ].join(" ").toLowerCase();

    return searchable.includes(term);
  });

  renderMeals(currentMeals);
}

async function filterByCategory(category) {
  showMessage(recipesGrid, "Loading category...");

  try {
    // Filter endpoint: verify query parameter against your Postman collection
    const url = `${API_BASE}/filter?category=${encodeURIComponent(category)}`;
    const data = await fetchJSON(url);

    currentMeals = Array.isArray(data.results)
      ? data.results
      : [];

    renderMeals(currentMeals);

  } catch (error) {
    console.warn("Category API filter failed:", error);

    // Fallback filters currently loaded meals only
    currentMeals = allMeals.filter(meal =>
      meal.category?.toLowerCase() === category.toLowerCase()
    );

    renderMeals(currentMeals);
  }
}

function filterByArea(area) {
  currentMeals = allMeals.filter(meal =>
    meal.area?.toLowerCase() === area.toLowerCase()
  );

  renderMeals(currentMeals);
}

function resetMealFilters() {
  searchInput.value = "";
  currentMeals = allMeals;
  renderMeals(currentMeals);
}

// ============================================
// 9. FETCH SINGLE MEAL DETAILS
// ============================================

async function getMealDetails(id) {
  try {
    const data = await fetchJSON(`${API_BASE}/${id}`);

    if (!data.result) {
      throw new Error("Meal details not found");
    }

    currentMeal = data.result;
    renderMealDetails(currentMeal);

  } catch (error) {
    console.error("Meal details error:", error);
    alert("Unable to load meal details.");
  }
}

// ============================================
// 10. RENDER MEAL DETAILS
// ============================================

function renderMealDetails(meal) {
  const section = sections.details;

  // 10.1 Hero image and title
  const image = section.querySelector(".relative.h-80 img");
  const title = section.querySelector(".relative.h-80 h1");

  if (image) {
    image.src = meal.thumbnail || "";
    image.alt = meal.name || "Meal";
  }

  if (title) {
    title.textContent = meal.name || "Unknown meal";
  }

  // 10.2 Category, Area and Tags
  const badges = section.querySelectorAll(
    ".relative.h-80 .absolute.bottom-0 .flex.items-center.gap-3 span"
  );

  const values = [
    meal.category || "Unknown",
    meal.area || "Unknown",
    Array.isArray(meal.tags) ? meal.tags.join(", ") : meal.tags || ""
  ];

  badges.forEach((badge, index) => {
    badge.textContent = values[index] || "";
    badge.classList.toggle("hidden", !values[index]);
  });

  // 10.3 Remove unsupported static hero data
  const heroServings = $("#hero-servings");
  const heroCalories = $("#hero-calories");

  if (heroServings) {
    heroServings.textContent = "Servings unavailable";
  }

  if (heroCalories) {
    heroCalories.textContent = "Nutrition unavailable";
  }

  // Hide the static cooking-time label
  const heroInfo = section.querySelector(
    ".relative.h-80 .flex.items-center.gap-6"
  );

  const timeItem = heroInfo?.firstElementChild;
  timeItem?.classList.add("hidden");

  // 10.4 Ingredients
  const headings = [...section.querySelectorAll("h2")];

  const ingredientsHeading = headings.find(heading =>
    heading.textContent.includes("Ingredients")
  );

  const ingredientsContainer =
    ingredientsHeading?.parentElement?.querySelector(
      ".grid.grid-cols-1.md\\:grid-cols-2"
    );

  const count = ingredientsHeading?.querySelector("span");

  const ingredients = Array.isArray(meal.ingredients)
    ? meal.ingredients
    : [];

  if (count) {
    count.textContent = `${ingredients.length} items`;
  }

  if (ingredientsContainer) {
    ingredientsContainer.replaceChildren();

    ingredients.forEach(item => {
      const row = createElement(
        "label",
        "flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-emerald-50"
      );

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "ingredient-checkbox w-5 h-5";

      const ingredientName = typeof item === "string"
        ? item
        : `${item.measure ?? ""} ${item.ingredient ?? ""}`.trim();

      const text = createElement(
        "span",
        "text-gray-700",
        ingredientName
      );

      row.append(checkbox, text);
      ingredientsContainer.appendChild(row);
    });
  }

  // 10.5 Instructions
  const instructionsHeading = headings.find(heading =>
    heading.textContent.includes("Instructions")
  );

  const instructionsContainer =
    instructionsHeading?.parentElement?.querySelector(".space-y-4");

  const instructions = Array.isArray(meal.instructions)
    ? meal.instructions
    : meal.instructions ? [meal.instructions] : [];

  if (instructionsContainer) {
    instructionsContainer.replaceChildren();

    instructions.forEach((instruction, index) => {
      const row = createElement(
        "div",
        "flex gap-4 p-4 rounded-xl hover:bg-gray-50"
      );

      const number = createElement(
        "div",
        "w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0",
        String(index + 1)
      );

      const paragraph = createElement(
        "p",
        "text-gray-700 leading-relaxed pt-2",
        typeof instruction === "string"
          ? instruction
          : instruction?.text ?? instruction?.step ?? ""
      );

      row.append(number, paragraph);
      instructionsContainer.appendChild(row);
    });
  }

  // 10.6 YouTube video
  const video = section.querySelector("iframe");

  if (video) {
    let videoId = "";

    try {
      if (meal.youtube) {
        const url = new URL(meal.youtube);

        if (url.hostname === "youtu.be") {
          videoId = url.pathname.slice(1);
        } else if (
          ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
            url.hostname
          )
        ) {
          videoId = url.searchParams.get("v") || "";

          if (!videoId && url.pathname.startsWith("/embed/")) {
            videoId = url.pathname.split("/")[2];
          }
        }
      }
    } catch (error) {
      console.warn("Invalid YouTube URL:", error);
    }

    const validVideo = /^[a-zA-Z0-9_-]{11}$/.test(videoId);

    if (validVideo) {
      video.src = `https://www.youtube.com/embed/${videoId}`;
    } else {
      video.removeAttribute("src");
    }

    // Hide the whole video card when no video exists
    const videoCard = video.closest(".bg-white.rounded-2xl");
    videoCard?.classList.toggle("hidden", !validVideo);
  }

  // 10.7 Nutrition facts
  // The confirmed meal API response has no nutrition values.
  // Do not display the static example values.
  const nutritionContainer = $("#nutrition-facts-container");

  if (nutritionContainer) {
    showMessage(
      nutritionContainer,
      "Nutrition data is not available for this meal."
    );
  }

  // 10.8 Connect the Log Meal button to the selected meal
  const logButton = $("#log-meal-btn");

  if (logButton) {
    logButton.dataset.mealId = meal.id;
  }

  // 10.9 Open the details page
  showPage("details");
}

// ============================================
// 11. FOOD LOG - STORAGE & TOTALS
// ============================================

function addFoodLogItem(item) {
  const entry = {
    ...item,
    logId: crypto.randomUUID(),
    date: getTodayKey()
  };

  foodLog.push(entry);
  saveFoodLog();
  renderFoodLog();
}

function deleteFoodLogItem(logId) {
  foodLog = foodLog.filter(item => item.logId !== logId);
  saveFoodLog();
  renderFoodLog();
}

function clearFoodLog() {
  foodLog = foodLog.filter(item => item.date !== getTodayKey());
  saveFoodLog();
  renderFoodLog();
}

function calculateDailyTotals(items) {
  return items.reduce((totals, item) => {
    ["calories", "protein", "carbs", "fat"].forEach(key => {
      const value = Number(item[key]);

      if (Number.isFinite(value)) {
        totals[key] += value;
      }
    });

    return totals;
  }, {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
}

// ============================================
// 12. RENDER FOOD LOG
// ============================================

function renderFoodLog() {
  const container = $("#logged-items-list");
  if (!container) return;

  const today = foodLog.filter(item =>
    item.date === getTodayKey()
  );

  const totals = calculateDailyTotals(today);

  container.replaceChildren();

  if (!today.length) {
    showMessage(container, "No meals logged today.");
  }

  today.forEach(item => {
    const row = createElement(
      "div",
      "flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl"
    );

    const info = createElement("div");

    const title = createElement(
      "p",
      "font-semibold text-gray-900",
      item.name || "Food item"
    );

    const calories = createElement(
      "p",
      "text-xs text-gray-500",
      item.calories == null
        ? "Calories unavailable"
        : `${formatNumber(item.calories)} kcal`
    );

    info.append(title, calories);

    const deleteButton = createElement(
      "button",
      "text-red-600 font-medium text-sm",
      "Delete"
    );

    deleteButton.addEventListener("click", () => {
      deleteFoodLogItem(item.logId);
    });

    row.append(info, deleteButton);
    container.appendChild(row);
  });

  const clearButton = $("#clear-foodlog");

  if (clearButton) {
    clearButton.style.display = today.length ? "" : "none";
  }

  // Update summary counters and progress bars
  const progressCards = $(
    "#foodlog-today-section"
  )?.querySelectorAll(".grid > div");

  const keys = ["calories", "protein", "carbs", "fat"];

  keys.forEach((key, index) => {
    const card = progressCards?.[index];
    if (!card) return;

    const counter = card.querySelector(".text-gray-500");
    const bar = card.querySelector(".h-2\\.5 > div");

    const value = totals[key];
    const goal = goals[key];
    const unit = key === "calories" ? "kcal" : "g";

    if (counter) {
      counter.textContent =
        `${formatNumber(value)} / ${goal} ${unit}`;
    }

    if (bar) {
      const percentage = Math.min((value / goal) * 100, 100);
      bar.style.width = `${percentage}%`;
    }
  });

  const dateElement = $("#foodlog-date");

  if (dateElement) {
    dateElement.textContent =
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric"
      });
  }

  const logHeading = [...document.querySelectorAll("h4")].find(
    heading => heading.textContent.includes("Logged Items")
  );

  if (logHeading) {
    logHeading.textContent = `Logged Items (${today.length})`;
  }
}

// ============================================
// 13. LOG SELECTED MEAL
// ============================================

function logSelectedMeal() {
  if (!currentMeal) return;

  // Meal API has no confirmed nutrition information.
  // Save the meal without inventing nutritional values.
  addFoodLogItem({
    id: currentMeal.id,
    name: currentMeal.name,
    type: "meal",
    calories: null,
    protein: null,
    carbs: null,
    fat: null
  });

  showPage("foodlog");
}

// ============================================
// 14. PRODUCT SEARCH
// Uses Open Food Facts public API
// ============================================

async function searchProducts(query) {
  const container = $("#products-grid");
  const count = $("#products-count");

  if (!query.trim()) {
    showMessage(container, "Enter a product name.");
    return;
  }

  showMessage(container, "Searching products...");

  try {
    const url =
      `${PRODUCT_API}/cgi/search.pl?search_terms=` +
      `${encodeURIComponent(query)}&search_simple=1&action=process` +
      `&json=1&page_size=24`;

    const data = await fetchJSON(url);

    currentProducts = Array.isArray(data.products)
      ? data.products
      : [];

    renderProducts();

  } catch (error) {
    console.error("Product search failed:", error);
    showMessage(container, "Unable to search products.");
    if (count) count.textContent = "Search failed";
  }
}

// ============================================
// 15. BARCODE LOOKUP
// ============================================

async function lookupBarcode(barcode) {
  const container = $("#products-grid");

  if (!/^\d{8,14}$/.test(barcode.trim())) {
    showMessage(container, "Enter a valid barcode.");
    return;
  }

  showMessage(container, "Looking up barcode...");

  try {
    const data = await fetchJSON(
      `${PRODUCT_API}/api/v2/product/${encodeURIComponent(barcode.trim())}.json`
    );

    currentProducts = data.status === 1 && data.product
      ? [data.product]
      : [];

    renderProducts();

  } catch (error) {
    console.error("Barcode lookup failed:", error);
    showMessage(container, "Barcode lookup failed.");
  }
}

// ============================================
// 16. RENDER PRODUCTS
// ============================================

function renderProducts() {
  const container = $("#products-grid");
  const count = $("#products-count");

  container.replaceChildren();

  const products = currentProducts.filter(product =>
    !activeProductGrade ||
    product.nutriscore_grade?.toLowerCase() === activeProductGrade
  );

  if (count) {
    count.textContent = `${products.length} products`;
  }

  if (!products.length) {
    showMessage(container, "No products found.");
    return;
  }

  products.forEach(product => {
    const card = createElement(
      "article",
      "product-card bg-white rounded-xl overflow-hidden shadow-sm p-4"
    );

    const image = document.createElement("img");
    image.src = product.image_front_url || product.image_url || "";
    image.alt = product.product_name || "Product";
    image.loading = "lazy";
    image.className = "w-full h-40 object-contain mb-3";

    const brand = createElement(
      "p",
      "text-xs text-emerald-600 font-semibold",
      product.brands || "Unknown brand"
    );

    const title = createElement(
      "h3",
      "font-bold text-gray-900 mb-2",
      product.product_name || "Unknown product"
    );

    const grade = createElement(
      "p",
      "text-sm text-gray-600 mb-2",
      `Nutri-Score: ${product.nutriscore_grade?.toUpperCase() || "N/A"}`
    );

    const nutrition = product.nutriments || {};

    const nutritionText = createElement(
      "p",
      "text-xs text-gray-600 mb-3",
      `Per 100g: ${nutrition["energy-kcal_100g"] ?? "N/A"} kcal | ` +
      `Protein: ${nutrition.proteins_100g ?? "N/A"}g | ` +
      `Carbs: ${nutrition.carbohydrates_100g ?? "N/A"}g | ` +
      `Fat: ${nutrition.fat_100g ?? "N/A"}g`
    );

    const logButton = createElement(
      "button",
      "w-full bg-emerald-600 text-white rounded-lg px-3 py-2 font-medium",
      "Log 100g"
    );

    logButton.addEventListener("click", () => {
      const required = [
        "energy-kcal_100g",
        "proteins_100g",
        "carbohydrates_100g",
        "fat_100g"
      ];

      if (!required.every(key =>
        nutrition[key] != null &&
        Number.isFinite(Number(nutrition[key]))
      )) {
        alert("Complete nutrition data is unavailable for this product.");
        return;
      }

      addFoodLogItem({
        id: product.code,
        name: `${product.product_name || "Product"} (100g)`,
        type: "product",
        calories: Number(nutrition["energy-kcal_100g"]),
        protein: Number(nutrition.proteins_100g),
        carbs: Number(nutrition.carbohydrates_100g),
        fat: Number(nutrition.fat_100g)
      });

      showPage("foodlog");
    });

    card.append(
      image,
      brand,
      title,
      grade,
      nutritionText,
      logButton
    );

    container.appendChild(card);
  });
}

// ============================================
// 17. EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Meal search
  searchInput?.addEventListener("input", event => {
    searchMeals(event.target.value);
  });

  // Back to recipes
  $("#back-to-meals-btn")?.addEventListener("click", () => {
    showPage("meals");
  });

  // Log meal
  $("#log-meal-btn")?.addEventListener("click", logSelectedMeal);

  // Clear food log
  $("#clear-foodlog")?.addEventListener("click", () => {
    if (confirm("Clear today's food log?")) {
      clearFoodLog();
    }
  });

  // Search products
  $("#search-product-btn")?.addEventListener("click", () => {
    searchProducts($("#product-search-input").value);
  });

  $("#product-search-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      searchProducts(event.target.value);
    }
  });

  // Barcode search
  $("#lookup-barcode-btn")?.addEventListener("click", () => {
    lookupBarcode($("#barcode-input").value);
  });

  $("#barcode-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      lookupBarcode(event.target.value);
    }
  });

  // Nutri-Score filters
  document.querySelectorAll(".nutri-score-filter").forEach(button => {
    button.addEventListener("click", () => {
      activeProductGrade = button.dataset.grade || "";
      renderProducts();
    });
  });

  // Sidebar navigation
  const navLinks = document.querySelectorAll("#sidebar .nav-link");

  navLinks[0]?.addEventListener("click", event => {
    event.preventDefault();
    showPage("meals");
  });

  navLinks[1]?.addEventListener("click", event => {
    event.preventDefault();
    showPage("products");
  });

  navLinks[2]?.addEventListener("click", event => {
    event.preventDefault();
    showPage("foodlog");
  });

  // Quick actions
  const quickButtons = document.querySelectorAll(".quick-log-btn");

  quickButtons[0]?.addEventListener("click", () => showPage("meals"));
  quickButtons[1]?.addEventListener("click", () => showPage("products"));

  quickButtons[2]?.addEventListener("click", () => {
    alert("Custom food entry is not implemented yet.");
  });

  // All Recipes button
  const allButton = $("#search-filters-section button");

  allButton?.addEventListener("click", resetMealFilters);

  // Grid / List view
  $("#grid-view-btn")?.addEventListener("click", () => {
    recipesGrid.classList.remove("grid-cols-1");
    recipesGrid.classList.add("grid-cols-4");
  });

  $("#list-view-btn")?.addEventListener("click", () => {
    recipesGrid.classList.remove("grid-cols-4");
    recipesGrid.classList.add("grid-cols-1");
  });
}

// ============================================
// 18. INITIALIZE APP
// ============================================

async function initializeApp() {
  setupEventListeners();

  showPage("meals");

  await getMeals();
  await getCategories();

  renderFoodLog();

  // Remove loading overlay
  const overlay = $("#app-loading-overlay");

  if (overlay) {
    overlay.classList.add("hidden");
  }
}

// ============================================
// 19. START APPLICATION
// ============================================

initializeApp();