import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { syncServerTime, getSyncedDate, checkMaintenanceActive, getSecondsUntilMaintenanceEnd } from '../utils/timeSync';

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

export const MaintenanceGuard: React.FC<MaintenanceGuardProps> = ({ children }) => {
  const [isMaintenance, setIsMaintenance] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let checkInterval: any;
    
    const init = async () => {
      await syncServerTime();
      setLoading(false);
      
      const updateStatus = () => {
        const currentDate = getSyncedDate();
        const active = checkMaintenanceActive(currentDate);
        setIsMaintenance(active);
        if (active) {
          setTimeLeft(getSecondsUntilMaintenanceEnd(currentDate));
        }
      };

      updateStatus();
      // Tick every second to update status and the countdown timer
      checkInterval = setInterval(updateStatus, 1000);
    };

    init();

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="pdf-app pdf-justify-center pdf-items-center" style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
        <div className="pdf-text-label-14-mono pdf-text-muted">서버 시간 동기화 중...</div>
      </div>
    );
  }

  if (isMaintenance) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
      <div className="pdf-app pdf-justify-center pdf-items-center" style={{ minHeight: '100vh', background: 'var(--color-bg-secondary)', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative dynamic glows for premium aesthetics */}
        <div style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(173, 29, 29, 0.12) 0%, transparent 70%)',
          top: '15%',
          left: '10%',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          animation: 'pdf-pulse 10s infinite alternate'
        }} />
        <div style={{
          position: 'absolute',
          width: '350px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(173, 29, 29, 0.08) 0%, transparent 70%)',
          bottom: '15%',
          right: '10%',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          animation: 'pdf-pulse 8s infinite alternate-reverse'
        }} />

        <style>{`
          @keyframes pdf-pulse {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(1.15); opacity: 0.9; }
          }
          @keyframes pdf-rotate-slow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

        <div className="pdf-panel pdf-animate-fade-in" style={{
          width: '90%',
          maxWidth: '440px',
          padding: 'var(--space-400)',
          textAlign: 'center',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-hardware-bevel), var(--shadow-functional-glow)',
          background: 'var(--color-bg-primary)',
          zIndex: 1
        }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: 'var(--space-200)', 
            borderRadius: '50%', 
            background: 'var(--color-red-light)', 
            marginBottom: 'var(--space-300)' 
          }}>
            <Clock 
              size={40} 
              className="pdf-text-red" 
              style={{ animation: 'pdf-rotate-slow 25s linear infinite' }} 
            />
          </div>

          <h2 className="pdf-text-heading-24 pdf-text-red" style={{ fontWeight: 800, marginBottom: 'var(--space-150)' }}>
            시스템 정기 점검 안내
          </h2>

          <p className="pdf-text-copy-14 pdf-text-muted" style={{ marginBottom: 'var(--space-300)', lineHeight: '1.6' }}>
            더욱 안정적인 서비스를 제공하기 위해 정기 점검 중입니다.<br />
            점검 완료 후 정상적인 서비스 이용이 가능합니다.
          </p>

          <div style={{
            background: 'var(--color-bg-secondary)',
            borderRadius: '12px',
            padding: 'var(--space-200)',
            marginBottom: 'var(--space-300)',
            border: '1px solid var(--color-border-default)',
            textAlign: 'left'
          }}>
            <div className="pdf-flex-row pdf-justify-between" style={{ marginBottom: 'var(--space-100)' }}>
              <span className="pdf-text-label-14-mono pdf-text-muted">점검 기준 시간</span>
              <span className="pdf-text-label-14-mono" style={{ fontWeight: 600 }}>한국 표준시 (KST)</span>
            </div>
            <div className="pdf-flex-row pdf-justify-between">
              <span className="pdf-text-label-14-mono pdf-text-muted">매일 점검 시간</span>
              <span className="pdf-text-label-14-mono pdf-text-red" style={{ fontWeight: 700 }}>23:55 ~ 24:10 (00:10)</span>
            </div>
          </div>

          <div style={{
            padding: 'var(--space-300)',
            background: 'var(--color-red-light)',
            borderRadius: '12px',
            border: '1px solid var(--color-functional-red)',
            marginBottom: 'var(--space-200)'
          }}>
            <div className="pdf-text-label-14-mono pdf-text-red" style={{ marginBottom: 'var(--space-100)', letterSpacing: '0.05em' }}>
              점검 완료까지 남은 시간
            </div>
            <div className="pdf-text-heading-32 pdf-text-red" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
          </div>

          <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-300)' }}>
            서버 시간과 동기화되어 있으며 점검 종료 시 자동 해제됩니다.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
