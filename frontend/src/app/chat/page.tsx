'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveRoutingTrace } from '@/components/LiveRoutingTrace';
import { getStoredToken, getStoredUser, fetchWithAuth, User as UserType } from '@/lib/api';
import { Send, Bot, User as UserIcon, Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string | null;
}

interface AttendanceSubject {
  id: string;
  subject: string;
  total_classes: number;
  attended_classes: number;
  percentage: number;
  is_at_risk: boolean;
  classes_needed_to_clear_risk: number;
}

interface StudentAttendanceData {
  student_id: string;
  student_name: string;
  overall_percentage: number;
  overall_risk: boolean;
  total_subjects: number;
  subjects: AttendanceSubject[];
}

export default function ChatPage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceData | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: 'Welcome to the Academic Command Center! Ask me anything regarding your attendance records or official university policy rules.',
      agent: 'student_support'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [routingReasoning, setRoutingReasoning] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);
    if (currentUser && currentUser.role === 'STUDENT') {
      loadAttendanceSnapshot();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAttendanceSnapshot = async () => {
    try {
      const res = await fetchWithAuth('/api/attendance/my');
      if (res.ok) {
        const data = await res.json();
        setAttendanceData(data);
      }
    } catch (err) {
      console.error('Failed to load student attendance snapshot:', err);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const query = customPrompt || inputQuery;
    if (!query.trim() || isStreaming) return;

    const userToken = getStoredToken();
    if (!userToken) {
      window.location.href = '/login';
      return;
    }

    const userMessageId = Date.now().toString();
    const newUserMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: query
    };

    setMessages((prev) => [...prev, newUserMsg]);
    if (!customPrompt) setInputQuery('');
    setIsStreaming(true);
    setActiveAgent(null);
    setRoutingReasoning('Supervisor evaluating intent...');

    const assistantMessageId = (Date.now() + 1).toString();
    
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        agent: null
      }
    ]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ message: query })
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to establish SSE stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataJsonStr = trimmed.substring(6);
            try {
              const eventData = JSON.parse(dataJsonStr);

              if (eventData.type === 'routing') {
                setActiveAgent(eventData.agent);
                setRoutingReasoning(`Routed to ${eventData.agent === 'attendance' ? 'Attendance Agent' : 'Student Support Agent'}`);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, agent: eventData.agent } : msg
                  )
                );
              } else if (eventData.type === 'token') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + eventData.content }
                      : msg
                  )
                );
              } else if (eventData.type === 'done') {
                setIsStreaming(false);
                if (activeAgent === 'attendance') {
                  loadAttendanceSnapshot();
                }
              }
            } catch (err) {
              console.error('SSE JSON parse error:', err);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: 'Error connecting to Academic AI backend. Please verify server connection.' }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex flex-col font-sans text-paper">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Chat Thread (~65% / 8 columns) */}
        <section className="lg:col-span-8 flex flex-col bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-border bg-surface flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-paper" />
              <div>
                <h1 className="font-serif text-base font-semibold text-paper">Academic Assistant Workspace</h1>
                <p className="text-xs text-subtle font-sans">Unified Chat with Autonomous Supervisor Routing</p>
              </div>
            </div>
            <button
              onClick={() => setMessages([])}
              className="p-1.5 text-subtle hover:text-paper hover:bg-ink rounded transition-colors text-xs flex items-center gap-1 border border-border"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Clear Thread</span>
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 max-h-[calc(100vh-320px)] min-h-[350px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                    msg.role === 'user'
                      ? 'bg-paper text-ink border-paper font-bold'
                      : 'bg-ink border-border text-paper'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <UserIcon className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                {/* Message Body */}
                <div className="space-y-1.5">
                  {msg.role === 'assistant' && msg.agent && (
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-subtle">ROUTED TO:</span>
                      <span className="px-2 py-0.5 rounded font-semibold uppercase tracking-wider bg-paper text-ink border border-paper">
                        {msg.agent === 'attendance' ? 'Attendance Agent (Python Engine)' : 'Student Support Agent (pgvector RAG)'}
                      </span>
                    </div>
                  )}

                  <div
                    className={`p-4 rounded-lg text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-paper text-ink font-medium rounded-tr-none shadow-sm'
                        : 'bg-surface border border-border text-paper rounded-tl-none font-sans whitespace-pre-wrap shadow-sm'
                    }`}
                  >
                    {msg.content || (
                      <span className="text-subtle font-mono text-xs animate-pulse">
                        Evaluating request & streaming tokens...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Part C: Pinned "My Attendance" Compact Snapshot Card for Students */}
          {attendanceData && (
            <div className="mx-4 mb-2 p-3 bg-ink border border-border-strong rounded-lg font-mono text-xs shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-xs uppercase tracking-wider font-semibold text-paper">
                    My Attendance Snapshot
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] rounded uppercase font-bold border ${
                    attendanceData.overall_risk 
                      ? 'border-border-strong text-paper bg-surface' 
                      : 'border-border text-subtle bg-surface'
                  }`}>
                    {attendanceData.overall_risk ? '[!] AT RISK (<75%)' : '[OK] GOOD STANDING'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-paper">
                    OVERALL: {attendanceData.overall_percentage}%
                  </span>
                  <button
                    onClick={() => setShowSnapshot(!showSnapshot)}
                    className="p-1 hover:bg-surface rounded text-subtle hover:text-paper"
                  >
                    {showSnapshot ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {showSnapshot && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {attendanceData.subjects.map((sub) => (
                    <div
                      key={sub.id}
                      className={`p-2 rounded border flex items-center justify-between ${
                        sub.is_at_risk
                          ? 'border-border-strong bg-surface text-paper font-semibold shadow-xs'
                          : 'border-border bg-surface/50 text-subtle'
                      }`}
                    >
                      <span className="truncate max-w-[160px]">{sub.subject}</span>
                      <div className="text-right">
                        <span>{sub.attended_classes}/{sub.total_classes} ({sub.percentage}%)</span>
                        {sub.is_at_risk && (
                          <span className="block text-[9px] text-paper font-bold">
                            Needs +{sub.classes_needed_to_clear_risk} classes
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Test Prompts */}
          <div className="px-4 py-2 border-t border-border bg-ink flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-subtle font-mono shrink-0">TEST PROMPTS:</span>
            <button
              onClick={() => handleSend("What is my attendance status in Data Structures?")}
              className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-paper whitespace-nowrap transition-colors"
            >
              Check Attendance Status
            </button>
            <button
              onClick={() => handleSend("What is the policy for attendance shortage below 75%?")}
              className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-paper whitespace-nowrap transition-colors"
            >
              Attendance Policy Rules
            </button>
            <button
              onClick={() => handleSend("How many classes do I need to attend to clear risk?")}
              className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-paper whitespace-nowrap transition-colors"
            >
              Required Classes Calculation
            </button>
          </div>

          {/* Input Box */}
          <div className="p-4 border-t border-border bg-surface">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about your attendance numbers or academic policies..."
                disabled={isStreaming}
                className="flex-1 bg-ink border border-border focus:border-paper rounded-lg px-4 py-3 text-sm text-paper placeholder-subtle focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isStreaming || !inputQuery.trim()}
                className="px-5 py-3 bg-paper text-ink font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed font-sans text-sm"
              >
                <span>Send</span>
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Right Panel: Supervisor Routing Panel (~35% / 4 columns) */}
        <aside className="lg:col-span-4">
          <LiveRoutingTrace
            activeAgent={activeAgent}
            isStreaming={isStreaming}
            routingReasoning={routingReasoning}
          />
        </aside>
      </main>
    </div>
  );
}
