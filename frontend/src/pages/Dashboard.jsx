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

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner" /></div>;

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
      <div className="section-header">
        <div>
          <h2 className="section-title">Dashboard</h2>
          <p className="section-subtitle">Welcome back, {user?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={() => navigate('/report')}><FiPlusCircle /> Report Case</button>
          <button className="btn-secondary" onClick={() => navigate('/search')}><FiSearch /> AI Search</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {statCards.map(s => (
          <div className="stat-card" key={s.label}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Weekly Cases</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f1420', border: '1px solid #1e2a42', borderRadius: 8 }} />
              <Bar dataKey="cases" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Case Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f1420', border: '1px solid #1e2a42', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            {pieData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i], display: 'inline-block' }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Cases */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recent Cases</h3>
        </div>
        <table className="table">
          <thead>
            <tr><th>Case ID</th><th>Name</th><th>Last Seen</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No cases yet. <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/report')}>Report one →</span></td></tr>
            )}
            {cases.map(c => (
              <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.caseId}`)}>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)' }}>{c.caseId}</td>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.lastSeenLocation || '—'}</td>
                <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
