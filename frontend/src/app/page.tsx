'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setAuthSession, TokenResponse } from '@/lib/api';
import { 
  GraduationCap, 
  Sparkles, 
  Cpu, 
  ArrowRight, 
  Users, 
  Activity,
  MessageSquare,
  Zap,
  Award,
  BookOpen
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
    <div className="min-h-screen bg-[#FDFDFD] text-zinc-900 font-sans flex flex-col selection:bg-zinc-900 selection:text-white">
      {/* Top Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-zinc-200/80 shadow-xs">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-12 h-20">
          {/* Official Brand Logo */}
          <Link href="/" className="font-serif text-xl font-bold tracking-tight text-zinc-900 cursor-pointer flex items-center gap-3">
            <div className="h-9 w-9 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center shadow-xs">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span>Smart Academic</span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-zinc-600">
            <a href="#architecture" className="hover:text-zinc-900 transition-colors duration-300">Ecosystem</a>
            <a href="#evolution" className="hover:text-zinc-900 transition-colors duration-300">AI Tutoring</a>
            <a href="#pillars" className="hover:text-zinc-900 transition-colors duration-300">Research & RAG</a>
            <a href="#demo-access" className="hover:text-zinc-900 transition-colors duration-300">Demo Roster</a>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <Link 
              href="/login"
              className="text-sm text-zinc-700 font-medium hover:text-zinc-900 hover:bg-zinc-100 px-4 py-2 rounded-lg transition-all border border-transparent"
            >
              Sign In
            </Link>
            <button 
              onClick={() => handleQuickDemoLogin('student@academic.edu', 'STUDENT')}
              className="text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 px-5 py-2.5 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[700px] flex items-center justify-center overflow-hidden bg-white bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:32px_32px] border-b border-zinc-200/80">
          <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 text-center flex flex-col items-center py-16">
            <div className="text-xs font-mono tracking-widest uppercase mb-6 bg-zinc-100 text-zinc-800 px-4 py-2 rounded-full border border-zinc-300/70 flex items-center gap-2 shadow-xs">
              <Activity className="h-3.5 w-3.5 text-zinc-900" />
              <span>The Future of Knowledge</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-bold text-zinc-950 max-w-5xl mb-6 leading-[1.15] tracking-tight">
              Architecting a Better Future <br />
              Through Collective Intelligence.
            </h1>

            <p className="text-base sm:text-lg text-zinc-600 max-w-3xl mb-10 leading-relaxed font-normal">
              More than a resource hub—a collaborative engine combining <strong>pgvector RAG</strong> for policy inquiries and a <strong>deterministic Python math engine</strong> for 75% threshold attendance intelligence.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <button 
                onClick={() => handleQuickDemoLogin('student@academic.edu', 'STUDENT')}
                className="w-full sm:w-auto text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 px-8 py-4 rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>Launch Student Workspace</span>
              </button>

              <button 
                onClick={() => handleQuickDemoLogin('faculty@academic.edu', 'FACULTY')}
                className="w-full sm:w-auto text-sm font-semibold bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50 px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <Users className="h-4 w-4 text-zinc-600" />
                <span>Faculty Ledger Register</span>
              </button>
            </div>

            {/* 1-Click Quick Credentials Bar */}
            <div id="demo-access" className="mt-14 pt-8 border-t border-zinc-200/80 w-full max-w-2xl mx-auto">
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Instant Demo Access Accounts</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => handleQuickDemoLogin('student@academic.edu', 'STUDENT')}
                  className="p-4 bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-xl text-left transition-all shadow-xs group"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-zinc-500 group-hover:text-zinc-900 transition-colors" />
                      Demo Student (COMP-A)
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">Alex Mercer</span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">student@academic.edu</p>
                </button>

                <button
                  onClick={() => handleQuickDemoLogin('faculty@academic.edu', 'FACULTY')}
                  className="p-4 bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-xl text-left transition-all shadow-xs group"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-zinc-500 group-hover:text-zinc-900 transition-colors" />
                      Demo Faculty (COMP)
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">Prof. Vance</span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">faculty@academic.edu</p>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* System Evolution Section */}
        <section id="evolution" className="py-24 bg-[#F8F9FA] border-b border-zinc-200/80 relative z-20">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-16">
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2 block">AUTONOMOUS PIPELINE</span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-zinc-950 mb-4">System Evolution</h2>
              <p className="text-sm text-zinc-600 max-w-2xl mx-auto leading-relaxed">
                Discover how active engagement continuously refines and elevates the platform's collective intelligence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="bg-white p-8 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col items-center text-center transition-transform hover:-translate-y-1 duration-300">
                <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-900">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-zinc-900 mb-3">1. Data Input & Discourse</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Engage in high-level academic queries, submit syllabus topics, and pose complex inquiries to our multi-agent supervisor network.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white p-8 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col items-center text-center transition-transform hover:-translate-y-1 duration-300">
                <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-900">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-zinc-900 mb-3">2. Algorithmic Synthesis</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Our autonomous models process interactions in real time, routing between vector RAG similarity search and Python attendance calculation.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white p-8 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col items-center text-center transition-transform hover:-translate-y-1 duration-300">
                <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-900">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-zinc-900 mb-3">3. Continuous Upgrade</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Live lecture session updates reflect instantly across student attendance snapshots and department risk audit ledgers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Key Pillars Section */}
        <section id="pillars" className="py-24 bg-white relative z-20 border-b border-zinc-200/80">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-16">
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2 block">SYSTEM FOUNDATION</span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-zinc-950 mb-4">The Architecture of Excellence</h2>
              <p className="text-sm text-zinc-600 max-w-2xl mx-auto leading-relaxed">
                Foundational pillars supporting rigorous inquiry and academic advancement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Pillar 1 */}
              <div className="bg-[#FDFDFD] p-8 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col items-start transition-transform hover:-translate-y-1 duration-300">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-900">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-zinc-900 mb-3">Advanced AI Tutoring</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Autonomous multi-agent models route policy and syllabus queries to specialized pgvector RAG subgraphs seamlessly.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="bg-[#FDFDFD] p-8 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col items-start transition-transform hover:-translate-y-1 duration-300">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-900">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-zinc-900 mb-3">Department Research Network</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Scoped department isolation ensures COMP, AIDS, ECS, and MECH students receive department-tailored information.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="bg-[#FDFDFD] p-8 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col items-start transition-transform hover:-translate-y-1 duration-300">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 text-zinc-900">
                  <Award className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-zinc-900 mb-3">Institutional Prestige</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Deterministic Python calculations enforce strict 75% attendance compliance without LLM arithmetic errors.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-[#F8F9FA] border-t border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <div className="font-serif text-lg font-bold text-zinc-900 mb-1 flex items-center gap-2.5">
              <div className="h-7 w-7 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center shadow-xs">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span>Smart Academic</span>
            </div>
            <div className="text-xs font-mono text-zinc-500">
              © 2024 Smart Academic Platform. Architecting a Better Future.
            </div>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-xs font-mono text-zinc-600">
            <a href="#" className="hover:text-zinc-900 transition-colors">Institutional Privacy</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Academic Terms</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Global Charter</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Research Archive</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
