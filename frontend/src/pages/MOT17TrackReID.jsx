import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMot17Tracks, matchMot17Track } from '../services/mot17TrackService';

const PLAY_MS = 130;

function frameUrl(base, trackId, file) {
  if (!base || !trackId || !file) return '';
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(trackId)}/${encodeURIComponent(file)}`;
}

function TrackFilmstrip({ baseUrl, trackId, frames, label, playing, emptyHint, accent = '#ef4444' }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [trackId, frames]);

  useEffect(() => {
    if (!playing || !frames?.length) return undefined;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % frames.length);
    }, PLAY_MS);
    return () => clearInterval(t);
  }, [playing, frames]);

  const src = frames?.length ? frameUrl(baseUrl, trackId, frames[idx]) : '';

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 600 }}>{trackId}</span>
      </div>
      <div
        style={{
          aspectRatio: '3 / 4',
          maxHeight: 320,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a12',
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: 320,
              objectFit: 'contain',
              boxSizing: 'border-box',
              border: `2px solid ${accent}`,
            }}
            onError={(e) => {
              e.target.style.opacity = 0.2;
            }}
          />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 12px', textAlign: 'center' }}>
            {emptyHint || 'No frames for this track.'}
          </span>
        )}
      </div>
      <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-subtle)' }}>
        {frames?.length ? `${frames.length} frames · loop` : '—'}
      </div>
    </div>
  );
}

export default function MOT17TrackReID() {
  const [tracks, setTracks] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  const [matchIndex, setMatchIndex] = useState(0);
  const [playQuery, setPlayQuery] = useState(true);
  const [playMatch, setPlayMatch] = useState(false);
  const [viewMode, setViewMode] = useState('rgb');

  const baseUrlRgb = result?.frame_base_url || '';
  const baseUrlSil = result?.silhouette_frame_base_url || '';
  const baseUrl = viewMode === 'rgb' ? baseUrlRgb : baseUrlSil;

  const queryFramesRgb = result?.query_frames || [];
  const queryFramesSil = result?.query_silhouette_frames || [];
  const queryFrames = viewMode === 'rgb' ? queryFramesRgb : queryFramesSil;

  const loadMeta = useCallback(async () => {
    setErr(null);
    try {
      const tr = await getMot17Tracks();
      const list = tr.tracks || [];
      setTracks(list);
      setQuery((q) => (q && list.includes(q) ? q : ''));
    } catch (e) {
      setErr(e.message || 'Failed to load track list');
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const runMatch = async () => {
    if (!query) return;
    setErr(null);
    setLoading(true);
    setResult(null);
    setMatchIndex(0);
    setPlayQuery(true);
    setPlayMatch(false);
    try {
      const data = await matchMot17Track(query, 5);
      setResult(data);
    } catch (e) {
      setErr(e.response?.data?.message || e.message || 'Match failed');
    } finally {
      setLoading(false);
    }
  };

  const matches = result?.matches || [];
  const current = matches[matchIndex];
  const matchFrames =
    viewMode === 'rgb' ? (current?.frames || []) : (current?.silhouette_frames || []);

  const queryEmptyHint = useMemo(() => {
    if (!result || queryFrames.length) return undefined;
    if (viewMode === 'rgb') {
      return !baseUrlRgb
        ? 'RGB frame URL not available — check ML service crop configuration.'
        : 'No RGB crop files for this track.';
    }
    return !baseUrlSil
      ? 'Silhouette frame URL not available — check ML service silhouette configuration.'
      : 'No silhouette files for this track.';
  }, [result, queryFrames.length, viewMode, baseUrlRgb, baseUrlSil]);

  const matchEmptyHint = useMemo(() => {
    if (!current || matchFrames.length) return undefined;
    if (viewMode === 'rgb') {
      return !baseUrlRgb
        ? 'RGB frame URL not available — check ML service crop configuration.'
        : 'No RGB crop files for this track.';
    }
    return !baseUrlSil
      ? 'Silhouette frame URL not available — check ML service silhouette configuration.'
      : 'No silhouette files for this track.';
  }, [current, matchFrames.length, viewMode, baseUrlRgb, baseUrlSil]);

  const goNextMatch = () => {
    if (matchIndex < matches.length - 1) {
      setMatchIndex((i) => i + 1);
      setPlayMatch(true);
    }
  };

  const goPrevMatch = () => {
    if (matchIndex > 0) {
      setMatchIndex((i) => i - 1);
      setPlayMatch(true);
    }
  };

  useEffect(() => {
    if (result?.matches?.length) {
      setPlayMatch(false);
      const t = setTimeout(() => setPlayMatch(true), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [matchIndex, result]);

  const weightsLine = useMemo(() => {
    const w = result?.weights;
    if (!w) return '';
    return `0.6·appearance + 0.2·attribute + 0.2·gait`;
  }, [result]);

  return (
    <div
      className="page-reid fade-in-up"
      style={{
        maxWidth: 1100,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: 0, lineHeight: 1.2 }}>
          Track <span style={{ color: '#f472b6' }}>Re-ID</span>
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.65, maxWidth: 720 }}>
          Precomputed OSNet appearance, PA-100K attributes, and gait track embeddings — top-5 cosine fusion, no training.
        </p>
      </header>

      <section className="card" style={{ padding: '20px 22px', marginBottom: 22 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '16px 20px',
          }}
        >
          <div style={{ flex: '1 1 220px', minWidth: 0, maxWidth: '100%' }}>
            <label
              htmlFor="mot17-query-track"
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-subtle)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Query track
            </label>
            <select
              id="mot17-query-track"
              className="input"
              style={{ width: '100%', marginTop: 0 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            >
              <option value="" disabled hidden>
                Select a track
              </option>
              {tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              flex: '0 1 auto',
            }}
          >
            <button type="button" className="btn-primary" disabled={loading || !tracks.length || !query} onClick={runMatch}>
              {loading ? 'Searching…' : 'Find top 5 matches'}
            </button>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input type="checkbox" checked={playQuery} onChange={(e) => setPlayQuery(e.target.checked)} />
              Animate query
            </label>
          </div>
        </div>
        {err && (
          <p style={{ margin: '16px 0 0', paddingTop: 14, borderTop: '1px solid var(--border)', color: '#fca5a5', fontSize: 13 }}>
            {err}
          </p>
        )}
      </section>

      {result && (
        <>
          <section className="card" style={{ padding: '20px 22px 22px', marginBottom: 22 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px 16px',
                marginBottom: 18,
                paddingBottom: 16,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 0.55, margin: 0 }}>
                Query preview
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  View
                </span>
                <button
                  type="button"
                  className={viewMode === 'rgb' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: 12 }}
                  onClick={() => setViewMode('rgb')}
                >
                  RGB crops
                </button>
                <button
                  type="button"
                  className={viewMode === 'sil' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: 12 }}
                  onClick={() => setViewMode('sil')}
                >
                  Silhouettes
                </button>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                gap: 22,
                alignItems: 'start',
              }}
            >
              <TrackFilmstrip
                baseUrl={baseUrl}
                trackId={result.query_track}
                frames={queryFrames}
                label={viewMode === 'rgb' ? 'Query · RGB' : 'Query · silhouette'}
                playing={playQuery}
                emptyHint={queryEmptyHint}
                accent={viewMode === 'sil' ? '#a78bfa' : '#ef4444'}
              />
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  minHeight: 120,
                  boxSizing: 'border-box',
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-subtle)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    margin: '0 0 12px',
                  }}
                >
                  Top attributes
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    alignItems: 'flex-start',
                  }}
                >
                  {(result.query_top_attributes || []).map((a) => (
                    <span
                      key={a}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        background: 'rgba(244,114,182,0.12)',
                        border: '1px solid rgba(244,114,182,0.35)',
                        color: '#fbcfe8',
                        width: 'fit-content',
                        maxWidth: '100%',
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
                {weightsLine ? (
                  <p
                    style={{
                      margin: '14px 0 0',
                      paddingTop: 12,
                      borderTop: '1px solid var(--border)',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontFamily: 'ui-monospace, monospace',
                      lineHeight: 1.5,
                    }}
                  >
                    {weightsLine}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="card" style={{ padding: '20px 22px', marginBottom: 18 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 18,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>
                Match <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{matchIndex + 1}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 14 }}> / {matches.length}</span>
              </h3>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" className="btn-secondary" disabled={matchIndex <= 0} onClick={goPrevMatch}>
                  ← Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={matchIndex >= matches.length - 1}
                  onClick={goNextMatch}
                >
                  Next →
                </button>
              </div>
            </div>

            {current && (
              <>
                <pre
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: 'var(--text)',
                    background: 'var(--surface-2)',
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    margin: '0 0 18px',
                    whiteSpace: 'pre-wrap',
                    overflowX: 'auto',
                  }}
                >
                  {`MATCH ${matchIndex + 1}: ${current.track_id}
Final: ${current.final?.toFixed(3) ?? '—'}
App: ${current.appearance?.toFixed(3) ?? '—'} | Attr: ${current.attribute?.toFixed(3) ?? '—'} | Gait: ${current.gait?.toFixed(3) ?? '—'}
Reason: ${current.reason || '—'}
Matched Attributes: ${(current.matched_attributes || []).join(', ') || '—'}
Match top attributes: ${(current.top_attributes || []).join(', ')}`}
                </pre>

                <TrackFilmstrip
                  baseUrl={baseUrl}
                  trackId={current.track_id}
                  frames={matchFrames}
                  label={viewMode === 'rgb' ? 'Match · RGB' : 'Match · silhouette'}
                  playing={playMatch}
                  emptyHint={matchEmptyHint}
                  accent={viewMode === 'sil' ? '#a78bfa' : '#ef4444'}
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
