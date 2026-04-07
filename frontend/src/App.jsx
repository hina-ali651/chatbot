import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { LogOut, Send, Trash2 } from "lucide-react";

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

  const googleClientIdPresent = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  useEffect(() => {
    saveToken(token);
  }, [token]);

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
      // ignore - history is optional
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
    <div className="page">
      <header className="topbar">
        <div>
          <div className="brand">Chatbot</div>
          <div className="sub">Google Auth + FastAPI + Gemini</div>
        </div>

        <div className="auth">
          {token ? (
            <>
              <span className="pill ok">Authenticated</span>
              <button className="btn" onClick={logout} disabled={busy} title="Logout">
                <LogOut size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <span className="pill">{googleClientIdPresent ? "Sign in to chat" : "Missing VITE_GOOGLE_CLIENT_ID"}</span>
              <div className="google">
                <GoogleLogin
                  onSuccess={handleGoogleLogin}
                  onError={() => setError("Google login failed")}
                  useOneTap={false}
                />
              </div>
            </>
          )}
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <main className="grid">
        <section className="card">
          <div className="cardTitle">Chat</div>
          <form onSubmit={sendMessage} className="composer">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={token ? "Type your message…" : "Login first to start chatting…"}
              disabled={busy || !token}
              rows={4}
            />
            <div className="row">
              <button className="btn primary" type="submit" disabled={busy || !token || !message.trim()}>
                <Send size={16} />
                Send
              </button>
              <button className="btn danger" type="button" onClick={clearHistory} disabled={busy || !token}>
                <Trash2 size={16} />
                Clear history
              </button>
            </div>
          </form>

          <div className="replyBox">
            <div className="cardTitle small">Reply</div>
            <pre className="reply">{busy ? "..." : reply || "—"}</pre>
          </div>
        </section>

        <aside className="card">
          <div className="cardTitle">History</div>
          <div className="history">
            {!token ? (
              <div className="muted">Login to view chat history.</div>
            ) : history?.length ? (
              history.slice(-20).map((h, idx) => (
                <div key={idx} className={`msg ${h.role === "model" ? "model" : "user"}`}>
                  <div className="role">{h.role}</div>
                  <div className="text">{h.parts}</div>
                </div>
              ))
            ) : (
              <div className="muted">No history yet.</div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

