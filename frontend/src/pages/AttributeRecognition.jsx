import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { predictAttributes } from '../services/attributeService';
import useStore from '../store/useStore';
import './AttributeRecognition.css';

const ATTR_GROUPS = [
  {
    name: 'Demographics',
    icon: '👤',
    keys: ['Female', 'AgeOver60', 'Age18-60', 'AgeLess18'],
    color: '#818cf8',
    glow: 'rgba(129,140,248,0.35)',
  },
  {
    name: 'Orientation',
    icon: '🧭',
    keys: ['Front', 'Side', 'Back'],
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.35)',
  },
  {
    name: 'Accessories',
    icon: '🎒',
    keys: ['Hat', 'Glasses', 'HandBag', 'ShoulderBag', 'Backpack', 'HoldObjectsInFront'],
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.35)',
  },
  {
    name: 'Upper Body',
    icon: '👕',
    keys: ['ShortSleeve', 'LongSleeve', 'UpperStride', 'UpperLogo', 'UpperPlaid', 'UpperSplice'],
    color: '#34d399',
    glow: 'rgba(52,211,153,0.35)',
  },
  {
    name: 'Lower Body',
    icon: '👖',
    keys: ['LowerStripe', 'LowerPattern', 'LongCoat', 'Trousers', 'Shorts', 'Skirt&Dress', 'boots'],
    color: '#f97316',
    glow: 'rgba(249,115,22,0.35)',
  },
];

const ICONS = {
  Female: '♀', AgeOver60: '🧓', 'Age18-60': '🧑', AgeLess18: '🧒',
  Front: '⬆', Side: '➡', Back: '⬇',
  Hat: '🎩', Glasses: '👓', HandBag: '👜', ShoulderBag: '💼', Backpack: '🎒', HoldObjectsInFront: '📦',
  ShortSleeve: '👕', LongSleeve: '🧥', UpperStride: '〰', UpperLogo: '🔖', UpperPlaid: '◼', UpperSplice: '🔀',
  LowerStripe: '〰', LowerPattern: '◼', LongCoat: '🥼', Trousers: '👖', Shorts: '🩳', 'Skirt&Dress': '👗', boots: '👢',
};

/* ── Circular Gauge ── */
function CircularGauge({ pct, color, glow, size = 72 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} className="attr-gauge">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: `drop-shadow(0 0 5px ${glow})`, transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fill={color} fontSize={size < 60 ? 10 : 13} fontWeight="800" fontFamily="Inter, sans-serif">
        {pct}%
      </text>
    </svg>
  );
}

/* ── Attribute Row ── */
function AttrRow({ name, prob, color, glow }) {
  const pct = Math.round(prob * 100);
  const active = prob > 0.5;
  const icon = ICONS[name] || '•';
  return (
    <div className={`attr-row${active ? ' attr-row--active' : ''}`} style={{ '--ac': color, '--glow': glow }}>
      <span className="attr-row__icon">{icon}</span>
      <span className="attr-row__name">{name}</span>
      <div className="attr-row__track">
        <div
          className="attr-row__fill"
          style={{ width: `${pct}%`, background: active ? color : 'rgba(255,255,255,0.1)', boxShadow: active ? `0 0 8px ${glow}` : 'none' }}
        />
      </div>
      <span className="attr-row__pct" style={{ color: active ? color : 'var(--text-muted)' }}>{pct}%</span>
      {active && <span className="attr-row__badge" style={{ background: `${color}22`, color, borderColor: `${color}44` }}>✓</span>}
    </div>
  );
}

