import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { matchGait, addGait } from '../services/gaitService';
import useStore from '../store/useStore';
import { FiUploadCloud, FiX } from 'react-icons/fi';

/* ─── Sub-components ─────────────────────────────────────────── */

const GaitBar = ({ similarity }) => {
  const pct = Math.round(Math.min(Math.max(similarity * 100, 0), 100));
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : pct >= 40 ? '#f97316' : '#ef4444';
  const label = pct >= 80 ? 'HIGH' : pct >= 60 ? 'MEDIUM' : pct >= 40 ? 'LOW' : 'VERY LOW';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Gait Similarity</span>
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

const FrameStrip = ({ files }) => {
  const shown = files.slice(0, 15);
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
        {files.length} frame{files.length !== 1 ? 's' : ''} selected
        {files.length > 15 && <span style={{ opacity: 0.6 }}> (showing first 15)</span>}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {shown.map((f, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img
              src={URL.createObjectURL(f)}
              alt={`f${i}`}
              style={{
                width: 38, height: 58, objectFit: 'cover', borderRadius: 8,
                border: '1px solid var(--border)', filter: 'grayscale(100%)',
                transition: 'transform 0.2s'
              }}
            />
            <span style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.7)', color: '#aaa', fontSize: 8,
              textAlign: 'center', borderRadius: '0 0 8px 8px', padding: '2px 0',
              fontWeight: 600
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
          </div>
        ))}
        {files.length > 15 && (
          <div style={{
            width: 38, height: 58, borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 11, fontWeight: 700
          }}>
            +{files.length - 15}
          </div>
        )}
      </div>
    </div>
  );
};

