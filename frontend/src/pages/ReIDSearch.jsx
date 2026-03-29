import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { searchReid } from '../services/reidService';
import useStore from '../store/useStore';
import { FiUploadCloud, FiX, FiArrowRight } from 'react-icons/fi';

/* ═══════════ Sub Components ═══════════ */

const SimilarityBar = ({ score }) => {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : pct >= 40 ? '#f97316' : '#ef4444';
  const label = pct >= 80 ? 'HIGH' : pct >= 60 ? 'MEDIUM' : pct >= 40 ? 'LOW' : 'VERY LOW';
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Cosine Similarity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700,
            background: `${color}18`, color, border: `1px solid ${color}30`,
            letterSpacing: 0.5
          }}>{label}</span>
          <span style={{ fontWeight: 800, color, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 999,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 12px ${color}40`,
          transition: 'width 0.8s cubic-bezier(.4,0,.2,1)'
        }} />
      </div>
    </div>
  );
};

const MatchCard = ({ match, rank, ai }) => (
  <div
    className="card"
    style={{
      padding: 20, transition: 'all 0.3s var(--ease-out)',
      borderLeft: rank === 1 ? '3px solid #06b6d4' : '3px solid transparent'
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = '#06b6d4'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = rank === 1 ? '#06b6d4' : 'var(--border)'; e.currentTarget.style.transform = ''; }}
  >
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: rank === 1 ? 'rgba(6,182,212,0.15)' : 'var(--surface-2)',
        border: `1px solid ${rank === 1 ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: 16,
        color: rank === 1 ? '#06b6d4' : 'var(--text-muted)',
        boxShadow: rank === 1 ? '0 4px 16px rgba(6,182,212,0.2)' : 'none'
      }}>
        #{rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#22d3ee', fontSize: 16 }}>{match.person_id}</span>
          {ai?.likelihood && (
            <span style={{
              padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              background: ai.likelihood === 'HIGH' ? 'rgba(16,185,129,0.12)' : ai.likelihood === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
              color: ai.likelihood === 'HIGH' ? 'var(--success)' : ai.likelihood === 'MEDIUM' ? 'var(--warning)' : 'var(--danger)',
            }}>
              {ai.likelihood}
            </span>
          )}
        </div>
        <p style={{
          fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
          marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {match.image_path}
        </p>
      </div>
    </div>

    <SimilarityBar score={match.similarity} />

    {ai && (
      <div style={{
        marginTop: 14, background: 'rgba(6,182,212,0.04)',
        border: '1px solid rgba(6,182,212,0.15)', borderRadius: 12, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 8
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          🤖 AI Analysis
        </p>
        <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{ai.verdict}</p>
        {ai.explanation && <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>{ai.explanation}</p>}
        {ai.recommendation && <p style={{ fontSize: 11, color: '#60a5fa' }}>💡 {ai.recommendation}</p>}
      </div>
    )}
  </div>
);

/* ═══════════ Main Component ═══════════ */

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

  const handleClear = () => {
    setReidResults(null);
    setPreview(null);
    setError(null);
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="page-icon" style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))',
            border: '1px solid rgba(6,182,212,0.3)',
            boxShadow: '0 0 30px rgba(6,182,212,0.15)'
          }}>🔍</div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>
              Person <span style={{ color: '#06b6d4' }}>Re-ID</span> Search
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              OSNet 512-dim embedding · Cosine similarity gallery matching
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left: Upload Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Top-K Selector */}
          <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Top-K:</span>
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {[3, 5, 10].map(k => (
                <button
                  key={k}
                  onClick={() => setTopK(k)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                    background: topK === k ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'var(--surface-2)',
                    color: topK === k ? '#fff' : 'var(--text-muted)',
                    boxShadow: topK === k ? '0 4px 12px rgba(6,182,212,0.25)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`upload-zone${isDragActive ? ' drag-over' : ''}`}
            style={{
              position: 'relative', minHeight: 240,
              borderColor: isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : undefined,
            }}
          >
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="Query" style={{
                maxHeight: 220, maxWidth: '100%', borderRadius: 12, objectFit: 'contain',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.3s'
                }}>
                  <FiUploadCloud style={{ fontSize: 26, color: '#06b6d4' }} />
                </div>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                  {isDragActive ? 'Drop image here' : 'Drag & drop a person image'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>or click to browse · JPG / PNG</p>
              </div>
            )}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(6,8,15,0.9)',
                borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                backdropFilter: 'blur(4px)'
              }}>
                <div className="spinner" style={{ borderTopColor: '#06b6d4', boxShadow: '0 0 16px rgba(6,182,212,0.3)' }} />
                <p style={{ fontSize: 13, color: '#06b6d4', fontWeight: 700, letterSpacing: 0.3 }}>
                  Running OSNet inference…
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Extracting 512-dim embedding</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--danger)',
              display: 'flex', gap: 8, alignItems: 'center'
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Tips */}
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
              Tips for best results
            </p>
            {[
              'Use full-body cropped person images',
              'Ensure the person is clearly visible',
              'Good lighting improves matching accuracy',
              'Enroll persons in Gallery before searching'
            ].map(t => (
              <div key={t} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>✓</span>{t}
              </div>
            ))}
          </div>

          {/* Clear */}
          {(preview || reidResults) && !loading && (
            <button className="btn-secondary" onClick={handleClear} style={{ width: '100%', justifyContent: 'center' }}>
              <FiX /> Clear & Reset
            </button>
          )}
        </div>

        {/* ── Right: Results ── */}
        <div>
          {!reidResults && !loading && (
            <div className="card" style={{
              padding: 72, textAlign: 'center',
              background: 'linear-gradient(180deg, var(--surface), rgba(6,182,212,0.02))',
            }}>
              <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.7 }}>🎯</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Awaiting Query Image</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
                Upload a person image to compare against all enrolled gallery persons using OSNet deep Re-ID with cosine similarity matching.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
                {[
                  ['📷', 'Upload'],
                  ['⚡', 'Extract'],
                  ['🎯', 'Match']
                ].map(([icon, label]) => (
                  <div key={label} style={{
                    width: 80, padding: '14px 0', borderRadius: 12,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reidResults && (
            <div className="fade-in-up">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800 }}>Gallery Matches</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Top {reidResults.matches?.length} results · Embedding dim: {reidResults.query_dim}
                  </p>
                </div>
              </div>

              {reidResults.matches?.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                  <p style={{ fontSize: 36, marginBottom: 14 }}>📭</p>
                  <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Gallery is empty</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Add persons via the <a href="/reid-gallery" style={{ color: '#06b6d4', textDecoration: 'none' }}>Gallery page</a>.
                  </p>
                </div>
              ) : (
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reidResults.matches?.map((m, i) => {
                    const ai = reidResults.aiAnalysis?.find?.(a => a.person_id === m.person_id);
                    return <MatchCard key={i} match={m} rank={i + 1} ai={ai} />;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
