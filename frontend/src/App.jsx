import { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { LogOut, Send, Trash2, Sparkles, User, AlertCircle, MessageSquare } from "lucide-react";

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
    const instance = axios.create({ baseURL: "/api" });
    instance.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, [token]);

  async function refreshHistory() {
    if (!token) return;
    try {
      const res = await api.get("/history");
      setHistory(res.data?.history ?? []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (token) void refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    
    // Optimistic UI update
    setHistory(prev => [...prev, { role: "user", parts: userMessage }]);
    setError("");
    setBusy(true);

    try {
      const res = await api.post("/chat", { message: userMessage });
      // We rely on refreshHistory to pull the updated history including the model's reply
      await refreshHistory();
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
    } catch (e) {
      setError(e?.response?.data?.detail ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setHistory([]);
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
          <div className="brand-small">
            <Sparkles size={20} color="#a78bfa" />
            Nexus AI
          </div>
          <button className="btn-icon" title="New Chat" onClick={clearHistory}>
            <MessageSquare size={18} />
          </button>
        </div>

        <div className="history-list">
           {/* We just show a summary in the sidebar for aesthetics */}
          <div className="history-item" style={{background: 'var(--bg-tertiary)', color: '#fff', borderColor: 'var(--border-light)'}}>
            <MessageSquare size={14} /> Current Session
          </div>
          {history.length === 0 && (
            <div style={{padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center'}}>
              No history yet. Start a conversation!
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
            <button className="btn-icon danger" onClick={clearHistory} title="Clear Chat">
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
