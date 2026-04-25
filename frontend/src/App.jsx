import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ReportCase from './pages/ReportCase';
import CaseDetail from './pages/CaseDetail';
import AdminPanel from './pages/AdminPanel';

// ── Re-ID System Pages ───────────────────────────────────────────────────────
import ReIDDashboard from './pages/ReIDDashboard';
import ReIDSearch from './pages/ReIDSearch';
import AttributeRecognition from './pages/AttributeRecognition';
import MOT17TrackReID from './pages/MOT17TrackReID';

const Private = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff' }}>Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user?.role === 'admin' ? children : <Navigate to="/reid-dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<Layout />}>
            <Route path="/report" element={<Private><ReportCase /></Private>} />
            <Route path="/cases/:id" element={<Private><CaseDetail /></Private>} />
            <Route path="/admin" element={<Private><AdminRoute><AdminPanel /></AdminRoute></Private>} />

            {/* ── Re-ID System ───────────────────────────────────────────── */}
            <Route path="/reid-dashboard" element={<Private><ReIDDashboard /></Private>} />
            <Route path="/reid-search" element={<Private><ReIDSearch /></Private>} />
            <Route path="/attributes" element={<Private><AttributeRecognition /></Private>} />
            <Route path="/gait" element={<Navigate to="/reid-dashboard" replace />} />
            <Route path="/mot17-track-reid" element={<Private><MOT17TrackReID /></Private>} />
            <Route path="/dashboard" element={<Navigate to="/reid-dashboard" replace />} />
            <Route path="/search" element={<Navigate to="/reid-dashboard" replace />} />
            <Route path="/privacy" element={<Navigate to="/reid-dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

