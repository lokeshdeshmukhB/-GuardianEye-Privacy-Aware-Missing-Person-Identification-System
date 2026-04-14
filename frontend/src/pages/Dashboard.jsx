import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FiUsers, FiAlertCircle, FiCheckCircle, FiSearch, FiPlusCircle } from 'react-icons/fi';
import { getStats, getCases } from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#ef4444', '#10b981', '#64748b'];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getCases({ limit: 8 })])
      .then(([s, c]) => { setStats(s.data); setCases(c.data.cases); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  const barData = [
    { day: 'Mon', cases: 2 }, { day: 'Tue', cases: 5 }, { day: 'Wed', cases: 3 },
    { day: 'Thu', cases: 8 }, { day: 'Fri', cases: 4 }, { day: 'Sat', cases: 1 }, { day: 'Sun', cases: 6 }
  ];

  const pieData = [
    { name: 'Active', value: stats?.activeCases || 0 },
    { name: 'Found', value: stats?.foundCases || 0 },
    { name: 'Closed', value: (stats?.totalCases || 0) - (stats?.activeCases || 0) - (stats?.foundCases || 0) }
  ];

  const statCards = [
    { label: 'Total Cases', value: stats?.totalCases ?? 0, icon: <FiUsers />, color: '#6366f1' },
    { label: 'Active Cases', value: stats?.activeCases ?? 0, icon: <FiAlertCircle />, color: '#ef4444' },
    { label: 'Found', value: stats?.foundCases ?? 0, icon: <FiCheckCircle />, color: '#10b981' },
    { label: 'AI Searches', value: stats?.totalSearches ?? 0, icon: <FiSearch />, color: '#f59e0b' }
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="page-icon" style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 0 30px rgba(99,102,241,0.12)'
          }}>🏠</div>
          <div>
            <h2 className="section-title">Dashboard</h2>
            <p className="section-subtitle">Welcome back, {user?.name}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={() => navigate('/report')}><FiPlusCircle /> Report Case</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-4 stagger" style={{ marginBottom: 28 }}>
        {statCards.map(s => (
          <div className="stat-card" key={s.label}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `${s.color}15`, border: `1px solid ${s.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: s.color,
              boxShadow: `0 4px 16px ${s.color}15`
            }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-1px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginBottom: 18, fontSize: 15, fontWeight: 700 }}>Weekly Cases</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="day" stroke="#3d4a64" tick={{ fontSize: 12, fill: '#5e6b85' }} />
              <YAxis stroke="#3d4a64" tick={{ fontSize: 12, fill: '#5e6b85' }} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(13,17,32,0.95)', border: '1px solid #1c2540',
                  borderRadius: 10, backdropFilter: 'blur(8px)'
                }}
                labelStyle={{ color: '#e8ecf4' }}
              />
              <Bar dataKey="cases" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginBottom: 18, fontSize: 15, fontWeight: 700 }}>Case Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'rgba(13,17,32,0.95)', border: '1px solid #1c2540',
                  borderRadius: 10
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
            {pieData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i], display: 'inline-block', boxShadow: `0 0 8px ${COLORS[i]}40` }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Cases */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Cases</h3>
        </div>
        <table className="table">
          <thead>
            <tr><th>Case ID</th><th>Name</th><th>Last Seen</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                No cases yet. <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/report')}>Report one →</span>
              </td></tr>
            )}
            {cases.map(c => (
              <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.caseId}`)}>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: '#06b6d4' }}>{c.caseId}</td>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.lastSeenLocation || '—'}</td>
                <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                <td style={{ color: 'var(--text-subtle)', fontSize: 14 }}>→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
