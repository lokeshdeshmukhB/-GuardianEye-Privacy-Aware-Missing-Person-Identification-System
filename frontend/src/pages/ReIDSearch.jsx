import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { searchReid } from '../services/reidService';
import useStore from '../store/useStore';
import { FiUploadCloud, FiX, FiImage } from 'react-icons/fi';

/** Backend origin (Vite env is .../api). Used for /uploads and /api/reid/image. */
function getApiOrigin() {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  return base.replace(/\/api\/?$/, '');
}

/** URL to display a gallery match image_path from the API. */
function galleryMatchImageUrl(imagePath) {
  if (!imagePath) return '';
  const p = String(imagePath).trim();
  if (p.startsWith('/uploads')) return `${getApiOrigin()}${p}`;
  return `${getApiOrigin()}/api/reid/image?path=${encodeURIComponent(p)}`;
}

/** Keys for query vs gallery structured attribute comparison (PA-100K). */
const ATTR_COMPARE_KEYS = [
  { key: 'gender', label: 'Gender' },
  { key: 'age', label: 'Age' },
  { key: 'upperBodyClothing', label: 'Upper clothing' },
  { key: 'lowerBodyClothing', label: 'Lower clothing' },
  { key: 'hasHat', label: 'Hat' },
  { key: 'hasGlasses', label: 'Glasses' },
  { key: 'hasBackpack', label: 'Backpack' },
  { key: 'hasBag', label: 'Bag' },
  { key: 'wearingBoots', label: 'Boots' },
  { key: 'orientation', label: 'Orientation' },
];

