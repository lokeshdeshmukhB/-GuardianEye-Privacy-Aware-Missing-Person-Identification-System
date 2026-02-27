const mongoose = require("mongoose");

const searchLogSchema = new mongoose.Schema({
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  officerName: String,
  searchType: {
    type: String,
    enum: ["multi-modal", "reid", "attribute", "gait"],
    default: "multi-modal",
  },
  queryImagePath: String,
  results: [{ caseId: String, score: Number }],
  resultCount: Number,
  processingTime: Number,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SearchLog", searchLogSchema);
