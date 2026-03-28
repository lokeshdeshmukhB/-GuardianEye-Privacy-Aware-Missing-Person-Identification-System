import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { searchReid } from '../services/reidService';
import useStore from '../store/useStore';

const SimilarityBar = ({ score }) => {
  const pct = Math.round(score * 100);
  const color = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: 'var(--text-muted)' }}>Similarity</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.7s ease' }} />
      </div>
    </div>
  );
};

const LikelihoodBadge = ({ likelihood }) => {
  const colors = {
    HIGH:   { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success)' },
    MEDIUM: { bg: 'rgba(245,158,11,0.12)',  color: 'var(--warning)' },
    LOW:    { bg: 'rgba(239,68,68,0.12)',   color: 'var(--danger)'  },
  };
  if (!likelihood) return null;
  const c = colors[likelihood] || { bg: 'var(--surface-2)', color: 'var(--text-muted)' };
  return (
    <span style={{ ...c, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      {likelihood}
    </span>
  );
};

export default function ReIDSearch() {
  const { reidResults, setReidResults, loading, setLoading } = useStore();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [topK, setTopK] = useState(5);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('top_k', String(topK));
      setReidResults(await searchReid(form));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [topK, setReidResults, setLoading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, multiple: false,
  });

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: 'rgba(6,182,212,0.12)',
            border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
          }}>🔍</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Person Re-ID Search</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>OSNet 512-dim cosine similarity matching against the gallery</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Left: Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Top-K selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Top-K Results:</span>
            {[3, 5, 10].map(k => (
              <button
                key={k}
                onClick={() => setTopK(k)}
                style={{
                  padding: '5px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: topK === k ? 'var(--accent)' : 'var(--surface-2)',
                  color: topK === k ? '#fff' : 'var(--text-muted)',
                  transition: 'background 0.15s'
                }}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`upload-zone${isDragActive ? ' drag-over' : ''}`}
            style={{ position: 'relative', minHeight: 220 }}
          >
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="Query" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
            ) : (
              <div style={{ padding: '16px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🧬</div>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
                  {isDragActive ? 'Drop the image here' : 'Drag & drop a person image'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>or click to select · JPG / PNG</p>
              </div>
            )}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(10,13,20,0.85)', borderRadius: 'var(--radius)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10
              }}>
                <div className="spinner" />
                <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Running OSNet inference…</p>
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          {/* Tips */}
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Tips</p>
            {['Use full-body crop images', 'Ensure the person is clearly visible', 'Good lighting improves accuracy', 'Enroll persons in Gallery first'].map(t => (
              <div key={t} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5, display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--success)' }}>✓</span>{t}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Results */}
        <div>
          {!reidResults && !loading && (
            <div className="card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🎯</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Awaiting Query Image</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                Upload a person image to compare against all enrolled gallery persons using OSNet deep Re-ID.
              </p>
            </div>
          )}

          {reidResults && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Gallery Matches</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Top {reidResults.matches?.length} results · Embedding dim: {reidResults.query_dim}
                  </p>
                </div>
                <button className="btn-secondary" onClick={() => { setReidResults(null); setPreview(null); }}
                  style={{ fontSize: 12, padding: '6px 14px' }}>
                  Clear
                </button>
              </div>

              {reidResults.matches?.length === 0 && (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>📭</p>
                  <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Gallery is empty</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add persons via the <a href="/reid-gallery" style={{ color: 'var(--accent)' }}>Gallery page</a>.</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reidResults.matches?.map((m, i) => {
                  const ai = reidResults.aiAnalysis?.find?.(a => a.person_id === m.person_id);
                  return (
                    <div key={i} className="card" style={{ padding: 18 }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-muted)', minWidth: 28 }}>#{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, color: '#22d3ee', fontSize: 15 }}>{m.person_id}</span>
                            {ai && <LikelihoodBadge likelihood={ai.likelihood} />}
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.image_path}</p>
                        </div>
                      </div>
                      <SimilarityBar score={m.similarity} />
                      {ai && (
                        <div style={{ marginTop: 14, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>🤖 AI Analysis</p>
                          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{ai.verdict}</p>
                          {ai.explanation && <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>{ai.explanation}</p>}
                          {ai.recommendation && <p style={{ fontSize: 11, color: '#60a5fa' }}>💡 {ai.recommendation}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
