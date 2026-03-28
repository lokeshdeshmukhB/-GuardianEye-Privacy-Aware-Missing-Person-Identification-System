import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { getGallery, addPerson, deleteGalleryPerson } from '../services/reidService';
import useStore from '../store/useStore';

const PersonCard = ({ person, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const photoUrl = person.photoUrl
    ? `http://localhost:5001${person.photoUrl}`
    : null;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove "${person.personId}" from gallery?`)) return;
    setDeleting(true);
    try { await onDelete(person.personId); } finally { setDeleting(false); }
  };

  return (
    <div className="card" style={{ padding: 18, cursor: 'pointer' }} onClick={() => setExpanded(o => !o)}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {photoUrl ? (
          <img src={photoUrl} alt={person.personId} style={{ width: 52, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 52, height: 68, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👤</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{person.personId}</p>
          {person.name && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{person.name}</p>}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {person.embeddingCount ?? (person.embedding ? '1' : '0')} embedding{person.embeddingCount !== 1 ? 's' : ''} · Added {new Date(person.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, padding: '4px 10px', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {deleting ? '…' : '✕'}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Person ID</span><span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{person.personId}</span>
            </div>
            {person.gender && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gender</span><span style={{ color: 'var(--text)' }}>{person.gender}</span></div>}
            {person.age && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Age</span><span style={{ color: 'var(--text)' }}>{person.age}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default function GalleryPage() {
  const { gallery, setGallery, loading, setLoading } = useStore();
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({ personId: '', name: '', gender: '', age: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const loadGallery = useCallback(async () => {
    setLoading(true);
    try { setGallery(await getGallery()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [setGallery, setLoading]);

  useEffect(() => { loadGallery(); }, []);

  const onDrop = useCallback((accepted) => {
    const f = accepted[0]; if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, multiple: false,
  });

  const handleAdd = async () => {
    if (!file) return setError('Upload a photo.');
    if (!formData.personId.trim()) return setError('Person ID is required.');
    setError(null); setSuccess(null); setAdding(true);
    try {
      const form = new FormData();
      form.append('image', file);
      Object.entries(formData).forEach(([k, v]) => { if (v) form.append(k, v); });
      await addPerson(form);
      setSuccess(`"${formData.personId}" enrolled with Re-ID embedding!`);
      setFile(null); setPreview(null);
      setFormData({ personId: '', name: '', gender: '', age: '' });
      loadGallery();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setAdding(false); }
  };

  const handleDelete = async (personId) => {
    await deleteGalleryPerson(personId);
    loadGallery();
  };

  const persons = gallery?.persons || [];
  const filtered = persons.filter(p =>
    !search || p.personId?.toLowerCase().includes(search.toLowerCase()) || p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade-in" style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            👥
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Re-ID Gallery</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {persons.length} person{persons.length !== 1 ? 's' : ''} enrolled · OSNet 512-dim embeddings
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Left: Add Person */}
        <div className="card" style={{ padding: 22 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>➕ Enroll New Person</p>

          {/* Photo upload */}
          <div
            {...getRootProps()}
            className={`upload-zone${isDragActive ? ' drag-over' : ''}`}
            style={{ minHeight: 160, padding: 20, marginBottom: 14 }}
          >
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="Preview" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {isDragActive ? 'Drop here' : 'Upload person photo'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click or drag & drop</p>
              </>
            )}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'personId', label: 'Person ID *', placeholder: 'e.g. P001' },
              { key: 'name',     label: 'Full Name',    placeholder: 'Optional' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 5 }}>{label}</label>
                <input
                  className="input"
                  type="text"
                  placeholder={placeholder}
                  value={formData[key]}
                  onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                  style={{ fontSize: 13 }}
                />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 5 }}>Gender</label>
                <select className="input" value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))} style={{ fontSize: 13 }}>
                  <option value="">Optional</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 5 }}>Age</label>
                <input className="input" type="number" placeholder="Optional" value={formData.age} onChange={e => setFormData(p => ({ ...p, age: e.target.value }))} style={{ fontSize: 13 }} />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--danger)', marginTop: 10 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--success)', marginTop: 10 }}>
              ✅ {success}
            </div>
          )}

          <button className="btn-primary" onClick={handleAdd} disabled={adding} style={{ width: '100%', marginTop: 14 }}>
            {adding ? 'Enrolling…' : '➕ Enroll & Extract Embedding'}
          </button>
        </div>

        {/* Right: Gallery list */}
        <div>
          {/* Search */}
          <div style={{ marginBottom: 14 }}>
            <input
              className="input"
              type="text"
              placeholder="🔍  Search by Person ID or Name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: 60, textAlign: 'center' }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
              <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{search ? 'No matching persons' : 'Gallery is empty'}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {search ? `No persons match "${search}"` : 'Enroll the first person using the form →'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(p => (
                <PersonCard key={p.personId} person={p} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
