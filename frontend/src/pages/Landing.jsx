import { Link } from 'react-router-dom';
import { FiShield, FiSearch, FiUsers, FiCpu, FiArrowRight, FiLayers, FiTarget, FiActivity } from 'react-icons/fi';
import './Landing.css';

const Landing = () => (
  <div className="landing noise-bg">
    {/* Ambient glow orbs */}
    <div className="landing-glow landing-glow--1" />
    <div className="landing-glow landing-glow--2" />
    <div className="landing-glow landing-glow--3" />

    {/* Top nav */}
    <nav className="landing-nav">
      <div className="landing-nav__logo">
        <div className="landing-nav__icon"><FiShield /></div>
        <span>GuardianEye</span>
      </div>
      <div className="landing-nav__actions">
        <Link to="/login" className="landing-nav__link">Sign In</Link>
        <Link to="/register" className="landing-nav__cta"><FiArrowRight /> Get Started</Link>
      </div>
    </nav>

    {/* Hero */}
    <section className="hero">
      <div className="hero-badge-container">
        <div className="hero-badge">
          <span className="hero-badge__dot" />
          <FiShield /> Privacy-Aware AI Identification
        </div>
      </div>
      <h1>
        Identify Missing Persons<br />
        <span className="gradient-text-animated">with Multi-Model AI</span>
      </h1>
      <p className="hero-desc">
        Three cutting-edge deep learning models — Person Re-ID, Pedestrian Attribute Recognition,
        and Gait Analysis — unified in one powerful surveillance intelligence platform.
      </p>
      <div className="hero-cta">
        <Link to="/login" className="cta-btn primary">
          Launch Platform <FiArrowRight />
        </Link>
        <Link to="/register" className="cta-btn secondary">
          Create Account
        </Link>
      </div>

      {/* Tech stack badges */}
      <div className="hero-tech">
        {['PyTorch', 'OSNet', 'ResNet-50', 'GaitSet', 'FastAPI', 'React', 'MongoDB'].map(t => (
          <span key={t} className="hero-tech__badge">{t}</span>
        ))}
      </div>
    </section>

    {/* Model Cards */}
    <section className="models-section">
      <h2 className="models-section__title">
        <span className="gradient-text">Three Models, One Platform</span>
      </h2>
      <p className="models-section__subtitle">
        Each model specializes in a unique dimension of person identification
      </p>
      <div className="model-cards">
        {[
          {
            icon: <FiTarget />,
            title: 'Person Re-ID',
            model: 'OSNet x1.0',
            dataset: 'Market-1501',
            desc: '512-dimensional feature embeddings with cosine similarity matching against a gallery of known persons.',
            color: '#06b6d4',
            features: ['512-dim embeddings', 'Top-K ranking', 'Gallery management', 'Real-time search']
          },
          {
            icon: <FiLayers />,
            title: 'Attribute Recognition',
            model: 'ResNet-50',
            dataset: 'PA-100K',
            desc: '26 binary attribute predictions — demographics, clothing, accessories — from a single pedestrian image.',
            color: '#10b981',
            features: ['26 attributes', 'Multi-label classification', 'Confidence scoring', 'Structured output']
          },
          {
            icon: <FiActivity />,
            title: 'Gait Recognition',
            model: 'SimpleGaitSet',
            dataset: 'CASIA-B',
            desc: 'Identify individuals from walking silhouette sequences — even when face or clothing is obscured.',
            color: '#8b5cf6',
            features: ['30-frame sequences', 'Silhouette analysis', 'Cross-view matching', 'Identity enrollment']
          }
        ].map(m => (
          <div key={m.title} className="model-card" style={{ '--mc': m.color }}>
            <div className="model-card__icon" style={{ color: m.color }}>
              {m.icon}
            </div>
            <div className="model-card__badges">
              <span className="model-card__badge" style={{ color: m.color, borderColor: `${m.color}44`, background: `${m.color}11` }}>
                {m.model}
              </span>
              <span className="model-card__badge" style={{ color: m.color, borderColor: `${m.color}44`, background: `${m.color}11` }}>
                {m.dataset}
              </span>
            </div>
            <h3>{m.title}</h3>
            <p>{m.desc}</p>
            <ul className="model-card__features">
              {m.features.map(f => (
                <li key={f} style={{ color: m.color }}>
                  <span className="model-card__check" style={{ background: `${m.color}22`, color: m.color }}>✓</span>
                  <span style={{ color: 'var(--text-muted)' }}>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>

    {/* Features */}
    <section className="features">
      {[
        { icon: <FiCpu />, title: 'Deep Learning Pipeline', desc: 'Three PyTorch models loaded at startup via FastAPI — zero-latency inference with GPU acceleration.' },
        { icon: <FiSearch />, title: 'Intelligent Search', desc: 'Upload any surveillance image to instantly match against the gallery using state-of-the-art embeddings.' },
        { icon: <FiUsers />, title: 'Gallery Management', desc: 'Enroll persons with photos, manage embeddings, and maintain a growing identification database.' },
        { icon: <FiShield />, title: 'Privacy Compliant', desc: 'Role-based access control, full audit logs, and GDPR-aligned data handling built into every layer.' }
      ].map(f => (
        <div className="feature-card" key={f.title}>
          <div className="feature-icon">{f.icon}</div>
          <h3>{f.title}</h3>
          <p>{f.desc}</p>
        </div>
      ))}
    </section>

    {/* Stats */}
    <section className="landing-stats">
      {[
        { value: '512', label: 'Embedding Dimensions' },
        { value: '26', label: 'Recognized Attributes' },
        { value: '30', label: 'Gait Frames Analyzed' },
        { value: '3', label: 'ML Models Deployed' },
      ].map(s => (
        <div key={s.label} className="landing-stat">
          <div className="landing-stat__value gradient-text">{s.value}</div>
          <div className="landing-stat__label">{s.label}</div>
        </div>
      ))}
    </section>

    {/* Footer */}
    <footer className="landing-footer">
      <div className="landing-footer__logo">
        <FiShield /> GuardianEye
      </div>
      <p>Privacy-Aware Missing Person Identification System</p>
      <p className="landing-footer__tech">Built with MERN Stack + PyTorch + FastAPI</p>
      <p className="landing-footer__copy">© {new Date().getFullYear()} GuardianEye. All rights reserved.</p>
    </footer>
  </div>
);

export default Landing;
