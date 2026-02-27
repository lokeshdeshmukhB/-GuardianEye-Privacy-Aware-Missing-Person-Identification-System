import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import ReportCase from './pages/ReportCase';
import CaseDetail from './pages/CaseDetail';
import AdminPanel from './pages/AdminPanel';
import PrivacyPage from './pages/PrivacyPage';

const Private = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff' }}>Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user?.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
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
            <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
            <Route path="/search" element={<Private><SearchPage /></Private>} />
            <Route path="/report" element={<Private><ReportCase /></Private>} />
            <Route path="/cases/:id" element={<Private><CaseDetail /></Private>} />
            <Route path="/admin" element={<Private><AdminRoute><AdminPanel /></AdminRoute></Private>} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
