'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setAuthSession, TokenResponse } from '@/lib/api';
import { GraduationCap, Lock, Mail, User as UserIcon, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'FACULTY'>('STUDENT');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName, role }),
        });

        if (!regRes.ok) {
          let errText = 'Registration failed';
          try {
            const errData = await regRes.json();
            errText = errData.detail || errText;
          } catch {
            errText = 'Backend server offline. Please start the FastAPI backend on port 8000.';
          }
          throw new Error(errText);
        }
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        let errText = 'Invalid email or password';
        try {
          const errData = await loginRes.json();
          errText = errData.detail || errText;
        } catch {
          errText = 'Backend server offline. Please start the FastAPI backend on port 8000.';
        }
        throw new Error(errText);
      }

      const data: TokenResponse = await loginRes.json();
      setAuthSession(data.access_token, {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        student_erp_id: data.student_erp_id,
        roll_no: data.roll_no,
      });

      if (data.role === 'FACULTY') {
        router.push('/faculty');
      } else if (data.role === 'ADMIN') {
        router.push('/admin/allotment');
      } else {
        router.push('/chat');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsRegister(false);
    setErrorMsg('');
    setLoading(true);

    try {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });

      if (!loginRes.ok) {
        let errText = 'Invalid email or password';
        try {
          const errData = await loginRes.json();
          errText = errData.detail || errText;
        } catch {
          errText = 'Backend server offline. Please start the FastAPI backend on port 8000.';
        }
        throw new Error(errText);
      }

      const data: TokenResponse = await loginRes.json();
      setAuthSession(data.access_token, {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        student_erp_id: data.student_erp_id,
        roll_no: data.roll_no,
      });

      if (data.role === 'FACULTY') {
        router.push('/faculty');
      } else if (data.role === 'ADMIN') {
        router.push('/admin/allotment');
      } else {
        router.push('/chat');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
    fontWeight: 700,
    color: '#09090B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '6px',
  };

  const inputWrapStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#FFFFFF',
    border: '1px solid #E4E4E7',
    borderRadius: '6px',
    padding: '10px 12px 10px 38px',
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    color: '#09090B',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ECECEE',
        display: 'flex',
        fontFamily: 'Inter, system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left decorative technical panel (SS3 Style) */}
      <div
        style={{
          display: 'none',
          width: '42%',
          background: '#09090B',
          padding: '52px',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          borderRight: '1px solid #27272A',
        }}
        className="hidden lg:flex"
      >
        {/* Subtle Technical Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          <div style={{ width: '34px', height: '34px', background: '#18181B', borderRadius: '6px', border: '1px solid #27272A', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <GraduationCap style={{ width: '18px', height: '18px', color: '#FFFFFF' }} />
            <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '6px', height: '6px', background: '#FF5500', borderRadius: '50%' }} />
          </div>
          <div>
            <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '16px', color: '#FFFFFF' }}>Smart Academic</span>
            <span style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', color: '#71717A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>LABS // ERP 2.0</span>
          </div>
        </Link>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: '#18181B', border: '1px solid #27272A', borderRadius: '4px', marginBottom: '16px' }}>
            <span style={{ width: '6px', height: '6px', background: '#FF5500' }} />
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SYSTEM ARCHITECTURE</span>
          </div>

          <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '32px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2, marginBottom: '14px', letterSpacing: '-0.02em' }}>
            Academic Intelligence<br />Command Center
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14.5px', color: '#A1A1AA', lineHeight: 1.6, maxWidth: '440px' }}>
            Real-time deterministic attendance tracking, pgvector ordinance assistance, and autonomous faculty batch distribution.
          </p>

          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              'pgvector RAG for university statutes & ordinances',
              'Deterministic 75% attendance threshold ledger',
              'Automated cohort sectioning & practical lab matrix',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '5px', height: '5px', background: '#FF5500', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#D4D4D8' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', position: 'relative', zIndex: 1 }}>
          // AUTONOMOUS SCHEME · PRODUCTION RELEASE
        </p>
      </div>

      {/* Right login panel */}
      <div
        className="flex-1 flex items-center justify-center py-8 px-4 sm:p-8"
      >
        <div className="w-full max-w-[420px] bg-white border border-[#E4E4E7] rounded-md p-5 sm:p-9 shadow-sm">

          {/* Heading */}
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#FF5500', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '4px' }}>
              // AUTHENTICATION GATEWAY
            </span>
            <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '24px', fontWeight: 800, color: '#09090B', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {isRegister ? 'Create Your Account' : 'Sign In to Console'}
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#71717A' }}>
              {isRegister
                ? 'Register to access academic records & tools'
                : 'Access your student or faculty workspace'}
            </p>
          </div>

          {/* Demo Quick-Fill */}
          <div style={{ background: '#FAFAFB', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '12px', marginBottom: '20px' }}>
            <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', textAlign: 'center' }}>
              QUICK DEMO ACCOUNTS
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[
                { label: 'Student', email: 'student@academic.edu', pwd: 'student123' },
                { label: 'Faculty', email: 'faculty@academic.edu', pwd: 'faculty123' },
                { label: 'Admin', email: 'admin@academic.edu', pwd: 'admin123' },
              ].map((d) => (
                <button
                  key={d.label}
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin(d.email, d.pwd)}
                  style={{
                    padding: '8px 4px',
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E7',
                    borderRadius: '4px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#09090B',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5500'; e.currentTarget.style.color = '#FF5500'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.color = '#09090B'; }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '10px 12px', marginBottom: '18px' }}>
              <AlertCircle style={{ width: '15px', height: '15px', color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', color: '#DC2626', lineHeight: 1.4 }}>{errorMsg}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegister && (
              <div>
                <label style={labelStyle}>Full Name</label>
                <div style={inputWrapStyle}>
                  <UserIcon style={{ width: '15px', height: '15px', color: '#71717A', position: 'absolute', left: '12px' }} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF5500'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={labelStyle}>Email Address</label>
              <div style={inputWrapStyle}>
                <Mail style={{ width: '15px', height: '15px', color: '#71717A', position: 'absolute', left: '12px' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@academic.edu"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = '#FF5500'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <div style={inputWrapStyle}>
                <Lock style={{ width: '15px', height: '15px', color: '#71717A', position: 'absolute', left: '12px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  style={{ ...inputStyle, paddingRight: '40px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#FF5500'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', padding: '0', display: 'flex' }}
                >
                  {showPassword ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label style={labelStyle}>Account Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {(['STUDENT', 'FACULTY'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      style={{
                        padding: '8px',
                        border: role === r ? '1.5px solid #18181B' : '1px solid #E4E4E7',
                        borderRadius: '4px',
                        background: role === r ? '#18181B' : '#FFFFFF',
                        color: role === r ? '#FFFFFF' : '#71717A',
                        fontFamily: '"Plus Jakarta Sans", sans-serif',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {r === 'STUDENT' ? 'Student' : 'Faculty Member'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 20px',
                background: loading ? '#D4D4D8' : '#FF5500',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                boxShadow: loading ? 'none' : '0 2px 10px rgba(255, 85, 0, 0.3)',
                marginTop: '4px',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#E64D00'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#FF5500'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
              {!loading && <ArrowRight style={{ width: '15px', height: '15px' }} />}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #E4E4E7' }}>
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setErrorMsg(''); }}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', color: '#FF5500', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              {isRegister ? 'Already have an account? Sign In' : 'No account yet? Register'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <Link href="/" style={{ fontFamily: 'Inter, sans-serif', fontSize: '11.5px', color: '#71717A', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = '#09090B'}
              onMouseLeave={e => e.currentTarget.style.color = '#71717A'}
            >
              ← Back to Overview
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .hidden { display: none !important; }
        @media (min-width: 1024px) {
          .lg\\:flex { display: flex !important; }
          .lg\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
