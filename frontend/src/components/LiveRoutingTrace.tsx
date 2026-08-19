'use client';

import React from 'react';
import { ShieldCheck, Calculator, ArrowRight, Activity } from 'lucide-react';

interface LiveRoutingTraceProps {
  activeAgent: string | null;     // 'student_support' | 'attendance' | null
  isStreaming: boolean;
  routingReasoning?: string | null;
}

export const LiveRoutingTrace: React.FC<LiveRoutingTraceProps> = ({
  activeAgent,
  isStreaming,
  routingReasoning,
}) => {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Activity className={`h-4 w-4 ${isStreaming ? 'text-paper animate-pulse' : 'text-subtle'}`} />
          <h3 className="font-serif text-sm tracking-wide font-semibold text-paper uppercase">
            Supervisor Routing Panel
          </h3>
        </div>
        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
          isStreaming 
            ? 'bg-paper text-ink border border-paper font-bold animate-pulse' 
            : 'bg-ink text-subtle border border-border'
        }`}>
          {isStreaming ? 'STREAMING ACTIVE' : 'IDLE / READY'}
        </span>
      </div>

      {/* SVG Interactive Live Routing Trace Line Diagram */}
      <div className="relative py-2">
        <svg className="w-full h-24 overflow-visible" viewBox="0 0 400 100">
          <defs>
            <linearGradient id="monochromeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0A0A0B" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0A0A0B" stopOpacity="1" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Static Connection Lines */}
          <path
            d="M 50 50 L 180 50 M 220 50 Q 280 50, 320 25 M 220 50 Q 280 50, 320 75"
            fill="none"
            stroke="#E4E4E7"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Active Animated Routing Trace Path: Supervisor -> Student Support Node */}
          {activeAgent === 'student_support' && (
            <path
              d="M 50 50 L 180 50 M 220 50 Q 280 50, 320 25"
              fill="none"
              stroke="url(#monochromeGlow)"
              strokeWidth="3"
              filter="url(#glow)"
              className="animate-routing-trace"
            />
          )}

          {/* Active Animated Routing Trace Path: Supervisor -> Attendance Node */}
          {activeAgent === 'attendance' && (
            <path
              d="M 50 50 L 180 50 M 220 50 Q 280 50, 320 75"
              fill="none"
              stroke="url(#monochromeGlow)"
              strokeWidth="3"
              filter="url(#glow)"
              className="animate-routing-trace"
            />
          )}

          {/* Nodes */}
          {/* Node 1: User Query */}
          <circle cx="50" cy="50" r="14" fill="#FFFFFF" stroke={isStreaming ? '#0A0A0B' : '#E4E4E7'} strokeWidth="2" />
          <text x="50" y="54" textAnchor="middle" fill="#0A0A0B" fontSize="10" fontFamily="IBM Plex Mono" fontWeight="bold">Q</text>

          {/* Node 2: Supervisor Router Node */}
          <rect x="180" y="36" width="40" height="28" rx="6" fill="#F4F4F5" stroke={isStreaming ? '#0A0A0B' : '#E4E4E7'} strokeWidth="2" />
          <text x="200" y="53" textAnchor="middle" fill="#0A0A0B" fontSize="9" fontFamily="IBM Plex Mono" fontWeight="bold">SUP</text>

          {/* Node 3A: Student Support Node (Top Right) */}
          <circle 
            cx="320" 
            cy="25" 
            r="16" 
            fill={activeAgent === 'student_support' ? '#0A0A0B' : '#FFFFFF'} 
            stroke={activeAgent === 'student_support' ? '#0A0A0B' : '#E4E4E7'} 
            strokeWidth="2" 
          />
          <text x="320" y="29" textAnchor="middle" fill={activeAgent === 'student_support' ? '#FFFFFF' : '#0A0A0B'} fontSize="9" fontWeight="bold" fontFamily="IBM Plex Mono">RAG</text>

          {/* Node 3B: Attendance Node (Bottom Right) */}
          <circle 
            cx="320" 
            cy="75" 
            r="16" 
            fill={activeAgent === 'attendance' ? '#0A0A0B' : '#FFFFFF'} 
            stroke={activeAgent === 'attendance' ? '#0A0A0B' : '#E4E4E7'} 
            strokeWidth="2" 
          />
          <text x="320" y="79" textAnchor="middle" fill={activeAgent === 'attendance' ? '#FFFFFF' : '#0A0A0B'} fontSize="9" fontWeight="bold" fontFamily="IBM Plex Mono">CALC</text>
        </svg>
      </div>

      {/* Agents Status Cards */}
      <div className="grid grid-cols-1 gap-3 font-sans">
        {/* Student Support Node */}
        <div className={`p-3 rounded border transition-all ${
          activeAgent === 'student_support'
            ? 'bg-ink border-border-strong text-paper font-semibold shadow-sm'
            : 'bg-surface border-border text-subtle'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-4 w-4 ${activeAgent === 'student_support' ? 'text-paper' : 'text-subtle'}`} />
              <span className="font-serif text-xs font-semibold tracking-wide">Student Support Agent</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">pgvector RAG</span>
          </div>
          <p className="text-[11px] text-subtle leading-relaxed">
            Policy, grading & syllabus inquiries. Answers retrieved from chunked vectors.
          </p>
        </div>

        {/* Attendance Node */}
        <div className={`p-3 rounded border transition-all ${
          activeAgent === 'attendance'
            ? 'bg-ink border-border-strong text-paper font-semibold shadow-sm'
            : 'bg-surface border-border text-subtle'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Calculator className={`h-4 w-4 ${activeAgent === 'attendance' ? 'text-paper' : 'text-subtle'}`} />
              <span className="font-serif text-xs font-semibold tracking-wide">Attendance Agent</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">Python Engine</span>
          </div>
          <p className="text-[11px] text-subtle leading-relaxed">
            Deterministic percentage & risk flag calculations executed strictly in Python.
          </p>
        </div>
      </div>

      {/* Classification Details Log */}
      {routingReasoning && (
        <div className="p-2.5 rounded bg-ink border border-border font-mono text-[11px] text-paper flex items-start gap-2">
          <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-paper" />
          <span>{routingReasoning}</span>
        </div>
      )}
    </div>
  );
};
