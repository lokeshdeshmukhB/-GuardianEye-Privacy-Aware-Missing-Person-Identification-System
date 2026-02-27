import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiSearch, FiUser, FiMapPin, FiClock, FiX } from 'react-icons/fi';
import { searchPersons } from '../services/api';

const MODES = [
  { id: 'multi-modal', label: 'Multi-Modal', desc: 'Attributes + Re-ID + Gait' },
  { id: 'reid', label: 'Re-ID Only', desc: 'OSNet embedding match' },
  { id: 'attribute', label: 'Attributes', desc: 'PA-100K recognition' },
  { id: 'gait', label: 'Gait', desc: 'Silhouette analysis' }
];

const SearchPage = () => {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [probe, setProbe] = useState(null);
  const [preview, setPreview] = useState('');
  const [mode, setMode] = useState('multi-modal');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    setProbe(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSearch = async () => {
    if (!probe) { setError('Please upload a probe image'); return; }
    setLoading(true); setError(''); setResults([]); setSearched(false);
    const stages = ['Extracting attributes…', 'Computing Re-ID embedding…', 'Gait analysis…', 'Fusing scores…'];
    for (const s of stages) {
      setStage(s);
      await new Promise(r => setTimeout(r, 500));
    }
    try {
      const fd = new FormData();
      fd.append('probe', probe);
      fd.append('searchType', mode);
      const { data } = await searchPersons(fd);
      setResults(data.results || []);
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
                      {/* Display individual scores if available */}
                      {(r.reidScore !== undefined || r.attributeScore !== undefined || r.gaitScore !== undefined) && (
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
                          {r.gaitScore !== undefined && (
                            <div style={{ background: 'rgba(249,115,22,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Gait</div>
                              <div style={{ fontWeight: 600, color: '#f97316' }}>{Math.round(r.gaitScore * 100)}%</div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
