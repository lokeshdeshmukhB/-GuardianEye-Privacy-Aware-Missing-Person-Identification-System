import { useState, useEffect } from 'react';
import { FiUsers, FiTrash2, FiShield, FiActivity, FiSearch } from 'react-icons/fi';
import { getUsers, deleteUser, getStats, getSearchLogs } from '../services/api';

const AdminPanel = () => {
  const [tab, setTab] = useState('officers');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUsers(), getStats(), getSearchLogs()])
      .then(([u, s, l]) => { setUsers(u.data); setStats(s.data); setLogs(l.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await deleteUser(id);
      setUsers(u => u.filter(x => x._id !== id));
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Admin Panel</h2>
          <p className="section-subtitle">Manage officers and view audit logs</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Cases', value: stats?.totalCases ?? 0, icon: <FiActivity />, color: '#6366f1' },
          { label: 'Active Cases', value: stats?.activeCases ?? 0, icon: <FiActivity />, color: '#ef4444' },
          { label: 'Officers', value: users.filter(u => u.role === 'officer').length, icon: <FiUsers />, color: '#10b981' },
          { label: 'AI Searches', value: stats?.totalSearches ?? 0, icon: <FiSearch />, color: '#f59e0b' }
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {['officers', 'logs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: tab === t ? 'var(--accent)' : 'var(--surface)', color: tab === t ? '#fff' : 'var(--text-muted)'
            }}>
            {t === 'officers' ? '👮 Officers' : '📋 Search Logs'}
          </button>
        ))}
      </div>

      {/* Officers tab */}
      {tab === 'officers' && (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Badge</th><th>Department</th><th></th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</td>
                  <td><span className={`badge badge-${u.role === 'admin' ? 'found' : 'active'}`}>{u.role}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{u.badge || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.department || '—'}</td>
                  <td>
                    <button onClick={() => handleDelete(u._id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No users found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Officer</th><th>Type</th><th>Results</th><th>Time (ms)</th><th>Timestamp</th></tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l._id}>
                  <td>{l.officerName}</td>
                  <td><span className="badge badge-active">{l.searchType}</span></td>
                  <td>{l.resultCount}</td>
                  <td style={{ fontFamily: 'monospace' }}>{l.processingTime}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No search logs yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