const ScoreBar = ({ label, score, color, compact }) => {
  const pct = Math.round((score ?? 0) * 100);
  const c = color || (pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : pct >= 40 ? '#f97316' : '#ef4444');
  const barH = compact ? 4 : 6;
  const fs = compact ? 9 : 11;
  const mb = compact ? 4 : 6;
  return (
    <div style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, fontSize: fs, marginBottom: mb }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{pct}%</span>
      </div>
      <div style={{ height: barH, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${c}88, ${c})`,
            transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
          }}
        />
      </div>
    </div>
  );
};

function fmtCell(v) {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (v == null || v === '') return '—';
  return String(v);
}

const thumbSm = { width: 72, height: 90, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'block' };

/** Scales down in narrow columns so the table stays within the main pane (no horizontal scroll). */
const thumbHead = {
  ...thumbSm,
  width: '100%',
  maxWidth: 72,
  height: 'auto',
  maxHeight: 90,
  aspectRatio: '4 / 5',
  margin: '0 auto',
  boxSizing: 'border-box',
};

const thImgCell = {
  padding: '6px 4px',
  textAlign: 'center',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border)',
  overflow: 'hidden',
};

const AttributeCompareTable = ({ queryAttrs, matches, queryImageUrl, plain }) => {
  const q = queryAttrs || {};
  if (!matches?.length) return null;
  const colCount = 2 + matches.length;
  const dataColPct = `${(100 / colCount).toFixed(3)}%`;

  return (
    <div
      className={plain ? undefined : 'card'}
      style={{
        marginTop: 0,
        marginBottom: 0,
        padding: '16px 18px 14px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.55, marginBottom: 10 }}>
        Visual comparison
      </p>
      <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
        <table
          style={{
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            tableLayout: 'fixed',
            fontSize: 12,
            borderCollapse: 'collapse',
          }}
        >
          <colgroup>
            <col style={{ width: dataColPct }} />
            <col style={{ width: dataColPct }} />
            {matches.map((_, i) => (
              <col key={i} style={{ width: dataColPct }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--border)',
                  verticalAlign: 'middle',
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  fontWeight: 700,
                  textAlign: 'left',
                }}
              >
                Images
              </th>
              <th style={{ ...thImgCell }}>
                {queryImageUrl ? (
                  <img src={queryImageUrl} alt="Query" style={thumbHead} />
                ) : (
                  <div
                    style={{
                      ...thumbSm,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      maxWidth: 72,
                      aspectRatio: '4 / 5',
                      maxHeight: 90,
                      margin: '0 auto',
                    }}
                  >
                    <FiImage style={{ opacity: 0.35, fontSize: 20 }} />
                  </div>
                )}
              </th>
              {matches.map((m, i) => {
                const src = galleryMatchImageUrl(m.image_path);
                return (
                  <th key={`img-${i}`} style={{ ...thImgCell }}>
                    {src ? (
                      <img
                        src={src}
                        alt={`Match ${i + 1}`}
                        style={thumbHead}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          ...thumbSm,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          maxWidth: 72,
                          aspectRatio: '4 / 5',
                          maxHeight: 90,
                          margin: '0 auto',
                        }}
                      >
                        <FiImage style={{ opacity: 0.35, fontSize: 20 }} />
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '6px 10px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Attribute</th>
              <th style={{ padding: '6px 10px 8px', color: '#06b6d4', fontWeight: 700 }}>Query</th>
              {matches.map((m, i) => (
                <th key={`h-${i}`} style={{ padding: '6px 10px 8px', color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word' }}>
                  #{i + 1} {m.person_id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ATTR_COMPARE_KEYS.map(({ key, label }) => (
              <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '5px 10px', color: 'var(--text-muted)', verticalAlign: 'top' }}>{label}</td>
                <td style={{ padding: '5px 10px', verticalAlign: 'top', wordBreak: 'break-word' }}>{fmtCell(q[key])}</td>
                {matches.map((m, j) => {
                  const s = m.structured_attributes || {};
                  return (
                    <td key={j} style={{ padding: '5px 10px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                      {fmtCell(s[key])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MatchCard = ({ match, rank, ai, compact }) => {
  const fusion = match.fusion_score ?? match.similarity ?? 0;
  const reid = match.reid_score ?? 0;
  const attr = match.attribute_score ?? 0;
  const imgSrc = galleryMatchImageUrl(match.image_path);

  if (compact) {
    return (
      <div
        className="card"
        style={{
          padding: '10px 12px',
          minWidth: 0,
          transition: 'all 0.25s var(--ease-out)',
          border: '1px solid var(--border)',
          borderLeft: rank === 1 ? '3px solid #06b6d4' : undefined,
          borderRadius: 10,
          background: 'var(--surface)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 12,
          height: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.04) inset';
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: '0 0 auto',
            width: 'clamp(100px, 30%, 148px)',
            aspectRatio: '3 / 4',
            borderRadius: 10,
            overflow: 'hidden',
            border: `1px solid ${rank === 1 ? 'rgba(6,182,212,0.45)' : 'var(--border)'}`,
            background: 'var(--surface-2)',
            alignSelf: 'center',
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={`Rank ${rank}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center center',
                display: 'block',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiImage style={{ opacity: 0.3, fontSize: 24 }} />
            </div>
          )}
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              padding: '3px 8px',
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 900,
              background: 'rgba(0,0,0,0.72)',
              color: '#fff',
            }}
          >
            #{rank}
          </span>
        </div>
        <div
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontWeight: 800,
                color: '#22d3ee',
                fontSize: 13,
                letterSpacing: '-0.02em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
              title={match.person_id}
            >
              {match.person_id}
            </span>
            {ai?.likelihood && (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 9,
                  fontWeight: 800,
                  flexShrink: 0,
                  background:
                    ai.likelihood === 'HIGH'
                      ? 'rgba(16,185,129,0.15)'
                      : ai.likelihood === 'MEDIUM'
                        ? 'rgba(245,158,11,0.15)'
                        : 'rgba(239,68,68,0.15)',
                  color:
                    ai.likelihood === 'HIGH'
                      ? 'var(--success)'
                      : ai.likelihood === 'MEDIUM'
                        ? 'var(--warning)'
                        : 'var(--danger)',
                }}
              >
                {ai.likelihood}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <ScoreBar label="Fusion" score={fusion} color="#a855f7" compact />
            <ScoreBar label="OSNet" score={reid} color="#06b6d4" compact />
            <ScoreBar label="PA-100K" score={attr} color="#22c55e" compact />
          </div>
          {ai && (
            <div
              style={{
                padding: '8px 10px',
                background: 'rgba(6,182,212,0.06)',
                border: '1px solid rgba(6,182,212,0.15)',
                borderRadius: 8,
                minHeight: 0,
              }}
            >
              <p style={{ fontSize: 8, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 4px' }}>AI</p>
              <p
                style={{
                  fontSize: 10,
                  color: 'var(--text)',
                  lineHeight: 1.45,
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {ai.verdict}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        padding: '18px 20px 20px',
        transition: 'all 0.3s var(--ease-out)',
        border: '1px solid var(--border)',
        borderLeft: rank === 1 ? '4px solid #06b6d4' : undefined,
        borderRadius: 12,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.18)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div
          style={{
            position: 'relative',
            width: 108,
            minHeight: 136,
            flexShrink: 0,
            borderRadius: 12,
            overflow: 'hidden',
            border: `1px solid ${rank === 1 ? 'rgba(6,182,212,0.35)' : 'var(--border)'}`,
            background: 'var(--surface-2)',
            alignSelf: 'flex-start',
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={`Rank ${rank}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiImage style={{ opacity: 0.3, fontSize: 28 }} />
            </div>
          )}
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 900,
              background: 'rgba(0,0,0,0.65)',
              color: '#fff',
            }}
          >
            #{rank}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: '#22d3ee', fontSize: 17, letterSpacing: '-0.02em' }}>{match.person_id}</span>
            {ai?.likelihood && (
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  background:
                    ai.likelihood === 'HIGH'
                      ? 'rgba(16,185,129,0.12)'
                      : ai.likelihood === 'MEDIUM'
                        ? 'rgba(245,158,11,0.12)'
                        : 'rgba(239,68,68,0.12)',
                  color:
                    ai.likelihood === 'HIGH'
                      ? 'var(--success)'
                      : ai.likelihood === 'MEDIUM'
                        ? 'var(--warning)'
                        : 'var(--danger)',
                }}
              >
                {ai.likelihood}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'ui-monospace, monospace',
              marginTop: 0,
              lineHeight: 1.45,
              wordBreak: 'break-all',
            }}
          >
            {match.image_path}
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14,
        }}
      >
        <ScoreBar label="Fusion (OSNet + PA-100K)" score={fusion} color="#a855f7" />
        <ScoreBar label="Appearance (OSNet)" score={reid} color="#06b6d4" />
        <ScoreBar label="Attributes (PA-100K)" score={attr} color="#22c55e" />
      </div>

      {ai && (
        <div
          style={{
            marginTop: 16,
            background: 'rgba(6,182,212,0.05)',
            border: '1px solid rgba(6,182,212,0.18)',
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            AI Analysis
          </p>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{ai.verdict}</p>
          {ai.explanation && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>{ai.explanation}</p>
          )}
          {ai.recommendation && (
            <p style={{ fontSize: 11, color: '#60a5fa' }}>{ai.recommendation}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default function ReIDSearch() {
  const { reidResults, setReidResults } = useStore();
  /** Local only — global `loading` is shared with Gallery/Attributes/Gait and can block this page's dropzone. */
  const [searchLoading, setSearchLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [topK, setTopK] = useState(5);
  const lastFileRef = useRef(null);

  const runSearch = useCallback(
    async (file, k) => {
      if (!file) return;
      setSearchLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('image', file);
        form.append('top_k', String(k));
        form.append('w_reid', '0.55');
        form.append('w_attr', '0.45');
        setReidResults(await searchReid(form));
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setSearchLoading(false);
      }
    },
    [setReidResults]
  );

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;
      lastFileRef.current = file;
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      await runSearch(file, topK);
    },
    [topK, runSearch]
  );

  /** Changing Top-K re-runs search when a query image is already loaded (no re-upload). */
  const changeTopK = useCallback(
    (k) => {
      setTopK(k);
      const file = lastFileRef.current;
      if (file) runSearch(file, k);
    },
    [runSearch]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
    },
    multiple: false,
  });

  const handleClear = () => {
    lastFileRef.current = null;
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setReidResults(null);
    setError(null);
  };

  const queryStructured = reidResults?.query_structured_attributes;
  const hasMatchTable = Boolean(reidResults?.matches?.length);

  const queryUploadBox = (
    <div
      {...getRootProps()}
      className={`upload-zone${isDragActive ? ' drag-over' : ''}`}
      style={{
        position: 'relative',
        flexShrink: 0,
        width: hasMatchTable ? 'min(100%, 168px)' : 'min(100%, 320px)',
        aspectRatio: '1 / 1',
        maxWidth: '100%',
        boxSizing: 'border-box',
        borderLeft: `2px dashed ${isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
        borderRight: `2px dashed ${isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
        borderTop: `2px dashed ${isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
        borderBottom: `2px dashed ${isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: preview ? (hasMatchTable ? 8 : 10) : hasMatchTable ? 10 : 14,
        overflow: 'hidden',
      }}
    >
      <input {...getInputProps()} />
      {preview ? (
        <img
          src={preview}
          alt="Query"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            borderRadius: 10,
            objectFit: 'contain',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '0 8px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(6,182,212,0.08)',
              border: '1px solid rgba(6,182,212,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.3s',
              flexShrink: 0,
            }}
          >
            <FiUploadCloud style={{ fontSize: 22, color: '#06b6d4' }} />
          </div>
          <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', lineHeight: 1.35, margin: 0 }}>
            {isDragActive ? 'Drop image here' : 'Drag & drop a person image'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>or click to browse · JPG / PNG</p>
        </div>
      )}
      {searchLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6,8,15,0.9)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="spinner" style={{ borderTopColor: '#06b6d4', boxShadow: '0 0 16px rgba(6,182,212,0.3)' }} />
          <p style={{ fontSize: 13, color: '#06b6d4', fontWeight: 700, letterSpacing: 0.3 }}>
            Running multimodal fusion…
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>OSNet + PA-100K · fusion ranking</p>
        </div>
      )}
    </div>
  );

  const leftSticky = {
    position: 'sticky',
    left: 0,
    zIndex: 4,
    background: 'var(--bg)',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="fade-in"
      style={{
        maxWidth: 1420,
        margin: '0 auto',
        padding: '0 clamp(16px, 3vw, 28px)',
        paddingBottom: hasMatchTable ? 20 : 48,
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div
            className="page-icon"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))',
              border: '1px solid rgba(6,182,212,0.3)',
              boxShadow: '0 0 30px rgba(6,182,212,0.15)',
              flexShrink: 0,
            }}
          >
            🔍
          </div>
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.2, margin: 0 }}>
              Person <span style={{ color: '#06b6d4' }}>Re-ID</span> Search
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.55, maxWidth: 560 }}>
              OSNet appearance + PA-100K attributes · multimodal fusion (image-only)
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: hasMatchTable
            ? 'minmax(96px, 180px) minmax(0, 1fr)'
            : 'minmax(260px, 380px) minmax(0, 1fr)',
          gap: 'clamp(16px, 2.5vw, 28px)',
          alignItems: 'start',
        }}
      >
        {/* Col 1 — with table: compact query thumb top-left (same band as Gallery matches); more width for table */}
        {hasMatchTable ? (
          <div
            style={{
              gridColumn: 1,
              gridRow: '1 / 4',
              alignSelf: 'start',
              minWidth: 0,
              width: '100%',
              maxWidth: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              gap: 14,
              paddingBottom: 8,
              ...leftSticky,
            }}
          >
            {queryUploadBox}
            {error && (
              <div
                style={{
                  width: '100%',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 12,
                  color: 'var(--danger)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  boxSizing: 'border-box',
                }}
              >
                <span>⚠️</span> {error}
              </div>
            )}
            {(preview || reidResults) && !searchLoading && (
              <button
                className="btn-secondary"
                type="button"
                onClick={handleClear}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  boxSizing: 'border-box',
                }}
              >
                <FiX /> Clear & Reset
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              gridColumn: 1,
              gridRow: '1 / 4',
              alignSelf: 'stretch',
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              paddingTop: 8,
              paddingBottom: 8,
              ...leftSticky,
            }}
          >
            <div
              style={{
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                minHeight: 0,
              }}
            >
              {queryUploadBox}
            </div>
            {error && (
              <div
                style={{
                  width: 'min(100%, 320px)',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 12,
                  color: 'var(--danger)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  boxSizing: 'border-box',
                }}
              >
                <span>⚠️</span> {error}
              </div>
            )}
            {(preview || reidResults) && !searchLoading && (
              <button
                className="btn-secondary"
                type="button"
                onClick={handleClear}
                style={{
                  width: 'min(100%, 320px)',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  boxSizing: 'border-box',
                }}
              >
                <FiX /> Clear & Reset
              </button>
            )}
          </div>
        )}

        {/* Row 1 col 2 — intro or results header */}
        <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0 }}>
          {!reidResults && !searchLoading && (
            <div
              className="card"
              style={{
                padding: 'clamp(40px, 8vw, 72px) clamp(20px, 4vw, 40px)',
                textAlign: 'center',
                background: 'linear-gradient(180deg, var(--surface), rgba(6,182,212,0.03))',
                borderRadius: 16,
              }}
            >
              <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.75 }}>🎯</div>
              <h2 style={{ fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>Upload a query image</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto', lineHeight: 1.65 }}>
                Results appear here with gallery matches, scores, and attribute comparison. Use full-body person crops when possible.
              </p>
            </div>
          )}
          {reidResults && (
            <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>Gallery matches</h2>
              {reidResults.matches?.length === 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    Top {reidResults.matches?.length ?? 0} / {reidResults.gallery_total ?? '—'} in gallery
                  </span>
                  {reidResults.query_dim != null && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 999,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Embedding dim {reidResults.query_dim}
                    </span>
                  )}
                  {reidResults.fusion_weights && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 999,
                        background: 'rgba(6,182,212,0.08)',
                        border: '1px solid rgba(6,182,212,0.2)',
                        color: '#22d3ee',
                      }}
                    >
                      Fusion {Math.round((reidResults.fusion_weights.w_reid ?? 0.55) * 100)}% OSNet ·{' '}
                      {Math.round((reidResults.fusion_weights.w_attr ?? 0.45) * 100)}% PA-100K
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 2 col 2 — Top-K + attribute table (shorter panel; scroll inside for many rows) */}
        {reidResults && reidResults.matches?.length > 0 && (
          <div
            style={{
              gridColumn: 2,
              gridRow: 2,
              minWidth: 0,
              minHeight: 0,
              alignSelf: 'stretch',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {preview && (
              <div
                style={{
                  flexShrink: 0,
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  alignItems: 'flex-start',
                  background: 'var(--surface)',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.55 }}>
                  Results to show
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
                  {[3, 5, 10].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => changeTopK(k)}
                      style={{
                        padding: '8px 16px',
                        minWidth: 44,
                        borderRadius: 9,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: '1px solid transparent',
                        fontFamily: 'inherit',
                        lineHeight: 1.2,
                        background: topK === k ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'var(--surface-2)',
                        color: topK === k ? '#fff' : 'var(--text-muted)',
                        boxShadow: topK === k ? '0 3px 12px rgba(6,182,212,0.3)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div
              style={{
                flex: '1 1 auto',
                minHeight: 0,
                height: 'clamp(330px, 38vh, min(420px, 65vh))',
                width: '100%',
                minWidth: 0,
                overflowX: 'auto',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <AttributeCompareTable
                queryAttrs={queryStructured}
                matches={reidResults.matches}
                queryImageUrl={preview}
                plain
              />
            </div>
          </div>
        )}

        {/* Row 3 col 2 — empty state, match cards */}
        <div style={{ gridColumn: 2, gridRow: 3, minWidth: 0 }}>
          {reidResults && (
            <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {reidResults.matches?.length === 0 && (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                  <p style={{ fontSize: 36, marginBottom: 14 }}>📭</p>
                  <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No matches or empty gallery</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Add persons via the{' '}
                    <a href="/reid-gallery" style={{ color: '#06b6d4', textDecoration: 'none' }}>
                      Gallery page
                    </a>
                    .
                  </p>
                </div>
              )}

              {reidResults.matches?.length > 0 && (
                <>
                  <h2
                    style={{
                      fontSize: 'clamp(17px, 2.2vw, 21px)',
                      fontWeight: 800,
                      margin: 0,
                      lineHeight: 1.2,
                      paddingBottom: 12,
                      marginBottom: 4,
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    Match details
                  </h2>
                  <div
                    className="stagger"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                      gap: 12,
                      width: '100%',
                      alignItems: 'stretch',
                    }}
                  >
                  {reidResults.matches?.map((m, i) => {
                    const ai = reidResults.aiAnalysis?.find?.((a) => a.person_id === m.person_id);
                    return <MatchCard key={i} match={m} rank={i + 1} ai={ai} compact />;
                  })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
