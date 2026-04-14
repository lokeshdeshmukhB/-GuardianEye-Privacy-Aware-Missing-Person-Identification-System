import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiUser, FiMapPin, FiCalendar, FiX, FiSave } from 'react-icons/fi';
import { createCase } from '../services/api';

const ReportCase = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', age: '', gender: 'unknown', height: '', weight: '',
    lastSeenDate: '', lastSeenLocation: '', lastSeenLat: '', lastSeenLng: '', description: ''
  });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setPhoto(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: false,
  });

  const clearPhoto = () => {
    setPhoto(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError('Name is required'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (photo) fd.append('photos', photo);
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
          <p className="section-subtitle">Upload one reference photo (optional) and complete the details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
          <h4 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>Personal Information</h4>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>}

          {field('name', 'Full Name', 'text', <FiUser />, 'John Doe', true)}
          <div className="grid-2">
            <div className="form-group">
              <label>Age</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                  <FiUser />
                </span>
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="25"
                  value={form.age}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setForm((f) => ({ ...f, age: v }));
                  }}
                />
              </div>
            </div>
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
          <div className="grid-2">
            {field('lastSeenLat', 'Latitude', 'number', <FiMapPin />, '28.6139')}
            {field('lastSeenLng', 'Longitude', 'number', <FiMapPin />, '77.2090')}
          </div>
          {field('lastSeenDate', 'Last Seen Date', 'date', <FiCalendar />)}

          <div className="form-group">
            <label>Description</label>
            <textarea className="input" placeholder="Clothing, distinctive features, circumstances of disappearance…"
              rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ resize: 'vertical' }} />
          </div>

          <h4 style={{ marginBottom: 12, marginTop: 24, fontSize: 14, fontWeight: 600 }}>Reference photo (optional)</h4>
          <div
            {...getRootProps()}
            className={`upload-zone${isDragActive ? ' drag-over' : ''}`}
            style={{
              position: 'relative',
              aspectRatio: '1 / 1',
              maxWidth: 320,
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: preview ? 10 : 14,
              overflow: 'hidden',
              borderLeft: `2px dashed ${isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
              borderRight: `2px dashed ${isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
              borderTop: `2px dashed ${isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
              borderBottom: `2px dashed ${isDragActive ? '#06b6d4' : preview ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
            }}
          >
            <input {...getInputProps()} />
            {preview ? (
              <>
                <img
                  src={preview}
                  alt=""
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    borderRadius: 10,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearPhoto(); }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'var(--danger)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                  }}
                  aria-label="Remove photo"
                >
                  <FiX />
                </button>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '0 8px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(6,182,212,0.08)',
                    border: '1px solid rgba(6,182,212,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FiUploadCloud style={{ fontSize: 22, color: '#06b6d4' }} />
                </div>
                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', lineHeight: 1.35, margin: 0 }}>
                  {isDragActive ? 'Drop image here' : 'Drag & drop a person image'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>or click to browse · JPG / PNG / WebP</p>
              </div>
            )}
          </div>

          <button className="btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            {loading ? 'Saving…' : <><FiSave /> Submit Case</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportCase;
