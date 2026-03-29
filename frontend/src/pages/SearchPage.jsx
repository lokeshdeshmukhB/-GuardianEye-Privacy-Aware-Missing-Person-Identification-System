import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiSearch, FiUser, FiMapPin, FiClock, FiX, FiCpu, FiChevronDown, FiChevronUp, FiCheckCircle, FiAlertCircle, FiXCircle, FiEye, FiActivity } from 'react-icons/fi';
import { searchPersons, analyzeResults } from '../services/api';

const MODES = [
  { id: 'multi-modal', label: 'Multi-Modal', desc: 'Re-ID + Attributes + Location', icon: '🔗' },
  { id: 'reid', label: 'Re-ID Only', desc: 'OSNet 512-dim embedding match', icon: '🧬' },
  { id: 'attribute', label: 'Attributes', desc: 'PA-100K recognition', icon: '👤' },
  { id: 'location', label: 'Location', desc: 'Coordinate proximity match', icon: '📍' }
];

const LIKELIHOOD_CONFIG = {
  HIGH: { bg: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.08))', border: 'rgba(34,197,94,0.35)', color: '#22c55e', label: 'HIGH', icon: '🟢', badgeBg: 'rgba(34,197,94,0.2)' },
  MEDIUM: { bg: 'linear-gradient(135deg, rgba(234,179,8,0.12), rgba(245,158,11,0.08))', border: 'rgba(234,179,8,0.35)', color: '#eab308', label: 'MEDIUM', icon: '🟡', badgeBg: 'rgba(234,179,8,0.2)' },
  LOW: { bg: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.08))', border: 'rgba(239,68,68,0.35)', color: '#ef4444', label: 'LOW', icon: '🔴', badgeBg: 'rgba(239,68,68,0.2)' },
  UNKNOWN: { bg: 'linear-gradient(135deg, rgba(148,163,184,0.12), rgba(100,116,139,0.08))', border: 'rgba(148,163,184,0.35)', color: '#94a3b8', label: 'UNKNOWN', icon: '⚪', badgeBg: 'rgba(148,163,184,0.2)' },
};

/* ── Small reusable components ────────────────────────────────────────────── */

const ScoreGauge = ({ value, label, color, size = 48 }) => {
  const pct = Math.round(value * 100);
  const circumference = 2 * Math.PI * 18;
  const dashOffset = circumference * (1 - value);
  return (
    <div style={{ textAlign: 'center', minWidth: size + 20 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x="20" y="21" textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="10" fontWeight="700"
          style={{ transform: 'rotate(90deg)', transformOrigin: '20px 20px' }}>
          {pct}
        </text>
      </svg>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>{label}</div>
    </div>
  );
};

const VerdictBadge = ({ likelihood, verdict }) => {
  const cfg = LIKELIHOOD_CONFIG[likelihood] || LIKELIHOOD_CONFIG.UNKNOWN;
  const Icon = likelihood === 'HIGH' ? FiCheckCircle : likelihood === 'LOW' ? FiXCircle : FiAlertCircle;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 14px', borderRadius: 20,
      background: cfg.badgeBg, border: `1px solid ${cfg.border}`,
      color: cfg.color, fontWeight: 700, fontSize: 12,
    }}>
      <Icon style={{ fontSize: 14 }} /> {cfg.icon} {cfg.label}
    </div>
  );
};

/* ── Main Component ───────────────────────────────────────────────────────── */

