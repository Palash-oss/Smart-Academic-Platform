'use client';

import React, { useState, useEffect } from 'react';
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
import { getStoredUser, User } from '@/lib/api';
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
                                    <div style={{ fontWeight: 800, fontSize: '12px', color: isLab ? '#15803D' : '#1D4ED8' }}>
                                      {cell.course_abbr} {isLab ? 'Lab' : ''}
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: '#1F2937', fontWeight: 700, marginTop: '2px' }}>
                                      {cell.faculty_initials || ''}
                                    </div>
                                    <div style={{ fontSize: '9.5px', color: '#6B7280', marginTop: '2px' }}>
                                      📍 {cell.room_number || 'Room 703'}
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
