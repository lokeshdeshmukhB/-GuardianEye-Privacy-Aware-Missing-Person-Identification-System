import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register as registerApi } from '../services/api';
import { FiUser, FiMail, FiLock, FiShield, FiBriefcase } from 'react-icons/fi';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'officer', badge: '', department: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await registerApi(form);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, type = 'text', icon, placeholder = '') => (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{icon}</span>
        <input className="input" style={{ paddingLeft: 36 }} type={type} placeholder={placeholder}
          value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required={['name', 'email', 'password'].includes(key)} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <FiShield style={{ fontSize: 36, color: 'var(--accent)', marginBottom: 12 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Register Officer</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Create your law enforcement account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}>{error}</div>}

          {field('name', 'Full Name', 'text', <FiUser />, 'Officer John Doe')}
          {field('email', 'Email', 'email', <FiMail />, 'officer@dept.gov')}
          {field('password', 'Password', 'password', <FiLock />, '••••••••')}
          {field('badge', 'Badge Number', 'text', <FiBriefcase />, 'PD-12345')}
          {field('department', 'Department', 'text', <FiBriefcase />, 'Missing Persons Unit')}

          <div className="form-group">
            <label>Role</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="officer">Officer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Creating…' : 'Create Account'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
            Have account? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
