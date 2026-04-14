const fs = require('fs');
const path = require('path');

// utils/ → backend/ → repo root/ml-services (not backend/ml-services)
const MLS_ROOT = path.join(__dirname, '..', '..', 'ml-services');
const DATASETS_ROOT = path.join(MLS_ROOT, 'datasets');
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const basenameCache = new Map();

/** Cached list of directories that look like PA-100K .../PA-100K/data (flat image folders). */
let cachedPa100kDataDirs = null;

function discoverPa100kDataDirs() {
  if (cachedPa100kDataDirs) return cachedPa100kDataDirs;
  const roots = [];

  const pushIfDataDir = (dir) => {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        roots.push(path.resolve(dir));
      }
    } catch {
      /* ignore */
    }
  };

  // ml-services/datasets/PA-100K/data
  pushIfDataDir(path.join(DATASETS_ROOT, 'PA-100K', 'data'));

  // ml-services/datasets/datasets/<any>/PA-100K/data (your archive layout)
  const nested = path.join(DATASETS_ROOT, 'datasets');
  try {
    if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
      for (const entry of fs.readdirSync(nested, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        pushIfDataDir(path.join(nested, entry.name, 'PA-100K', 'data'));
      }
    }
  } catch {
    /* ignore */
  }

  // Known layout from repo (explicit, avoids missing discovery on odd FS)
  pushIfDataDir(path.join(DATASETS_ROOT, 'datasets', 'archive (2) (1)', 'PA-100K', 'data'));

  cachedPa100kDataDirs = [...new Set(roots)];
  return cachedPa100kDataDirs;
}

/**
 * Resolve a gallery image_path from Re-ID API to an absolute file path on disk.
 * PA-100K images are matched by basename under discovered .../PA-100K/data folders (fast O(1)).
 */
function resolveGalleryImagePath(rel) {
  if (!rel || typeof rel !== 'string') return null;
  const normalized = rel.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;

  const base = path.basename(normalized);

  const tryPaths = [
    path.join(DATASETS_ROOT, normalized),
    path.join(MLS_ROOT, normalized),
    path.join(DATASETS_ROOT, normalized.replace(/^datasets\//, '')),
    path.join(UPLOADS_ROOT, base),
  ];

  for (const p of tryPaths) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.resolve(p);
    } catch {
      /* ignore */
    }
  }

  if (basenameCache.has(base)) {
    const cached = basenameCache.get(base);
    if (cached && fs.existsSync(cached)) return cached;
  }

  // PA-100K: path in API is often "datasets/000170.jpg" → file is .../PA-100K/data/000170.jpg
  for (const dataDir of discoverPa100kDataDirs()) {
    const p = path.join(dataDir, base);
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const abs = path.resolve(p);
        basenameCache.set(base, abs);
        return abs;
      }
    } catch {
      /* ignore */
    }
  }

  function findByName(dir, name, maxDepth, depth = 0) {
    if (depth > maxDepth || !fs.existsSync(dir)) return null;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name === name) return full;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        const found = findByName(path.join(dir, e.name), name, maxDepth, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  const found = findByName(DATASETS_ROOT, base, 14);
  if (found) {
    const abs = path.resolve(found);
    basenameCache.set(base, abs);
    return abs;
  }

  return null;
}

function clearPa100kDataDirCache() {
  cachedPa100kDataDirs = null;
}

module.exports = { resolveGalleryImagePath, DATASETS_ROOT, MLS_ROOT, clearPa100kDataDirCache };
