import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { predictAttributes } from '../services/attributeService';
import useStore from '../store/useStore';

const ATTR_GROUPS = [
  { name: 'Demographics', keys: ['Female', 'AgeOver60', 'Age18-60', 'AgeLess18'], color: '#818cf8' },
  { name: 'Orientation',  keys: ['Front', 'Side', 'Back'],                       color: '#22d3ee' },
  { name: 'Accessories',  keys: ['Hat', 'Glasses', 'HandBag', 'ShoulderBag', 'Backpack', 'HoldObjectsInFront'], color: '#fbbf24' },
  { name: 'Upper Body',   keys: ['ShortSleeve', 'LongSleeve', 'UpperStride', 'UpperLogo', 'UpperPlaid', 'UpperSplice'],         color: '#34d399' },
  { name: 'Lower Body',   keys: ['LowerStripe', 'LowerPattern', 'LongCoat', 'Trousers', 'Shorts', 'Skirt&Dress', 'boots'],     color: '#f97316' },
];

const AttrBar = ({ name, prob, color }) => {
  const pct = Math.round(prob * 100);
  const active = prob > 0.5;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: active ? 'var(--text)' : 'var(--text-muted)', width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <div style={{ flex: 1, height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: active ? color : 'var(--border)', borderRadius: 3, opacity: active ? 1 : 0.5, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: active ? color : 'var(--text-muted)', width: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
};

const StructuredTag = ({ label, value }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', fontSize: 12,
    padding: '5px 10px', background: 'var(--surface-2)', borderRadius: 7
  }}>
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontWeight: 600 }}>{value || '—'}</span>
  </div>
);

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
  const totalPreds  = Object.values(attrs).length;
  const avgConf     = totalPreds > 0
    ? Object.values(attrs).reduce((s, v) => s + (v?.confidence || 0), 0) / totalPreds
    : 0;

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
          }}>🏷️</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Attribute Recognition</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>PA-100K ResNet-50 · 26-class binary pedestrian attribute classification</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            {...getRootProps()}
            className={`upload-zone${isDragActive ? ' drag-over' : ''}`}
            style={{ position: 'relative', minHeight: 200 }}
          >
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="Query" style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
            ) : (
              <div style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏷️</div>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
                  {isDragActive ? 'Drop image here' : 'Drag & drop a person image'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>or click to browse · JPG / PNG</p>
              </div>
            )}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(10,13,20,0.85)', borderRadius: 'var(--radius)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10
              }}>
                <div className="spinner" style={{ borderTopColor: 'var(--success)' }} />
                <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Extracting 26 attributes…</p>
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          {/* Structured summary */}
          {Object.keys(structured).length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Structured Overview</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <StructuredTag label="Gender" value={structured.gender} />
                <StructuredTag label="Age Group" value={structured.age} />
                <StructuredTag label="Orientation" value={structured.orientation} />
                <StructuredTag label="Upper Body" value={structured.upperBodyClothing} />
                <StructuredTag label="Lower Body" value={structured.lowerBodyClothing} />
                <StructuredTag label="Upper Pattern" value={structured.upperBodyPattern} />
                <StructuredTag label="Lower Pattern" value={structured.lowerBodyPattern} />
                <StructuredTag label="Hat" value={structured.hasHat ? '✓ Yes' : '✗ No'} />
                <StructuredTag label="Glasses" value={structured.hasGlasses ? '✓ Yes' : '✗ No'} />
                <StructuredTag label="Bag" value={structured.hasBag ? '✓ Yes' : '✗ No'} />
                <StructuredTag label="Boots" value={structured.wearingBoots ? '✓ Yes' : '✗ No'} />
              </div>
            </div>
          )}

          {/* Stats */}
          {totalPreds > 0 && (
            <div className="card" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, textAlign: 'center' }}>
              <div style={{ borderRight: '1px solid var(--border)', padding: '4px 0' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{activePreds}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Positive Attrs</p>
              </div>
              <div style={{ padding: '4px 0' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{Math.round(avgConf * 100)}%</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Confidence</p>
              </div>
            </div>
          )}

          {(attrResults || preview) && !loading && (
            <button className="btn-secondary" onClick={() => { setAttrResults(null); setPreview(null); setError(null); }}
              style={{ width: '100%', fontSize: 12 }}>
              Clear Results
            </button>
          )}
        </div>

        {/* Right: Attribute bars */}
        <div>
          {!attrResults && !loading && (
            <div className="card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🏷️</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Awaiting Image</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                Upload a person image to run PA-100K ResNet-50 attribute recognition across 26 binary labels.
              </p>
            </div>
          )}

          {attrResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ATTR_GROUPS.map(group => {
                const groupAttrs = group.keys.filter(k => attrs[k] !== undefined);
                if (!groupAttrs.length) return null;
                return (
                  <div key={group.name} className="card" style={{ padding: 18 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: group.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                      {group.name}
                    </p>
                    {groupAttrs.map(k => (
                      <AttrBar key={k} name={k} prob={attrs[k]?.confidence || 0} color={group.color} />
                    ))}
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
