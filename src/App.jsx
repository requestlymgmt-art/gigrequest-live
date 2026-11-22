import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// Pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Setlist from './pages/Setlist';
import QRCodeHub from './pages/QRCodeHub';
import StageMode from './pages/StageMode';
import ProfileSettings from './pages/ProfileSettings';
import FanLivePage from './pages/FanLivePage';
import BandAnalytics from './pages/BandAnalytics';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  const location = useLocation();

  // Certain pages like StageMode and the public fan page don't need the default musician navbar/footer
  const isStageMode = location.pathname.startsWith('/stage-mode');
  const isPublicFanPage = location.pathname.startsWith('/live/') || location.pathname.startsWith('/band/');

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            fontSize: '0.875rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          },
        }}
      />

      {!isStageMode && !isPublicFanPage && <Navbar />}

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<BandAnalytics />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/setlist" element={<Setlist />} />
          <Route path="/qr-code" element={<QRCodeHub />} />
          <Route path="/stage-mode" element={<StageMode />} />
          <Route path="/settings" element={<ProfileSettings />} />
          <Route path="/profile" element={<ProfileSettings />} />

          {/* Public Fan QR Code Scan Landing Pages */}
          <Route path="/live/:slug" element={<FanLivePage />} />
          <Route path="/band/:slug" element={<FanLivePage />} />

          {/* Authentication */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Fallback */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>

      {!isStageMode && !isPublicFanPage && <Footer />}
    </>
  );
}
