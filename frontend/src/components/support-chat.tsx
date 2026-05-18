'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, ArrowLeft, Check, Home, MessageSquare, MoreHorizontal, Download, Maximize2, Minimize2 } from 'lucide-react';
import { useMagic } from '@/context/MagicContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Simple markdown renderer for bot messages -- handles bold, bullets, numbered lists, paragraphs
function renderMarkdown(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  const elements: React.ReactNode[] = [];

  paragraphs.forEach((para, pi) => {
    const lines = para.split('\n');
    const bulletLines: string[] = [];
    const numberedLines: string[] = [];
    let isBulletList = false;
    let isNumberedList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[-*]\s+/.test(trimmed)) {
        isBulletList = true;
        bulletLines.push(trimmed.replace(/^[-*]\s+/, ''));
      } else if (/^\d+\.\s+/.test(trimmed)) {
        isNumberedList = true;
        numberedLines.push(trimmed.replace(/^\d+\.\s+/, ''));
      }
    }

    if (isBulletList && bulletLines.length > 0) {
      elements.push(
        <ul key={`p${pi}`} className="list-disc list-inside space-y-1 my-1">
          {bulletLines.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    } else if (isNumberedList && numberedLines.length > 0) {
      elements.push(
        <ol key={`p${pi}`} className="list-decimal list-inside space-y-1 my-1">
          {numberedLines.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    } else {
      // Regular paragraph -- render inline formatting with line breaks
      elements.push(
        <p key={`p${pi}`} className={pi > 0 ? 'mt-2' : ''}>
          {lines.map((line, li) => (
            <React.Fragment key={li}>
              {li > 0 && <br />}
              {renderInline(line)}
            </React.Fragment>
          ))}
        </p>
      );
    }
  });

  return elements;
}

// Inline formatting: **bold** and *italic*
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** or *italic* segments
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(<strong key={`b${match.index}`} className="font-semibold text-gray-900 dark:text-white">{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={`i${match.index}`}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'home' | 'messages'>('home');
  const [view, setView] = useState<'tabs' | 'chat' | 'contact'>('tabs');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastBotMsg, setLastBotMsg] = useState('');
  const [chatStartTime, setChatStartTime] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useMagic();

  // Listen for external open requests (from profile dropdown)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-support-chat', handleOpen);
    return () => window.removeEventListener('open-support-chat', handleOpen);
  }, []);

  const displayName = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'there';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (view === 'chat' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [view]);

  // Close three-dots menu on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const downloadTranscript = () => {
    const lines = messages.map((m) => {
      const sender = m.role === 'user' ? 'You' : 'Predensity Bot';
      return `${sender}: ${m.content}`;
    });
    const text = `Predensity Support Chat Transcript\n${new Date().toLocaleString()}\n${'='.repeat(40)}\n\n${lines.join('\n\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predensity-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const toggleExpand = () => {
    setExpanded((v) => !v);
    setMenuOpen(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const reply = data.reply || 'Sorry, I could not process that. Please try again.';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
      setLastBotMsg(reply);
    } catch {
      const fallback = 'Something went wrong. Please try again or contact support.';
      setMessages([...newMessages, { role: 'assistant', content: fallback }]);
      setLastBotMsg(fallback);
    } finally {
      setLoading(false);
    }
  };

  const startChat = () => {
    if (messages.length === 0) {
      const greeting = "Hi there, I'm your Predensity Support Agent. I'm well trained and ready to assist you today but you can ask for the team at any time.";
      const followUp = 'How can I help?';
      setMessages([
        { role: 'assistant', content: greeting },
        { role: 'assistant', content: followUp },
      ]);
      setLastBotMsg(followUp);
      setChatStartTime(new Date());
    }
    setView('chat');
  };

  const getTimeSince = () => {
    if (!chatStartTime) return '';
    const mins = Math.floor((Date.now() - chatStartTime.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    return `${mins}m`;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`fixed rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 transition-all duration-300 ${
      expanded
        ? 'bottom-0 right-0 w-full h-full sm:bottom-4 sm:right-4 sm:w-[520px] sm:h-[700px] sm:rounded-2xl rounded-none'
        : 'bottom-6 right-6 w-[380px] h-[560px]'
    }`}>

      {/* Chat view */}
      {view === 'chat' && (
        <>
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('tabs'); setTab('messages'); }}
                className="text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-vibrant-purple flex items-center justify-center">
                  <span className="text-white text-xs font-bold">P</span>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-neutral-950" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Predensity Bot</p>
                <p className="text-[10px] text-green-400">Active</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Three-dots menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
                  aria-label="More options"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 py-1 animate-in fade-in-0 zoom-in-95 duration-100">
                    <button
                      onClick={toggleExpand}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-left"
                    >
                      {expanded ? <Minimize2 className="w-4 h-4 text-vibrant-purple" /> : <Maximize2 className="w-4 h-4 text-vibrant-purple" />}
                      {expanded ? 'Collapse window' : 'Expand window'}
                    </button>
                    <button
                      onClick={downloadTranscript}
                      disabled={messages.length === 0}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4 text-vibrant-purple" />
                      Download transcript
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-vibrant-purple flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">P</span>
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-vibrant-purple text-white rounded-2xl rounded-br-md'
                      : 'bg-gray-100 dark:bg-neutral-800/60 text-gray-900 dark:text-neutral-100 rounded-2xl rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    renderMarkdown(msg.content)
                  ) : (
                    msg.content.split('\n').map((line, li) => (
                      <span key={li}>
                        {li > 0 && <br />}
                        {line}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-vibrant-purple flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">P</span>
                </div>
                <div className="bg-gray-100 dark:bg-neutral-800/60 px-3.5 py-2.5 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Contact support link */}
          <div className="px-4 py-1">
            <button
              onClick={() => setView('contact')}
              className="text-xs text-gray-400 dark:text-neutral-500 hover:text-vibrant-purple transition-colors"
            >
              Not getting the help you need? Contact support
            </button>
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-9 h-9 flex items-center justify-center bg-vibrant-purple hover:bg-vibrant-purple/90 text-white rounded-lg disabled:opacity-50 transition-colors"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </>
      )}

      {/* Contact view */}
      {view === 'contact' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView(messages.length > 0 ? 'chat' : 'tabs')}
                className="text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Contact Support</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <ContactSupportView />
        </>
      )}

      {/* Tab views (Home / Messages) */}
      {view === 'tabs' && (
        <>
          {tab === 'home' && (
            <>
              {/* Hero gradient header */}
              <div className="relative px-5 pt-5 pb-8 dark:bg-neutral-950">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                  className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center text-gray-400 dark:text-white/80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/20 rounded-full transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="relative mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/20 backdrop-blur flex items-center justify-center">
                    <span className="text-gray-900 dark:text-white text-sm font-bold">P</span>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-neutral-950" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  Hi {displayName}
                </h2>
                <p className="text-base text-gray-500 dark:text-white/80">How can we help?</p>
              </div>

              {/* Content cards */}
              <div className="flex-1 px-4 -mt-3 space-y-3 overflow-y-auto pb-2">
                {/* Recent message card */}
                {messages.length > 0 && (
                  <button
                    onClick={() => { setView('chat'); }}
                    className="w-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-3.5 text-left hover:bg-gray-100 dark:hover:bg-neutral-800/80 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-400 dark:text-neutral-400 mb-2">Recent message</p>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-vibrant-purple flex items-center justify-center">
                          <span className="text-white text-xs font-bold">P</span>
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-50 dark:border-neutral-900" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">Predensity Bot</p>
                          <span className="text-[10px] text-gray-400 dark:text-neutral-500">{getTimeSince()}</span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-neutral-400 truncate">
                          {lastBotMsg || 'Start a conversation...'}
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {/* Ask a question card */}
                <button
                  onClick={startChat}
                  className="w-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 text-left hover:bg-gray-100 dark:hover:bg-neutral-800/80 transition-colors"
                >
                  <p className="text-sm text-gray-900 dark:text-white">Have an issue or a question?</p>
                </button>

                {/* Contact support card */}
                <button
                  onClick={() => setView('contact')}
                  className="w-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 text-left hover:bg-gray-100 dark:hover:bg-neutral-800/80 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-vibrant-purple/20 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-vibrant-purple" />
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white">Contact the team directly</p>
                </button>
              </div>
            </>
          )}

          {tab === 'messages' && (
            <>
              {/* Messages tab header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Messages</p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 text-center h-full pt-20">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                      <MessageSquare className="w-5 h-5 text-gray-400 dark:text-neutral-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No messages</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-400 mb-4">Messages from the team will be shown here</p>
                    <button
                      onClick={startChat}
                      className="px-5 py-2 bg-vibrant-purple hover:bg-vibrant-purple/90 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Ask a question
                    </button>
                  </div>
                ) : (
                  <div className="p-3">
                    <button
                      onClick={() => setView('chat')}
                      className="w-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-3.5 text-left hover:bg-gray-100 dark:hover:bg-neutral-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full bg-vibrant-purple flex items-center justify-center">
                            <span className="text-white text-xs font-bold">P</span>
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-50 dark:border-neutral-900" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Predensity Bot</p>
                            <span className="text-[10px] text-gray-400 dark:text-neutral-500">{getTimeSince()}</span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-neutral-400 truncate">{lastBotMsg}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bottom tab bar */}
          <div className="flex border-t border-gray-200 dark:border-neutral-800">
            <button
              onClick={() => setTab('home')}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                tab === 'home' ? 'text-vibrant-purple' : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-medium">Home</span>
            </button>
            <button
              onClick={() => setTab('messages')}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                tab === 'messages' ? 'text-vibrant-purple' : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[10px] font-medium">Messages</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ContactSupportView() {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!reason || !details.trim()) return;
    setSending(true);
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details }),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-green-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Message sent</h3>
        <p className="text-xs text-gray-400 dark:text-neutral-400">
          Our team has received your message and will get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 py-4">
      <p className="text-xs text-gray-400 dark:text-neutral-400 mb-4">
        Describe your issue and our team will follow up via email.
      </p>

      <label htmlFor="reason" className="text-xs font-medium text-gray-400 dark:text-neutral-400 mb-1">
        Reason
      </label>
      <select
        id="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white mb-3 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
      >
        <option value="">Select a reason...</option>
        <option value="Deposit issue">Deposit issue</option>
        <option value="Withdrawal issue">Withdrawal issue</option>
        <option value="Bet dispute">Bet dispute</option>
        <option value="Account problem">Account problem</option>
        <option value="Bug report">Bug report</option>
        <option value="Feature request">Feature request</option>
        <option value="Other">Other</option>
      </select>

      <label htmlFor="details" className="text-xs font-medium text-gray-400 dark:text-neutral-400 mb-1">
        Details
      </label>
      <textarea
        id="details"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Describe your issue..."
        rows={4}
        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white resize-none mb-4 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-vibrant-purple"
      />

      <button
        onClick={handleSend}
        disabled={!reason || !details.trim() || sending}
        className="w-full py-2.5 bg-vibrant-purple hover:bg-vibrant-purple/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {sending ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
