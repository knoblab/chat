import React, { useState } from 'react';
import { createClient } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { HOMESERVER_URL } from '../matrix/client';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

const generate5CharId = (uid: string): string => {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 33) ^ uid.charCodeAt(i);
  }
  hash = Math.abs(hash);

  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const alphaNumerics = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const firstChar = letters[hash % 26];
  let rest = '';
  let temp = Math.floor(hash / 26);
  for (let i = 0; i < 4; i++) {
    rest += alphaNumerics[temp % 36];
    temp = Math.floor(temp / 36);
  }

  // Force v2 to effectively reset old accounts with f_ or other messy prefixes
  return firstChar + rest + '_v2';
};

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
        initial_device_display_name: 'Knoblab Chat Web'
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
        initial_device_display_name: 'Knoblab Chat Web',
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

      // 2. Determine candidate usernames to support all historical versions (v0: f_xyz, v1: a1234, v2: a1234_v2)
      const usernamesToTry = Array.from(new Set([
        generate5CharId(user.uid),                    // Current v2 format (a1234_v2)
        generate5CharId(user.uid).replace('_v2', ''), // v1 format (a1234)
        `f_${user.uid.toLowerCase()}`                 // v0 format (f_xyz)
      ]));

      // Determine secure password candidates to support both legacy accounts and clean salt formats
      const rawSalt = import.meta.env.VITE_MATRIX_SECRET_SALT || 'qpi_secure_salt_2026';
      const cleanSalt = rawSalt.replace(/^_+/, '');
      const passwordsToTry = Array.from(new Set([
        `${user.uid}_${cleanSalt}`,         // Standard format (one underscore: uid_salt)
        `${user.uid}__${cleanSalt}`,        // Legacy format from Phase 1 (two underscores: uid__salt)
        `${user.uid}_qpi_secure_salt_2026`, // Default legacy fallback
        `${user.uid}__qpi_secure_salt_2026` // Default legacy fallback with double underscore
      ]));

      const tempClient = createClient({ baseUrl: HOMESERVER_URL });
      let authResult = null;
      let successfulUsername = usernamesToTry[0];
      let successfulPassword = passwordsToTry[0];

      // 3. Try to log in with candidate username & password combinations
      for (const uname of usernamesToTry) {
        for (const pwd of passwordsToTry) {
          try {
            authResult = await tempClient.loginWithPassword(uname, pwd);
            successfulUsername = uname;
            successfulPassword = pwd;
            console.log('Successfully logged in with Matrix credentials:', uname);
            break;
          } catch (_loginErr: any) {
            // Try next candidate combination
          }
        }
        if (authResult) break;
      }

      if (!authResult) {
        // User account likely doesn't exist, auto-register with latest v2 username & clean salt
        console.log('Matrix account not found or login failed. Attempting auto-registration...');
        try {
          authResult = await handleRawRegister(successfulUsername, successfulPassword);
        } catch (regErr: any) {
          const errMsg = regErr?.message || '';
          if (errMsg.toLowerCase().includes('taken') || errMsg.toLowerCase().includes('in use') || errMsg.includes('M_USER_IN_USE')) {
            throw new Error(
              `이미 가입된 Matrix 계정(${successfulUsername})의 비밀번호가 일치하지 않습니다. 이전 로그인 시점과 환경변수(VITE_MATRIX_SECRET_SALT)가 달라졌을 수 있으므로 확인이 필요합니다.`,
              { cause: regErr }
            );
          }
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
          <h2 className="pdf-text-heading-32 pdf-text-red" style={{ fontWeight: 800, marginBottom: 'var(--space-050)' }}>Knoblab Chat</h2>
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
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.6z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.7H.94v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.96 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.94a9 9 0 0 0 0 8.06l3.02-2.33z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.2C13.46.8 11.43 0 9 0 5.48 0 2.44 2.02.94 4.97l3.02 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
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
          Secure Matrix Protocol
        </div>

      </div>
    </div>
  );
};
