'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveRoutingTrace } from '@/components/LiveRoutingTrace';
import { getStoredToken, getStoredUser, fetchWithAuth, User as UserType, getApiUrl } from '@/lib/api';
import { Send, Bot, User as UserIcon, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [routingReasoning, setRoutingReasoning] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);

    const isFaculty = currentUser?.role === 'FACULTY';
    const welcomeText = isFaculty
      ? `Welcome, ${currentUser.full_name}. Ask me anything regarding your department attendance analytics, division risk summaries, or official university policy rules.`
      : `Welcome, ${currentUser?.full_name || 'Student'}. Ask me anything regarding your course attendance records or official university policy rules.`;

    setMessages([{ id: 'welcome-msg', role: 'assistant', content: welcomeText, agent: 'student_support' }]);

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
    if (!userToken) { window.location.href = '/login'; return; }

    const userMessageId = Date.now().toString();
    setMessages((prev) => [...prev, { id: userMessageId, role: 'user', content: query }]);
    if (!customPrompt) setInputQuery('');
    setIsStreaming(true);
    setActiveAgent(null);
    setRoutingReasoning('Supervisor evaluating intent...');

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '', agent: null }]);

    try {
      const response = await fetch(getApiUrl('/api/chat/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ message: query }),
      });

      if (!response.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: 'Error connecting to the intelligence backend.' }
              : msg
          )
        );
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) return;

      let buffer = '';
      let detectedAgent: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.replace('data: ', '').trim());
            if (parsed.type === 'routing') {
              detectedAgent = parsed.agent;
              setActiveAgent(parsed.agent);
              setRoutingReasoning(parsed.reasoning || null);
            } else if (parsed.type === 'token') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + parsed.token, agent: detectedAgent }
                    : msg
                )
              );
            } else if (parsed.type === 'error') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: parsed.error, agent: detectedAgent }
                    : msg
                )
              );
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: 'Failed to communicate with intelligence service.' }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const isFaculty = user?.role === 'FACULTY';

  const prompts = isFaculty
    ? ['Which students are at risk in my department?', 'Show division breakdown for my department', 'What is the policy for attendance shortage below 75%?']
    : ['What is my attendance status in Data Structures?', 'What is the attendance policy for shortage below 75%?', 'How many classes do I need to attend to clear risk?'];

  return (
    <div style={{ minHeight: '100vh', background: '#ECECEE', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1360px', width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}
        className="lg-grid-2col px-4 sm:px-6 py-4 sm:py-7">

        {/* Chat Panel */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '600px' }}>

          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '15px', fontWeight: 800, color: '#09090B', marginBottom: '2px' }}>
                {isFaculty ? 'Faculty Intelligence Workspace' : 'Academic Assistant'}
              </h1>
              <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A' }}>
                {isFaculty ? '// DEPARTMENT ANALYTICS & POLICY RAG' : '// ATTENDANCE TRACKING & POLICY RAG'}
              </p>
            </div>
            <button
              onClick={() => setMessages([])}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '12px', fontWeight: 600, color: '#71717A', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.color = '#09090B'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#71717A'; }}
            >
              <RefreshCw style={{ width: '12px', height: '12px' }} />
              <span>Clear</span>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: 'calc(100vh - 420px)', minHeight: '300px' }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="max-w-[94%] sm:max-w-[85%]"
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  marginLeft: msg.role === 'user' ? 'auto' : '0',
                  marginRight: msg.role === 'user' ? '0' : 'auto',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: msg.role === 'user' ? '#18181B' : '#F4F4F6',
                  border: msg.role === 'user' ? 'none' : '1px solid #E4E4E7',
                }}>
                  {msg.role === 'user'
                    ? <UserIcon style={{ width: '15px', height: '15px', color: '#FFFFFF' }} />
                    : <Bot style={{ width: '15px', height: '15px', color: '#09090B' }} />}
                </div>

                {/* Bubble */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {msg.role === 'assistant' && msg.agent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9.5px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ROUTED TO:</span>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 700, color: '#FF5500', background: '#FFF4ED', border: '1px solid #FED7AA', borderRadius: '3px', padding: '1px 7px' }}>
                        {msg.agent === 'attendance'
                          ? (isFaculty ? 'Department Attendance Engine' : 'Student Attendance Engine')
                          : (isFaculty ? 'Faculty Policy Agent' : 'Student Support Agent')}
                      </span>
                    </div>
                  )}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    background: msg.role === 'user' ? '#18181B' : '#FAFAFB',
                    border: msg.role === 'user' ? 'none' : '1px solid #E4E4E7',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    lineHeight: 1.65,
                    color: msg.role === 'user' ? '#FFFFFF' : '#09090B',
                    whiteSpace: 'pre-wrap',
                    boxShadow: msg.role === 'user' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                  }}>
                    {msg.content || (
                      <span style={{ color: '#71717A', fontStyle: 'italic', fontSize: '13px' }}>Evaluating reasoning trace...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Student Attendance Snapshot */}
          {user && user.role === 'STUDENT' && attendanceData && (
            <div style={{ margin: '0 16px 12px', background: '#FAFAFB', border: '1px solid #E4E4E7', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: showSnapshot ? '1px solid #E4E4E7' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 800, color: '#09090B' }}>My Attendance Ledger</span>
                  {attendanceData.overall_risk ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '2px 8px' }}>
                      <AlertTriangle style={{ width: '10px', height: '10px' }} />
                      At Risk
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 600, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '4px', padding: '2px 8px' }}>
                      <CheckCircle2 style={{ width: '10px', height: '10px' }} />
                      Good Standing
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '15px', fontWeight: 800, color: attendanceData.overall_risk ? '#DC2626' : '#16A34A' }}>
                    {attendanceData.overall_percentage}%
                  </span>
                  <button
                    onClick={() => setShowSnapshot(!showSnapshot)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', display: 'flex' }}
                  >
                    {showSnapshot ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
                  </button>
                </div>
              </div>
              {showSnapshot && (
                <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {attendanceData.subjects.map((sub) => {
                    const pct = sub.percentage;
                    const color = pct >= 75 ? '#16A34A' : '#DC2626';
                    return (
                      <div key={sub.id} style={{ background: '#FFFFFF', border: `1px solid ${sub.is_at_risk ? '#FECACA' : '#E4E4E7'}`, borderRadius: '6px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: '#09090B', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.subject}</span>
                          <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 800, color }}>{pct}%</span>
                        </div>
                        <div style={{ height: '3px', background: '#E4E4E7', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: '99px' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#71717A' }}>{sub.attended_classes}/{sub.total_classes}</span>
                          {sub.is_at_risk && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 700, color: '#DC2626' }}>+{sub.classes_needed_to_clear_risk}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quick Prompts */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #E4E4E7', display: 'flex', gap: '8px', overflowX: 'auto', background: '#FAFAFB' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, alignSelf: 'center' }}>TRY:</span>
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                style={{ padding: '5px 12px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#09090B', whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5500'; e.currentTarget.style.color = '#FF5500'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.color = '#09090B'; }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid #E4E4E7', background: '#FFFFFF' }}>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={isFaculty ? 'Ask about department analytics or policy...' : 'Ask about attendance or academic policies...'}
                disabled={isStreaming}
                style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '10px 16px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#09090B', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#FF5500'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; }}
              />
              <button
                type="submit"
                disabled={isStreaming || !inputQuery.trim()}
                className="px-3 sm:px-5 py-2.5"
                style={{
                  background: isStreaming || !inputQuery.trim() ? '#E4E4E7' : '#FF5500',
                  color: isStreaming || !inputQuery.trim() ? '#A1A1AA' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: isStreaming || !inputQuery.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  boxShadow: isStreaming || !inputQuery.trim() ? 'none' : '0 2px 8px rgba(255,85,0,0.3)',
                }}
                onMouseEnter={e => { if (!isStreaming && inputQuery.trim()) { e.currentTarget.style.background = '#E64D00'; } }}
                onMouseLeave={e => { if (!isStreaming && inputQuery.trim()) { e.currentTarget.style.background = '#FF5500'; } }}
              >
                <span className="hidden sm:inline">Send</span>
                <Send style={{ width: '13px', height: '13px' }} />
              </button>
            </form>
          </div>
        </div>

        {/* Routing Panel */}
        <div className="routing-panel">
          <LiveRoutingTrace
            activeAgent={activeAgent}
            isStreaming={isStreaming}
            routingReasoning={routingReasoning}
            role={user?.role}
          />
        </div>

      </main>

      <style jsx global>{`
        @media (min-width: 1024px) {
          .lg-grid-2col {
            grid-template-columns: 1fr 380px !important;
          }
        }
        @media (max-width: 1023px) {
          .routing-panel { display: none; }
        }
      `}</style>
    </div>
  );
}
