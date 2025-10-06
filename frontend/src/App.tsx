import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

type ChatMessage = { role: 'user' | 'agent'; text: string };

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'agent', text: "Hi! I'm SolSwapAI. Say 'sell' to begin selling SOL/USDC/USDT for NGN." },
  ]);
  const [input, setInput] = useState('');
  const userIdRef = useRef<string>(crypto.randomUUID());

  async function sendMessage() {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    try {
      const { data } = await axios.post('/chat/message', {
        userId: userIdRef.current,
        message: text,
      });
      const reply: string = data.reply ?? '...';
      setMessages((prev) => [...prev, { role: 'agent', text: reply }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'agent', text: 'Sorry, something went wrong.' }]);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 16, fontFamily: 'Inter, system-ui, Arial' }}>
      <h2>SolSwapAI</h2>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, minHeight: 360 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0', display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              background: m.role === 'user' ? '#2563eb' : '#f3f4f6',
              color: m.role === 'user' ? '#fff' : '#111827',
              padding: '8px 12px',
              borderRadius: 8,
              maxWidth: '80%'
            }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}
        />
        <button onClick={sendMessage} style={{ padding: '10px 16px', borderRadius: 8, background: '#111827', color: '#fff' }}>Send</button>
      </div>
    </div>
  );
}


