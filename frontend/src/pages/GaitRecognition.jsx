import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { matchGait, addGait } from '../services/gaitService';
import useStore from '../store/useStore';

/* ─── Sub-components ─────────────────────────────────────────── */

const GaitBar = ({ similarity }) => {
  const pct = Math.round(Math.min(Math.max(similarity * 100, 0), 100));
  const color = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: 'var(--text-muted)' }}>Gait Similarity</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.7s ease' }} />
      </div>
    </div>
  );
};

const ConfidenceBadge = ({ level }) => {
  const styles = {
    HIGH:   { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
    MEDIUM: { background: 'rgba(245,158,11,0.15)',  color: 'var(--warning)' },
    LOW:    { background: 'rgba(239,68,68,0.15)',   color: 'var(--danger)'  },
  };
  const s = styles[level] || { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  return (
    <span style={{ ...s, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      {level}
    </span>
  );
};

const FrameStrip = ({ files }) => {
  const shown = files.slice(0, 15);
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        {files.length} frame{files.length !== 1 ? 's' : ''} selected
        {files.length > 15 && <span style={{ marginLeft: 6, opacity: 0.6 }}>(showing first 15)</span>}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {shown.map((f, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img
              src={URL.createObjectURL(f)}
              alt={`f${i}`}
              style={{ width: 36, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', filter: 'grayscale(100%)' }}
            />
            <span style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.65)', color: '#aaa', fontSize: 8,
              textAlign: 'center', borderRadius: '0 0 6px 6px', padding: '1px 0'
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
          </div>
        ))}
        {files.length > 15 && (
          <div style={{
            width: 36, height: 56, borderRadius: 6, border: '1px solid var(--border)',
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
  const pct = Math.round(match.similarity * 100);

  return (
    <div
      className="card"
      onClick={() => setOpen(o => !o)}
      style={{ padding: 20, cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: rank === 1 ? 'rgba(139,92,246,0.25)' : 'var(--surface-2)',
          border: rank === 1 ? '1px solid rgba(139,92,246,0.5)' : '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 16, color: rank === 1 ? '#a78bfa' : 'var(--text-muted)'
        }}>
          #{rank}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#a78bfa' }}>{match.person_id}</span>
            {ai && <ConfidenceBadge level={ai.confidence_level} />}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {match.image_path || 'gait gallery'}
          </p>
        </div>

        <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      <GaitBar similarity={match.similarity} />

      {/* Expandable AI detail */}
      {open && ai && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ai.assessment && (
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 5 }}>🤖 AI Assessment</p>
              <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{ai.assessment}</p>
            </div>
          )}
          {ai.caveats && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', marginBottom: 5 }}>⚠️ Caveats</p>
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
    <div className="fade-in" style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
          }}>🚶</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Gait Recognition</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              SimpleGaitSet · Identify a person from their walking silhouette sequence
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[['match', '🔍 Match Identity'], ['enroll', '➕ Enroll Person']].map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setFiles([]); setGaitResults(null); setEnrollDone(null); setError(null); }}
              style={{
                padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: mode === m ? 'var(--accent)' : 'var(--surface-2)',
                color: mode === m ? '#fff' : 'var(--text-muted)',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Left: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* How it works */}
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>How It Works</p>
            {[
              ['🎥', 'Extract silhouettes', 'Background subtraction on surveillance footage'],
              ['📤', 'Upload 1–30 frames', 'Sequential grayscale PNGs from one walking cycle'],
              ['⚙️', 'Auto-padded to 30', 'System samples/pads to exactly 30 frames'],
              ['🎯', 'Matched by gait', 'SimpleGaitSet extracts 128-dim signature, cosine search'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Person ID (enroll only) */}
          {mode === 'enroll' && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
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
              position: 'relative', minHeight: 160,
              borderColor: files.length ? 'rgba(139,92,246,0.5)' : undefined,
              background: files.length ? 'rgba(139,92,246,0.04)' : undefined,
            }}
          >
            <input {...getInputProps()} />

            {files.length === 0 ? (
              <div style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🚶</div>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
                  {isDragActive ? 'Drop frames here' : 'Drag & drop silhouette frames'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  PNG / BMP · Grayscale · Up to 30 frames<br />
                  <span style={{ color: 'var(--accent)', fontWeight: 500, marginTop: 4, display: 'block' }}>or click to browse</span>
                </p>
              </div>
            ) : (
              <FrameStrip files={files} />
            )}

            {/* Spinner overlay */}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(10,13,20,0.85)', borderRadius: 'var(--radius)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10
              }}>
                <div className="spinner" style={{ borderTopColor: '#8b5cf6' }} />
                <p style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>
                  {mode === 'match' ? 'Analyzing gait sequence…' : 'Enrolling gait signature…'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>SimpleGaitSet inference running</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          {files.length > 0 && !loading && (
            <button
              className="btn-primary"
              onClick={handleSubmit}
              style={{ background: mode === 'enroll' ? 'var(--success)' : undefined, width: '100%', padding: '11px 0' }}
            >
              {mode === 'match'
                ? `🔍 Match Gait — ${files.length} frame${files.length > 1 ? 's' : ''}`
                : `➕ Enroll "${personId || '?'}" — ${files.length} frame${files.length > 1 ? 's' : ''}`
              }
            </button>
          )}

          {/* Enroll success */}
          {enrollDone && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: 14 }}>
              <p style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4, fontSize: 13 }}>✅ Gait Enrolled</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Person <strong style={{ color: 'var(--text)' }}>{enrollDone.person_id}</strong> registered with a{' '}
                <strong style={{ color: 'var(--text)' }}>{enrollDone.embedding_dim}-dim</strong> gait signature.
              </p>
            </div>
          )}

          {/* Stats after match */}
          {gaitResults && (
            <div className="card" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', gap: 0 }}>
              {[
                ['Frames In', gaitResults.frames_received],
                ['Gait Dim', gaitResults.embedding_dim || 128],
                ['Matches', matches.length],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: '6px 0', borderRight: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#a78bfa' }}>{val}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div>
          {/* Empty state */}
          {!gaitResults && !loading && !enrollDone && (
            <div className="card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🚶</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Awaiting Silhouettes</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 320, margin: '0 auto 24px', lineHeight: 1.6 }}>
                Upload 1–30 grayscale silhouette frames from surveillance footage, then click <strong>Match Gait</strong> to identify the person.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {[['🎥', 'Extract from video'], ['📤', 'Upload frames'], ['🎯', 'Get identity match']].map(([icon, t]) => (
                  <div key={t} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Match results */}
          {gaitResults && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Identity Matches</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {matches.length === 0
                      ? 'No gallery matches found — enroll persons first'
                      : `${matches.length} candidate${matches.length > 1 ? 's' : ''} ranked by gait similarity · Click to expand AI analysis`}
                  </p>
                </div>
                <button className="btn-secondary" onClick={() => { setGaitResults(null); setFiles([]); }}
                  style={{ fontSize: 12, padding: '6px 14px' }}>
                  Clear
                </button>
              </div>

              {matches.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>📭</p>
                  <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Gait gallery is empty</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Switch to <strong>Enroll Person</strong> mode to register gait signatures first.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {matches.map((m, i) => {
                    const ai = aiAnalysis.find(a => a.person_id === m.person_id);
                    return <MatchCard key={i} match={m} ai={ai} rank={i + 1} />;
                  })}
                  {/* AI note */}
                  <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18 }}>🤖</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Click any card to expand the Groq AI forensic assessment</p>
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
