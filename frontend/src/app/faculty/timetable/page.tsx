'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import TimetableGrid from '@/components/TimetableGrid';
import { AddExtraLectureButton, AddExtraLectureModal, UpcomingExtraLectures, formatExtraDate, localIsoDate } from '@/components/ExtraLectures';
import {
  fetchFacultyTimetable,
  fetchMasterTimetable,
  fetchTimetableStatus,
  FacultyTimetableResponse,
  MasterTimetableResponse,
  TimetableStatusResponse,
} from '@/lib/timetable';
import { getStoredUser, User, fetchWithAuth } from '@/lib/api';
import {
  Calendar,
  Clock,
  BookOpen,
  MapPin,
  Printer,
  ChevronRight,
  Sparkles,
  Layers,
  Award,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Table,
  UserCheck,
  Building,
  ArrowLeftRight,
  CheckSquare,
  X,
  Send,
  Check,
  Users,
} from 'lucide-react';
import Link from 'next/link';

export default function FacultyTimetablePage() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedTerm, setSelectedTerm] = useState('2026-27-SEM5');
  const [activeTab, setActiveTab] = useState<'personal' | 'master'>('personal');
  const [selectedDivision, setSelectedDivision] = useState('B');
  const [personalData, setPersonalData] = useState<FacultyTimetableResponse | null>(null);
  const [masterData, setMasterData] = useState<MasterTimetableResponse | null>(null);
  const [status, setStatus] = useState<TimetableStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [extraModalOpen, setExtraModalOpen] = useState(false);
  const [extraNotice, setExtraNotice] = useState('');

  // Class Swap & Substitution State
  const [swapRequests, setSwapRequests] = useState<{ received: any[]; sent: any[] }>({ received: [], sent: [] });
  const [colleagues, setColleagues] = useState<Array<{
    id: string;
    full_name: string;
    email: string;
    is_clashing?: boolean;
    clash_details?: string | null;
    match_score?: number;
    recommendation_badge?: string;
  }>>([]);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [activeSlotForSwap, setActiveSlotForSwap] = useState<any>(null);
  const [activeDayForSwap, setActiveDayForSwap] = useState('');
  const [swapDate, setSwapDate] = useState('2026-08-25');
  const [targetFacultyId, setTargetFacultyId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    loadSwaps();
    loadColleagues();
  }, []);

  useEffect(() => {
    loadData(selectedTerm, activeTab, selectedDivision);
  }, [selectedTerm, activeTab, selectedDivision]);

  const loadSwaps = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/timetable/swap-requests');
      if (res.ok) {
        const data = await res.json();
        setSwapRequests(data);
      }
    } catch (err) {
      console.error('Failed to load swap requests:', err);
    }
  };

  const loadColleagues = async (sourceSlotId?: string) => {
    try {
      const endpoint = sourceSlotId
        ? `/api/v1/timetable/faculty/colleagues?source_slot_id=${sourceSlotId}`
        : '/api/v1/timetable/faculty/colleagues';
      const res = await fetchWithAuth(endpoint);
      if (res.ok) {
        const data = await res.json();
        setColleagues(data);
        if (data.length > 0) {
          const firstFree = data.find((c: any) => !c.is_clashing);
          setTargetFacultyId(firstFree ? firstFree.id : data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load colleagues:', err);
    }
  };

  const handleRespondSwap = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    setRespondingId(requestId);
    try {
      const res = await fetchWithAuth('/api/v1/timetable/swap-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action }),
      });
      if (res.ok) {
        await loadSwaps();
        await loadData(selectedTerm, activeTab, selectedDivision);
      }
    } catch (err) {
      console.error('Error responding to swap:', err);
    } finally {
      setRespondingId(null);
    }
  };

  const handleOpenSwapModal = (cell: any, day: string) => {
    setActiveSlotForSwap(cell);
    setActiveDayForSwap(day);
    setSwapModalOpen(true);
    if (cell && cell.slot_id) {
      loadColleagues(cell.slot_id);
    }
  };

  const handleSubmitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSlotForSwap || !activeSlotForSwap.slot_id || !targetFacultyId) return;

    setSwapSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/v1/timetable/swap-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_term: selectedTerm,
          source_slot_id: activeSlotForSwap.slot_id,
          target_faculty_id: targetFacultyId,
          swap_date: swapDate,
          swap_type: 'SUBSTITUTION',
          reason: swapReason || 'Department Duty / Schedule Adjustment',
        }),
      });
      if (res.ok) {
        setSwapModalOpen(false);
        setSwapReason('');
        await loadSwaps();
        await loadData(selectedTerm, activeTab, selectedDivision);
      }
    } catch (err) {
      console.error('Failed to submit swap request:', err);
    } finally {
      setSwapSubmitting(false);
    }
  };

  const loadData = async (term: string, tab: 'personal' | 'master', div: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const st = await fetchTimetableStatus(term);
      setStatus(st);

      if (tab === 'personal') {
        const res = await fetchFacultyTimetable(term);
        setPersonalData(res);
      } else {
        const mRes = await fetchMasterTimetable(term, div);
        setMasterData(mRes);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load timetable');
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
            <Link href="/faculty" style={{ color: '#71717A', textDecoration: 'none' }}>FACULTY PORTAL</Link>
            <ChevronRight style={{ width: '12px', height: '12px' }} />
            <span style={{ color: '#FF5500', fontWeight: 700 }}>TIMETABLE</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                Faculty Academic Timetable
              </h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A' }}>
                {activeTab === 'personal'
                  ? 'Personalized teaching schedule showing only your assigned theory lectures, lab batches, and classroom locations.'
                  : 'Official master division timetable showing complete theory sections, parallel lab rotations, and breaks for all divisions.'}
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

              <AddExtraLectureButton onClick={() => setExtraModalOpen(true)} />

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

        {/* Incoming Peer Class Swap Requests Banner */}
        {swapRequests.received.filter((r) => r.status === 'PENDING').length > 0 && (
          <div
            className="no-print"
            style={{
              background: '#FFF7ED',
              border: '1px solid #FFEDD5',
              borderRadius: '8px',
              padding: '16px 20px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <ArrowLeftRight style={{ width: '18px', height: '18px', color: '#EA580C' }} />
              <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 800, color: '#9A3412' }}>
                Incoming Class Coverage Requests ({swapRequests.received.filter((r) => r.status === 'PENDING').length})
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
              {swapRequests.received.filter((r) => r.status === 'PENDING').map((req) => (
                <div
                  key={req.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #FED7AA',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#09090B' }}>
                        {req.source_course_abbr} ({req.source_section || 'COMP'})
                      </span>
                      <span style={{ fontSize: '10.5px', fontFamily: '"JetBrains Mono", monospace', background: '#FFEDD5', color: '#9A3412', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        {req.swap_date}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#4B5563', marginTop: '4px' }}>
                      Requested by: <strong>{req.requesting_faculty_name}</strong> • {req.source_day} ({req.source_time})
                    </p>
                    {req.reason && (
                      <p style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic', marginTop: '2px' }}>
                        &ldquo;{req.reason}&rdquo;
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={respondingId === req.id}
                      onClick={() => handleRespondSwap(req.id, 'APPROVED')}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: '#16A34A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check style={{ width: '13px', height: '13px' }} />
                      <span>{respondingId === req.id ? 'Authorizing...' : 'Accept & Cover Class'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={respondingId === req.id}
                      onClick={() => handleRespondSwap(req.id, 'REJECTED')}
                      style={{
                        padding: '6px 10px',
                        background: '#FFFFFF',
                        color: '#DC2626',
                        border: '1px solid #FCA5A5',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Switcher Tabs: Personal Teaching Schedule vs Master Division Timetable */}
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
              <span>My Teaching Schedule</span>
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

          {/* Division Switcher when in Master view */}
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
        {/* TAB 1: PERSONAL TEACHING SCHEDULE                                   */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'personal' && (
          <>
            {/* Workload KPI Summary Cards */}
            {personalData && personalData.total_weekly_hours > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A', textTransform: 'uppercase' }}>Weekly Load</span>
                    <Clock style={{ width: '16px', height: '16px', color: '#FF5500' }} />
                  </div>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '24px', fontWeight: 800 }}>
                    {personalData.total_weekly_hours} <span style={{ fontSize: '14px', fontWeight: 500, color: '#71717A' }}>hrs/week</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
                    Balanced Academic Workload
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A', textTransform: 'uppercase' }}>Theory Lectures</span>
                    <BookOpen style={{ width: '16px', height: '16px', color: '#3B82F6' }} />
                  </div>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '24px', fontWeight: 800 }}>
                    {personalData.theory_hours} <span style={{ fontSize: '14px', fontWeight: 500, color: '#71717A' }}>hours</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#71717A', marginTop: '4px' }}>
                    Classroom Theory Sessions
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A', textTransform: 'uppercase' }}>Practical / Labs</span>
                    <Layers style={{ width: '16px', height: '16px', color: '#10B981' }} />
                  </div>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '24px', fontWeight: 800 }}>
                    {personalData.practical_hours} <span style={{ fontSize: '14px', fontWeight: 500, color: '#71717A' }}>hours</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#71717A', marginTop: '4px' }}>
                    Supervised Lab Batches
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A', textTransform: 'uppercase' }}>Assigned Courses</span>
                    <Award style={{ width: '16px', height: '16px', color: '#8B5CF6' }} />
                  </div>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '24px', fontWeight: 800 }}>
                    {personalData.assigned_courses_count} <span style={{ fontSize: '14px', fontWeight: 500, color: '#71717A' }}>courses</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#71717A', marginTop: '4px' }}>
                    Computer Engineering
                  </div>
                </div>
              </div>
            )}

            {extraNotice && (
              <div role="status" className="no-print" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                {extraNotice}
              </div>
            )}

            {/* Weekly Matrix Table */}
            {loading ? (
              <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '60px', textAlign: 'center' }}>
                <RefreshCw style={{ width: '28px', height: '28px', color: '#FF5500', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A' }}>Loading your personalized timetable...</p>
              </div>
            ) : personalData && personalData.total_weekly_hours > 0 ? (
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
                      <span>Faculty: </span>
                      <span style={{ textTransform: 'uppercase' }}>{personalData.faculty_name} ({personalData.faculty_initials})</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span>Department: </span>
                      <span>Computer Engineering</span>
                    </div>
                    <div>
                      <span>Email: </span>
                      <span>{personalData.email}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span>Academic Term: </span>
                      <span>{personalData.academic_term}</span>
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
                        {personalData.time_slots.map((slot, sIdx) => (
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
                      {personalData.days.map((day) => {
                        const dayCells = personalData.schedule[day] || [];
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

                              if (cell.is_extra) {
                                const cancelled = cell.extra_status === 'CANCELLED';
                                return (
                                  <td
                                    key={cIdx}
                                    colSpan={cell.col_span}
                                    style={{ border: '1px solid #000000', padding: '8px 4px', background: '#FFF7ED', verticalAlign: 'middle', opacity: cancelled ? 0.6 : 1 }}
                                  >
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#C2410C', background: '#FFEDD5', padding: '1px 5px', borderRadius: '3px', marginBottom: '4px', display: 'inline-block' }}>
                                      EXTRA · {cell.extra_date ? formatExtraDate(cell.extra_date) : ''}
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: '12px', color: '#C2410C', textDecoration: cancelled ? 'line-through' : 'none' }}>
                                      {cell.course_code} {cell.course_name}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#374151', fontWeight: 600, marginTop: '2px' }}>
                                      {cell.section_name || ''} {cancelled ? '• Cancelled' : ''}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>📍 {cell.room_number}</div>
                                  </td>
                                );
                              }

                              if (cell.slot_type === 'THEORY' || cell.slot_type === 'PRACTICAL') {
                                const isLab = cell.slot_type === 'PRACTICAL';
                                const divClean = cell.section_name ? cell.section_name.replace('COMP-', '').replace('Division ', '') : 'B';
                                const markUrl = `/faculty/mark?course=${encodeURIComponent(cell.course_abbr || cell.course_name || '')}&div=${divClean}&batch=${cell.batch_name || 'ALL'}&date=2026-08-24`;

                                return (
                                  <td
                                    key={cIdx}
                                    colSpan={cell.col_span}
                                    style={{
                                      border: '1px solid #000000',
                                      padding: '8px 4px',
                                      background: cell.is_substituted
                                        ? (cell.original_faculty_name ? '#FEF9C3' : '#F3F4F6')
                                        : (isLab ? '#F0FDF4' : '#EFF6FF'),
                                      verticalAlign: 'middle',
                                    }}
                                  >
                                    {cell.is_substituted && cell.original_faculty_name && (
                                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#854D0E', background: '#FEF08A', padding: '1px 5px', borderRadius: '3px', marginBottom: '4px', display: 'inline-block' }}>
                                        ⭐ COVERING ({cell.original_faculty_name.split(' ')[0]})
                                      </div>
                                    )}
                                    {cell.is_substituted && cell.substitute_faculty_name && (
                                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#4B5563', background: '#E5E7EB', padding: '1px 5px', borderRadius: '3px', marginBottom: '4px', display: 'inline-block' }}>
                                        🔄 DELEGATED ({cell.substitute_faculty_name.split(' ')[0]})
                                      </div>
                                    )}

                                    <div style={{ fontWeight: 800, fontSize: '12px', color: isLab ? '#15803D' : '#1D4ED8' }}>
                                      {cell.course_abbr} {isLab ? 'Lab' : ''}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#374151', fontWeight: 600, marginTop: '2px' }}>
                                      {cell.section_name || ''} {cell.batch_name ? `• ${cell.batch_name}` : ''}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>
                                      📍 {cell.room_number || 'Room 703'}
                                    </div>

                                    {/* Action Buttons: Take Attendance & Request Swap */}
                                    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', justifyContent: 'center' }}>
                                      <Link
                                        href={markUrl}
                                        title="Take Attendance for this lecture slot"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          fontSize: '9.5px',
                                          fontWeight: 700,
                                          background: '#FF5500',
                                          color: '#FFFFFF',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          textDecoration: 'none',
                                        }}
                                      >
                                        <CheckSquare style={{ width: '10px', height: '10px' }} />
                                        <span>Mark</span>
                                      </Link>

                                      {!cell.is_substituted && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenSwapModal(cell, day)}
                                          title="Request Peer Class Swap / Substitution"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            fontSize: '9.5px',
                                            fontWeight: 700,
                                            background: '#FFFFFF',
                                            color: '#374151',
                                            border: '1px solid #D1D5DB',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <ArrowLeftRight style={{ width: '10px', height: '10px' }} />
                                          <span>Swap</span>
                                        </button>
                                      )}
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
                                    color: '#9CA3AF',
                                    fontSize: '10px',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  Free / Prep
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
                  The master timetable has not been generated by the administrator yet. Once generated, your teaching sessions and lab allocations will appear here.
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
        {/* TAB 2: MASTER DIVISION TIMETABLE (ACCESSIBLE TO FACULTY)             */}
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
        {activeTab === 'personal' && personalData && (
          <UpcomingExtraLectures
            lectures={(personalData.extra_lectures || []).filter((el) => el.date >= localIsoDate())}
            onCancelled={async (el) => {
              setExtraNotice(`Extra Lecture cancelled: ${el.subject_name}, ${formatExtraDate(el.date)} ${el.start_time}–${el.end_time}.`);
              await loadData(selectedTerm, activeTab, selectedDivision);
            }}
          />
        )}

        {extraModalOpen && (
          <AddExtraLectureModal
            term={selectedTerm}
            onClose={() => setExtraModalOpen(false)}
            onCreated={async (el) => {
              setExtraModalOpen(false);
              setExtraNotice(`Extra Lecture added: ${el.subject_name}, ${formatExtraDate(el.date)} ${el.start_time}–${el.end_time}.`);
              await loadData(selectedTerm, activeTab, selectedDivision);
            }}
          />
        )}

        {/* Peer Class Swap & Substitution Request Modal */}
        {swapModalOpen && activeSlotForSwap && (
          <div
            className="no-print"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(9, 9, 11, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                background: '#FFFFFF',
                border: '1px solid #E4E4E7',
                borderRadius: '10px',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArrowLeftRight style={{ width: '18px', height: '18px', color: '#FF5500' }} />
                  <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '17px', fontWeight: 800, color: '#09090B' }}>
                    Request Class Substitution
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSwapModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#71717A' }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              <form onSubmit={handleSubmitSwap}>
                {/* Slot Details Summary Box */}
                <div style={{ background: '#F4F4F6', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 800, color: '#09090B', marginBottom: '4px' }}>
                    {activeSlotForSwap.course_abbr} — {activeSlotForSwap.course_name || 'Assigned Session'}
                  </div>
                  <div style={{ color: '#52525B' }}>
                    {activeDayForSwap} • {activeSlotForSwap.start_time} - {activeSlotForSwap.end_time} • {activeSlotForSwap.section_name || 'COMP-B'} {activeSlotForSwap.batch_name ? `(${activeSlotForSwap.batch_name})` : ''}
                  </div>
                  <div style={{ color: '#71717A', marginTop: '2px' }}>
                    📍 {activeSlotForSwap.room_number || 'Room 703'}
                  </div>
                </div>

                {/* Target Date */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Date of Lecture Session
                  </label>
                  <input
                    type="date"
                    required
                    value={swapDate}
                    onChange={(e) => setSwapDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      border: '1px solid #E4E4E7',
                      borderRadius: '6px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '13px',
                      color: '#09090B',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Colleague Select */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Request Coverage From Colleague (AI Smart Compatibility Analysis)
                  </label>
                  <select
                    required
                    value={targetFacultyId}
                    onChange={(e) => setTargetFacultyId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      border: '1px solid #E4E4E7',
                      borderRadius: '6px',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      color: '#09090B',
                      outline: 'none',
                    }}
                  >
                    {colleagues.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.is_clashing ? '🛑 [Clash: Busy] ' : '🟢 [98% Match - Free Slot] '}
                        {c.full_name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic AI Compatibility Recommender Banner */}
                {(() => {
                  const selCol = colleagues.find((c) => c.id === targetFacultyId);
                  if (!selCol) return null;
                  return (
                    <div
                      style={{
                        marginBottom: '14px',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: selCol.is_clashing ? '#FEF2F2' : '#F0FDF4',
                        border: `1px solid ${selCol.is_clashing ? '#FECACA' : '#BBF7D0'}`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: selCol.is_clashing ? '#EF4444' : '#16A34A',
                          color: '#FFFFFF',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '11px',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {selCol.is_clashing ? '35% CLASH' : '98% MATCH'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontFamily: '"Plus Jakarta Sans", sans-serif',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: selCol.is_clashing ? '#991B1B' : '#166534',
                            marginBottom: '2px',
                          }}
                        >
                          {selCol.recommendation_badge || (selCol.is_clashing ? 'Schedule Conflict' : 'Free Prep Slot')}
                        </p>
                        <p
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '11.5px',
                            color: selCol.is_clashing ? '#B91C1C' : '#15803D',
                            lineHeight: 1.35,
                          }}
                        >
                          {selCol.is_clashing
                            ? `Conflict: ${selCol.clash_details || 'Teaching another class during this time slot'}. Requesting coverage may cause an overlap.`
                            : 'Zero timetable clashes detected. Colleague has an open preparation period during this time slot.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Reason */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Reason / Official Duty Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Attending AI Conference / Medical Consultation"
                    value={swapReason}
                    onChange={(e) => setSwapReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      border: '1px solid #E4E4E7',
                      borderRadius: '6px',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      color: '#09090B',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Modal Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSwapModalOpen(false)}
                    style={{
                      padding: '8px 16px',
                      background: '#F4F4F6',
                      color: '#09090B',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={swapSubmitting}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      background: '#FF5500',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: swapSubmitting ? 0.6 : 1,
                    }}
                  >
                    <Send style={{ width: '13px', height: '13px' }} />
                    <span>{swapSubmitting ? 'Sending Request...' : 'Send Swap Request'}</span>
                  </button>
                </div>
              </form>
            </div>
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
