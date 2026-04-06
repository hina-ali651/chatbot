import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, Lock, User, ArrowRight } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const Login = ({ setToken }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await axios.post('http://localhost:8000/api/login', { username, password });
      setToken(res.data.token);
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '3rem', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative background flare */}
      <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'var(--accent-purple)', filter: 'blur(70px)', zIndex: 0, opacity: 0.5 }}></div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.05)', 
            padding: '1.2rem', 
            borderRadius: '24px',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{ background: 'var(--accent-gradient)', padding: '0.8rem', borderRadius: '16px' }}>
              <Sparkles size={32} color="white" />
            </div>
          </div>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.5px' }} className="text-gradient">NexAuth</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Your intelligent AI companion awaits</p>
      </div>

      {error && (
        <div className="animate-slide-up" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '0.85rem', borderRadius: '14px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <div className="input-glow" style={{ position: 'relative', borderRadius: '16px', transition: 'all 0.3s' }}>
          <User size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }} />
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '1.2rem 1.2rem 1.2rem 3.2rem',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
            }}
          />
        </div>

        <div className="input-glow" style={{ position: 'relative', borderRadius: '16px', transition: 'all 0.3s' }}>
          <Lock size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }} />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '1.2rem 1.2rem 1.2rem 3.2rem',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
            }}
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          style={{
            background: 'var(--accent-gradient)',
            color: 'white',
            border: 'none',
            padding: '1.2rem',
            borderRadius: '16px',
            fontSize: '1.05rem',
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.8rem',
            marginTop: '0.5rem',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={(e) => !isLoading && (e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.6)')}
          onMouseOut={(e) => !isLoading && (e.currentTarget.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.4)')}
          onMouseDown={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(1)')}
        >
          {isLoading ? 'Authenticating...' : (
            <>Welcome In <ArrowRight size={20} /></>
          )}
        </button>
      </form>
      
      <div style={{ position: 'relative', zIndex: 1, marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Or connect with</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            theme="filled_black"
            shape="pill"
            size="large"
            onSuccess={async (credentialResponse) => {
              try {
                setIsLoading(true);
                const res = await axios.post('http://localhost:8000/api/auth/google', {
                  token: credentialResponse.credential
                });
                setToken(res.data.token);
              } catch (err) {
                setError('Google login failed');
                setIsLoading(false);
              }
            }}
            onError={() => {
              setError('Google login failed');
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;