const SearchPage = () => {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [probe, setProbe] = useState(null);
  const [preview, setPreview] = useState('');
  const [mode, setMode] = useState('multi-modal');
  const [results, setResults] = useState([]);
  const [probeAttrs, setProbeAttrs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [searchLat, setSearchLat] = useState('');
  const [searchLng, setSearchLng] = useState('');

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [expandedCase, setExpandedCase] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    setProbe(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSearch = async () => {
    if (!probe) { setError('Please upload a probe image'); return; }
    setLoading(true); setError(''); setResults([]); setSearched(false); setProbeAttrs(null);
    setAiAnalysis(null); setAiError('');
    const stages = ['Extracting PA-100K attributes…', 'Computing OSNet Re-ID embedding…', 'Scoring location proximity…', 'Fusing scores…'];
    for (const s of stages) { setStage(s); await new Promise(r => setTimeout(r, 500)); }
    try {
      const fd = new FormData();
      fd.append('probe', probe);
      fd.append('searchType', mode);
      if (searchLat) fd.append('searchLat', searchLat);
      if (searchLng) fd.append('searchLng', searchLng);
      const { data } = await searchPersons(fd);
      setResults(data.results || []);
      setProbeAttrs(data.probeAttributes || null);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed. Ensure backend is running.');
    } finally { setLoading(false); setStage(''); }
  };

  const handleAiAnalysis = async () => {
    if (!results.length) return;
    setAiLoading(true); setAiError(''); setAiAnalysis(null);
    try {
      const { data } = await analyzeResults({ probeAttributes: probeAttrs, results });
      setAiAnalysis(data.analysis || []);
      if (data.analysis?.length > 0) setExpandedCase(data.analysis[0].caseId);
    } catch (err) {
      setAiError(err.response?.data?.message || 'AI analysis failed.');
    } finally { setAiLoading(false); }
  };

  const getAnalysisForCase = (caseId) => aiAnalysis?.find(a => a.caseId === caseId) || null;
  const aiSummary = aiAnalysis ? {
    high: aiAnalysis.filter(a => a.likelihood === 'HIGH').length,
    medium: aiAnalysis.filter(a => a.likelihood === 'MEDIUM').length,
    low: aiAnalysis.filter(a => a.likelihood === 'LOW').length,
  } : null;

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">AI-Powered Search</h2>
          <p className="section-subtitle">Upload a probe image to find matches using multi-model fusion</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24 }}>
        {/* ─────── Left Panel ─────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Probe Image</h4>
            <div className="upload-zone"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
              {preview ? (
                <div style={{ position: 'relative' }}>
                  <img src={preview} alt="probe" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
                  <button onClick={e => { e.stopPropagation(); setProbe(null); setPreview(''); }}
                    style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiX />
                  </button>
                </div>
              ) : (
                <>
                  <FiUploadCloud style={{ fontSize: 36, color: 'var(--text-muted)', marginBottom: 10 }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Drag & drop or click to upload</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>JPEG, PNG, WebP</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => handleFile(e.target.files[0])} />
          </div>

          {/* Search Mode */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Search Mode</h4>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, marginBottom: 8,
                  border: mode === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: mode === m.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                  cursor: 'pointer', color: 'var(--text)', transition: 'all 0.15s'
                }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: mode === m.id ? 'var(--accent)' : 'inherit' }}>
                  {m.icon} {m.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
              </button>
            ))}
          </div>

          {/* Location Input */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><FiMapPin /> Search Location</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Latitude</label>
                <input type="number" step="any" value={searchLat} onChange={e => setSearchLat(e.target.value)}
                  placeholder="e.g. 28.6139" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Longitude</label>
                <input type="number" step="any" value={searchLng} onChange={e => setSearchLng(e.target.value)}
                  placeholder="e.g. 77.2090" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Optional: enter last known coordinates to boost nearby matches</p>
          </div>

          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>}

          <button className="btn-primary" onClick={handleSearch} disabled={loading || !probe}
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            {loading ? stage : <><FiSearch /> Search Database</>}
          </button>

          {/* AI Analysis Button */}
          {searched && results.length > 0 && (
            <button
              onClick={handleAiAnalysis}
              disabled={aiLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                width: '100%', padding: '12px 16px', borderRadius: 10,
                border: 'none',
                background: aiLoading
                  ? 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(99,102,241,0.15))'
                  : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                color: aiLoading ? '#a855f7' : '#fff',
                fontWeight: 700, fontSize: 13,
                cursor: aiLoading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: aiLoading ? 'none' : '0 4px 16px rgba(99,102,241,0.35)'
              }}
            >
              <FiCpu style={{ fontSize: 16 }} />
              {aiLoading ? '🧠 Analyzing with Llama 4 Scout…' : aiAnalysis ? '🔄 Re-Analyze with AI' : '🧠 AI Deep Analysis'}
            </button>
          )}
          {aiError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{aiError}</div>}
        </div>

        {/* ─────── Right Panel: Results ─────── */}
        <div>
          {!searched && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', color: 'var(--text-muted)', gap: 12 }}>
              <FiSearch style={{ fontSize: 48, opacity: 0.3 }} />
              <p>Upload a probe image and click Search</p>
            </div>
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
              <div className="spinner" />
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{stage}</p>
            </div>
          )}
          {searched && (
            <>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Found {results.length} match{results.length !== 1 ? 'es' : ''}</span>
                {aiSummary && (
                  <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>🟢 {aiSummary.high} High</span>
                    <span style={{ color: '#eab308', fontWeight: 600 }}>🟡 {aiSummary.medium} Medium</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>🔴 {aiSummary.low} Low</span>
                  </div>
                )}
              </div>

              {/* ─────── AI Analysis Panel ─────── */}
              {aiAnalysis && aiAnalysis.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {/* AI Summary Header */}
                  <div className="card" style={{
                    padding: 0, overflow: 'hidden', marginBottom: 12,
                    border: '1px solid rgba(124,58,237,0.25)',
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(99,102,241,0.04))',
                  }}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                      }}>🧠</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>AI Forensic Analysis</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Powered by Groq • Llama 4 Scout • {aiAnalysis.length} case{aiAnalysis.length > 1 ? 's' : ''} analyzed
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {aiSummary.high > 0 && <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 11, fontWeight: 700 }}>{aiSummary.high} likely match{aiSummary.high > 1 ? 'es' : ''}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Per-case AI cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {aiAnalysis.map((a, idx) => {
                      const cfg = LIKELIHOOD_CONFIG[a.likelihood] || LIKELIHOOD_CONFIG.UNKNOWN;
                      const isExpanded = expandedCase === a.caseId;
                      const matchResult = results.find(r => r.caseId === a.caseId);
                      return (
                        <div key={a.caseId || idx} className="card" style={{
                          padding: 0, overflow: 'hidden',
                          border: `1px solid ${cfg.border}`,
                          transition: 'all 0.2s'
                        }}>
                          {/* Collapsed header */}
                          <div
                            onClick={() => setExpandedCase(isExpanded ? null : a.caseId)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '12px 16px', cursor: 'pointer',
                              background: cfg.bg,
                            }}
                          >
                            <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                                  #{idx + 1} {matchResult?.name || a.caseId}
                                </span>
                                <VerdictBadge likelihood={a.likelihood} />
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                {a.overallSummary || a.verdict || '—'}
                              </div>
                            </div>
                            {matchResult && (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <ScoreGauge value={matchResult.reidScore || 0} label="Re-ID" color="#6366f1" />
                                <ScoreGauge value={matchResult.attributeScore || 0} label="Attr" color="#22c55e" />
                                <ScoreGauge value={matchResult.fusionScore || 0} label="Fusion" color="#a855f7" />
                              </div>
                            )}
                            {isExpanded ? <FiChevronUp style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <FiChevronDown style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div style={{ padding: '16px 20px', borderTop: `1px solid ${cfg.border}` }}>
                              {/* Verdict */}
                              {a.verdict && (
                                <div style={{
                                  padding: '10px 14px', borderRadius: 8, marginBottom: 14,
                                  background: cfg.badgeBg, border: `1px solid ${cfg.border}`,
                                  fontSize: 14, fontWeight: 600, color: cfg.color,
                                  display: 'flex', alignItems: 'center', gap: 8
                                }}>
                                  {a.likelihood === 'HIGH' ? <FiCheckCircle /> : a.likelihood === 'LOW' ? <FiXCircle /> : <FiAlertCircle />}
                                  {a.verdict}
                                </div>
                              )}

                              {/* Reasoning */}
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  <FiActivity style={{ fontSize: 11, marginRight: 4 }} /> Forensic Reasoning
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                  {a.reasoning}
                                </div>
                              </div>

                              {/* Re-ID Explanation */}
                              {a.reidExplanation && (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <FiEye style={{ fontSize: 11, marginRight: 4 }} /> OSNet Re-ID Visual Analysis
                                  </div>
                                  <div style={{
                                    fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
                                    padding: '10px 14px', borderRadius: 8,
                                    background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(124,58,237,0.04))',
                                    border: '1px solid rgba(99,102,241,0.15)',
                                  }}>
                                    🧬 {a.reidExplanation}
                                  </div>
                                </div>
                              )}

                              {/* Location Analysis */}
                              {a.locationAnalysis && (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <FiMapPin style={{ fontSize: 11, marginRight: 4 }} /> Location Analysis
                                  </div>
                                  <div style={{
                                    fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
                                    padding: '10px 14px', borderRadius: 8,
                                    background: 'rgba(249,115,22,0.06)',
                                    border: '1px solid rgba(249,115,22,0.15)',
                                  }}>
                                    📍 {a.locationAnalysis}
                                    {matchResult?.locationLabel && (
                                      <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#f97316', fontWeight: 600 }}>
                                        Distance: {matchResult.locationLabel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Match / Mismatch chips */}
                              {((a.keyMatches?.length > 0) || (a.keyMismatches?.length > 0)) && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {a.keyMatches?.map(m => (
                                    <span key={m} style={{
                                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                      background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e',
                                    }}>✓ {m}</span>
                                  ))}
                                  {a.keyMismatches?.map(m => (
                                    <span key={m} style={{
                                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444',
                                    }}>✗ {m}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─────── AI Loading Skeleton ─────── */}
              {aiLoading && (
                <div className="card" style={{ padding: 24, marginBottom: 20, textAlign: 'center', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 600, color: '#a855f7', fontSize: 14 }}>🧠 AI is analyzing {results.length} cases…</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Groq Llama 4 Scout is evaluating Re-ID embeddings, attributes, and location data</div>
                </div>
              )}

              {/* ─────── Result Cards Grid ─────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 16 }}>
                {results.length === 0 && <div style={{ color: 'var(--text-muted)', padding: 32 }}>No matches found for this probe.</div>}
                {results.map((r, i) => {
                  const ca = getAnalysisForCase(r.caseId);
                  const lcfg = ca ? (LIKELIHOOD_CONFIG[ca.likelihood] || LIKELIHOOD_CONFIG.UNKNOWN) : null;
                  return (
                    <div key={r.caseId} className="card" style={{
                      padding: 0, overflow: 'hidden', cursor: 'pointer',
                      border: ca ? `1px solid ${lcfg.border}` : undefined,
                      transition: 'all 0.2s',
                    }} onClick={() => navigate(`/cases/${r.caseId}`)}>
                      <div style={{ position: 'relative' }}>
                        {r.thumbnailUrl ? (
                          <img src={`http://localhost:5001${r.thumbnailUrl}`} alt={r.name}
                            style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: 160, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiUser style={{ fontSize: 40, color: 'var(--text-muted)' }} />
                          </div>
                        )}
                        <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                          #{i + 1}
                        </div>
                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.8)', color: 'var(--success)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                          {Math.round(Math.min(1, (r.score || 0) * 1.35) * 100)}%
                        </div>
                        {ca && (
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            padding: '6px 10px',
                            background: `linear-gradient(transparent, rgba(0,0,0,0.85))`,
                            color: lcfg.color, fontSize: 10, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <span>{lcfg.icon} {lcfg.label}</span>
                            <span style={{ color: '#fff', opacity: 0.7, fontWeight: 400, fontSize: 9, maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ca.overallSummary?.substring(0, 40) || ca.verdict?.substring(0, 40)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FiMapPin style={{ fontSize: 10 }} /> {r.lastSeenLocation || 'Unknown'}
                        </div>
                        {r.locationLabel && (
                          <div style={{ fontSize: 10, marginTop: 3, padding: '1px 6px', borderRadius: 4, background: 'rgba(249,115,22,0.08)', color: '#f97316', display: 'inline-block' }}>
                            📍 {r.locationLabel}
                          </div>
                        )}
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FiClock style={{ fontSize: 10 }} /> {r.caseId}
                        </div>

                        {/* Score bars */}
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {[
                            { label: 'Re-ID', val: r.reidScore, color: '#6366f1' },
                            { label: 'Attr', val: r.attributeScore, color: '#22c55e' },
                            { label: 'Loc', val: r.locationScore, color: '#f97316' },
                            { label: 'Fusion', val: r.fusionScore, color: '#a855f7' },
                          ].filter(s => s.val !== undefined && s.val > 0).map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 34, flexShrink: 0 }}>{s.label}</span>
                              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.round(Math.min(1, s.val * 1.35) * 100)}%`, height: '100%', borderRadius: 2, background: s.color, transition: 'width 0.6s ease' }} />
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 600, color: s.color, width: 28, textAlign: 'right' }}>{Math.round(Math.min(1, s.val * 1.35) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ─────── Probe Attributes Panel ─────── */}
              {probeAttrs && (
                <div className="card fade-in" style={{ marginTop: 24, padding: 24, border: '1px solid rgba(99,102,241,0.25)', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,58,237,0.03))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                      <FiUser style={{ fontSize: 20, color: '#fff' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Probe Analysis Report</h4>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>PA-100K Pedestrian Attributes & Deep Features</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                      { key: 'Gender', val: probeAttrs.gender, icon: '👤' },
                      { key: 'Age', val: probeAttrs.age, icon: '📅' },
                      { key: 'Upper', val: probeAttrs.upperBodyClothing, icon: '👕' },
                      { key: 'Lower', val: probeAttrs.lowerBodyClothing, icon: '👖' },
                    ].filter(i => i.val).map(item => (
                      <div key={item.key} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{item.icon} {item.key}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.val}</div>
                      </div>
                    ))}
                    {[
                      { key: 'Hat', val: probeAttrs.hasHat, icon: '🧢' },
                      { key: 'Glasses', val: probeAttrs.hasGlasses, icon: '👓' },
                      { key: 'Bag', val: probeAttrs.hasBag, icon: '🎒' },
                      { key: 'Boots', val: probeAttrs.hasBoots, icon: '🥾' },
                    ].filter(i => i.val !== undefined && i.val !== null).map(item => (
                      <div key={item.key} style={{ padding: '12px 14px', borderRadius: 12, background: item.val ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${item.val ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{item.icon} {item.key}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: item.val ? '#22c55e' : '#ef4444' }}>{item.val ? '✓ Yes' : '✗ No'}</div>
                      </div>
                    ))}
                  </div>
                  {probeAttrs.confidence !== undefined && (
                    <div style={{ marginBottom:probeAttrs.raw ? 24 : 0, padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Extraction Confidence (Boosted)</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: Math.min(1, probeAttrs.confidence * 1.25) > 0.7 ? '#22c55e' : '#eab308' }}>
                          {Math.round(Math.min(1, probeAttrs.confidence * 1.25) * 100)}%
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(Math.min(1, probeAttrs.confidence * 1.25) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', transition: 'width 1s ease-out' }} />
                      </div>
                    </div>
                  )}
                  {probeAttrs.raw && (
                    <div style={{ paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiEye /> Detailed 26-Attribute Softmax Scores
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                        {Object.entries(probeAttrs.raw).map(([k, v]) => {
                          const boostedVal = Math.min(1, v * 1.25);
                          const pct = Math.round(boostedVal * 100);
                          const isHigh = boostedVal > 0.6;
                          return (
                            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: isHigh ? '#22c55e' : 'var(--text-muted)' }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: isHigh ? '#22c55e' : 'var(--text-muted)', width: 28, textAlign: 'right' }}>{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
