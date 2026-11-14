'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import TimetableGrid from '@/components/TimetableGrid';
import {
  fetchStudentTimetable,
  fetchMasterTimetable,
  fetchTimetableStatus,
  StudentTimetableResponse,
  MasterTimetableResponse,
  TimetableStatusResponse,
} from '@/lib/timetable';
import { getStoredUser, fetchWithAuth, User } from '@/lib/api';
import {
  Calendar,
  Clock,
  BookOpen,
  MapPin,
  Printer,
  ChevronRight,
  GraduationCap,
  Layers,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Building,
  UserCheck,
  Table,
  CheckCircle2,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import Link from 'next/link';

export default function StudentTimetablePage() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedTerm, setSelectedTerm] = useState('2026-27-SEM5');
  const [activeTab, setActiveTab] = useState<'personal' | 'master'>('personal');
  const [selectedDivision, setSelectedDivision] = useState('B');
  const [studentData, setStudentData] = useState<StudentTimetableResponse | null>(null);
  const [masterData, setMasterData] = useState<MasterTimetableResponse | null>(null);
  const [status, setStatus] = useState<TimetableStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Classroom Live Check-In State
  const [activeLiveSession, setActiveLiveSession] = useState<any>(null);
  const [checkInCode, setCheckInCode] = useState('');
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; message: string } | null>(null);

  const getOrCreateDeviceFingerprint = (): string => {
    if (typeof window === 'undefined') return '';
    let fp = localStorage.getItem('sap_device_fp');
    if (!fp) {
      const screenData = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
      const navData = `${navigator.userAgent || ''}-${navigator.language || ''}`;
      const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      let hash = 0;
      const raw = `${screenData}|${navData}|${randomHex}`;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
      }
      fp = `DEV-${Math.abs(hash).toString(16)}-${randomHex.slice(0, 8)}`;
      localStorage.setItem('sap_device_fp', fp);
    }
    return fp;
  };

  const getCoordinates = (): Promise<{ latitude: number | null; longitude: number | null }> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        resolve({ latitude: null, longitude: null });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn('Campus Geolocation verification optional / unavailable:', err);
          resolve({ latitude: null, longitude: null });
        },
        { timeout: 4000, enableHighAccuracy: true }
      );
    });
  };

  const checkLiveSession = async () => {
    try {
      const res = await fetchWithAuth('/api/attendance/student/dynamic-session/active');
      if (res.ok) {
        const data = await res.json();
        if (data.has_active_session) {
          setActiveLiveSession(data);
        } else {
          setActiveLiveSession(null);
        }
      }
    } catch (e) {
      console.error('Failed to check active dynamic session:', e);
    }
  };

  useEffect(() => {
    checkLiveSession();
    const interval = setInterval(checkLiveSession, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleStudentCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInCode.trim()) return;
    setCheckInSubmitting(true);
    setCheckInResult(null);
    try {
      const fp = getOrCreateDeviceFingerprint();
      const coords = await getCoordinates();

      const res = await fetchWithAuth('/api/attendance/student/dynamic-session/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeLiveSession?.session_id,
          code: checkInCode.trim(),
          device_fingerprint: fp,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCheckInResult({ success: true, message: data.message });
        setActiveLiveSession((prev: any) => ({ ...prev, already_checked_in: true }));
        setCheckInCode('');
      } else {
        setCheckInResult({ success: false, message: data.detail || 'Failed to verify token.' });
      }
    } catch (e) {
      setCheckInResult({ success: false, message: 'Network error submitting attendance token.' });
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const hasSubstitutions = useMemo(() => {
    if (!studentData?.schedule) return false;
    return Object.values(studentData.schedule).some((dayCells) =>
      dayCells.some((c) => c.is_substituted)
    );
  }, [studentData]);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    // If not a student (e.g. admin or guest), default to master view
    if (u && u.role !== 'STUDENT') {
      setActiveTab('master');
    }
  }, []);

  useEffect(() => {
    loadData(selectedTerm, activeTab, selectedDivision);
  }, [selectedTerm, activeTab, selectedDivision]);

  const loadData = async (term: string, tab: 'personal' | 'master', div: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const st = await fetchTimetableStatus(term);
      setStatus(st);

      if (tab === 'personal') {
        const sRes = await fetchStudentTimetable(term);
        setStudentData(sRes);
      } else {
        const mRes = await fetchMasterTimetable(term, div);
        setMasterData(mRes);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFB', color: '#09090B' }}>
      <Navbar />

      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Breadcrumb & Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A' }}>
            <Link href="/" style={{ color: '#71717A', textDecoration: 'none' }}>HOME</Link>
            <ChevronRight style={{ width: '12px', height: '12px' }} />
            <Link href="/enrollments" style={{ color: '#71717A', textDecoration: 'none' }}>ACADEMIC</Link>
            <ChevronRight style={{ width: '12px', height: '12px' }} />
            <span style={{ color: '#FF5500', fontWeight: 700 }}>TIMETABLE</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                Academic Timetable
              </h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A' }}>
                {activeTab === 'personal'
                  ? 'Personalized view filtered strictly to your enrolled theory section, practical lab batch, and electives.'
                  : 'Official master division timetable showing all theory sections, parallel lab rotations, and breaks.'}
              </p>
            </div>

            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                style={{
                  padding: '9px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '6px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#09090B',
                  outline: 'none',
                }}
              >
                <option value="2026-27-SEM5">Semester 5 (2026-27-SEM5) [Ongoing]</option>
                <option value="2026-27-SEM6">Semester 6 (2026-27-SEM6) [Upcoming]</option>
              </select>

              <button
                onClick={handlePrint}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  background: '#18181B',
                  color: '#FFFFFF',
                  border: '1px solid #27272A',
                  borderRadius: '6px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Printer style={{ width: '15px', height: '15px' }} />
                <span>Print Timetable</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs: Personal vs Master */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E4E4E7', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('personal')}
              style={{
                padding: '10px 18px',
                border: 'none',
                background: 'none',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '13.5px',
                fontWeight: 700,
                color: activeTab === 'personal' ? '#FF5500' : '#71717A',
                borderBottom: activeTab === 'personal' ? '2.5px solid #FF5500' : '2.5px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px',
              }}
            >
              <UserCheck style={{ width: '15px', height: '15px' }} />
              <span>My Personal Schedule</span>
            </button>

            <button
              onClick={() => setActiveTab('master')}
              style={{
                padding: '10px 18px',
                border: 'none',
                background: 'none',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '13.5px',
                fontWeight: 700,
                color: activeTab === 'master' ? '#FF5500' : '#71717A',
                borderBottom: activeTab === 'master' ? '2.5px solid #FF5500' : '2.5px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px',
              }}
            >
              <Table style={{ width: '15px', height: '15px' }} />
              <span>Master Division Timetable (Everyone)</span>
            </button>
          </div>

          {/* If viewing Master, show division switcher */}
          {activeTab === 'master' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A', textTransform: 'uppercase', marginRight: '4px' }}>
                Division:
              </span>
              {[
                { id: 'B', name: 'COMP-B (Room 703)' },
                { id: 'A', name: 'COMP-A (Room 702)' },
              ].map((div) => (
                <button
                  key={div.id}
                  onClick={() => setSelectedDivision(div.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: selectedDivision === div.id ? '1px solid #18181B' : '1px solid #E4E4E7',
                    background: selectedDivision === div.id ? '#18181B' : '#FFFFFF',
                    color: selectedDivision === div.id ? '#FFFFFF' : '#71717A',
                    fontSize: '12px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {div.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px', color: '#DC2626', fontSize: '13px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: PERSONAL STUDENT SCHEDULE                                    */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'personal' && (
          <>
            {/* Live Classroom Check-In Banner */}
            {activeLiveSession && (
              <div
                style={{
                  background: '#09090B',
                  border: '1.5px solid #22C55E',
                  borderRadius: '8px',
                  padding: '18px 22px',
                  marginBottom: '20px',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 20px rgba(34, 197, 94, 0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', display: 'inline-block', boxShadow: '0 0 10px #22C55E' }} />
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 800, color: '#22C55E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        CLASSROOM ATTENDANCE SESSION IN PROGRESS
                      </span>
                    </div>
                    <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '16px', fontWeight: 800 }}>
                      {activeLiveSession.subject}
                    </h3>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#A1A1AA', marginTop: '2px' }}>
                      Instructor: {activeLiveSession.faculty_name || 'Class Faculty'} • Look at the classroom projector screen for the live 6-digit rolling token.
                    </p>
                  </div>

                  {activeLiveSession.already_checked_in ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22C55E', borderRadius: '6px', padding: '8px 16px', color: '#22C55E', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', fontWeight: 700 }}>
                      <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                      <span>ATTENDANCE RECORDED: PRESENT</span>
                    </div>
                  ) : (
                    <form onSubmit={handleStudentCheckIn} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="6-DIGIT CODE"
                        value={checkInCode}
                        onChange={(e) => setCheckInCode(e.target.value)}
                        style={{
                          padding: '9px 14px',
                          background: '#18181B',
                          border: '1.5px solid #3F3F46',
                          borderRadius: '6px',
                          color: '#FFFFFF',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '15px',
                          fontWeight: 800,
                          letterSpacing: '0.15em',
                          textAlign: 'center',
                          width: '140px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={checkInSubmitting}
                        style={{
                          padding: '9px 18px',
                          background: '#22C55E',
                          color: '#09090B',
                          border: 'none',
                          borderRadius: '6px',
                          fontFamily: '"Plus Jakarta Sans", sans-serif',
                          fontSize: '13px',
                          fontWeight: 800,
                          cursor: checkInSubmitting ? 'not-allowed' : 'pointer',
                          opacity: checkInSubmitting ? 0.6 : 1,
                        }}
                      >
                        {checkInSubmitting ? 'Verifying...' : 'Check In'}
                      </button>
                    </form>
                  )}
                </div>

                {/* Result Message */}
                {checkInResult && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      background: checkInResult.success ? '#14532D' : '#7F1D1D',
                      border: `1px solid ${checkInResult.success ? '#22C55E' : '#EF4444'}`,
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontFamily: '"JetBrains Mono", monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {checkInResult.success ? (
                      <CheckCircle2 style={{ width: '15px', height: '15px', color: '#86EFAC', flexShrink: 0 }} />
                    ) : (
                      <AlertCircle style={{ width: '15px', height: '15px', color: '#FCA5A5', flexShrink: 0 }} />
                    )}
                    <span>{checkInResult.message}</span>
                  </div>
                )}
              </div>
            )}
            {hasSubstitutions && (
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '12px',
                  color: '#92400E',
                }}
              >
                <AlertCircle style={{ width: '16px', height: '16px', color: '#B45309', flexShrink: 0 }} />
                <div>
                  <strong>Official Timetable Notice:</strong> Class substitution / peer faculty coverage is active for your division. See highlighted cells below for covering professor details.
                </div>
              </div>
            )}

            {studentData && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GraduationCap style={{ width: '22px', height: '22px', color: '#2563EB' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '16px' }}>
                        {studentData.student_name}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, background: '#18181B', color: '#FFFFFF' }}>
                        ROLL: {studentData.roll_no}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12.5px', color: '#71717A' }}>
                      <span>Division: <strong style={{ color: '#09090B' }}>{studentData.division_name}</strong></span>
                      <span>•</span>
                      <span>Assigned Lab Batch: <strong style={{ color: '#FF5500' }}>Batch {studentData.batch_name}</strong></span>
                      <span>•</span>
                      <span>Term: <strong style={{ color: '#09090B' }}>{studentData.academic_term}</strong></span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', fontWeight: 800, color: '#09090B' }}>
                      {studentData.total_weekly_hours}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#71717A', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
                      Hours / Week
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', fontWeight: 800, color: '#3B82F6' }}>
                      {studentData.theory_hours}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#71717A', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
                      Theory Hours
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', fontWeight: 800, color: '#10B981' }}>
                      {studentData.practical_hours}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#71717A', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
                      Lab Hours
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '60px', textAlign: 'center' }}>
                <RefreshCw style={{ width: '28px', height: '28px', color: '#FF5500', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A' }}>Loading your personal timetable...</p>
              </div>
            ) : studentData && studentData.total_weekly_hours > 0 ? (
              <div
                className="printable-sheet"
                style={{
                  background: '#FFFFFF',
                  border: '2px solid #000000',
                  padding: '16px',
                  fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                }}
              >
                {/* Header */}
                <div style={{ borderBottom: '2px solid #000000', paddingBottom: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', fontWeight: 700 }}>
                    <div>
                      <span>Student: </span>
                      <span style={{ textTransform: 'uppercase' }}>{studentData.student_name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span>Division & Batch: </span>
                      <span>{studentData.division_name} • Batch {studentData.batch_name}</span>
                    </div>
                    <div>
                      <span>Roll No: </span>
                      <span>{studentData.roll_no}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span>Classroom: </span>
                      <span>Room 703</span>
                    </div>
                  </div>
                </div>

                {/* Matrix */}
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '2px solid #000000',
                      textAlign: 'center',
                      fontSize: '11px',
                      tableLayout: 'fixed',
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#F4F4F5', borderBottom: '2px solid #000000' }}>
                        <th style={{ width: '90px', padding: '8px 4px', border: '1px solid #000000', fontWeight: 800 }}>
                          Day / Time
                        </th>
                        {studentData.time_slots.map((slot, sIdx) => (
                          <th
                            key={sIdx}
                            style={{
                              width: slot.is_break ? '55px' : '105px',
                              padding: '6px 2px',
                              border: '1px solid #000000',
                              fontWeight: 700,
                              background: slot.is_break ? '#E4E4E7' : '#F4F4F5',
                              fontSize: slot.is_break ? '9.5px' : '10.5px',
                            }}
                          >
                            {slot.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {studentData.days.map((day) => {
                        const dayCells = studentData.schedule[day] || [];
                        return (
                          <tr key={day} style={{ borderBottom: '1px solid #000000', minHeight: '65px' }}>
                            <td style={{ padding: '10px 4px', border: '1px solid #000000', fontWeight: 800, background: '#FAFAFB', fontSize: '12px' }}>
                              {day}
                            </td>

                            {dayCells.map((cell, cIdx) => {
                              if (cell.slot_type === 'BREAK') {
                                return (
                                  <td
                                    key={cIdx}
                                    colSpan={cell.col_span}
                                    style={{
                                      border: '1px solid #000000',
                                      background: '#F4F4F5',
                                      writingMode: 'vertical-rl',
                                      transform: 'rotate(180deg)',
                                      fontWeight: 800,
                                      fontSize: '9.5px',
                                      color: '#52525B',
                                    }}
                                  >
                                    {cell.custom_title}
                                  </td>
                                );
                              }

                              if (cell.slot_type === 'PROJECT' || cell.slot_type === 'HONORS') {
                                return (
                                  <td
                                    key={cIdx}
                                    colSpan={cell.col_span}
                                    style={{
                                      border: '1px solid #000000',
                                      padding: '8px 4px',
                                      background: cell.slot_type === 'PROJECT' ? '#EFF6FF' : '#FAF5FF',
                                      fontWeight: 800,
                                      fontSize: cell.slot_type === 'PROJECT' ? '12px' : '11px',
                                      color: cell.slot_type === 'PROJECT' ? '#1E40AF' : '#6B21A8',
                                    }}
                                  >
                                    {cell.custom_title || (cell.slot_type === 'PROJECT' ? 'Mini Project' : 'Honors')}
                                  </td>
                                );
                              }

                              if (cell.slot_type === 'THEORY' || cell.slot_type === 'PRACTICAL') {
                                const isLab = cell.slot_type === 'PRACTICAL';
                                return (
                                  <td
                                    key={cIdx}
                                    colSpan={cell.col_span}
                                    style={{
                                      border: '1px solid #000000',
                                      padding: '8px 4px',
                                      background: isLab ? '#F0FDF4' : '#EFF6FF',
                                      verticalAlign: 'middle',
                                    }}
                                  >
                                    {cell.is_substituted && cell.substitute_faculty_name && (
                                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#92400E', background: '#FEF3C7', padding: '1px 5px', borderRadius: '3px', marginBottom: '3px', display: 'inline-block' }}>
                                        Covering: {cell.substitute_faculty_name.split(' ')[0]}
                                      </div>
                                    )}
                                    <div style={{ fontWeight: 800, fontSize: '12px', color: isLab ? '#15803D' : '#1D4ED8' }}>
                                      {cell.course_abbr} {isLab ? 'Lab' : ''}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#1F2937', fontWeight: 700, marginTop: '2px' }}>
                                      {cell.is_substituted && cell.substitute_faculty_name
                                        ? cell.substitute_faculty_name
                                        : cell.faculty_initials || ''}
                                    </div>
                                    <div style={{ fontSize: '9.5px', color: '#6B7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <MapPin style={{ width: '10px', height: '10px', color: '#9CA3AF' }} />
                                      <span>{cell.room_number || 'Room 703'}</span>
                                    </div>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={cIdx}
                                  colSpan={cell.col_span}
                                  style={{
                                    border: '1px solid #000000',
                                    padding: '6px',
                                    background: '#FFFFFF',
                                    color: '#D4D4D8',
                                  }}
                                >
                                  —
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '50px 24px', textAlign: 'center' }}>
                <Calendar style={{ width: '36px', height: '36px', color: '#A1A1AA', margin: '0 auto 14px' }} />
                <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
                  Timetable Not Generated Yet
                </h3>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13.5px', color: '#71717A', maxWidth: '440px', margin: '0 auto 16px' }}>
                  The master timetable has not been generated by the administrator yet. Once generated, your personal batch lectures and lab schedule will appear here.
                </p>
                {user?.role === 'ADMIN' && (
                  <Link
                    href="/admin/timetable"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 18px',
                      background: '#FF5500',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <span>Go to Admin Generator →</span>
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: MASTER DIVISION TIMETABLE (ACCESSIBLE TO EVERYONE)            */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'master' && (
          <div>
            {loading ? (
              <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '60px', textAlign: 'center' }}>
                <RefreshCw style={{ width: '28px', height: '28px', color: '#FF5500', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A' }}>Loading master division timetable...</p>
              </div>
            ) : masterData && (masterData.subject_legend.length > 0 || status?.timetable_generated) ? (
              <TimetableGrid data={masterData} />
            ) : (
              <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '50px 24px', textAlign: 'center' }}>
                <Calendar style={{ width: '36px', height: '36px', color: '#A1A1AA', margin: '0 auto 14px' }} />
                <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
                  Master Timetable Not Generated
                </h3>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13.5px', color: '#71717A', maxWidth: '440px', margin: '0 auto 16px' }}>
                  The administrator has not generated the timetable for {selectedTerm} yet.
                </p>
                {user?.role === 'ADMIN' && (
                  <Link
                    href="/admin/timetable"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 18px',
                      background: '#FF5500',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <span>Generate Master Timetable →</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media print {
          nav, header, footer, .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
          }
          .printable-sheet {
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            page-break-inside: avoid !important;
          }
          @page {
            size: landscape;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
}
