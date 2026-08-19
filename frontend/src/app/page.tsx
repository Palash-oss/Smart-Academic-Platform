'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setAuthSession, TokenResponse } from '@/lib/api';
import { 
  GraduationCap, 
  Sparkles, 
  Cpu, 
  ShieldCheck, 
  Calculator, 
  ArrowRight, 
  FileText, 
  Users, 
  CheckCircle2, 
  Layers, 
  Database,
  Terminal,
  Activity
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  const handleQuickDemoLogin = async (email: string, role: 'STUDENT' | 'FACULTY') => {
    try {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: role === 'STUDENT' ? 'student123' : 'faculty123' }),
      });

      if (loginRes.ok) {
        const data: TokenResponse = await loginRes.json();
        setAuthSession(data.access_token, {
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
        });

        if (data.role === 'FACULTY') {
          router.push('/faculty');
        } else {
          router.push('/chat');
        }
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-ink text-paper font-sans flex flex-col selection:bg-paper selection:text-ink">
      {/* Top Header Navigation */}
      <header className="h-16 border-b border-border bg-surface sticky top-0 z-50 px-6 md:px-12 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-ink border border-border-strong rounded-full flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-paper" />
          </div>
          <span className="font-serif text-lg font-bold tracking-wide text-paper">
            SMART ACADEMIC PLATFORM
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs font-mono px-4 py-2 border border-border rounded-lg text-subtle hover:text-paper hover:bg-ink transition-all"
          >
            Sign In
          </Link>
          <button
            onClick={() => handleQuickDemoLogin('student@academic.edu', 'STUDENT')}
            className="text-xs font-semibold px-4 py-2 bg-paper text-ink rounded-lg hover:opacity-90 transition-opacity shadow-xs flex items-center gap-1.5"
          >
            <span>Launch App</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 md:px-12 pt-16 pb-20 max-w-6xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-surface border border-border rounded-full text-xs font-mono text-paper shadow-xs">
          <Activity className="h-3.5 w-3.5 text-paper animate-pulse" />
          <span>Multi-Agent Autonomous Supervisor Architecture v0.1.0</span>
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-paper leading-[1.15] max-w-4xl mx-auto">
          The Intelligent Academic Command Center
        </h1>

        <p className="text-base sm:text-lg text-subtle font-sans max-w-2xl mx-auto leading-relaxed">
          Unified academic assistant combining <strong>pgvector RAG</strong> for policy inquiries and a <strong>deterministic Python math engine</strong> for 75% threshold attendance intelligence.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => handleQuickDemoLogin('student@academic.edu', 'STUDENT')}
            className="px-6 py-3.5 bg-paper text-ink font-semibold rounded-lg hover:opacity-90 transition-all text-sm flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>Demo Student Assistant</span>
          </button>

          <button
            onClick={() => handleQuickDemoLogin('faculty@academic.edu', 'FACULTY')}
            className="px-6 py-3.5 bg-surface text-paper font-semibold border border-border-strong rounded-lg hover:bg-surface-hover transition-all text-sm flex items-center gap-2 shadow-xs"
          >
            <Users className="h-4 w-4" />
            <span>Faculty Attendance Ledger</span>
          </button>
        </div>

        {/* 1-Click Quick Credentials Bar */}
        <div className="pt-6 border-t border-border max-w-xl mx-auto">
          <p className="text-[11px] font-mono text-subtle uppercase tracking-wider mb-3">1-Click Immediate Demo Access</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleQuickDemoLogin('student@academic.edu', 'STUDENT')}
              className="p-3 bg-surface hover:bg-surface-hover border border-border rounded-lg text-left transition-all"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-paper">
                <span>Demo Student</span>
                <span className="font-mono text-[10px] text-subtle">Alex Mercer</span>
              </div>
              <p className="text-[11px] font-mono text-subtle mt-0.5">student@academic.edu</p>
            </button>

            <button
              onClick={() => handleQuickDemoLogin('faculty@academic.edu', 'FACULTY')}
              className="p-3 bg-surface hover:bg-surface-hover border border-border rounded-lg text-left transition-all"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-paper">
                <span>Demo Faculty</span>
                <span className="font-mono text-[10px] text-subtle">Prof. Vance</span>
              </div>
              <p className="text-[11px] font-mono text-subtle mt-0.5">faculty@academic.edu</p>
            </button>
          </div>
        </div>
      </section>

      {/* System Architecture Section */}
      <section className="px-6 md:px-12 py-16 bg-surface border-y border-border">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-subtle">Dual-Agent Pipeline</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-paper">
              Autonomous LangGraph Routing Architecture
            </h2>
            <p className="text-xs sm:text-sm text-subtle max-w-xl mx-auto">
              Requests are classified instantly by the Supervisor Node and streamed to specialized subgraphs over SSE.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
            {/* Card 1: Supervisor */}
            <div className="p-6 bg-ink border border-border rounded-lg space-y-4 shadow-xs">
              <div className="h-10 w-10 bg-surface border border-border-strong rounded-lg flex items-center justify-center">
                <Cpu className="h-5 w-5 text-paper" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-paper">1. Supervisor Router</h3>
              <p className="text-xs text-subtle leading-relaxed">
                Classifies input queries into policy or attendance intent. Streams a live <code className="font-mono bg-surface px-1 py-0.5 rounded">routing</code> event to the frontend UI immediately.
              </p>
            </div>

            {/* Card 2: Student Support Agent */}
            <div className="p-6 bg-ink border border-border rounded-lg space-y-4 shadow-xs">
              <div className="h-10 w-10 bg-surface border border-border-strong rounded-lg flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-paper" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-paper">2. Student Support Agent</h3>
              <p className="text-xs text-subtle leading-relaxed">
                Executes 768-dimensional vector similarity search over <code className="font-mono bg-surface px-1 py-0.5 rounded">pgvector</code> policy embeddings, generating grounded answers with citations.
              </p>
            </div>

            {/* Card 3: Attendance Agent */}
            <div className="p-6 bg-ink border border-border rounded-lg space-y-4 shadow-xs">
              <div className="h-10 w-10 bg-surface border border-border-strong rounded-lg flex items-center justify-center">
                <Calculator className="h-5 w-5 text-paper" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-paper">3. Attendance Python Engine</h3>
              <p className="text-xs text-subtle leading-relaxed">
                Computes attendance percentages and 75% risk flags strictly in Python. The LLM explains pre-computed math—never performing arithmetic itself.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-mono uppercase tracking-widest text-subtle">Academic Suite</span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-paper">
            Key System Capabilities
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-surface border border-border rounded-lg flex items-start gap-4">
            <div className="p-2.5 bg-ink border border-border rounded-lg shrink-0">
              <Activity className="h-5 w-5 text-paper" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif text-base font-semibold text-paper">Live Routing Trace Visualization</h4>
              <p className="text-xs text-subtle leading-relaxed">
                Real-time SVG animation displaying light moving from the query node to the active agent subgraph during SSE token streaming.
              </p>
            </div>
          </div>

          <div className="p-6 bg-surface border border-border rounded-lg flex items-start gap-4">
            <div className="p-2.5 bg-ink border border-border rounded-lg shrink-0">
              <CheckCircle2 className="h-5 w-5 text-paper" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif text-base font-semibold text-paper">Live Session Attendance Marker</h4>
              <p className="text-xs text-subtle leading-relaxed">
                Faculty interface for marking lecture sessions with immediate live database updates reflected instantly across student views.
              </p>
            </div>
          </div>

          <div className="p-6 bg-surface border border-border rounded-lg flex items-start gap-4">
            <div className="p-2.5 bg-ink border border-border rounded-lg shrink-0">
              <Layers className="h-5 w-5 text-paper" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif text-base font-semibold text-paper">Bulk Roster CSV Import</h4>
              <p className="text-xs text-subtle leading-relaxed">
                Upload class rosters via CSV format to automatically register student accounts and initialize attendance tracking.
              </p>
            </div>
          </div>

          <div className="p-6 bg-surface border border-border rounded-lg flex items-start gap-4">
            <div className="p-2.5 bg-ink border border-border rounded-lg shrink-0">
              <Database className="h-5 w-5 text-paper" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif text-base font-semibold text-paper">Faculty Audit Ledger</h4>
              <p className="text-xs text-subtle leading-relaxed">
                Monospace compliance ledger providing filtering for at-risk students (&lt;75% attendance) and detailed per-subject breakdowns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface px-6 md:px-12 py-8 mt-auto text-center text-xs font-mono text-subtle">
        <p>Smart Academic Platform — Multi-Agent Engineering Architecture</p>
      </footer>
    </div>
  );
}
