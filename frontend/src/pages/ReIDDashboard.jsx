import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats } from '../services/gaitService';
import useStore from '../store/useStore';
import { FiActivity, FiSearch, FiUsers, FiCpu } from 'react-icons/fi';

const ACCENT_VIOLET = 'rgba(139,92,246,0.15)';

const StatCard = ({ label, value, icon: Icon, loading }) => (
  <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</p>
      {Icon && <Icon style={{ color: 'var(--accent)', fontSize: 16 }} />}
    </div>
    <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>
      {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, display: 'inline-block' }} /> : (value ?? '—')}
    </p>
  </div>
);

const ModelBadge = ({ label, online }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    background: online ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
    color: online ? 'var(--success)' : 'var(--danger)',
    border: `1px solid ${online ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
  }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: online ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
    {label}
  </div>
);

const QuickCard = ({ to, label, desc, icon, accentRgb }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(to)}
      className="card"
      style={{
        padding: 22, cursor: 'pointer', transition: 'transform 0.15s, border-color 0.2s',
        borderLeft: `3px solid rgb(${accentRgb})`,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `rgb(${accentRgb})`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
    >
      <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
};

export default function ReIDDashboard() {
  const { stats, setStats } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(d => setStats(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ml = stats?.mlService;
  const byType = stats?.byType || {};

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
          }}>🧬</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Re-ID Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Person Re-Identification System — Command Center</p>
          </div>
        </div>
      </div>

      {/* ML Service Status */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>ML Service (FastAPI)</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
            background: ml?.status === 'online' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
            color: ml?.status === 'online' ? 'var(--success)' : 'var(--danger)',
          }}>
            {ml?.status?.toUpperCase() || 'CHECKING…'}
          </span>
          {ml?.device && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{ml.device.toUpperCase()}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ModelBadge label="OSNet Re-ID" online={ml?.models?.osnet_reid} />
          <ModelBadge label="PA-100K Attributes" online={ml?.models?.pa100k_attributes} />
          <ModelBadge label="GaitSet" online={ml?.models?.gaitset} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <StatCard label="Gallery Persons" value={stats?.totalPersons} icon={FiUsers} loading={loading} />
        <StatCard label="Total Searches" value={stats?.totalSearches} icon={FiSearch} loading={loading} />
        <StatCard label="Searches Today" value={stats?.searchesToday} icon={FiActivity} loading={loading} />
        <StatCard label="Re-ID Searches" value={byType.reid ?? 0} icon={FiCpu} loading={loading} />
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Quick Actions</p>
        <div className="grid-3">
          <QuickCard to="/reid-search" label="Person Re-ID Search" desc="Match query image against gallery using OSNet 512-dim" icon="🔍" accentRgb="6,182,212" />
          <QuickCard to="/attributes"  label="Attribute Recognition" desc="PA-100K: 26-attribute binary classification" icon="🏷️" accentRgb="16,185,129" />
          <QuickCard to="/gait"        label="Gait Recognition"    desc="SimpleGaitSet silhouette sequence matching" icon="🚶" accentRgb="139,92,246" />
        </div>
      </div>

      {/* Gallery link */}
      <div style={{ marginBottom: 28 }}>
        <div
          className="card"
          onClick={() => window.location.href = '/reid-gallery'}
          style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>👥 Gallery Management</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Add, view or remove persons from the Re-ID gallery</p>
          </div>
          <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>→</span>
        </div>
      </div>

      {/* Recent Searches */}
      {stats?.recentSearches?.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Recent Searches</h3>
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
                const typeColors = { reid: '#22d3ee', gait: '#a78bfa', attribute: '#34d399' };
                return (
                  <tr key={i}>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase', background: `${typeColors[s.searchType] || '#888'}22`,
                        color: typeColors[s.searchType] || 'var(--text-muted)',
                      }}>{s.searchType}</span>
                    </td>
                    <td style={{ fontSize: 13 }}>{s.results?.length ?? 0} matches</td>
                    <td style={{ fontSize: 13 }}>{s.processingTime ? `${s.processingTime}ms` : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(s.createdAt).toLocaleString()}</td>
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
