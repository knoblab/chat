import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MatrixProvider, useMatrix } from './matrix/MatrixProvider';
import { MaintenanceGuard } from './components/MaintenanceGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useUIStore } from './stores/useUIStore';

// Lazy loading pages for code splitting and faster initial load
const Auth = React.lazy(() => import('./pages/Auth').then(m => ({ default: m.Auth })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const InviteHandler = React.lazy(() => import('./pages/InviteHandler').then(m => ({ default: m.InviteHandler })));

const LoadingScreen = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)' }}>
    <div className="pdf-text-copy-13-mono" style={{ color: 'var(--color-functional-red)', fontWeight: 'bold' }}>Loading Matrix Client...</div>
  </div>
);

const AppRoutes = () => {
  const { client, isReady } = useMatrix();

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route 
          path="/login" 
          element={!client ? <Auth /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/invite/:roomId" 
          element={<InviteHandler />} 
        />
        <Route 
          path="/" 
          element={client ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </Suspense>
  );
};

function App() {
  const theme = useUIStore((state) => state.theme);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <MatrixProvider>
        <MaintenanceGuard>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </MaintenanceGuard>
      </MatrixProvider>
    </ErrorBoundary>
  );
}

export default App;
