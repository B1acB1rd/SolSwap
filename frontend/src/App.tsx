import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { QuickActions } from './components/QuickActions';

type ChatMessage = { 
  role: 'user' | 'agent'; 
  text: string; 
  timestamp: Date;
  order?: any;
};

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'agent', 
      text: "Hey there! 👋 Welcome to SolSwapAI. I'm here to help you easily sell your Solana, USDC, or USDT for Nigerian Naira, sent directly to your bank account. How can I assist you today? Are you looking to start a sale, or would you perhaps like to check our current rates first?", 
      timestamp: new Date() 
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const userIdRef = useRef<string>(crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;
    
    const userMessage: ChatMessage = { role: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await axios.post('/chat/message', {
        userId: userIdRef.current,
        message: text,
      });
      
      const agentMessage: ChatMessage = { 
        role: 'agent', 
        text: data.reply ?? '...', 
        timestamp: new Date(),
        order: data.order
      };
      setMessages((prev) => [...prev, agentMessage]);
      setSession(data.session);
      if (data.order) {
        setCurrentOrder(data.order);
      }
    } catch (e: any) {
      const errorMessage: ChatMessage = { 
        role: 'agent', 
        text: 'Sorry, something went wrong. Please try again.', 
        timestamp: new Date() 
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const extractAddress = (text: string) => {
    const addressRegex = /[A-Za-z0-9]{32,44}/g;
    return text.match(addressRegex);
  };

  const handleQuickAction = (action: string) => {
    if (isLoading) return;
    
    const actionMessages: Record<string, string> = {
      'sell': 'I want to sell tokens',
      'rates': 'What are the current rates?',
      'help': 'How does this work?',
      'phantom': 'How do I send from my Phantom wallet?'
    };
    
    const message = actionMessages[action];
    if (message) {
      setInput(message);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, isLoading]);

  return (
    <div className="chat-container" style={{ 
      maxWidth: 900, 
      margin: '0 auto', 
      padding: 12, 
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #9945FF 0%, #00FFA3 100%)',
        color: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '12px 12px 0 0',
        marginBottom: 0,
        boxShadow: '0 4px 20px rgba(153, 69, 255, 0.3)'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '24px', 
          fontWeight: '700',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #00FFA3 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>SolSwapAI</h1>
        <p style={{ 
          margin: '6px 0 0 0', 
          opacity: 0.9, 
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Sell Solana tokens for Nigerian Naira
        </p>
      </div>

      {/* Chat Container */}
      <div style={{ 
        flex: 1,
        background: '#1A1A1A',
        border: '1px solid #9945FF',
        borderRadius: '0 0 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Quick Actions */}
        <div className="quick-actions" style={{ padding: '12px 16px 0 16px' }}>
          <QuickActions 
            onAction={handleQuickAction} 
            disabled={isLoading}
          />
        </div>

        {/* Messages */}
        <div style={{ 
          flex: 1, 
          padding: '0 16px 16px 16px', 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {messages.map((m, i) => {
            const addresses = extractAddress(m.text);
            return (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: '8px'
              }}>
                {m.role === 'agent' && (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #9945FF 0%, #00FFA3 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: '2px solid #00FFA3',
                    boxShadow: '0 4px 15px rgba(153, 69, 255, 0.4)',
                    overflow: 'hidden'
                  }}>
                    <img 
                      src="/mahoraga12345.jpeg" 
                      alt="Mahoraga" 
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      AI
                    </div>
                  </div>
                )}
                
                <div className="message-bubble" style={{
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{
                    background: m.role === 'user' 
                      ? 'linear-gradient(135deg, #9945FF 0%, #00FFA3 100%)' 
                      : 'linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%)',
                    color: m.role === 'user' ? '#FFFFFF' : '#FFFFFF',
                    padding: '16px 20px',
                    borderRadius: m.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                    boxShadow: m.role === 'user' 
                      ? '0 4px 20px rgba(153, 69, 255, 0.4)' 
                      : '0 4px 20px rgba(0, 255, 163, 0.2)',
                    border: m.role === 'user' 
                      ? '1px solid #00FFA3' 
                      : '1px solid #9945FF',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    fontSize: '15px',
                    fontWeight: '500'
                  }}>
                    {m.text.split('\n').map((line, idx) => {
                      if (addresses && addresses.includes(line.trim())) {
                        return (
                          <div key={idx} style={{
                            background: 'linear-gradient(135deg, #9945FF 0%, #00FFA3 100%)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            margin: '6px 0',
                            border: '1px solid #00FFA3',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#FFFFFF',
                            fontWeight: '600',
                            boxShadow: '0 2px 10px rgba(153, 69, 255, 0.3)',
                            transition: 'all 0.2s ease'
                          }} onClick={() => copyToClipboard(line.trim())}>
                            <span>{line}</span>
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>📋</span>
                          </div>
                        );
                      }
                      
                      // Format text with better styling
                      const formatText = (text: string) => {
                        return text
                          .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #00FFA3; font-weight: 600;">$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em style="color: #9945FF; font-style: italic;">$1</em>')
                          .replace(/^\d+\.\s/gm, '<span style="color: #00FFA3; font-weight: 600; margin-right: 8px;">$&</span>')
                          .replace(/\n/g, '<br/>');
                      };
                      
                      return (
                        <div 
                          key={idx} 
                          dangerouslySetInnerHTML={{ __html: formatText(line) }}
                          style={{ lineHeight: '1.5' }}
                        />
                      );
                    })}
                  </div>
                  
                  <div style={{
                    fontSize: '12px',
                    color: '#00FFA3',
                    marginTop: '6px',
                    padding: '0 8px',
                    fontWeight: '500'
                  }}>
                    {formatTime(m.timestamp)}
                  </div>
                </div>

                {m.role === 'user' && (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #00FFA3 0%, #9945FF 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: '16px',
                    fontWeight: '700',
                    border: '2px solid #9945FF',
                    boxShadow: '0 4px 15px rgba(0, 255, 163, 0.4)'
                  }}>
                    U
                  </div>
                )}
              </div>
            );
          })}
          
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #9945FF 0%, #00FFA3 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                border: '2px solid #00FFA3',
                boxShadow: '0 4px 15px rgba(153, 69, 255, 0.4)',
                overflow: 'hidden'
              }}>
                <img 
                  src="/mahoraga12345.jpeg" 
                  alt="Mahoraga" 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  AI
                </div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%)',
                padding: '16px 20px',
                borderRadius: '20px 20px 20px 6px',
                boxShadow: '0 4px 20px rgba(0, 255, 163, 0.2)',
                border: '1px solid #9945FF'
              }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', background: '#00FFA3', borderRadius: '50%', animation: 'pulse 1.4s ease-in-out infinite' }}></div>
                  <div style={{ width: '10px', height: '10px', background: '#9945FF', borderRadius: '50%', animation: 'pulse 1.4s ease-in-out infinite 0.2s' }}></div>
                  <div style={{ width: '10px', height: '10px', background: '#00FFA3', borderRadius: '50%', animation: 'pulse 1.4s ease-in-out infinite 0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ 
          padding: '16px 20px', 
          background: 'linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%)',
          borderTop: '1px solid #9945FF',
          display: 'flex', 
          gap: '12px',
          alignItems: 'flex-end',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              style={{ 
                width: '90%',
                minHeight: '44px',
                maxHeight: '100px',
                padding: '12px 16px', 
                border: '2px solid #9945FF', 
                borderRadius: '22px',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '14px',
                outline: 'none',
                background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                color: '#FFFFFF',
                fontWeight: '500',
                boxShadow: '0 3px 12px rgba(153, 69, 255, 0.2)',
                transition: 'all 0.3s ease'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
          </div>
          <button 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading}
            style={{ 
              padding: '12px 20px', 
              borderRadius: '22px', 
              background: input.trim() && !isLoading 
                ? 'linear-gradient(135deg, #9945FF 0%, #00FFA3 100%)' 
                : '#2A2A2A',
              color: '#FFFFFF',
              border: input.trim() && !isLoading ? '2px solid #00FFA3' : '2px solid #666666',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.3s ease',
              boxShadow: input.trim() && !isLoading 
                ? '0 3px 15px rgba(153, 69, 255, 0.4)' 
                : 'none',
              transform: input.trim() && !isLoading ? 'translateY(0)' : 'none'
            }}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(153, 69, 255, 0.4); }
          50% { box-shadow: 0 4px 30px rgba(153, 69, 255, 0.6); }
        }
        
        .chat-container {
          background: #ffffff !important;
        }
        
        .chat-container textarea:focus {
          border-color: #00FFA3 !important;
          box-shadow: 0 4px 25px rgba(0, 255, 163, 0.3) !important;
        }
        
        .chat-container button:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 25px rgba(153, 69, 255, 0.6) !important;
        }
        
        @media (max-width: 768px) {
          .chat-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8px !important;
            height: 100vh !important;
          }
          
          .message-bubble {
            max-width: 85% !important;
          }
          
          .quick-actions {
            flex-wrap: wrap !important;
            gap: 8px !important;
            padding: 10px 12px 0 12px !important;
          }
          
          .quick-actions button {
            font-size: 11px !important;
            padding: 6px 10px !important;
          }
        }
      `}</style>
    </div>
  );
}


