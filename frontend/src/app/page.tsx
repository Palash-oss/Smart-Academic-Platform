'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setAuthSession, TokenResponse, getApiUrl } from '@/lib/api';
import {
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Database,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

const WORDS_TO_TYPE = [
  'Academic Performance',
  'Attendance Records',
  'Faculty Allotments',
  'Policy Compliance',
  'Institutional Data',
];

export default function LandingPage() {
  const router = useRouter();

  // Typewriter backspacing effect (pure React state, no external animation library)
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(WORDS_TO_TYPE[0].length);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayText, setDisplayText] = useState(WORDS_TO_TYPE[0]);
  const [loggingInRole, setLoggingInRole] = useState<string | null>(null);

  useEffect(() => {
    const currentWord = WORDS_TO_TYPE[wordIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      if (charIndex < currentWord.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.substring(0, charIndex + 1));
          setCharIndex((prev) => prev + 1);
        }, 70);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2200);
      }
    } else {
      if (charIndex > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.substring(0, charIndex - 1));
          setCharIndex((prev) => prev - 1);
        }, 35);
      } else {
        // Paused on empty string before starting next word (prevents sudden jumps)
        timeout = setTimeout(() => {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % WORDS_TO_TYPE.length);
        }, 250);
      }
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, wordIndex]);

  // Fast Instant Demo Authentication
  const handleQuickLogin = async (email: string, role: string) => {
    const pwd = role === 'STUDENT' ? 'student123' : role === 'FACULTY' ? 'faculty123' : 'admin123';
    setLoggingInRole(email);
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pwd }),
      });
      if (res.ok) {
        const data: TokenResponse = await res.json();
        setAuthSession(data.access_token, {
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
        });
        if (data.role === 'FACULTY') router.push('/faculty');
        else if (data.role === 'ADMIN') router.push('/admin/allotment');
        else router.push('/chat');
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setLoggingInRole(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ECECEE', color: '#09090B', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ─── Top Architectural Navigation ─── */}
      <nav
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E4E4E7',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: '1360px',
            margin: '0 auto',
            padding: '0 1.5rem',
            height: '62px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                background: '#09090B',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <GraduationCap style={{ width: '17px', height: '17px', color: '#FFFFFF' }} />
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '6px', height: '6px', background: '#FF5500', borderRadius: '50%' }} />
            </div>
            <div>
              <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '15px', color: '#09090B', letterSpacing: '-0.02em' }}>
                Smart Academic
              </span>
              <span style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, fontSize: '9px', color: '#71717A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                LABS // ERP 2.0
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="hidden md:flex items-center gap-7">
            <a href="#features" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, color: '#52525B', textDecoration: 'none' }} className="hover:text-black transition-colors">
              Platform Features
            </a>
            <a href="#architecture" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, color: '#52525B', textDecoration: 'none' }} className="hover:text-black transition-colors">
              Architecture
            </a>
            <a href="#metrics" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, color: '#52525B', textDecoration: 'none' }} className="hover:text-black transition-colors">
              Live Metrics
            </a>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              href="/login"
              style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                color: '#09090B',
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #E4E4E7',
                background: '#FFFFFF',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
            >
              Sign In
            </Link>
            <Link
              href="/login"
              style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                color: '#FFFFFF',
                padding: '7px 16px',
                borderRadius: '6px',
                background: '#FF5500',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(255, 85, 0, 0.3)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#E64D00'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FF5500'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <span>Launch Demo</span>
              <ArrowRight style={{ width: '13px', height: '13px' }} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section with Typewriter Effect (Always Visible) ─── */}
      <section
        className="tech-grid-bg py-12 sm:py-20 px-4 sm:px-6"
        style={{
          borderBottom: '1px solid #E4E4E7',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '1040px', margin: '0 auto', textAlign: 'center' }}>
          
          {/* Tagline Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 14px',
              borderRadius: '4px',
              background: '#FFFFFF',
              border: '1px solid #E4E4E7',
              marginBottom: '28px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <span style={{ width: '7px', height: '7px', background: '#FF5500', display: 'inline-block' }} />
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px',
                fontWeight: 700,
                color: '#09090B',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Academic Intelligence Platform
            </span>
          </div>

          {/* Hero Heading with Live Typewriter (Fully Visible, High Impact) */}
          <h1
            style={{
              fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
              fontSize: 'clamp(34px, 5.5vw, 64px)',
              fontWeight: 800,
              color: '#09090B',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '20px',
              minHeight: '1.3em',
            }}
          >
            The Smarter Way to Manage
            <br />
            <span style={{ color: '#FF5500', minHeight: '1.15em', display: 'inline-block' }}>
              {displayText}
              <span
                style={{
                  color: '#FF5500',
                  display: 'inline-block',
                  fontWeight: 300,
                  marginLeft: '3px',
                }}
                className="animate-pulse"
              >
                |
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(15px, 2vw, 17px)',
              color: '#52525B',
              lineHeight: 1.6,
              maxWidth: '720px',
              margin: '0 auto 36px',
            }}
          >
            Combines <strong style={{ color: '#09090B', fontWeight: 600 }}>pgvector RAG</strong> for policy queries with a{' '}
            <strong style={{ color: '#09090B', fontWeight: 600 }}>deterministic attendance engine</strong> — giving students, faculty, and administrators real-time intelligence.
          </p>

          {/* CTA Buttons */}
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '56px' }}
          >
            <button
              onClick={() => handleQuickLogin('student@academic.edu', 'STUDENT')}
              style={{
                padding: '12px 26px',
                borderRadius: '6px',
                background: '#FF5500',
                color: '#FFFFFF',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(255, 85, 0, 0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#E64D00'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FF5500'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <span>Student Workspace</span>
              <ArrowRight style={{ width: '15px', height: '15px' }} />
            </button>

            <button
              onClick={() => handleQuickLogin('faculty@academic.edu', 'FACULTY')}
              style={{
                padding: '12px 26px',
                borderRadius: '6px',
                background: '#FFFFFF',
                color: '#09090B',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                border: '1px solid #D4D4D8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.borderColor = '#A1A1AA'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#D4D4D8'; }}
            >
              <Users style={{ width: '15px', height: '15px', color: '#52525B' }} />
              <span>Faculty Dashboard</span>
            </button>
          </div>

          {/* Instant Demo Access (SS3 Architectural Cards) */}
          <div style={{ maxWidth: '880px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#71717A',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '14px',
              }}
            >
              // INSTANT DEMO ACCESS (CLICK TO LAUNCH)
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
              
              {/* Student Good Standing */}
              <div
                onClick={() => handleQuickLogin('student@academic.edu', 'STUDENT')}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '6px',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5500'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#09090B' }}>
                    Student — Good Standing
                  </span>
                  {loggingInRole === 'student@academic.edu' ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#FF5500] animate-spin" />
                  ) : (
                    <ArrowRight style={{ width: '13px', height: '13px', color: '#A1A1AA' }} />
                  )}
                </div>
                <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', marginBottom: '10px' }}>
                  student@academic.edu
                </p>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    color: '#16A34A',
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    display: 'inline-block',
                  }}
                >
                  86.1% Attendance
                </span>
              </div>

              {/* Student At Risk */}
              <div
                onClick={() => handleQuickLogin('atrisk.student@academic.edu', 'STUDENT')}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '6px',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5500'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#09090B' }}>
                    Student — At Risk
                  </span>
                  {loggingInRole === 'atrisk.student@academic.edu' ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#FF5500] animate-spin" />
                  ) : (
                    <AlertTriangle style={{ width: '13px', height: '13px', color: '#DC2626' }} />
                  )}
                </div>
                <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', marginBottom: '10px' }}>
                  atrisk.student@academic.edu
                </p>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    color: '#DC2626',
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    display: 'inline-block',
                  }}
                >
                  71.2% — Below 75%
                </span>
              </div>

              {/* Faculty COMP */}
              <div
                onClick={() => handleQuickLogin('faculty@academic.edu', 'FACULTY')}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '6px',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5500'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#09090B' }}>
                    Faculty — COMP Dept.
                  </span>
                  {loggingInRole === 'faculty@academic.edu' ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#FF5500] animate-spin" />
                  ) : (
                    <ArrowRight style={{ width: '13px', height: '13px', color: '#A1A1AA' }} />
                  )}
                </div>
                <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', marginBottom: '10px' }}>
                  faculty@academic.edu
                </p>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    color: '#FF5500',
                    background: '#FFF4ED',
                    border: '1px solid #FED7AA',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    display: 'inline-block',
                  }}
                >
                  140 Students
                </span>
              </div>

              {/* Admin Allotment */}
              <div
                onClick={() => handleQuickLogin('admin@academic.edu', 'ADMIN')}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '6px',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF5500'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#09090B' }}>
                    Admin — Allotment
                  </span>
                  {loggingInRole === 'admin@academic.edu' ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#FF5500] animate-spin" />
                  ) : (
                    <ArrowRight style={{ width: '13px', height: '13px', color: '#A1A1AA' }} />
                  )}
                </div>
                <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', marginBottom: '10px' }}>
                  admin@academic.edu
                </p>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    color: '#09090B',
                    background: '#F4F4F6',
                    border: '1px solid #E4E4E7',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    display: 'inline-block',
                  }}
                >
                  Batch Optimizer
                </span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─── Institutional Accreditation Strip (SS3 Style, Clean Spacing) ─── */}
      <section
        className="py-5 px-4 sm:px-6"
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E4E4E7',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
          }}
        >
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ACCREDITATIONS & ARCHITECTURE:
          </span>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
            {[
              { label: 'Autonomous Scheme', sub: 'FRCRCE-3-26' },
              { label: 'NAAC Grade A++', sub: 'Institutional Score' },
              { label: 'Deterministic Engine', sub: 'Zero AI Hallucination' },
              { label: 'pgvector RAG', sub: 'University Ordinance' },
              { label: 'Dual-Role Supervisor', sub: 'Student / Faculty Guard' },
            ].map((p) => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '5px', height: '5px', background: '#FF5500', flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '12.5px', fontWeight: 700, color: '#09090B', lineHeight: 1.2 }}>{p.label}</p>
                  <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#71717A' }}>{p.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Live Metrics Strip (Independent Clean Section) ─── */}
      <section id="metrics" className="py-10 sm:py-16 px-4 sm:px-6" style={{ background: '#ECECEE', borderBottom: '1px solid #E4E4E7', position: 'relative' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {[
              { num: '70+', label: 'Students Tracked', detail: 'Real-time ledger updates', tag: 'METRIC.01' },
              { num: '8', label: 'Courses Managed', detail: 'Theory sections & lab batches', tag: 'METRIC.02' },
              { num: '75%', label: 'Attendance Threshold', detail: 'Deterministic ordinance formula', tag: 'METRIC.03' },
              { num: '2', label: 'Dedicated AI Agents', detail: 'Student support & Faculty risk analytics', tag: 'METRIC.04' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '6px',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#FF5500', fontWeight: 700, display: 'block', marginBottom: '8px', letterSpacing: '0.06em' }}>
                  // {stat.tag}
                </span>
                <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '38px', fontWeight: 800, color: '#09090B', lineHeight: 1, marginBottom: '8px', letterSpacing: '-0.02em' }}>
                  {stat.num}
                </p>
                <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 700, color: '#09090B', marginBottom: '4px' }}>
                  {stat.label}
                </p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#71717A' }}>
                  {stat.detail}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── Platform Architecture Panels (SS3 Layout) ─── */}
      <section id="features" className="py-12 sm:py-20 px-4 sm:px-6" style={{ background: '#FFFFFF', borderBottom: '1px solid #E4E4E7' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          
          <div style={{ marginBottom: '48px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#FF5500', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                // CORE CAPABILITIES
              </span>
              <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '32px', fontWeight: 800, color: '#09090B', marginTop: '6px', letterSpacing: '-0.02em' }}>
                Built for Institutional Precision
              </h2>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A', maxWidth: '420px' }}>
              Engineered with zero tolerance for calculation mistakes. Official academic statutes paired with conversational AI intelligence.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            {/* Card 1 */}
            <div style={{ background: '#F8F8FA', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '28px' }}>
              <div style={{ width: '36px', height: '36px', background: '#09090B', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <ShieldCheck style={{ width: '18px', height: '18px', color: '#FFFFFF' }} />
              </div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                01 // DETERMINISTIC ENGINE
              </span>
              <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800, color: '#09090B', margin: '6px 0 10px' }}>
                Strict 75% Attendance Formula
              </h3>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13.5px', color: '#52525B', lineHeight: 1.6 }}>
                Calculates remaining classes needed to clear risk using deterministic SQL algorithms. LLMs are strictly forbidden from guessing calculations.
              </p>
            </div>

            {/* Card 2 */}
            <div style={{ background: '#F8F8FA', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '28px' }}>
              <div style={{ width: '36px', height: '36px', background: '#09090B', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Bot style={{ width: '18px', height: '18px', color: '#FFFFFF' }} />
              </div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                02 // AGENT SUPERVISOR
              </span>
              <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800, color: '#09090B', margin: '6px 0 10px' }}>
                Dual-Role Routing Router
              </h3>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13.5px', color: '#52525B', lineHeight: 1.6 }}>
                Enforces strict access control: students only query personal standing; faculty receive division-wide analytics and at-risk cohorts.
              </p>
            </div>

            {/* Card 3 */}
            <div style={{ background: '#F8F8FA', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '28px' }}>
              <div style={{ width: '36px', height: '36px', background: '#09090B', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Layers style={{ width: '18px', height: '18px', color: '#FFFFFF' }} />
              </div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                03 // ALLOTMENT ENGINE
              </span>
              <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800, color: '#09090B', margin: '6px 0 10px' }}>
                Automated Batch Allotment
              </h3>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13.5px', color: '#52525B', lineHeight: 1.6 }}>
                Ingest Excel sheets to automatically carve 70-student cohorts into theory divisions and 18-student laboratory practical batches.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ background: '#09090B', color: '#FFFFFF', padding: '40px 24px', borderTop: '1px solid #27272A' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '8px', height: '8px', background: '#FF5500', display: 'inline-block' }} />
            <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '14px', letterSpacing: '-0.02em' }}>
              Smart Academic Platform
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#71717A', marginLeft: '8px' }}>
              v2.4 // PRODUCTION
            </span>
          </div>

          <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A' }}>
            Autonomous Academic ERP System · Deterministic Intelligence
          </p>

          <Link
            href="/login"
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '12px',
              fontWeight: 700,
              color: '#FFFFFF',
              background: '#27272A',
              padding: '6px 14px',
              borderRadius: '4px',
              textDecoration: 'none',
              border: '1px solid #3F3F46',
            }}
          >
            Access Portal →
          </Link>
        </div>
      </footer>

    </div>
  );
}
