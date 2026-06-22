import React, { useState } from 'react';
import { createClient } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { HOMESERVER_URL } from '../matrix/client';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export const Auth: React.FC = () => {
  const { login } = useMatrix();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRawRegister = async (username: string, pass: string) => {
    let session = '';
    const initialRes = await fetch(`${HOMESERVER_URL}/_matrix/client/v3/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password: pass,
        initial_device_display_name: 'QPI Chat Web'
      })
    });

    const initialData = await initialRes.json();
    
    if (initialRes.status === 401 && initialData.session) {
      session = initialData.session;
    } else if (!initialRes.ok) {
      throw new Error(initialData.error || 'Registration failed');
    }

    if (!session) throw new Error('Could not get registration session');

    const finalRes = await fetch(`${HOMESERVER_URL}/_matrix/client/v3/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password: pass,
        initial_device_display_name: 'QPI Chat Web',
        auth: {
          type: 'm.login.dummy',
          session: session
        }
      })
    });

    const finalData = await finalRes.json();
    
    if (!finalRes.ok) {
      throw new Error(finalData.error || 'Registration completion failed');
    }

    return finalData; // { access_token, user_id, device_id }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Authenticate with Firebase Google Provider
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      if (!user) throw new Error('Failed to get user profile from Google');

      // 2. Map Firebase UID to Matrix Username (must be lowercase)
      const matrixUsername = `f_${user.uid.toLowerCase()}`;
      
      // Determine secure password for Matrix based on Firebase UID
      const matrixPassword = `${user.uid}_qpi_secure_salt_2026`;

      const tempClient = createClient({ baseUrl: HOMESERVER_URL });
      let authResult;

      try {
        // 3. Try to log in
        authResult = await tempClient.loginWithPassword(matrixUsername, matrixPassword);
      } catch (loginErr: any) {
        // User account likely doesn't exist, auto-register
        console.log('Matrix account not found. Auto-registering...');
        try {
          authResult = await handleRawRegister(matrixUsername, matrixPassword);
        } catch (regErr: any) {
          console.error('Matrix auto-registration failed:', regErr);
          throw regErr;
        }
      }

      // Sync Google display name if available
      if (authResult.access_token) {
        tempClient.setAccessToken(authResult.access_token);
        if (user.displayName) {
          try {
            await tempClient.setDisplayName(user.displayName);
            console.log("Successfully synchronized Google displayName to Matrix profile:", user.displayName);
          } catch (nameErr) {
            console.warn("Failed to synchronize displayName to Matrix profile:", nameErr);
          }
        }
      }

      // 4. Set Matrix session
      await login(authResult.access_token!, authResult.user_id!, authResult.device_id!);
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      // Give descriptive feedback to help users debug env configurations or popup blockages
      let userFriendlyMessage = err.message || 'Authentication failed.';
      if (err.code === 'auth/popup-blocked') {
        userFriendlyMessage = 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        userFriendlyMessage = 'The sign-in window was closed before completion. Please try again.';
      } else if (err.code === 'auth/configuration-not-found' || err.message?.includes('dummy-api-key')) {
        userFriendlyMessage = 'Firebase is not configured yet. Please enter your Firebase settings in the .env file.';
      }
      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdf-app pdf-justify-center pdf-items-center" style={{ minHeight: '100vh' }}>
      <div className="pdf-panel pdf-animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-400)', textAlign: 'center', marginBottom: 0 }}>
        
        <div style={{ marginBottom: 'var(--space-300)' }}>
          <h2 className="pdf-text-heading-32 pdf-text-red" style={{ fontWeight: 800, marginBottom: 'var(--space-050)' }}>QPI Chat</h2>
          <p className="pdf-text-copy-14 pdf-text-muted">
            End-to-End Encrypted Messenger
          </p>
        </div>

        <div style={{ margin: 'var(--space-300) 0' }}>
          <button 
            onClick={handleGoogleLogin} 
            disabled={loading} 
            className="pdf-btn-primary pdf-btn-md pdf-w-full"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 'var(--space-150)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-hardware-bevel)'
            }}
          >
            {loading ? (
              <span className="pdf-text-copy-13-mono pdf-text-muted">Connecting...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block' }}>
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.6z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.7H.94v2.33A9 9 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.96 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.94a9 9 0 0 0 0 8.06l3.02-2.33z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.2C13.46.8 11.43 0 9 0 5.48 0 2.44 2.02.94 4.97l3.02 2.33C4.67 5.16 6.66 3.58 9 3.58z"/>
                </svg>
                <span style={{ fontWeight: 600 }}>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div style={{ 
            color: 'var(--color-functional-red)', 
            fontSize: '13px', 
            textAlign: 'center', 
            padding: 'var(--space-100)', 
            background: 'var(--color-red-light)', 
            borderRadius: '6px',
            border: '1px solid var(--color-functional-red)',
            marginTop: 'var(--space-200)',
            wordBreak: 'break-word'
          }}>
            {error}
          </div>
        )}

        <div className="pdf-text-copy-13-mono pdf-text-muted pdf-mt-300" style={{ fontSize: '11px' }}>
          Secure Matrix Protocol • Google Identity
        </div>

      </div>
    </div>
  );
};
