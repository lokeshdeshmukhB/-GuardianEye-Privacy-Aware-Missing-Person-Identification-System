import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiHome, FiSearch, FiPlusCircle, FiShield, FiLogOut, FiMenu,
  FiUsers, FiActivity, FiCpu, FiGrid, FiTarget, FiLayers
} from 'react-icons/fi';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const mainNavItems = [
    { to: '/reid-dashboard', icon: <FiActivity className="nav-item-icon" />, label: 'Dashboard' },
    { to: '/reid-search', icon: <FiTarget className="nav-item-icon" />, label: 'Person Re-ID' },
    { to: '/attributes', icon: <FiLayers className="nav-item-icon" />, label: 'Attributes' },
    { to: '/gait', icon: <FiCpu className="nav-item-icon" />, label: 'Gait Analysis' },
    { to: '/reid-gallery', icon: <FiGrid className="nav-item-icon" />, label: 'Gallery' },
  ];

  if (user?.role === 'admin') {
    mainNavItems.push({ to: '/admin', icon: <FiUsers className="nav-item-icon" />, label: 'Admin' });
  }

  const initial = user?.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-logo" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div className="sidebar-logo-icon">
            <FiShield />
          </div>
          <span className="sidebar-logo-text">GuardianEye</span>
        </div>

        <nav className="sidebar-nav">
          {/* Main section */}
          {mainNavItems.length > 0 && <div className="nav-section-label">Main</div>}
          {mainNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.icon}
              <span className="nav-item-label">{item.label}</span>
            </NavLink>
          ))}


        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-avatar">{initial}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'Officer'}</div>
            <div className="sidebar-user-role">{user?.role || 'officer'}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className={`main-content ${expanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
        {/* Topbar */}
        <header className="topbar">
          <button className="topbar-toggle" onClick={() => setExpanded((e) => !e)}>
            <FiMenu />
          </button>
          <div className="topbar-right">
            <span className="topbar-badge">🛡️ {user?.role === 'admin' ? 'Admin' : 'Officer'}</span>
            <button className="logout-btn" onClick={handleLogout}>
              <FiLogOut /> Logout
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
