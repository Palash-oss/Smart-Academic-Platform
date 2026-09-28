'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { Calendar, CheckSquare, Square, Save, CheckCircle2, ArrowLeft, Users, Search, Building2, BookOpen, AlertTriangle, RotateCcw, Clock } from 'lucide-react';
import Link from 'next/link';

interface Department {
  id: string;
  name: string;
  code: string;
  divisions: { id: string; name: string; student_count: number }[];
}

interface Course {
  id: string;
  code: string;
  name: string;
  full_label: string;
  semester: number;
}

interface Student {
  student_id: string;
  student_name: string;
  student_email: string;
}

interface MarkedSession {
  session_id: string;
  session_number: number;
  subject: string;
  session_date: string;
  present_count: number;
  absent_count: number;
  total_enrolled: number;
  created_at: string;
}

export default function MarkAttendancePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptCode, setSelectedDeptCode] = useState('COMP');
  const [selectedDivName, setSelectedDivName] = useState('A');
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseName, setSelectedCourseName] = useState('');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sessionDate, setSessionDate] = useState('2026-08-24');
  const [markedSessions, setMarkedSessions] = useState<MarkedSession[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [undoingSessionId, setUndoingSessionId] = useState<string | null>(null);

  const [resultBanner, setResultBanner] = useState<{
    subject: string;
    total: number;
    present: number;
    absent: number;
    sessionNumber: number;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch Departments & Divisions on Mount
  useEffect(() => {
    loadDepartments();
  }, []);

  // 2. Fetch Courses when Department changes
  useEffect(() => {
    if (selectedDeptCode) {
      loadCourses(selectedDeptCode);
    }
  }, [selectedDeptCode]);

  // 3. Fetch Students when Department, Division, or Batch changes
  useEffect(() => {
    if (selectedDeptCode && selectedDivName) {
      loadStudents(selectedDeptCode, selectedDivName, selectedBatch);
    }
  }, [selectedDeptCode, selectedDivName, selectedBatch]);

  // 4. Fetch Marked Sessions history for selected course and date
  useEffect(() => {
    if (selectedCourseName && sessionDate) {
      loadMarkedSessions(selectedCourseName, sessionDate);
    }
  }, [selectedCourseName, sessionDate]);

  const loadDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const res = await fetchWithAuth('/api/attendance/faculty/departments');
      if (res.ok) {
        const data: Department[] = await res.json();
        setDepartments(data);
        if (data.length > 0) {
          const compDept = data.find((d) => d.code === 'COMP') || data[0];
          setSelectedDeptCode(compDept.code);
          if (compDept.divisions.length > 0) {
            setSelectedDivName(compDept.divisions[0].name);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadCourses = async (deptCode: string) => {
    setLoadingCourses(true);
    try {
      const res = await fetchWithAuth(`/api/attendance/faculty/courses?dept_code=${deptCode}&department_code=${deptCode}`);
      if (res.ok) {
        const data: Course[] = await res.json();
        setCourses(data);
        if (data.length > 0) {
          setSelectedCourseName(data[0].full_label);
        } else {
          setSelectedCourseName('');
        }
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadStudents = async (deptCode: string, divName: string, batchName = selectedBatch) => {
    setLoadingStudents(true);
    try {
      const batchParam = batchName && batchName !== 'ALL' ? `&batch_name=${batchName}` : '';
      const res = await fetchWithAuth(`/api/attendance/faculty/students?dept_code=${deptCode}&div_name=${divName}${batchParam}`);
      if (res.ok) {
        const data: Student[] = await res.json();
        setStudents(data);
        setPresentStudentIds(new Set(data.map((s) => s.student_id)));
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadMarkedSessions = async (subject: string, date: string) => {
    try {
      const res = await fetchWithAuth(`/api/attendance/faculty/sessions?subject=${encodeURIComponent(subject)}&session_date=${date}`);
      if (res.ok) {
        const data: MarkedSession[] = await res.json();
        setMarkedSessions(data);
      }
    } catch (err) {
      console.error('Failed to load marked sessions history:', err);
    }
  };

  const handleDeptChange = (code: string) => {
    setSelectedDeptCode(code);
    const dept = departments.find((d) => d.code === code);
    if (dept && dept.divisions.length > 0) {
      setSelectedDivName(dept.divisions[0].name);
    }
  };

  const toggleStudentPresent = (id: string) => {
    setPresentStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = (select: boolean) => {
    if (select) {
      setPresentStudentIds(new Set(students.map((s) => s.student_id)));
    } else {
      setPresentStudentIds(new Set());
    }
  };

  const currentDept = departments.find((d) => d.code === selectedDeptCode);
  const availableDivisions = currentDept?.divisions || [];

  const sessionsTodayCount = markedSessions.length;
  const isMaxDailyReached = sessionsTodayCount >= 2;

  const filteredStudents = students.filter((st) =>
    st.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.student_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMaxDailyReached) return;

    setSubmitting(true);
    setResultBanner(null);
    setErrorMessage(null);

    const allIds = students.map((s) => s.student_id);
    const presentIds = Array.from(presentStudentIds);

    try {
      const res = await fetchWithAuth('/api/attendance/faculty/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedCourseName,
          session_date: sessionDate,
          present_student_ids: presentIds,
          all_enrolled_student_ids: allIds
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResultBanner({
          subject: data.subject,
          total: data.total_marked,
          present: data.present_count,
          absent: data.absent_count,
          sessionNumber: data.session_number
        });
        loadMarkedSessions(selectedCourseName, sessionDate);
      } else {
        const errData = await res.json();
        setErrorMessage(errData.detail || 'Failed to submit attendance session.');
      }
    } catch (err) {
      console.error('Failed to submit attendance session:', err);
      setErrorMessage('Network error while submitting attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoSession = async (sessionId: string, sessionNum: number) => {
    if (!confirm(`Are you sure you want to UNDO Session #${sessionNum}? This will revert all student attendance totals for this session.`)) {
      return;
    }

    setUndoingSessionId(sessionId);
    setErrorMessage(null);
    setResultBanner(null);

    try {
      const res = await fetchWithAuth(`/api/attendance/faculty/sessions/${sessionId}/undo`, {
        method: 'POST'
      });

      if (res.ok) {
        loadMarkedSessions(selectedCourseName, sessionDate);
        loadStudents(selectedDeptCode, selectedDivName);
      } else {
        const errData = await res.json();
        setErrorMessage(errData.detail || 'Failed to undo session.');
      }
    } catch (err) {
      console.error('Failed to undo session:', err);
      setErrorMessage('Network error while undoing session.');
    } finally {
      setUndoingSessionId(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ECECEE', color: '#09090B', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Navbar />

      <main style={{ maxWidth: '1180px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Navigation & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E4E4E7', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/faculty"
              style={{ padding: '8px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', color: '#09090B', display: 'flex', textDecoration: 'none' }}
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
            </Link>
            <div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#FF5500', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                // LIVE ATTENDANCE LEDGER
              </span>
              <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '22px', fontWeight: 800, color: '#09090B', letterSpacing: '-0.02em', marginTop: '2px' }}>
                Lecture Attendance Recording Console
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px',
                fontWeight: 700,
                color: isMaxDailyReached ? '#DC2626' : '#09090B',
                background: isMaxDailyReached ? '#FEF2F2' : '#FFFFFF',
                border: `1px solid ${isMaxDailyReached ? '#FECACA' : '#E4E4E7'}`,
                padding: '6px 12px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Clock style={{ width: '13px', height: '13px', color: isMaxDailyReached ? '#DC2626' : '#FF5500' }} />
              <span>SESSIONS TODAY: {sessionsTodayCount} / 2 (MAX 2)</span>
            </span>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertTriangle style={{ width: '18px', height: '18px', color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: '13px', color: '#DC2626' }}>Action Restricted</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#991B1B', marginTop: '2px' }}>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Max Limit Warning Banner */}
        {isMaxDailyReached && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle style={{ width: '16px', height: '16px', color: '#D97706', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#92400E' }}>
                <strong>Daily Limit Reached (2 / 2 Sessions Marked)</strong>: Additional session submissions for this course on {sessionDate} are restricted.
              </span>
            </div>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#B45309' }}>Use session history below to undo if needed.</span>
          </div>
        )}

        {/* Success Banner */}
        {resultBanner && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <CheckCircle2 style={{ width: '18px', height: '18px', color: '#16A34A' }} />
              <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: '14px', color: '#166534' }}>
                Session #{resultBanner.sessionNumber} Successfully Recorded Live in Postgres!
              </span>
            </div>
            <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#15803D' }}>
              Course: <strong>{resultBanner.subject}</strong> | Total Roster: <strong>{resultBanner.total}</strong> | Present: <strong>{resultBanner.present}</strong> | Absent: <strong>{resultBanner.absent}</strong>
            </p>
          </div>
        )}

        {/* Session History & Undo Panel */}
        {markedSessions.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E4E4E7', paddingBottom: '8px', marginBottom: '12px' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#09090B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock style={{ width: '13px', height: '13px', color: '#FF5500' }} />
                MARKED SESSIONS HISTORY ({sessionDate})
              </span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', color: '#71717A' }}>Click 'Undo Session' to revert attendance</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {markedSessions.map((sess) => (
                <div
                  key={sess.session_id}
                  style={{ padding: '12px', background: '#FAFAFB', border: '1px solid #E4E4E7', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '13px', color: '#09090B' }}>Session #{sess.session_number}</span>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#71717A' }}>At {sess.created_at || 'Today'}</span>
                    </div>
                    <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', marginTop: '2px' }}>
                      Present: <strong style={{ color: '#09090B' }}>{sess.present_count}</strong> / {sess.total_enrolled} Enrolled
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUndoSession(sess.session_id, sess.session_number)}
                    disabled={undoingSessionId === sess.session_id}
                    style={{
                      padding: '6px 12px',
                      background: '#FFFFFF',
                      border: '1px solid #FECACA',
                      color: '#DC2626',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
                  >
                    <RotateCcw style={{ width: '12px', height: '12px' }} />
                    <span>{undoingSessionId === sess.session_id ? 'Undoing...' : 'Undo'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendance Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Controls Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            
            {/* Department */}
            <div>
              <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                Department
              </label>
              <select
                value={selectedDeptCode}
                onChange={(e) => handleDeptChange(e.target.value)}
                disabled={loadingDepartments}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '8px 10px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#09090B', outline: 'none' }}
              >
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Division */}
            <div>
              <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                Division
              </label>
              <select
                value={selectedDivName}
                onChange={(e) => setSelectedDivName(e.target.value)}
                disabled={availableDivisions.length === 0}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '8px 10px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#09090B', outline: 'none' }}
              >
                {availableDivisions.map((div) => (
                  <option key={div.name} value={div.name}>
                    Division {div.name} ({div.student_count} Students)
                  </option>
                ))}
              </select>
            </div>

            {/* Practical Batch Scope */}
            <div>
              <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                Batch / Lab Scope
              </label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '8px 10px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#09090B', outline: 'none' }}
              >
                <option value="ALL">Entire Division (70 Students • Theory)</option>
                <option value="B1">Batch B1 (Roll 1–18 • 18 Students)</option>
                <option value="B2">Batch B2 (Roll 19–36 • 18 Students)</option>
                <option value="B3">Batch B3 (Roll 37–53 • 17 Students)</option>
                <option value="B4">Batch B4 (Roll 54–70 • 17 Students)</option>
              </select>
            </div>

            {/* Course */}
            <div>
              <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                Assigned Course
              </label>
              <select
                value={selectedCourseName}
                onChange={(e) => setSelectedCourseName(e.target.value)}
                disabled={loadingCourses || courses.length === 0}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '8px 10px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#09090B', outline: 'none' }}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.full_label}>
                    {c.full_label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                Session Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '8px 10px', fontSize: '13px', fontFamily: '"JetBrains Mono", monospace', color: '#09090B', outline: 'none' }}
              />
            </div>
          </div>

          {/* Student Roster Checkbox List */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            
            {/* Header & Quick Filter */}
            <div style={{ padding: '14px 18px', background: '#FAFAFB', borderBottom: '1px solid #E4E4E7', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users style={{ width: '16px', height: '16px', color: '#FF5500' }} />
                <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 800, color: '#09090B' }}>
                  {selectedDeptCode}-{selectedDivName} Class Roster ({presentStudentIds.size} / {students.length} Present)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ width: '13px', height: '13px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#71717A' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student..."
                    disabled={isMaxDailyReached}
                    style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '6px 10px 6px 30px', fontSize: '12px', color: '#09090B', width: '180px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    disabled={isMaxDailyReached}
                    style={{ padding: '6px 12px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '11.5px', fontWeight: 700, color: '#09090B', cursor: 'pointer' }}
                  >
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    disabled={isMaxDailyReached}
                    style={{ padding: '6px 12px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '11.5px', fontWeight: 600, color: '#71717A', cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Students List */}
            <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {loadingStudents ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#71717A', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>
                  Loading class roster for Division {selectedDeptCode}-{selectedDivName}...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#71717A', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>
                  No students found matching your search filter.
                </div>
              ) : (
                filteredStudents.map((st, idx) => {
                  const isPresent = presentStudentIds.has(st.student_id);
                  return (
                    <div
                      key={st.student_id}
                      onClick={() => toggleStudentPresent(st.student_id)}
                      style={{
                        padding: '12px 18px',
                        borderBottom: '1px solid #F4F4F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: isMaxDailyReached ? 'not-allowed' : 'pointer',
                        opacity: isMaxDailyReached ? 0.6 : 1,
                        background: isPresent ? '#FFFFFF' : '#FAFAFB',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isMaxDailyReached) e.currentTarget.style.background = '#F4F4F6'; }}
                      onMouseLeave={e => { if (!isMaxDailyReached) e.currentTarget.style.background = isPresent ? '#FFFFFF' : '#FAFAFB'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', width: '24px' }}>{idx + 1}.</span>
                        {isPresent ? (
                          <CheckSquare style={{ width: '18px', height: '18px', color: '#FF5500', flexShrink: 0 }} />
                        ) : (
                          <Square style={{ width: '18px', height: '18px', color: '#D4D4D8', flexShrink: 0 }} />
                        )}
                        <div>
                          <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: isPresent ? '#09090B' : '#71717A' }}>
                            {st.student_name}
                          </p>
                          <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A' }}>{st.student_email}</p>
                        </div>
                      </div>

                      <span
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '3px',
                          background: isPresent ? '#F0FDF4' : '#F4F4F6',
                          color: isPresent ? '#16A34A' : '#71717A',
                          border: `1px solid ${isPresent ? '#BBF7D0' : '#E4E4E7'}`,
                        }}
                      >
                        {isPresent ? 'PRESENT' : 'ABSENT'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={submitting || students.length === 0 || isMaxDailyReached}
              style={{
                padding: '11px 24px',
                background: isMaxDailyReached ? '#D4D4D8' : '#FF5500',
                color: '#FFFFFF',
                borderRadius: '6px',
                border: 'none',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                cursor: isMaxDailyReached || submitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isMaxDailyReached ? 'none' : '0 2px 10px rgba(255, 85, 0, 0.3)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (!isMaxDailyReached && !submitting) { e.currentTarget.style.background = '#E64D00'; } }}
              onMouseLeave={e => { if (!isMaxDailyReached && !submitting) { e.currentTarget.style.background = '#FF5500'; } }}
            >
              <Save style={{ width: '15px', height: '15px' }} />
              <span>
                {isMaxDailyReached
                  ? 'Max Daily Limit Reached (2/2 Marked)'
                  : submitting
                  ? 'Recording Session...'
                  : `Submit Session #${sessionsTodayCount + 1} for ${selectedDeptCode}-${selectedDivName}`}
              </span>
            </button>
          </div>
        </form>

      </main>
    </div>
  );
}
