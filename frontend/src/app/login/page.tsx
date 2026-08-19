'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAuthSession, TokenResponse } from '@/lib/api';
import { GraduationCap, Lock, Mail, User as UserIcon, ShieldAlert, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'FACULTY'>('STUDENT');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

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
      });

      if (data.role === 'FACULTY') {
        router.push('/faculty');
      } else {
        router.push('/chat');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoStudent = () => {
    setEmail('student@academic.edu');
    setPassword('student123');
    setIsRegister(false);
  };

  const fillDemoFaculty = () => {
    setEmail('faculty@academic.edu');
    setPassword('faculty123');
    setIsRegister(false);
  };

  return (
    <div className="min-h-screen bg-ink flex flex-col justify-center items-center p-4 font-sans text-paper relative overflow-hidden">
      {/* Subtle monochrome grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#E4E4E730_1px,transparent_1px),linear-gradient(to_bottom,#E4E4E730_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 shadow-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 bg-ink border border-paper text-paper rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-wide text-paper">
            ACADEMIC COMMAND CENTER
          </h1>
          <p className="text-xs text-subtle font-sans">
            Multi-Agent Academic Assistant & Attendance Platform
          </p>
        </div>

        {/* Quick Demo Fill Buttons */}
        <div className="p-3 bg-ink border border-border rounded-lg space-y-2 text-xs">
          <p className="font-mono text-[10px] text-subtle uppercase tracking-wider text-center">1-Click Demo Quick Login</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={fillDemoStudent}
              className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded text-paper transition-colors text-center font-medium shadow-xs"
            >
              Demo Student
            </button>
            <button
              type="button"
              onClick={fillDemoFaculty}
              className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded text-paper transition-colors text-center font-medium shadow-xs"
            >
              Demo Faculty
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-ink border border-border-strong rounded-lg text-paper text-xs flex items-center gap-2 font-mono">
            <ShieldAlert className="h-4 w-4 shrink-0 text-paper" />
            <span>[ERROR] {errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-mono text-subtle mb-1">FULL NAME</label>
              <div className="relative">
                <UserIcon className="h-4 w-4 absolute left-3 top-3 text-subtle" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full bg-ink border border-border focus:border-paper rounded-lg pl-9 pr-4 py-2.5 text-sm text-paper placeholder-subtle focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-subtle mb-1">EMAIL ADDRESS</label>
            <div className="relative">
              <Mail className="h-4 w-4 absolute left-3 top-3 text-subtle" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@academic.edu"
                className="w-full bg-ink border border-border focus:border-paper rounded-lg pl-9 pr-4 py-2.5 text-sm text-paper placeholder-subtle focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-subtle mb-1">PASSWORD</label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3 top-3 text-subtle" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-ink border border-border focus:border-paper rounded-lg pl-9 pr-4 py-2.5 text-sm text-paper placeholder-subtle focus:outline-none"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-mono text-subtle mb-1">ACCOUNT ROLE</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('STUDENT')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    role === 'STUDENT'
                      ? 'bg-paper text-ink border-paper font-bold'
                      : 'bg-ink border-border text-subtle'
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole('FACULTY')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    role === 'FACULTY'
                      ? 'bg-paper text-ink border-paper font-bold'
                      : 'bg-ink border-border text-subtle'
                  }`}
                >
                  Faculty Member
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-paper text-ink font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm mt-2 shadow-xs"
          >
            <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In to Command Center'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-subtle hover:text-paper transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : 'Need a new account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
