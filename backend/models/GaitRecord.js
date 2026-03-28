const mongoose = require('mongoose');

const GaitRecordSchema = new mongoose.Schema(
  {
    personId:       { type: String, required: true, index: true },
    embeddingIndex: { type: Number, default: -1 },
    condition:      { type: String, default: 'nm' }, // nm/bg/cl
    frameCount:     { type: Number, default: 30 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GaitRecord', GaitRecordSchema);
