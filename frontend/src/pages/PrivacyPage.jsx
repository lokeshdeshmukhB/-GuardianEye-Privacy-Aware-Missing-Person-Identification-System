import { FiShield, FiLock, FiEye, FiDatabase, FiUserCheck, FiAlertCircle } from 'react-icons/fi';

const Section = ({ icon, title, children }) => (
  <div className="card" style={{ padding: 24, marginBottom: 16 }}>
    <h3 style={{ fontFamily: 'Inter', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ color: 'var(--accent)' }}>{icon}</span> {title}
    </h3>
    {children}
  </div>
);

const PrivacyPage = () => (
  <div className="fade-in" style={{ maxWidth: 800 }}>
    <h2 className="section-title" style={{ marginBottom: 6 }}>Privacy & Compliance</h2>
    <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 14 }}>GuardianEye is built with privacy-by-design principles. Last updated: {new Date().toLocaleDateString()}</p>

    <Section icon={<FiShield />} title="Data Protection">
      <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.8 }}>All personal data is processed solely for law enforcement identification purposes. Data is stored in encrypted MongoDB collections and is never shared with third parties. Officers must have active credentials to access any case data.</p>
    </Section>

    <Section icon={<FiEye />} title="AI Transparency">
      <ul style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 2.2, paddingLeft: 20 }}>
        <li><strong style={{ color: 'var(--text)' }}>PA-100K ResNet50</strong>: Trained on 100,000 person images. Outputs 26 attributes. Confidence score disclosed for every prediction.</li>
        <li><strong style={{ color: 'var(--text)' }}>OSNet Re-ID</strong>: Market-1501 pre-trained. 512-dim embedding extracted. Cosine similarity used — threshold configurable per deployment.</li>
        <li><strong style={{ color: 'var(--text)' }}>Gait Model</strong>: Silhouette-based motion signature. Requires video input. Used as supplementary signal only.</li>
        <li>No autonomous decision-making — AI scores are advisory. Final decisions made by authorized officers.</li>
      </ul>
    </Section>

    <Section icon={<FiLock />} title="Access Control">
      <ul style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 2, paddingLeft: 20 }}>
        <li>JWT authentication required for all API endpoints</li>
        <li>Role-based access: Officer (read/write cases), Admin (user management + audit)</li>
        <li>Every case view is logged with officer identity, timestamp, and action</li>
        <li>Passwords hashed with bcrypt (12 salt rounds)</li>
      </ul>
    </Section>

    <Section icon={<FiDatabase />} title="Data Retention">
      <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.8 }}>Cases marked "Closed" are retained for 7 years per law enforcement records requirements. Probe images from AI searches are deleted after 30 days. Officers may request data deletion for found persons through the Admin panel.</p>
    </Section>

    <Section icon={<FiUserCheck />} title="Subject Rights">
      <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.8 }}>Individuals have the right to know what data is held, request correction, and request deletion (where not contrary to active investigation requirements). Contact your department's data protection officer.</p>
    </Section>

    <Section icon={<FiAlertCircle />} title="Legal Compliance">
      <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.8 }}>This system is designed for compliance with GDPR, India's PDPB, and applicable state-level law enforcement data protection frameworks. Biometric data (Re-ID embeddings, gait signatures) is treated as sensitive personal data.</p>
    </Section>
  </div>
);

export default PrivacyPage;
