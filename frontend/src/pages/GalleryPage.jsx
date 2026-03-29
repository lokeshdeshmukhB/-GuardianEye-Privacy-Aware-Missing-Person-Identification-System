import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { getGallery, addPerson, deleteGalleryPerson } from '../services/reidService';
import useStore from '../store/useStore';
import { FiUploadCloud, FiTrash2, FiChevronDown, FiChevronUp, FiPlus, FiSearch } from 'react-icons/fi';

/* ═══════════ Person Card ═══════════ */

const PersonCard = ({ person, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const photoUrl = person.photoUrl ? `http://localhost:5001${person.photoUrl}` : null;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove "${person.personId}" from gallery?`)) return;
    setDeleting(true);
    try { await onDelete(person.personId); } finally { setDeleting(false); }
  };

  return (
    <div
      className="card"
      style={{
        padding: 18, cursor: 'pointer',
        transition: 'all 0.3s var(--ease-out)'
      }}
      onClick={() => setExpanded(o => !o)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {photoUrl ? (
          <img src={photoUrl} alt={person.personId} style={{
            width: 54, height: 72, objectFit: 'cover', borderRadius: 10,
            border: '1px solid var(--border)', flexShrink: 0,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }} />
        ) : (
          <div style={{
            width: 54, height: 72, borderRadius: 10,
            border: '1px dashed var(--border)', background: 'var(--surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0
          }}>👤</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontWeight: 700, fontSize: 15 }}>{person.personId}</p>
            <span style={{
              padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
              background: 'rgba(99,102,241,0.1)', color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.2)'
            }}>
              {person.embeddingCount ?? (person.embedding ? '1' : '0')} emb
            </span>
          </div>
          {person.name && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{person.name}</p>}
          <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>
            Added {new Date(person.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {expanded ? <FiChevronUp style={{ color: 'var(--text-muted)', fontSize: 14 }} /> : <FiChevronDown style={{ color: 'var(--text-muted)', fontSize: 14 }} />}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-danger"
            style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8 }}
          >
            {deleting ? '…' : <FiTrash2 />}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8
        }}>
          {[
            ['Person ID', person.personId],
            ['Name', person.name || '—'],
            ['Gender', person.gender || '—'],
            ['Age', person.age || '—'],
          ].map(([label, val]) => (
            <div key={label} style={{
              padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)',
              display: 'flex', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, fontFamily: label === 'Person ID' ? 'monospace' : 'inherit' }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════ Main Component ═══════════ */

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
    <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="page-icon" style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
            border: '1px solid rgba(245,158,11,0.3)',
            boxShadow: '0 0 30px rgba(245,158,11,0.15)'
          }}>👥</div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>
              Re-ID <span style={{ color: '#f59e0b' }}>Gallery</span>
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              {persons.length} person{persons.length !== 1 ? 's' : ''} enrolled · OSNet 512-dim embeddings
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left: Add Person ── */}
        <div className="card" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: 160, height: 160,
            background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
            borderRadius: '50%', transform: 'translate(40%, -40%)'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, position: 'relative' }}>
            <FiPlus style={{ color: '#f59e0b', fontSize: 18 }} />
            <p style={{ fontSize: 15, fontWeight: 700 }}>Enroll New Person</p>
          </div>

          {/* Photo upload */}
          <div
            {...getRootProps()}
            className={`upload-zone${isDragActive ? ' drag-over' : ''}`}
            style={{
              minHeight: 160, padding: 20, marginBottom: 16,
              borderColor: isDragActive ? '#f59e0b' : preview ? 'rgba(245,158,11,0.3)' : undefined,
            }}
          >
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="Preview" style={{
                maxHeight: 140, maxWidth: '100%', borderRadius: 12, objectFit: 'contain',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FiUploadCloud style={{ fontSize: 22, color: '#f59e0b' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {isDragActive ? 'Drop here' : 'Upload person photo'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click or drag & drop</p>
              </div>
            )}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'personId', label: 'Person ID *', placeholder: 'e.g. P001' },
              { key: 'name', label: 'Full Name', placeholder: 'Optional' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
                <input
                  className="input"
                  type="text"
                  placeholder={placeholder}
                  value={formData[key]}
                  onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gender</label>
                <select className="input" value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">Optional</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Age</label>
                <input className="input" type="number" placeholder="Optional" value={formData.age} onChange={e => setFormData(p => ({ ...p, age: e.target.value }))} />
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--danger)', marginTop: 12,
              display: 'flex', gap: 6, alignItems: 'center'
            }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{
              background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--success)', marginTop: 12
            }}>
              ✅ {success}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleAdd}
            disabled={adding}
            style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
          >
            {adding ? 'Enrolling…' : '➕ Enroll & Extract Embedding'}
          </button>
        </div>

        {/* ── Right: Gallery List ── */}
        <div>
          {/* Search */}
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <FiSearch style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-subtle)', fontSize: 16
            }} />
            <input
              className="input"
              type="text"
              placeholder="Search by Person ID or Name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40, maxWidth: 400 }}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div className="spinner" style={{ borderTopColor: '#f59e0b' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{
              padding: 72, textAlign: 'center',
              background: 'linear-gradient(180deg, var(--surface), rgba(245,158,11,0.02))',
            }}>
              <p style={{ fontSize: 48, marginBottom: 16, opacity: 0.7 }}>📭</p>
              <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
                {search ? 'No matching persons' : 'Gallery is empty'}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto' }}>
                {search ? `No persons match "${search}"` : 'Enroll the first person using the form on the left.'}
              </p>
            </div>
          ) : (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
