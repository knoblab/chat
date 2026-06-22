import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MatrixProvider, useMatrix } from './matrix/MatrixProvider';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { InviteHandler } from './pages/InviteHandler';
import { MaintenanceGuard } from './components/MaintenanceGuard';

const AppRoutes = () => {
  const { client, isReady } = useMatrix();

  if (!isReady) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Loading Matrix Client...</div>
      </div>
    );
  }

  return (
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
  );
};

function App() {
  return (
    <MatrixProvider>
      <MaintenanceGuard>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MaintenanceGuard>
    </MatrixProvider>
  );
}

export default App;
