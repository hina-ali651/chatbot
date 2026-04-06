import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Login from './Login';
import Chat from './Chat';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const handleLogout = () => {
    setToken(null);
  };

  return (
    <GoogleOAuthProvider clientId="521503626467-k2rsg2fft237dm63par5g1sqf57bqj0t.apps.googleusercontent.com">
      {!token ? (
        <Login setToken={setToken} />
      ) : (
        <Chat token={token} onLogout={handleLogout} />
      )}
    </GoogleOAuthProvider>
  );
}

export default App;
