const mongoose = require('mongoose');

const missingPersonSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number },
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
  height: { type: String },
  weight: { type: String },
  lastSeenDate: { type: Date },
  lastSeenLocation: { type: String },
  description: { type: String },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['active', 'found', 'closed'],
    default: 'active'
  },
  photos: [{ type: String }],
  thumbnailUrl: { type: String },

  // PA-100K Attributes (from ResNet50)
  attributes: {
    gender: String,
    age: String,
    upperBodyColor: String,
    lowerBodyColor: String,
    upperBodyClothing: String,
    lowerBodyClothing: String,
    hasBag: Boolean,
    hasHat: Boolean,
    hasGlasses: Boolean,
    hairLength: String,
    bodyShape: String,
    confidence: Number,
    raw: mongoose.Schema.Types.Mixed
  },

  // Re-ID embedding (OSNet)
  reidEmbedding: [Number],

  // Gait signature
  gaitSignature: [Number],
  gaitScore: Number,

  // Audit
  privacyConsent: { type: Boolean, default: true },
  accessLog: [{ officer: String, timestamp: Date, action: String }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

missingPersonSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MissingPerson', missingPersonSchema);
