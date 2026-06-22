import React, { useState } from 'react';
import { createClient } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { HOMESERVER_URL } from '../matrix/client';
import { LogIn, UserPlus } from 'lucide-react';

export const Auth: React.FC = () => {
  const { login } = useMatrix();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRawRegister = async () => {
    // 1. Initial request to get session
    let session = '';
    const initialRes = await fetch(`${HOMESERVER_URL}/_matrix/client/v3/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
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

    // 2. Complete registration with dummy auth
    const finalRes = await fetch(`${HOMESERVER_URL}/_matrix/client/v3/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Prevent numeric-only usernames during registration (reserved for guest users in Synapse)
    if (!isLogin && /^\d+$/.test(username)) {
      setError('Username cannot contain only numbers. Please include at least one letter (e.g. user123).');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const tempClient = createClient({ baseUrl: HOMESERVER_URL });
        const res = await tempClient.loginWithPassword(username, password);
        await login(res.access_token!, res.user_id!, res.device_id!);
      } else {
        const res = await handleRawRegister();
        await login(res.access_token, res.user_id, res.device_id);
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials or network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdf-app pdf-justify-center pdf-items-center" style={{ minHeight: '100vh' }}>
      <div className="pdf-panel pdf-animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-300)', marginBottom: 0 }}>
        <div className="pdf-panel-header pdf-text-center">
          <h2 className="pdf-text-heading-24 pdf-text-red">
            {isLogin ? 'Welcome Back' : 'Join the Matrix'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="pdf-flex-col pdf-gap-150">
          <div>
            <label className="pdf-text-label-16 pdf-text-muted pdf-mb-050" style={{ display: 'block' }}>Username</label>
            <input 
              type="text" 
              className="pdf-input pdf-input-md pdf-font-mono"
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              placeholder="e.g. alice"
            />
          </div>
          <div>
            <label className="pdf-text-label-16 pdf-text-muted pdf-mb-050" style={{ display: 'block' }}>Password</label>
            <input 
              type="password" 
              className="pdf-input pdf-input-md pdf-font-mono"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{ 
              color: 'var(--color-functional-red)', 
              fontSize: '13px', 
              textAlign: 'center', 
              padding: 'var(--space-100)', 
              background: 'var(--color-red-light)', 
              borderRadius: '4px',
              border: '1px solid var(--color-functional-red)'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            className="pdf-btn-primary pdf-btn-md pdf-w-full pdf-mt-100"
          >
            {isLogin ? <LogIn size={16} /> : <UserPlus size={16} />}
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <p className="pdf-text-copy-14 pdf-text-center pdf-text-muted pdf-mt-200">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            className="pdf-text-red pdf-cursor-pointer" 
            style={{ fontWeight: 600 }}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Register' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
};
