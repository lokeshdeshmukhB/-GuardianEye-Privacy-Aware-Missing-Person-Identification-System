import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiUser, FiMapPin, FiCalendar, FiX, FiSave } from 'react-icons/fi';
import { createCase } from '../services/api';

const ReportCase = () => {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    name: '', age: '', gender: 'unknown', height: '', weight: '',
    lastSeenDate: '', lastSeenLocation: '', description: ''
  });
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addPhotos = (files) => {
    const arr = Array.from(files).slice(0, 5 - photos.length);
    setPhotos(p => [...p, ...arr]);
    arr.forEach(f => setPreviews(p => [...p, URL.createObjectURL(f)]));
  };

  const removePhoto = (i) => {
    setPhotos(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError('Name is required'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      photos.forEach(p => fd.append('photos', p));
      const { data } = await createCase(fd);
      navigate(`/cases/${data.caseId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, type = 'text', icon, placeholder = '', required = false) => (
    <div className="form-group">
      <label>{label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>{icon}</span>
        <input className="input" style={{ paddingLeft: 36 }} type={type} placeholder={placeholder}
          value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required={required} />
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Report Missing Person</h2>
          <p className="section-subtitle">AI will auto-extract attributes from uploaded photos</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <h4 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>Photo Upload (max 5)</h4>
              <div className="upload-zone" onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}>
                <FiUploadCloud style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click or drag photos here</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => addPhotos(e.target.files)} />
              {previews.length > 0 && (
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  {previews.map((p, i) => (
                    <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
                      <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                      <button type="button" onClick={() => removePhoto(i)}
                        style={{ position: 'absolute', top: -6, right: -6, background: 'var(--danger)', border: 'none', color: '#fff', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 20, background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.2)' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>🤖 AI Processing</h4>
              <ul style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 2, paddingLeft: 16 }}>
                <li>PA-100K ResNet50 → 26 attribute extraction</li>
                <li>OSNet → 512-dim Re-ID embedding</li>
                <li>Gait model → silhouette signature</li>
                <li>All stored for future matching</li>
              </ul>
            </div>
          </div>

          {/* Right */}
          <div className="card" style={{ padding: 24 }}>
            <h4 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>Personal Information</h4>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>}

            {field('name', 'Full Name', 'text', <FiUser />, 'John Doe', true)}
            <div className="grid-2">
              {field('age', 'Age', 'number', <FiUser />, '25')}
              <div className="form-group">
                <label>Gender</label>
                <select className="input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="unknown">Unknown</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              {field('height', 'Height', 'text', <FiUser />, "5'8\"")}
              {field('weight', 'Weight', 'text', <FiUser />, '70 kg')}
            </div>

            <h4 style={{ marginBottom: 16, marginTop: 20, fontSize: 14, fontWeight: 600 }}>Last Seen Details</h4>
            {field('lastSeenLocation', 'Last Seen Location', 'text', <FiMapPin />, 'Central Park, New York')}
            {field('lastSeenDate', 'Last Seen Date', 'date', <FiCalendar />)}

            <div className="form-group">
              <label>Description</label>
              <textarea className="input" placeholder="Clothing, distinctive features, circumstances of disappearance…"
                rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ resize: 'vertical' }} />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
              {loading ? 'Processing & Saving…' : <><FiSave /> Submit Case</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ReportCase;
