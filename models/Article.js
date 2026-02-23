const mongoose = require("mongoose");

const articleSchema = new mongoose.Schema(
  {
    articleId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      default: "Unknown",
    },
    url: {
      type: String,
      required: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    region: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    sentiment: {
      type: String,
      enum: ["positive", "negative", "neutral"],
      default: "neutral",
      index: true,
    },
    likes: {
      type: Number,
      default: 0,
      min: 0,
    },
    dislikes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

articleSchema.index({ articleId: 1, region: 1 }, { unique: true });
articleSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Article", articleSchema);

