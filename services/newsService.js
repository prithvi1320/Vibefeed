const crypto = require("crypto");
const Article = require("../models/Article");

const NEWS_API_BASE_URL = process.env.NEWS_API_BASE_URL || "https://newsapi.org/v2";
const NEWS_API_KEY = process.env.NEWS_API_KEY;

const SUPPORTED_REGIONS = ["us", "gb", "in", "ca", "au"];

function computeSentiment(likes, dislikes) {
  if (likes > dislikes) return "positive";
  if (dislikes > likes) return "negative";
  return "neutral";
}

function toArticleId(url, region) {
  return crypto.createHash("sha1").update(`${url}|${region}`).digest("hex");
}

function normalizeRegion(region) {
  if (!region) return "us";
  const normalized = String(region).toLowerCase();
  return SUPPORTED_REGIONS.includes(normalized) ? normalized : "us";
}

function mapNewsArticle(raw) {
  return {
    title: raw.title || "Untitled",
    description: raw.description || "",
    imageUrl: raw.urlToImage || "",
    source: raw.source?.name || "Unknown",
    url: raw.url,
    publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : new Date(),
  };
}

async function fetchLiveArticles({ region, query }) {
  if (!NEWS_API_KEY) {
    throw new Error("Missing NEWS_API_KEY in environment.");
  }

  const normalizedRegion = normalizeRegion(region);
  const hasSearch = Boolean(query && query.trim());
  const endpoint = hasSearch ? "everything" : "top-headlines";

  const params = new URLSearchParams({
    apiKey: NEWS_API_KEY,
    pageSize: "30",
    sortBy: "publishedAt",
  });

  if (hasSearch) {
    params.set("q", query.trim());
    params.set("language", "en");
  } else {
    params.set("country", normalizedRegion);
    params.set("category", "general");
  }

  const response = await fetch(`${NEWS_API_BASE_URL}/${endpoint}?${params.toString()}`);

  if (!response.ok) {
    let message = `News API request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data.message) message = data.message;
    } catch (error) {
      // keep fallback message
    }
    throw new Error(message);
  }

  const payload = await response.json();
  const rawArticles = Array.isArray(payload.articles) ? payload.articles : [];

  return rawArticles.filter((item) => item && item.url).map(mapNewsArticle);
}

async function upsertRegionArticles({ region, query }) {
  const normalizedRegion = normalizeRegion(region);
  const normalizedQuery = typeof query === "string" ? query.trim() : "";
  const liveArticles = await fetchLiveArticles({
    region: normalizedRegion,
    query: normalizedQuery || "",
  });

  const operations = liveArticles.map((item) => {
    const articleId = toArticleId(item.url, normalizedRegion);

    return {
      updateOne: {
        filter: { articleId, region: normalizedRegion },
        update: {
          $setOnInsert: {
            articleId,
            region: normalizedRegion,
            likes: 0,
            dislikes: 0,
            sentiment: "neutral",
          },
          $set: {
            title: item.title,
            description: item.description,
            imageUrl: item.imageUrl,
            source: item.source,
            url: item.url,
            publishedAt: item.publishedAt,
          },
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await Article.bulkWrite(operations, { ordered: false });
  }

  return operations.length;
}

module.exports = {
  SUPPORTED_REGIONS,
  computeSentiment,
  normalizeRegion,
  upsertRegionArticles,
};