/* ── Summary Tag ── */
function SummaryTag({ label, value, icon }) {
  const isBool = value === '✓ Yes' || value === '✗ No';
  const positive = value === '✓ Yes';
  return (
    <div className="summary-tag">
      <span className="summary-tag__icon">{icon}</span>
      <span className="summary-tag__label">{label}</span>
      <span className={`summary-tag__val${isBool ? (positive ? ' summary-tag__val--yes' : ' summary-tag__val--no') : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

/* ═══════════ Main Component ═══════════ */

export default function AttributeRecognition() {
  const { attrResults, setAttrResults, loading, setLoading } = useStore();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (accepted) => {
    const file = accepted[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      setAttrResults(await predictAttributes(form));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [setAttrResults, setLoading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, multiple: false,
  });

  const attrs = attrResults?.attributes || {};
  const structured = attrResults?.structured_attributes || {};

  const activePreds = Object.values(attrs).filter(v => v?.predicted).length;
  const totalPreds = Object.values(attrs).length;
  const avgConf = totalPreds > 0
    ? Object.values(attrs).reduce((s, v) => s + (v?.confidence || 0), 0) / totalPreds
    : 0;
  const maxConf = totalPreds > 0
    ? Math.max(...Object.values(attrs).map(v => v?.confidence || 0))
    : 0;

  const SUMMARY_FIELDS = [
    { label: 'Gender', value: structured.gender, icon: '👤' },
    { label: 'Age Group', value: structured.age, icon: '🎂' },
    { label: 'Orientation', value: structured.orientation, icon: '🧭' },
    { label: 'Upper Body', value: structured.upperBodyClothing, icon: '👕' },
    { label: 'Lower Body', value: structured.lowerBodyClothing, icon: '👖' },
    { label: 'Upper Pattern', value: structured.upperBodyPattern, icon: '🔲' },
    { label: 'Lower Pattern', value: structured.lowerBodyPattern, icon: '🔲' },
    { label: 'Hat', value: structured.hasHat ? '✓ Yes' : '✗ No', icon: '🎩' },
    { label: 'Glasses', value: structured.hasGlasses ? '✓ Yes' : '✗ No', icon: '👓' },
    { label: 'Bag', value: structured.hasBag ? '✓ Yes' : '✗ No', icon: '👜' },
    { label: 'Boots', value: structured.wearingBoots ? '✓ Yes' : '✗ No', icon: '👢' },
  ];

  return (
    <div className="attr-page fade-in">
      {/* ── Header ── */}
      <div className="attr-header">
        <div className="page-icon" style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.08))',
          border: '1px solid rgba(16,185,129,0.3)',
          boxShadow: '0 0 30px rgba(16,185,129,0.15)'
        }}>🏷️</div>
        <div>
          <h1 className="attr-header__title">Attribute Recognition</h1>
          <p className="attr-header__sub">PA-100K ResNet-50 · 26-class binary pedestrian attribute classification</p>
        </div>
        {attrResults && (
          <div className="attr-header__pills">
            <span className="attr-pill attr-pill--active">{activePreds} detected</span>
            <span className="attr-pill attr-pill--avg">{totalPreds} total</span>
          </div>
        )}
      </div>

      <div className="attr-layout">
        {/* ── Left column ── */}
        <div className="attr-left">
          {/* Upload zone */}
          <div
            {...getRootProps()}
            className={`attr-dropzone${isDragActive ? ' attr-dropzone--active' : ''}`}
          >
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="Query" className="attr-dropzone__img" />
            ) : (
              <div className="attr-dropzone__empty">
                <div className="attr-dropzone__circle">🏷️</div>
                <p className="attr-dropzone__text">
                  {isDragActive ? 'Drop image here' : 'Drag & drop a person image'}
                </p>
                <p className="attr-dropzone__hint">or click to browse · JPG / PNG</p>
              </div>
            )}
            {loading && (
              <div className="attr-dropzone__overlay">
                <div className="attr-spinner" />
                <p className="attr-dropzone__overlay-text">Extracting 26 attributes…</p>
              </div>
            )}
          </div>

          {error && (
            <div className="attr-error">⚠️ {error}</div>
          )}

          {/* Metrics row */}
          {totalPreds > 0 && (
            <div className="attr-metrics">
              <div className="attr-metric">
                <CircularGauge pct={activePreds} color="#10b981" glow="rgba(16,185,129,0.4)" size={72} />
                <span className="attr-metric__label">Detected</span>
              </div>
              <div className="attr-metric">
                <CircularGauge pct={Math.round(avgConf * 100)} color="#818cf8" glow="rgba(129,140,248,0.4)" size={72} />
                <span className="attr-metric__label">Avg Conf</span>
              </div>
              <div className="attr-metric">
                <CircularGauge pct={Math.round(maxConf * 100)} color="#f59e0b" glow="rgba(245,158,11,0.4)" size={72} />
                <span className="attr-metric__label">Peak Conf</span>
              </div>
            </div>
          )}

          {/* Structured summary */}
          {Object.keys(structured).length > 0 && (
            <div className="attr-summary-card">
              <p className="attr-summary-card__title">🔍 Structured Overview</p>
              <div className="attr-summary-list">
                {SUMMARY_FIELDS.map(f => (
                  <SummaryTag key={f.label} {...f} />
                ))}
              </div>
            </div>
          )}

          {(attrResults || preview) && !loading && (
            <button
              className="attr-clear-btn"
              onClick={() => { setAttrResults(null); setPreview(null); setError(null); }}
            >
              ✕ Clear Results
            </button>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="attr-right">
          {!attrResults && !loading && (
            <div className="attr-empty-state">
              <div className="attr-empty-state__icon">🏷️</div>
              <h2 className="attr-empty-state__title">Awaiting Image</h2>
              <p className="attr-empty-state__text">
                Upload a person image to run PA-100K ResNet-50 attribute recognition across 26 binary labels.
              </p>
              <div className="attr-empty-state__tags">
                {ATTR_GROUPS.map(g => (
                  <span key={g.name} className="attr-empty-tag" style={{ color: g.color, borderColor: `${g.color}44`, background: `${g.color}11` }}>
                    {g.icon} {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {attrResults && (
            <div className="attr-groups stagger">
              {ATTR_GROUPS.map(group => {
                const groupAttrs = group.keys.filter(k => attrs[k] !== undefined);
                if (!groupAttrs.length) return null;
                const groupActive = groupAttrs.filter(k => attrs[k]?.predicted).length;
                return (
                  <div key={group.name} className="attr-group-card" style={{ '--gc': group.color, '--gg': group.glow }}>
                    <div className="attr-group-card__header">
                      <span className="attr-group-card__icon">{group.icon}</span>
                      <span className="attr-group-card__name" style={{ color: group.color }}>{group.name}</span>
                      <span className="attr-group-card__count" style={{ color: group.color, background: `${group.color}18`, borderColor: `${group.color}33` }}>
                        {groupActive}/{groupAttrs.length}
                      </span>
                    </div>
                    <div className="attr-group-card__bars">
                      {groupAttrs.map(k => (
                        <AttrRow
                          key={k}
                          name={k}
                          prob={attrs[k]?.confidence || 0}
                          color={group.color}
                          glow={group.glow}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
