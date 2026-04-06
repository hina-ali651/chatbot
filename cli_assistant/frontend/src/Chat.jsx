import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, LogOut, Loader2, Sparkles, User, Trash2 } from 'lucide-react';

const Chat = ({ token, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const axiosInstance = axios.create({
    baseURL: 'http://localhost:8000/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchHistory = async () => {
    try {
      const res = await axiosInstance.get('/history');
      setMessages(res.data.history || []);
    } catch (err) {
      if (err.response?.status === 401) onLogout();
      console.error('Failed to fetch history', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', parts: userMsg }]);
    setIsLoading(true);

    try {
      const res = await axiosInstance.post('/chat', { message: userMsg });
      setMessages(prev => [...prev, { role: 'model', parts: res.data.reply }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'system', parts: 'Error: Connection lost or API unavailable.' }]);
      if (err.response?.status === 401) onLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await axiosInstance.post('/clear');
      setMessages([]);
    } catch (err) {
      console.error('Clear error', err);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '1000px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      
      {/* Decorative glowing orb top left */}
      <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '250px', height: '250px', background: 'var(--accent-blue)', filter: 'blur(100px)', zIndex: 0, opacity: 0.3, borderRadius: '50%', pointerEvents:'none' }}></div>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ background: 'var(--accent-gradient)', padding: '0.6rem', borderRadius: '14px', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}>
              <Sparkles size={24} color="white" />
            </div>
            <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', background: '#10b981', border: '2px solid var(--bg-dark)', borderRadius: '50%' }}></span>
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.3px' }} className="text-gradient">Nexus AI</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Ready to construct ideas
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={handleClear}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500 }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; e.currentTarget.style.color = '#fca5a5'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          >
            <Trash2 size={18} /> Clear
          </button>
          <button 
            onClick={onLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500 }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <LogOut size={18} /> Exit
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', animation: 'fadeIn 1s' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
              <Sparkles size={56} opacity={0.3} color="var(--accent-purple)" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>How can I help you today?</h3>
            <p>I am connected and ready for your requests.</p>
          </div>
        )}
        
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          return (
            <div key={idx} className="message-bubble" style={{ 
              display: 'flex', 
              flexDirection: isUser ? 'row-reverse' : 'row', 
              gap: '1rem',
              alignItems: 'flex-end',
            }}>
              <div style={{ 
                width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: isUser ? 'rgba(99, 102, 241, 0.2)' : isSystem ? 'rgba(239, 68, 68, 0.2)' : 'linear-gradient(135deg, rgba(31,41,55,1), rgba(17,24,39,1))',
                color: isUser ? 'var(--accent-indigo)' : isSystem ? '#ef4444' : 'var(--accent-purple)',
                border: !isUser && !isSystem ? '1px solid var(--glass-border)' : 'none',
                boxShadow: !isUser && !isSystem ? '0 4px 10px rgba(0,0,0,0.2)' : 'none'
              }}>
                {isUser ? <User size={20} /> : <Sparkles size={20} />}
              </div>
              <div style={{ 
                padding: '1.2rem 1.5rem', 
                borderRadius: '24px',
                borderBottomRightRadius: isUser ? '6px' : '24px',
                borderBottomLeftRadius: (!isUser && !isSystem) ? '6px' : '24px',
                background: isUser ? 'var(--user-msg-bg)' : isSystem ? 'rgba(239, 68, 68, 0.1)' : 'var(--bot-msg-bg)',
                maxWidth: '75%',
                boxShadow: isUser ? '0 4px 20px rgba(99,102,241,0.3)' : '0 4px 15px rgba(0,0,0,0.15)',
                border: isSystem ? '1px solid rgba(239, 68, 68, 0.3)' : isUser ? 'none' : '1px solid var(--glass-border)',
                lineHeight: '1.6',
                fontSize: '1rem',
                color: isUser ? '#fff' : 'var(--text-primary)',
                backdropFilter: isUser ? 'none' : 'blur(10px)'
              }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', letterSpacing: '0.2px' }}>
                  {msg.parts}
                </div>
              </div>
            </div>
          );
        })}
        
        {isLoading && (
          <div className="message-bubble" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', opacity: 0.9 }}>
             <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(31,41,55,1), rgba(17,24,39,1))', border: '1px solid var(--glass-border)', color: 'var(--accent-purple)' }}>
                <Sparkles size={20} />
             </div>
             <div style={{ padding: '1rem 1.5rem', borderRadius: '24px', borderBottomLeftRadius: '6px', background: 'var(--bot-msg-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(10px)' }}>
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} style={{ height: '10px' }} />
      </div>

      {/* Input Area */}
      <div style={{ position: 'relative', zIndex: 1, padding: '1.5rem 2rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '1rem', position: 'relative' }} className="input-glow">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message to Nexus..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '1.2rem 5rem 1.2rem 1.8rem',
              borderRadius: '24px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)',
              fontSize: '1.05rem',
              outline: 'none',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            style={{
              position: 'absolute',
              right: '0.8rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: input.trim() && !isLoading ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.1)',
              color: input.trim() && !isLoading ? 'white' : 'var(--text-secondary)',
              border: 'none',
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: input.trim() && !isLoading ? '0 4px 15px rgba(99,102,241,0.5)' : 'none'
            }}
            onMouseDown={(e) => input.trim() && !isLoading && (e.currentTarget.style.transform = 'translateY(-50%) scale(0.9)')}
            onMouseUp={(e) => input.trim() && !isLoading && (e.currentTarget.style.transform = 'translateY(-50%) scale(1)')}
          >
            {isLoading ? <Loader2 size={22} className="animate-spin" /> : <Send size={20} style={{ transform: 'translateX(2px)' }}/>}
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.8rem', opacity: 0.7 }}>
          Nexus AI can make mistakes. Verify important information.
        </p>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default Chat;
