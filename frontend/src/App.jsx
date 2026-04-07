import { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { LogOut, Send, Trash2, Bot, MessageSquare, AlertCircle } from "lucide-react";

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
  const [reply, setReply] = useState("");
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const historyRef = useRef(null);

  const googleClientIdPresent = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  useEffect(() => {
    saveToken(token);
  }, [token]);

  // Auto-scroll history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);

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
    void refreshHistory();
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
      setError(e?.response?.data?.detail ?? String(e));
      setToken("");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!message.trim() || !token) return;
    setError("");
    setReply("");
    setBusy(true);
    try {
      const res = await api.post("/chat", { message });
      setReply(res.data?.reply ?? "");
      setMessage("");
      await refreshHistory();
    } catch (e) {
      setError(e?.response?.data?.detail ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    if (!token) return;
    setError("");
    setBusy(true);
    try {
      await api.post("/clear");
      setHistory([]);
      setReply("");
    } catch (e) {
      setError(e?.response?.data?.detail ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setHistory([]);
    setReply("");
    setMessage("");
  }

  return (
    <>
      {/* Background blobs for premium effect */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <div className="page">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', background: 'rgba(139, 92, 246, 0.2)', borderRadius: '12px', color: '#a5b4fc' }}>
              <Bot size={28} />
            </div>
            <div>
              <div className="brand">Nexus AI Chat</div>
              <div className="sub">Powered by Gemini & FastAPI</div>
            </div>
          </div>

          <div className="auth">
            {token ? (
              <>
                <span className="pill ok">Authenticated</span>
                <button className="btn" onClick={logout} disabled={busy} title="Logout">
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <span className="pill">{googleClientIdPresent ? "Sign in required" : "Missing VITE_GOOGLE_CLIENT_ID"}</span>
                <div className="google" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                  <GoogleLogin
                    onSuccess={handleGoogleLogin}
                    onError={() => setError("Google login failed")}
                    useOneTap={false}
                    theme="filled_black"
                    shape="pill"
                  />
                </div>
              </>
            )}
          </div>
        </header>

        {error ? (
          <div className="error">
            <AlertCircle size={18} />
            {error}
          </div>
        ) : null}

        <main className="grid">
          <section className="card">
            <div className="cardTitle">
              <MessageSquare size={18} color="#a5b4fc" />
              New Conversation
            </div>
            <form onSubmit={sendMessage} className="composer">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={token ? "Ask me anything... (e.g. 'Explain quantum computing')" : "Please sign in to start chatting..."}
                disabled={busy || !token}
              />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <button className="btn danger" type="button" onClick={clearHistory} disabled={busy || !token || (history.length === 0 && !reply)}>
                    <Trash2 size={16} />
                    Reset
                  </button>
                </div>
                <button className="btn primary" type="submit" disabled={busy || !token || !message.trim()}>
                  <Send size={16} />
                  Send Message
                </button>
              </div>
            </form>

            <div className="replyBox">
              <div className="cardTitle small">AI Response</div>
              {busy && !reply ? (
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              ) : (
                <div className="reply">{reply || <span style={{color: 'var(--text-muted)', fontStyle: 'italic'}}>Awaiting your prompt...</span>}</div>
              )}
            </div>
          </section>

          <aside className="card">
            <div className="cardTitle">
              <Bot size={18} color="#a5b4fc" />
              Chat History
            </div>
            <div className="history" ref={historyRef}>
              {!token ? (
                <div className="muted">Sign in to view your chat history.</div>
              ) : history?.length ? (
                history.map((h, idx) => (
                  <div 
                    key={idx} 
                    className={`msg ${h.role === "model" ? "model" : "user"}`}
                    style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}
                  >
                    <div className="role">
                      {h.role === "model" ? "Nexus AI" : "You"}
                    </div>
                    <div className="text">{h.parts}</div>
                  </div>
                ))
              ) : (
                <div className="muted">Start chatting to see history here.</div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}