const MatchCard = ({ match, ai, rank }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="card"
      onClick={() => setOpen(o => !o)}
      style={{
        padding: 22, cursor: 'pointer',
        borderLeft: rank === 1 ? '3px solid #8b5cf6' : '3px solid transparent',
        transition: 'all 0.3s var(--ease-out)'
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = rank === 1 ? '#8b5cf6' : 'var(--border)'; e.currentTarget.style.transform = ''; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: rank === 1 ? 'rgba(139,92,246,0.15)' : 'var(--surface-2)',
          border: `1px solid ${rank === 1 ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 16,
          color: rank === 1 ? '#a78bfa' : 'var(--text-muted)',
          boxShadow: rank === 1 ? '0 4px 16px rgba(139,92,246,0.2)' : 'none'
        }}>
          #{rank}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#a78bfa' }}>{match.person_id}</span>
            {ai?.confidence_level && (
              <span style={{
                padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                background: ai.confidence_level === 'HIGH' ? 'rgba(16,185,129,0.12)' : ai.confidence_level === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                color: ai.confidence_level === 'HIGH' ? 'var(--success)' : ai.confidence_level === 'MEDIUM' ? 'var(--warning)' : 'var(--danger)',
              }}>
                {ai.confidence_level}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {match.image_path || 'gait gallery'}
          </p>
        </div>

        <span style={{ color: 'var(--text-subtle)', fontSize: 14, flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : '' }}>▼</span>
      </div>

      <GaitBar similarity={match.similarity} />

      {open && ai && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ai.assessment && (
            <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>🤖 AI Assessment</p>
              <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{ai.assessment}</p>
            </div>
          )}
          {ai.caveats && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>⚠️ Caveats</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{ai.caveats}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Main Page ──────────────────────────────────────────────── */
export default function GaitRecognition() {
  const { gaitResults, setGaitResults, loading, setLoading } = useStore();
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('match');
  const [personId, setPersonId] = useState('');
  const [enrollDone, setEnrollDone] = useState(null);

  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    setFiles(accepted);
    setError(null);
    setGaitResults(null);
    setEnrollDone(null);
  }, [setGaitResults]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, multiple: true,
  });

  const handleSubmit = async () => {
    if (!files.length) return setError('Upload at least 1 silhouette frame.');
    if (mode === 'enroll' && !personId.trim()) return setError('Enter a Person ID to enroll.');
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append('frames', f));
      if (mode === 'match') {
        setGaitResults(await matchGait(form));
      } else {
        form.append('person_id', personId.trim());
        setEnrollDone(await addGait(form));
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const matches = gaitResults?.matches || [];
  const aiAnalysis = gaitResults?.aiAnalysis || [];

  return (
    <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div className="page-icon" style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))',
            border: '1px solid rgba(139,92,246,0.3)',
            boxShadow: '0 0 30px rgba(139,92,246,0.15)'
          }}>🚶</div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>
              Gait <span style={{ color: '#8b5cf6' }}>Recognition</span>
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              SimpleGaitSet · Identify persons from walking silhouette sequences
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="card" style={{ padding: 6, display: 'inline-flex', gap: 4 }}>
          {[['match', '🔍 Match Identity'], ['enroll', '➕ Enroll Person']].map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setFiles([]); setGaitResults(null); setEnrollDone(null); setError(null); }}
              style={{
                padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                background: mode === m
                  ? (m === 'match' ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'linear-gradient(135deg, #10b981, #059669)')
                  : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-muted)',
                boxShadow: mode === m ? (m === 'match' ? '0 4px 16px rgba(139,92,246,0.3)' : '0 4px 16px rgba(16,185,129,0.3)') : 'none',
                transition: 'all 0.25s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Left: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* How it works */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 }}>How It Works</p>
            {[
              ['🎥', 'Extract silhouettes', 'Background subtraction on surveillance footage'],
              ['📤', 'Upload 1–30 frames', 'Sequential grayscale PNGs from one walking cycle'],
              ['⚙️', 'Auto-padded to 30', 'System samples/pads to exactly 30 frames'],
              ['🎯', 'Matched by gait', 'SimpleGaitSet extracts embedding, cosine search'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Person ID (enroll only) */}
          {mode === 'enroll' && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Person ID *
              </label>
              <input
                className="input"
                type="text"
                placeholder="e.g. P001"
                value={personId}
                onChange={e => setPersonId(e.target.value)}
              />
            </div>
          )}

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`upload-zone${isDragActive ? ' drag-over' : ''}`}
            style={{
              position: 'relative', minHeight: 180,
              borderColor: files.length ? 'rgba(139,92,246,0.4)' : undefined,
              background: files.length ? 'rgba(139,92,246,0.03)' : undefined,
            }}
          >
            <input {...getInputProps()} />

            {files.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FiUploadCloud style={{ fontSize: 24, color: '#8b5cf6' }} />
                </div>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                  {isDragActive ? 'Drop frames here' : 'Drag & drop silhouette frames'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                  PNG / BMP · Grayscale · Up to 30 frames<br />
                  <span style={{ color: '#8b5cf6', fontWeight: 500 }}>or click to browse</span>
                </p>
              </div>
            ) : (
              <FrameStrip files={files} />
            )}

            {loading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(6,8,15,0.9)',
                borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                backdropFilter: 'blur(4px)'
              }}>
                <div className="spinner" style={{ borderTopColor: '#8b5cf6', boxShadow: '0 0 16px rgba(139,92,246,0.3)' }} />
                <p style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700 }}>
                  {mode === 'match' ? 'Analyzing gait sequence…' : 'Enrolling gait signature…'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>SimpleGaitSet inference running</p>
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

          {/* Submit */}
          {files.length > 0 && !loading && (
            <button
              className={mode === 'enroll' ? 'btn-success' : 'btn-primary'}
              onClick={handleSubmit}
              style={{ width: '100%', padding: '12px 0', justifyContent: 'center' }}
            >
              {mode === 'match'
                ? `🔍 Match Gait — ${files.length} frame${files.length > 1 ? 's' : ''}`
                : `➕ Enroll "${personId || '?'}" — ${files.length} frame${files.length > 1 ? 's' : ''}`
              }
            </button>
          )}

          {/* Enroll success */}
          {enrollDone && (
            <div style={{
              background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 14, padding: 18
            }}>
              <p style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 6, fontSize: 14 }}>✅ Gait Enrolled</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Person <strong style={{ color: 'var(--text)' }}>{enrollDone.person_id}</strong> registered with a{' '}
                <strong style={{ color: 'var(--text)' }}>{enrollDone.embedding_dim}-dim</strong> gait signature.
              </p>
            </div>
          )}

          {/* Stats after match */}
          {gaitResults && (
            <div className="card" style={{ padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', overflow: 'hidden' }}>
              {[
                ['Frames In', gaitResults.frames_received, '#8b5cf6'],
                ['Gait Dim', gaitResults.embedding_dim || 128, '#06b6d4'],
                ['Matches', matches.length, '#10b981'],
              ].map(([label, val, color], i) => (
                <div key={label} style={{
                  padding: '16px 0',
                  borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.2s'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <p style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{val}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, fontWeight: 500 }}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div>
          {/* Empty state */}
          {!gaitResults && !loading && !enrollDone && (
            <div className="card" style={{
              padding: 72, textAlign: 'center',
              background: 'linear-gradient(180deg, var(--surface), rgba(139,92,246,0.02))',
            }}>
              <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.7 }}>🚶</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Awaiting Silhouettes</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 360, margin: '0 auto 28px', lineHeight: 1.7 }}>
                Upload 1–30 grayscale silhouette frames from surveillance footage, then click <strong>Match Gait</strong> to identify the person.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {[['🎥', 'Extract'], ['📤', 'Upload'], ['🎯', 'Match']].map(([icon, t]) => (
                  <div key={t} style={{
                    width: 80, padding: '14px 0', borderRadius: 12,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Match results */}
          {gaitResults && (
            <div className="fade-in-up">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800 }}>Identity Matches</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {matches.length === 0
                      ? 'No gallery matches found — enroll persons first'
                      : `${matches.length} candidate${matches.length > 1 ? 's' : ''} ranked by gait similarity`}
                  </p>
                </div>
                <button className="btn-secondary" onClick={() => { setGaitResults(null); setFiles([]); }}
                  style={{ fontSize: 12, padding: '7px 16px' }}>
                  <FiX /> Clear
                </button>
              </div>

              {matches.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                  <p style={{ fontSize: 36, marginBottom: 14 }}>📭</p>
                  <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Gait gallery is empty</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Switch to <strong>Enroll Person</strong> mode to register gait signatures first.</p>
                </div>
              ) : (
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {matches.map((m, i) => {
                    const ai = aiAnalysis.find(a => a.person_id === m.person_id);
                    return <MatchCard key={i} match={m} ai={ai} rank={i + 1} />;
                  })}
                  <div style={{
                    background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.15)',
                    borderRadius: 12, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start'
                  }}>
                    <span style={{ fontSize: 18 }}>🤖</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Click any card to expand the AI forensic assessment</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI analyzes stride pattern, body silhouette, and walking rhythm for each candidate.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
