import { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { LogOut, Send, Trash2, Sparkles, User, AlertCircle, MessageSquare, PlusSquare } from "lucide-react";

function loadToken() {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
}

function saveToken(token) {
  try {
    if (!token) localStorage.removeItem("auth_token");
    else localStorage.setItem("auth_token", token);
  } catch {
    // ignore
  }
}

export default function App() {
  const [token, setToken] = useState(loadToken);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  const googleClientIdPresent = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  useEffect(() => {
    saveToken(token);
  }, [token]);

  // Auto-scroll history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, busy]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const api = useMemo(() => {
    const instance = axios.create({ 
      baseURL: import.meta.env.VITE_BACKEND_URL 
        ? `${import.meta.env.VITE_BACKEND_URL}/api` 
        : "/api" 
    });
    instance.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, [token]);

  async function refreshSessions() {
    if (!token) return;
    try {
      const res = await api.get("/sessions");
      setSessions(res.data?.sessions ?? []);
    } catch (e) {
      if (e?.response?.status === 401) {
        setToken("");
        setSessions([]);
        setHistory([]);
      }
    }
  }

  async function refreshHistory(sessionId) {
    if (!token || !sessionId) return;
    try {
      const res = await api.get(`/history/${sessionId}`);
      setHistory(res.data?.history ?? []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (token) {
      void refreshSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function loadSession(sessionId) {
    if (sessionId === currentSessionId) return;
    setCurrentSessionId(sessionId);
    refreshHistory(sessionId);
  }

  function startNewChat() {
    setCurrentSessionId(null);
    setHistory([]);
    setError("");
  }

  async function handleGoogleLogin(credentialResponse) {
    setError("");
    setBusy(true);
    try {
      const googleToken = credentialResponse?.credential;
      if (!googleToken) throw new Error("Google credential missing");

      const res = await api.post("/auth/google", { token: googleToken });
      const newToken = res.data?.token || "";
      if (!newToken) throw new Error("Backend did not return token");
      setToken(newToken);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail ?? "Login Failed. Ensure VITE_GOOGLE_CLIENT_ID is valid.");
      setToken("");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(e) {
    if (e) e.preventDefault();
    if (!message.trim() || !token || busy) return;
    
    const userMessage = message.trim();
    setMessage(""); // UI updates instantly
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    
    const sessionIdToUse = currentSessionId || crypto.randomUUID();
    if (!currentSessionId) setCurrentSessionId(sessionIdToUse);

    // Optimistic UI update
    setHistory(prev => [...prev, { role: "user", parts: userMessage }]);
    setError("");
    setBusy(true);

    try {
      await api.post("/chat", { message: userMessage, session_id: sessionIdToUse });
      // We rely on refreshHistory to pull the updated history including the model's reply
      await refreshHistory(sessionIdToUse);
      await refreshSessions(); // update session list dynamically
    } catch (e) {
      const errDetail = e?.response?.data?.detail;
      if (errDetail && errDetail.includes("PERMISSION_DENIED")) {
        setError("Your Gemini API Key was revoked by Google (likely due to a leak). Please generate a new key at Google AI Studio and update your backend/.env file.");
      } else {
        setError(errDetail ?? String(e));
      }
      // Remove the optimistic message on failure
      setHistory(prev => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function clearHistory() {
    if (!token) return;
    setError("");
    setBusy(true);
    try {
      await api.post("/clear");
      setHistory([]);
      setSessions([]);
      setCurrentSessionId(null);
    } catch (e) {
      setError(e?.response?.data?.detail ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setHistory([]);
    setSessions([]);
    setCurrentSessionId(null);
    setMessage("");
  }

  // --- RENDERING ---

  // 1. Separate Login Screen 
  if (!token) {
    return (
      <div className="login-wrapper">
        <div className="ambient-light"></div>
        
        {error && (
          <div className="error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="login-card">
          <div className="logo-container">
            <div className="logo-box">
              <Sparkles size={36} color="#ffffff" />
            </div>
          </div>
          <h1 className="login-title">Nexus AI</h1>
          <p className="login-subtitle">Sign in to dive into an extraordinary conversational experience driven by intelligence.</p>
          
          <div className="login-btn-wrapper">
            {!googleClientIdPresent ? (
              <div style={{ color: '#fca5a5', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px' }}>
                VITE_GOOGLE_CLIENT_ID is missing from frontend/.env
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setError("Google login failed")}
                useOneTap={false}
                theme="filled_black"
                shape="pill"
                size="large"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Stylish Modern Chat Interface
  return (
    <div className="app-container">
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-small" style={{cursor: 'pointer'}} onClick={startNewChat}>
            <Sparkles size={20} color="#a78bfa" />
            Nexus AI
          </div>
          <button className="btn-icon" title="New Chat" onClick={startNewChat}>
            <PlusSquare size={18} />
          </button>
        </div>

        <div className="history-list">
          {sessions.length === 0 ? (
            <div style={{padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center'}}>
              No chat history yet.
            </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              {sessions.map((session, idx) => (
                <div 
                  key={idx} 
                  className="history-item" 
                  onClick={() => loadSession(session.session_id)}
                  style={{
                    color: currentSessionId === session.session_id ? '#fff' : 'var(--text-secondary)',
                    backgroundColor: currentSessionId === session.session_id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    cursor: 'pointer'
                  }}>
                  <MessageSquare size={14} style={{minWidth: '14px'}} />
                  <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none'}}>{session.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">
              <User size={16} color="#a1a1aa" />
            </div>
            <span>Authorized User</span>
          </div>
          <div style={{display: 'flex', gap: '8px'}}>
            <button className="btn-icon danger" onClick={clearHistory} title="Delete All Chats">
              <Trash2 size={16} />
            </button>
            <button className="btn-icon" onClick={logout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="chat-area">
        <div className="chat-messages">
          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Sparkles size={32} />
              </div>
              <h2>How can I help you today?</h2>
              <p>Type your message below to start chatting with Nexus.</p>
            </div>
          ) : (
            history.map((msg, idx) => (
              <div key={idx} className="message-wrapper">
                <div className={`message-avatar ${msg.role}`}>
                  {msg.role === "model" ? <Sparkles size={18} color="#fff" /> : <User size={18} color="#a1a1aa" />}
                </div>
                <div className="message-content">
                  {msg.parts}
                </div>
              </div>
            ))
          )}

          {busy && (
            <div className="message-wrapper">
              <div className="message-avatar model">
                <Sparkles size={18} color="#fff" />
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="input-area">
          <form className="input-container" onSubmit={sendMessage}>
            <textarea
              ref={textareaRef}
              rows="1"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Nexus AI..."
              disabled={busy}
            />
            <button type="submit" className="send-btn" disabled={!message.trim() || busy}>
              <Send size={16} />
            </button>
          </form>
          <div style={{textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
             Nexus AI may produce inaccurate information about people, places, or facts.
          </div>
        </div>
      </main>
    </div>
  );
}
