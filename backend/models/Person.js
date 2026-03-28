const mongoose = require('mongoose');

const PersonSchema = new mongoose.Schema(
  {
    personId:           { type: String, required: true, unique: true },
    name:               { type: String, required: true },
    notes:              { type: String, default: '' },
    galleryImages:      [{ type: String }],          // file paths
    embeddingIndex:     { type: Number, default: -1 },
    attributes:         { type: mongoose.Schema.Types.Mixed, default: null },
    gaitEmbeddingIndex: { type: Number, default: -1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Person', PersonSchema);
