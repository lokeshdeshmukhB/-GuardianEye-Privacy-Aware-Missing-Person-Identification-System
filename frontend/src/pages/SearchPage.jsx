import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiSearch, FiUser, FiMapPin, FiClock, FiX } from 'react-icons/fi';
import { searchPersons } from '../services/api';

const MODES = [
  { id: 'multi-modal', label: 'Multi-Modal', desc: 'Re-ID + Attributes + Location' },
  { id: 'reid', label: 'Re-ID Only', desc: 'OSNet 512-dim embedding match' },
  { id: 'attribute', label: 'Attributes', desc: 'PA-100K recognition' },
  { id: 'location', label: 'Location', desc: 'Coordinate proximity match' }
];

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

  const handleFile = (file) => {
    if (!file) return;
    setProbe(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSearch = async () => {
    if (!probe) { setError('Please upload a probe image'); return; }
    setLoading(true); setError(''); setResults([]); setSearched(false); setProbeAttrs(null);
    const stages = ['Extracting PA-100K attributes…', 'Computing OSNet Re-ID embedding…', 'Scoring location proximity…', 'Fusing scores…'];
    for (const s of stages) {
      setStage(s);
      await new Promise(r => setTimeout(r, 500));
    }
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
      setError(err.response?.data?.message || 'Search failed. Make sure the backend is running.');
    } finally {
      setLoading(false); setStage('');
    }
  };

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">AI-Powered Search</h2>
          <p className="section-subtitle">Upload a probe image to find matches using multi-model fusion</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24 }}>
        {/* Left Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Probe Image</h4>
            <div className={`upload-zone ${probe ? '' : ''}`}
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
                  cursor: 'pointer', color: 'var(--text)'
                }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: mode === m.id ? 'var(--accent)' : 'inherit' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.desc}</div>
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
        </div>

        {/* Results */}
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
              <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 14 }}>Found {results.length} match{results.length !== 1 ? 'es' : ''}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
                {results.length === 0 && <div style={{ color: 'var(--text-muted)', padding: 32 }}>No matches found for this probe.</div>}
                {results.map((r, i) => (
                  <div key={r.caseId} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => navigate(`/cases/${r.caseId}`)}>
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
                        {Math.round((r.score || 0) * 100)}%
                      </div>
                    </div>
                    <div style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FiMapPin style={{ fontSize: 10 }} /> {r.lastSeenLocation || 'Unknown location'}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FiClock style={{ fontSize: 10 }} /> {r.caseId}
                      </div>
                      {(r.reidScore !== undefined || r.attributeScore !== undefined || r.locationScore !== undefined) && (
                        <div style={{ marginTop: 10, fontSize: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {r.reidScore !== undefined && (
                            <div style={{ background: 'rgba(99,102,241,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Re-ID</div>
                              <div style={{ fontWeight: 600, color: '#6366f1' }}>{Math.round(r.reidScore * 100)}%</div>
                            </div>
                          )}
                          {r.attributeScore !== undefined && (
                            <div style={{ background: 'rgba(34,197,94,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Attr</div>
                              <div style={{ fontWeight: 600, color: '#22c55e' }}>{Math.round(r.attributeScore * 100)}%</div>
                            </div>
                          )}
                          {r.locationScore !== undefined && r.locationScore > 0 && (
                            <div style={{ background: 'rgba(249,115,22,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Location</div>
                              <div style={{ fontWeight: 600, color: '#f97316' }}>
                                {Math.round(r.locationScore * 100)}%
                                {r.distanceKm != null && <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 3 }}>({r.distanceKm}km)</span>}
                              </div>
                            </div>
                          )}
                          {r.fusionScore !== undefined && (
                            <div style={{ background: 'rgba(168,85,247,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Fusion</div>
                              <div style={{ fontWeight: 600, color: '#a855f7' }}>{Math.round(r.fusionScore * 100)}%</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Probe Attributes Panel */}
              {probeAttrs && (
                <div className="card" style={{ marginTop: 20, padding: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🔍 Probe Image — PA-100K Analysis
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {[
                      ['Gender', probeAttrs.gender],
                      ['Age', probeAttrs.age],
                      ['Upper', probeAttrs.upperBodyClothing],
                      ['Lower', probeAttrs.lowerBodyClothing],
                      ['Hat', probeAttrs.hasHat ? '✓' : '✗'],
                      ['Glasses', probeAttrs.hasGlasses ? '✓' : '✗'],
                      ['Bag', probeAttrs.hasBag ? '✓' : '✗'],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--text)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{k}:</span> <strong>{v}</strong>
                      </span>
                    ))}
                    {probeAttrs.confidence !== undefined && (
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontWeight: 600 }}>
                        Confidence: {Math.round(probeAttrs.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  {probeAttrs.raw && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 4, fontSize: 11 }}>
                      {Object.entries(probeAttrs.raw).map(([k, v]) => {
                        const pct = Math.round(v * 100);
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                            <span style={{ color: v > 0.5 ? '#22c55e' : 'var(--text-muted)', width: 10, fontWeight: 700 }}>{v > 0.5 ? '✓' : '·'}</span>
                            <span style={{ color: 'var(--text-muted)', flex: 1 }}>{k}</span>
                            <span style={{ fontWeight: 600, color: v > 0.5 ? 'var(--text)' : 'var(--text-muted)', opacity: v > 0.5 ? 1 : 0.5 }}>{pct}%</span>
                          </div>
                        );
                      })}
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
