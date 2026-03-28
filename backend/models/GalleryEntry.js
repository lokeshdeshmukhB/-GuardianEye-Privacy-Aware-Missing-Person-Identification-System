const mongoose = require('mongoose');

const GalleryEntrySchema = new mongoose.Schema(
  {
    personId:       { type: String, required: true, index: true },
    imagePath:      { type: String, required: true },
    embeddingIndex: { type: Number, default: -1 },
    cameraId:       { type: String, default: '' },
    condition:      { type: String, default: '' }, // nm/bg/cl for CASIA-B
  },
  { timestamps: true }
);

module.exports = mongoose.model('GalleryEntry', GalleryEntrySchema);
