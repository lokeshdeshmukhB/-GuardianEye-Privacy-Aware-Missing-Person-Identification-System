import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats } from '../services/gaitService';
import useStore from '../store/useStore';
import { FiActivity, FiSearch, FiUsers, FiCpu, FiTarget, FiLayers, FiGrid, FiArrowRight, FiZap } from 'react-icons/fi';

/* ═══════════ Sub Components ═══════════ */

const StatCard = ({ label, value, icon: Icon, color, loading }) => (
  <div className="stat-card" style={{ '--sc': color }}>
    <div style={{
      width: 48, height: 48, borderRadius: 14,
      background: `${color}15`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, color, flexShrink: 0,
      boxShadow: `0 4px 16px ${color}20`
    }}>
      {Icon && <Icon />}
    </div>
    <div>
      <p style={{ fontSize: 30, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>
        {loading ? <span className="spinner spinner-sm" style={{ borderTopColor: color }} /> : (value ?? '—')}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5, fontWeight: 500 }}>{label}</p>
    </div>
  </div>
);

const ModelStatusBadge = ({ label, online, icon }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
    background: online ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
    border: `1px solid ${online ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
    transition: 'all 0.3s'
  }}>
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: online ? 'var(--success)' : 'var(--danger)',
      boxShadow: online ? '0 0 8px rgba(16,185,129,0.5)' : '0 0 8px rgba(239,68,68,0.3)',
      flexShrink: 0,
      animation: online ? 'pulse 2s ease-in-out infinite' : 'none'
    }} />
    <span style={{ fontSize: 14, marginRight: 4 }}>{icon}</span>
    <span style={{ color: 'var(--text)' }}>{label}</span>
    <span style={{
      marginLeft: 'auto', fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 1,
      color: online ? 'var(--success)' : 'var(--danger)'
    }}>
      {online ? 'ONLINE' : 'OFFLINE'}
    </span>
  </div>
);

const FeatureButton = ({ to, label, desc, icon, color }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(to)}
      className="card card-glow"
      style={{
        padding: 24, cursor: 'pointer',
        borderLeft: `3px solid ${color}`,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}12`, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22
        }}>
          {icon}
        </div>
        <FiArrowRight style={{ color: 'var(--text-subtle)', fontSize: 18 }} />
      </div>
      <div>
        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--text)' }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</p>
      </div>
      <div style={{
        padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
        color, background: `${color}11`, border: `1px solid ${color}22`,
        alignSelf: 'flex-start', textTransform: 'uppercase', letterSpacing: 0.5
      }}>
        Launch →
      </div>
    </div>
  );
};

/* ═══════════ Main Component ═══════════ */

export default function ReIDDashboard() {
  const { stats, setStats } = useStore();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getStats()
      .then(d => setStats(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ml = stats?.mlService;
  const byType = stats?.byType || {};

  return (
    <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="page-icon" style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 0 30px rgba(99,102,241,0.15)'
          }}>🧬</div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>
              Re-ID <span className="gradient-text">Command Center</span>
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              Person Re-Identification System — Multi-Model Intelligence Hub
            </p>
          </div>
        </div>
      </div>

      {/* ── ML Service Status ── */}
      <div className="card" style={{ padding: 24, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
          borderRadius: '50%', transform: 'translate(50%, -50%)'
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, position: 'relative' }}>
          <FiZap style={{ color: 'var(--accent)', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>ML Service Status</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 999,
            background: ml?.status === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: ml?.status === 'online' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${ml?.status === 'online' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {ml?.status?.toUpperCase() || 'CHECKING…'}
          </span>
          {ml?.device && (
            <span style={{
              fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto',
              padding: '3px 10px', background: 'var(--surface-2)', borderRadius: 6,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5
            }}>
              {ml.device}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, position: 'relative' }}>
          <ModelStatusBadge label="OSNet Re-ID" online={ml?.models?.osnet_reid} icon="🔍" />
          <ModelStatusBadge label="PA-100K Attr" online={ml?.models?.pa100k_attributes} icon="🏷️" />
          <ModelStatusBadge label="SimpleGaitSet" online={ml?.models?.gaitset} icon="🚶" />
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid-4 stagger" style={{ marginBottom: 28 }}>
        <StatCard label="Gallery Persons" value={stats?.totalPersons} icon={FiUsers} color="#6366f1" loading={loading} />
        <StatCard label="Total Searches" value={stats?.totalSearches} icon={FiSearch} color="#06b6d4" loading={loading} />
        <StatCard label="Searches Today" value={stats?.searchesToday} icon={FiActivity} color="#10b981" loading={loading} />
        <StatCard label="Re-ID Searches" value={byType.reid ?? 0} icon={FiCpu} color="#f59e0b" loading={loading} />
      </div>

      {/* ── Feature Buttons ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
          Quick Actions
        </p>
        <div className="grid-3 stagger">
          <FeatureButton
            to="/reid-search"
            label="Person Re-ID Search"
            desc="Match a query image against the gallery using OSNet 512-dim cosine similarity"
            icon="🔍"
            color="#06b6d4"
          />
          <FeatureButton
            to="/attributes"
            label="Attribute Recognition"
            desc="PA-100K ResNet-50 — predict 26 binary pedestrian attributes from any person image"
            icon="🏷️"
            color="#10b981"
          />
          <FeatureButton
            to="/gait"
            label="Gait Recognition"
            desc="SimpleGaitSet silhouette sequence matching — identify by walking pattern"
            icon="🚶"
            color="#8b5cf6"
          />
        </div>
      </div>

      {/* ── Gallery Management ── */}
      <div
        className="card card-glow"
        onClick={() => navigate('/reid-gallery')}
        style={{
          padding: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', marginBottom: 28,
          background: 'linear-gradient(135deg, var(--surface), rgba(245,158,11,0.03))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
          }}>👥</div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15 }}>Gallery Management</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Add, view or remove persons from the Re-ID gallery
            </p>
          </div>
        </div>
        <FiArrowRight style={{ fontSize: 20, color: 'var(--text-muted)' }} />
      </div>

      {/* ── Recent Searches ── */}
      {stats?.recentSearches?.length > 0 && (
        <div className="card fade-in-up" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiActivity style={{ color: 'var(--accent)', fontSize: 16 }} />
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Searches</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Last {stats.recentSearches.length} entries
            </span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Results</th>
                <th>Processing</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentSearches.map((s, i) => {
                const typeConfig = {
                  reid: { color: '#06b6d4', label: 'RE-ID' },
                  gait: { color: '#8b5cf6', label: 'GAIT' },
                  attribute: { color: '#10b981', label: 'ATTR' }
                };
                const tc = typeConfig[s.searchType] || { color: '#888', label: s.searchType };
                return (
                  <tr key={i}>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        background: `${tc.color}15`, color: tc.color,
                        border: `1px solid ${tc.color}30`
                      }}>{tc.label}</span>
                    </td>
                    <td style={{ fontSize: 13 }}>{s.results?.length ?? 0} matches</td>
                    <td style={{ fontSize: 13, fontFamily: 'monospace' }}>
                      {s.processingTime ? `${s.processingTime}ms` : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
