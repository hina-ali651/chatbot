import { useMemo, useState } from "react";
import axios from "axios";

export default function App() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: "/api" });
    instance.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, [token]);

  async function loginAsAdmin() {
    setBusy(true);
    setReply("");
    try {
      const res = await api.post("/login", { username: "admin", password: "admin" });
      setToken(res.data.token);
    } catch (e) {
      setReply(e?.response?.data?.detail ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setReply("");
    try {
      const res = await api.post("/chat", { message });
      setReply(res.data.reply ?? "");
    } catch (err) {
      setReply(err?.response?.data?.detail ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="title">Chatbot</div>
          <div className="subtitle">React (Vite) + FastAPI</div>
        </div>
        <div className="right">
          <button className="btn" onClick={loginAsAdmin} disabled={busy}>
            Login (admin/admin)
          </button>
          <span className={`badge ${token ? "ok" : ""}`}>{token ? "Authed" : "No token"}</span>
        </div>
      </header>

      <main className="main">
        <form className="card" onSubmit={sendMessage}>
          <label className="label">Message</label>
          <textarea
            className="input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            disabled={busy}
          />
          <div className="actions">
            <button className="btn primary" type="submit" disabled={busy || !token}>
              Send
            </button>
            {!token ? <div className="hint">Login first to call protected endpoints.</div> : null}
          </div>
        </form>

        <section className="card">
          <div className="label">Reply</div>
          <pre className="reply">{busy ? "..." : reply || "—"}</pre>
        </section>
      </main>
    </div>
  );
}

