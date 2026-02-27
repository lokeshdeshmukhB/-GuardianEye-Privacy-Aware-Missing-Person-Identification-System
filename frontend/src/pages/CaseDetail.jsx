import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiMapPin, FiCalendar, FiActivity, FiShield, FiEdit3, FiCpu } from 'react-icons/fi';
import { getCase, updateCaseStatus } from '../services/api';

const MAX_POLL = 10;
const POLL_MS = 3000;

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef(null);

  const fetchCase = (silent = false) => {
    if (!silent) setLoading(true);
    return getCase(id)
      .then(r => { setCaseData(r.data); return r.data; })
      .catch(() => setError('Case not found'))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchCase().then(data => {
      // If photos exist but ML hasn't finished yet, start polling
      if (data?.photos?.length > 0 && !data?.attributes) {
        let count = 0;
        pollRef.current = setInterval(async () => {
          count++;
          setPollCount(count);
          const fresh = await fetchCase(true);
          if (fresh?.attributes || count >= MAX_POLL) {
            clearInterval(pollRef.current);
          }
        }, POLL_MS);
      }
    });
    return () => clearInterval(pollRef.current);
  }, [id]);

  const handleStatusChange = async (status) => {
    setUpdating(true);
    try {
      const { data } = await updateCaseStatus(id, status);
      setCaseData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner" /></div>;
  if (error || !caseData) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>{error || 'Case not found'}</div>;

  const attrs = caseData.attributes?.raw || {};
  const attrEntries = Object.entries(attrs).slice(0, 12);
  const embedding = caseData.reidEmbedding?.slice(0, 64) || [];

  return (
    <div className="fade-in">
      <button onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 20, fontSize: 14 }}>
        <FiArrowLeft /> Back
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{caseData.name}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{caseData.caseId}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className={`badge badge-${caseData.status}`} style={{ fontSize: 14, padding: '4px 12px' }}>{caseData.status}</span>
          <select value={caseData.status} onChange={e => handleStatusChange(e.target.value)} disabled={updating}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>
            <option value="active">Active</option>
            <option value="found">Found</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Photos */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Photos</h4>
            {caseData.photos?.length > 0 ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {caseData.photos.map((p, i) => (
                  <img key={i} src={`http://localhost:5001${p}`} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: 'var(--text-muted)', flexDirection: 'column', gap: 8 }}>
                <FiUser style={{ fontSize: 32 }} />
                <span style={{ fontSize: 13 }}>No photos uploaded</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Case Information</h4>
            {[
              [<FiUser />, 'Age / Gender', `${caseData.age || '?'} / ${caseData.gender}`],
              [<FiUser />, 'Build', `${caseData.height || '?'} · ${caseData.weight || '?'}`],
              [<FiMapPin />, 'Last Seen', caseData.lastSeenLocation || '—'],
              [<FiCalendar />, 'Last Seen Date', caseData.lastSeenDate ? new Date(caseData.lastSeenDate).toLocaleDateString() : '—'],
              [<FiEdit3 />, 'Description', caseData.description || '—']
            ].map(([icon, label, value], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--accent)', marginTop: 2 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: 14 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Access Log */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><FiShield /> Access Log</h4>
            {caseData.accessLog?.slice(-5).reverse().map((log, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{log.officer} — {log.action}</span>
                <span style={{ color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
            {(!caseData.accessLog || caseData.accessLog.length === 0) && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No access records yet</p>
            )}
          </div>
        </div>

        {/* Right — AI Attributes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><FiActivity /> PA-100K Attributes</h4>

            {caseData.attributes ? (
              /* ── Attributes loaded ─────────────────────────────────────── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(caseData.attributes)
                  .filter(([k]) => k !== 'raw' && k !== 'confidence')
                  .map(([k, v]) => (
                    <div key={k}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {k.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                          {typeof v === 'boolean' ? (v ? '✓ Yes' : '✗ No') : String(v)}
                        </span>
                      </div>
                    </div>
                  ))
                }
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Confidence</span>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{Math.round((caseData.attributes.confidence || 0) * 100)}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${(caseData.attributes.confidence || 0) * 100}%`, background: 'var(--success)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              </div>

            ) : caseData.photos?.length > 0 ? (
              /* ── ML still processing (photos exist, attributes pending) ── */
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(99,102,241,0.12)',
                  marginBottom: 12,
                  animation: 'pulse 1.6s ease-in-out infinite'
                }}>
                  <FiCpu style={{ fontSize: 24, color: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  AI Analysis in Progress
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                  PA-100K ResNet50 is extracting attributes…
                </div>

                {/* Animated progress dots */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 10 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'var(--accent)',
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                    }} />
                  ))}
                </div>

                {pollCount > 0 && pollCount < MAX_POLL && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7 }}>
                    Checking… ({pollCount}/{MAX_POLL})
                  </div>
                )}
                {pollCount >= MAX_POLL && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Still processing — refresh the page in a moment
                  </div>
                )}

                <style>{`
                  @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.08); opacity: 0.75; }
                  }
                  @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-6px); }
                  }
                `}</style>
              </div>

            ) : (
              /* ── No photos uploaded at all ───────────────────────────── */
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 12px', textAlign: 'center' }}>
                <FiUser style={{ fontSize: 28, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                No photos uploaded.<br />Add a photo when reporting to enable AI analysis.
              </div>
            )}
          </div>

          {/* Re-ID Embedding Visualization */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>OSNet Re-ID Embedding</h4>
            {embedding.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {embedding.map((v, i) => {
                  const norm = Math.abs(v) / 2;
                  return (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: v > 0 ? `rgba(99,102,241,${Math.min(norm, 1)})` : `rgba(239,68,68,${Math.min(norm, 1)})`,
                      title: v.toFixed(3)
                    }} />
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No Re-ID embedding available yet</p>
            )}
          </div>

          {/* Gait */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Gait Signature</h4>
            {caseData.gaitScore != null ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gait Score</span>
                  <span style={{ fontWeight: 600 }}>{(caseData.gaitScore * 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${caseData.gaitScore * 100}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 4 }} />
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gait analysis not available (requires video input)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseDetail;
