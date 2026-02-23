const state = {
  view: "home",
  region: "in",
  search: "",
};

const elements = {
  navLinks: Array.from(document.querySelectorAll(".nav-link")),
  regionSelect: document.getElementById("regionSelect"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  errorText: document.getElementById("errorText"),
  retryButton: document.getElementById("retryButton"),
  newsSections: document.getElementById("newsSections"),
  cardTemplate: document.getElementById("newsCardTemplate"),
  tickerText: document.getElementById("tickerText"),
};

const sentimentViews = new Set(["positive", "negative", "neutral"]);

function setLoading(isLoading) {
  elements.loadingState.classList.toggle("hidden", !isLoading);
}

function setError(message) {
  const hasError = Boolean(message);
  elements.errorState.classList.toggle("hidden", !hasError);
  elements.errorText.textContent = message || "";
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSentiment(sentiment) {
  const value = String(sentiment || "neutral").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRegion(region) {
  if (region === "world") return "WORLD";
  return String(region || "").toUpperCase();
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

function updateNav() {
  for (const link of elements.navLinks) {
    const isActive = link.dataset.view === state.view;
    link.classList.toggle("active", isActive);
  }
}

async function fetchJSON(url) {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load news.");
  }

  return data;
}

function getCommonParams() {
  const params = new URLSearchParams();
  if (state.search) {
    params.set("search", state.search);
  }
  return params;
}

function buildApiParamsForRegion(regionValue) {
  const params = getCommonParams();

  if (regionValue === "world") {
    params.set("region", "us");
    if (!params.get("search")) {
      params.set("search", "world");
    }
    return params;
  }

  params.set("region", "in");
  return params;
}

function renderTicker(items) {
  if (!items.length) {
    elements.tickerText.textContent = "No headlines available.";
    return;
  }

  const top = items
    .slice(0, 14)
    .map((item) => item.title)
    .filter(Boolean)
    .join("  |  ");

  elements.tickerText.textContent = top;
}

function createSection(title, subtitle) {
  const section = document.createElement("section");
  section.className = "news-section";

  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = title;

  const sub = document.createElement("p");
  sub.className = "section-subtitle";
  sub.textContent = subtitle;

  const grid = document.createElement("div");
  grid.className = "news-grid";

  section.appendChild(heading);
  section.appendChild(sub);
  section.appendChild(grid);

  return { section, grid };
}

function renderEmptyMessage(message) {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = message;
  elements.newsSections.appendChild(empty);
}

function inferSentiment(likes, dislikes) {
  if (likes > dislikes) return "positive";
  if (dislikes > likes) return "negative";
  return "neutral";
}

async function handleVote(articleId, voteType, likeCountEl, dislikeCountEl, badgeEl) {
  const currentLikes = Number(likeCountEl.textContent) || 0;
  const currentDislikes = Number(dislikeCountEl.textContent) || 0;

  const optimisticLikes = voteType === "like" ? currentLikes + 1 : currentLikes;
  const optimisticDislikes = voteType === "dislike" ? currentDislikes + 1 : currentDislikes;

  likeCountEl.textContent = String(optimisticLikes);
  dislikeCountEl.textContent = String(optimisticDislikes);

  let optimisticSentiment = inferSentiment(optimisticLikes, optimisticDislikes);
  badgeEl.classList.remove("positive", "negative", "neutral");
  badgeEl.classList.add(optimisticSentiment);
  badgeEl.textContent = formatSentiment(optimisticSentiment);

  try {
    const response = await fetch("/api/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleId, voteType }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Vote failed.");
    }

    const updated = data.item;
    likeCountEl.textContent = String(updated.likes);
    dislikeCountEl.textContent = String(updated.dislikes);
    badgeEl.classList.remove("positive", "negative", "neutral");
    badgeEl.classList.add(updated.sentiment);
    badgeEl.textContent = formatSentiment(updated.sentiment);
  } catch (error) {
    likeCountEl.textContent = String(currentLikes);
    dislikeCountEl.textContent = String(currentDislikes);
    optimisticSentiment = inferSentiment(currentLikes, currentDislikes);
    badgeEl.classList.remove("positive", "negative", "neutral");
    badgeEl.classList.add(optimisticSentiment);
    badgeEl.textContent = formatSentiment(optimisticSentiment);
    setError(error.message || "Unable to submit vote.");
  }
}

function renderCards(targetGrid, items) {
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No articles available in this section.";
    targetGrid.appendChild(empty);
    return;
  }

  for (const item of items) {
    const card = elements.cardTemplate.content.cloneNode(true);

    const image = card.querySelector(".card-image");
    const regionTag = card.querySelector(".region-tag");
    const sentimentBadge = card.querySelector(".sentiment-badge");
    const headline = card.querySelector(".headline");
    const description = card.querySelector(".description");
    const source = card.querySelector(".source");
    const likeBtn = card.querySelector(".like-btn");
    const dislikeBtn = card.querySelector(".dislike-btn");
    const likeCount = card.querySelector(".like-count");
    const dislikeCount = card.querySelector(".dislike-count");

    image.src = item.imageUrl || "https://via.placeholder.com/640x360?text=No+Image";
    image.alt = item.title || "News image";
    image.referrerPolicy = "no-referrer";

    const sentiment = String(item.sentiment || "neutral").toLowerCase();
    regionTag.textContent = formatRegion(item.regionLabel || item.region);
    sentimentBadge.textContent = formatSentiment(sentiment);
    sentimentBadge.classList.add(sentiment);

    headline.innerHTML = `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`;
    description.textContent = item.description || "No description available.";
    source.textContent = `${item.source || "Unknown"} | ${formatDate(item.publishedAt)}`;

    likeCount.textContent = String(item.likes || 0);
    dislikeCount.textContent = String(item.dislikes || 0);

    likeBtn.addEventListener("click", () =>
      handleVote(item.articleId, "like", likeCount, dislikeCount, sentimentBadge)
    );

    dislikeBtn.addEventListener("click", () =>
      handleVote(item.articleId, "dislike", likeCount, dislikeCount, sentimentBadge)
    );

    targetGrid.appendChild(card);
  }
}

function renderSingleSection(items, title, subtitle) {
  elements.newsSections.innerHTML = "";
  const sectionData = createSection(title, subtitle);
  renderCards(sectionData.grid, items);
  elements.newsSections.appendChild(sectionData.section);
}

function mergeTickerItems(indiaItems, worldItems) {
  const combined = [];
  combined.push(...indiaItems.slice(0, 8));
  combined.push(...worldItems.slice(0, 8));
  return combined;
}

async function fetchHomeNews() {
  const indiaParams = buildApiParamsForRegion("in");
  const worldParams = buildApiParamsForRegion("world");

  const [indiaData, worldData] = await Promise.all([
    fetchJSON(`/api/news/region/in?${indiaParams.toString()}`),
    fetchJSON(`/api/news?${worldParams.toString()}`),
  ]);

  const indiaItems = (indiaData.items || []).map((item) => ({ ...item, regionLabel: "in" }));
  const worldItems = (worldData.items || []).map((item) => ({ ...item, regionLabel: "world" }));

  const indiaSection = createSection(
    "India News",
    state.search ? `Results for \"${state.search}\"` : "Top headlines from India"
  );
  renderCards(indiaSection.grid, indiaItems);

  const worldSection = createSection(
    "World News",
    state.search ? `Global results for \"${state.search}\"` : "Global headlines and international stories"
  );
  renderCards(worldSection.grid, worldItems);

  elements.newsSections.innerHTML = "";
  if (state.region === "world") {
    elements.newsSections.appendChild(worldSection.section);
    elements.newsSections.appendChild(indiaSection.section);
  } else {
    elements.newsSections.appendChild(indiaSection.section);
    elements.newsSections.appendChild(worldSection.section);
  }

  renderTicker(mergeTickerItems(indiaItems, worldItems));
}

async function fetchFilteredNews() {
  const params = buildApiParamsForRegion(state.region);

  const viewTitleMap = {
    positive: "Positive News",
    negative: "Negative News",
    neutral: "Neutral News",
  };

  let data;
  if (sentimentViews.has(state.view)) {
    data = await fetchJSON(`/api/news/${state.view}?${params.toString()}`);
  } else {
    data = await fetchJSON(`/api/news?${params.toString()}`);
  }

  const items = Array.isArray(data.items) ? data.items : [];

  const subtitle = state.search
    ? `Results for \"${state.search}\" in ${formatRegion(state.region)}`
    : `Latest stories from ${formatRegion(state.region)}`;

  renderSingleSection(items, viewTitleMap[state.view] || "Top Stories", subtitle);
  renderTicker(items);
}

async function fetchNews() {
  setError("");
  setLoading(true);

  try {
    if (state.view === "home") {
      await fetchHomeNews();
    } else {
      await fetchFilteredNews();
    }
  } catch (error) {
    elements.newsSections.innerHTML = "";
    setError(error.message || "Failed to load news.");
  } finally {
    setLoading(false);
  }
}

for (const link of elements.navLinks) {
  link.addEventListener("click", () => {
    state.view = link.dataset.view;
    updateNav();
    fetchNews();
  });
}

elements.regionSelect.addEventListener("change", () => {
  state.region = elements.regionSelect.value;
  if (state.view !== "home") {
    fetchNews();
  }
});

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.search = elements.searchInput.value.trim();
  fetchNews();
});

elements.retryButton.addEventListener("click", () => {
  fetchNews();
});

updateNav();
fetchNews();
