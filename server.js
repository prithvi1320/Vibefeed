require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");

const Article = require("./models/Article");
const {
  SUPPORTED_REGIONS,
  computeSentiment,
  normalizeRegion,
  upsertRegionArticles,
} = require("./services/newsService");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in environment.");
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

function mapArticleResponse(doc) {
  return {
    articleId: doc.articleId,
    title: doc.title,
    description: doc.description,
    imageUrl: doc.imageUrl,
    source: doc.source,
    url: doc.url,
    publishedAt: doc.publishedAt,
    region: doc.region,
    sentiment: doc.sentiment,
    likes: doc.likes,
    dislikes: doc.dislikes,
  };
}

async function optionallyRefresh({ search, region, refresh }) {
  if (!refresh) return;
  await upsertRegionArticles({ query: search, region });
}

app.get("/api/meta", (req, res) => {
  res.json({
    regions: SUPPORTED_REGIONS,
    sentiments: ["positive", "negative", "neutral"],
  });
});

app.get("/api/news", async (req, res, next) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : "";
    const region = normalizeRegion(req.query.region);
    const refresh = req.query.refresh !== "false";

    await optionallyRefresh({ search, region, refresh });

    const filter = {};
    if (region) filter.region = region;
    if (search) {
      filter.$text = { $search: search };
    }

    const articles = await Article.find(filter)
      .sort({ publishedAt: -1 })
      .limit(120)
      .lean();

    res.json({ items: articles.map(mapArticleResponse) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/region/:region", async (req, res, next) => {
  try {
    const region = normalizeRegion(req.params.region);
    const search = req.query.search ? String(req.query.search).trim() : "";
    const refresh = req.query.refresh !== "false";

    await optionallyRefresh({ search, region, refresh });

    const filter = { region };
    if (search) filter.$text = { $search: search };

    const articles = await Article.find(filter)
      .sort({ publishedAt: -1 })
      .limit(120)
      .lean();

    res.json({ items: articles.map(mapArticleResponse) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/:sentiment", async (req, res, next) => {
  try {
    const sentiment = String(req.params.sentiment || "").toLowerCase();
    const validSentiments = ["positive", "negative", "neutral"];

    if (!validSentiments.includes(sentiment)) {
      return res.status(400).json({ error: "Invalid sentiment filter." });
    }

    const search = req.query.search ? String(req.query.search).trim() : "";
    const region = normalizeRegion(req.query.region);
    const refresh = req.query.refresh !== "false";

    await optionallyRefresh({ search, region, refresh });

    const filter = { sentiment, region };
    if (search) filter.$text = { $search: search };

    const articles = await Article.find(filter)
      .sort({ publishedAt: -1 })
      .limit(120)
      .lean();

    res.json({ items: articles.map(mapArticleResponse) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/vote", async (req, res, next) => {
  try {
    const { articleId, voteType } = req.body || {};

    if (!articleId || !["like", "dislike"].includes(voteType)) {
      return res.status(400).json({ error: "articleId and voteType are required." });
    }

    const field = voteType === "like" ? "likes" : "dislikes";

    const article = await Article.findOneAndUpdate(
      { articleId },
      { $inc: { [field]: 1 } },
      { new: true }
    );

    if (!article) {
      return res.status(404).json({ error: "Article not found." });
    }

    const nextSentiment = computeSentiment(article.likes, article.dislikes);
    if (article.sentiment !== nextSentiment) {
      article.sentiment = nextSentiment;
      await article.save();
    }

    res.json({ item: mapArticleResponse(article) });
  } catch (error) {
    next(error);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`VibeFeed server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

