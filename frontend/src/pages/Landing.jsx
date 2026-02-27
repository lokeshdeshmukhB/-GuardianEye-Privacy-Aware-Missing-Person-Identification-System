import { Link } from 'react-router-dom';
import { FiShield, FiSearch, FiUsers, FiCpu, FiArrowRight } from 'react-icons/fi';
import '../pages/Landing.css';

const Landing = () => (
  <div className="landing">
    {/* Hero */}
    <section className="hero">
      <div className="hero-badge"><FiShield /> Privacy-First AI</div>
      <h1>Find Missing Persons<br /><span className="gradient-text">with AI Precision</span></h1>
      <p>Multi-model identification using PA-100K attribute recognition,<br />OSNet Re-ID, and gait analysis — instantly.</p>
      <div className="hero-cta">
        <Link to="/login" className="cta-btn primary">Get Started <FiArrowRight /></Link>
        <Link to="/privacy" className="cta-btn secondary">Privacy Policy</Link>
      </div>
    </section>

    {/* Features */}
    <section className="features">
      {[
        { icon: <FiCpu />, title: 'PA-100K Attributes', desc: '26-attribute recognition (clothing, accessories, age, gender) via ResNet50 trained on 100,000 images.' },
        { icon: <FiSearch />, title: 'OSNet Re-ID', desc: 'State-of-the-art person re-identification with 512-dim embeddings and cosine similarity matching.' },
        { icon: <FiUsers />, title: 'Gait Analysis', desc: 'Silhouette-based gait signature extraction — identify people by how they walk.' },
        { icon: <FiShield />, title: 'Privacy Compliant', desc: 'Role-based access, full audit logs, and GDPR-aligned data handling built-in.' }
      ].map(f => (
        <div className="feature-card" key={f.title}>
          <div className="feature-icon">{f.icon}</div>
          <h3>{f.title}</h3>
          <p>{f.desc}</p>
        </div>
      ))}
    </section>

    {/* Footer */}
    <footer className="landing-footer">
      <p>GuardianEye © {new Date().getFullYear()} · Built with MERN + PyTorch</p>
    </footer>
  </div>
);

export default Landing;
