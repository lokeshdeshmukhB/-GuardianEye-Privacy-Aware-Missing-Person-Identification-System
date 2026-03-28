const mongoose = require('mongoose');

const SearchHistorySchema = new mongoose.Schema(
  {
    queryImage: { type: String, default: null },
    searchType: {
      type: String,
      enum: ['reid', 'attribute', 'gait'],
      required: true,
    },
    results: [
      {
        personId:   String,
        similarity: Number,
        imagePath:  String,
      },
    ],
    aiAnalysis: { type: mongoose.Schema.Types.Mixed, default: null },
    processingTime: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SearchHistory', SearchHistorySchema);
