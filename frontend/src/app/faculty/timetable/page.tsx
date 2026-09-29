'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import TimetableGrid from '@/components/TimetableGrid';
import {
  fetchFacultyTimetable,
  fetchMasterTimetable,
  fetchTimetableStatus,
  FacultyTimetableResponse,
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
  Sparkles,
  Layers,
  Award,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Table,
  UserCheck,
  Building,
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

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
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
                                    <div style={{ fontSize: '10px', color: '#374151', fontWeight: 600, marginTop: '2px' }}>
                                      {cell.section_name || ''} {cell.batch_name ? `• ${cell.batch_name}` : ''}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>
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
