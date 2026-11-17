'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { Calendar, CheckSquare, Square, Save, CheckCircle2, ArrowLeft, Users, Search, Building2, BookOpen, AlertTriangle, RotateCcw, Clock, Copy, Sparkles, QrCode, Maximize2, X, ShieldCheck } from 'lucide-react';
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

function MarkAttendanceContent() {
  const searchParams = useSearchParams();
  const queryCourse = searchParams.get('course') || searchParams.get('subject') || '';
  const queryDiv = searchParams.get('div') || searchParams.get('division') || '';
  const queryBatch = searchParams.get('batch') || '';
  const queryDate = searchParams.get('date') || '';
  const queryExtraLectureId = searchParams.get('extra_lecture') || '';
  const isSyncedFromTimetable = Boolean(queryCourse || queryDiv || queryBatch || queryDate);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptCode, setSelectedDeptCode] = useState('COMP');
  const [selectedDivName, setSelectedDivName] = useState(queryDiv || 'A');
  const [selectedBatch, setSelectedBatch] = useState<string>(queryBatch || 'ALL');
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseName, setSelectedCourseName] = useState('');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sessionDate, setSessionDate] = useState(queryDate || '2026-08-24');
  const [markedSessions, setMarkedSessions] = useState<MarkedSession[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [undoingSessionId, setUndoingSessionId] = useState<string | null>(null);
  const [copyingPrevious, setCopyingPrevious] = useState(false);
  const [copiedBanner, setCopiedBanner] = useState<{
    sessionDate: string;
    sessionNumber: number;
    matchedCount: number;
  } | null>(null);

  const [resultBanner, setResultBanner] = useState<{
    subject: string;
    total: number;
    present: number;
    absent: number;
    sessionNumber: number;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Software-based Dynamic Rolling TOTP Projector State
  const [dynamicModalOpen, setDynamicModalOpen] = useState(false);
  const [dynamicSessionId, setDynamicSessionId] = useState<string | null>(null);
  const [dynamicCode, setDynamicCode] = useState<string>('------');
  const [dynamicRemainingSeconds, setDynamicRemainingSeconds] = useState<number>(10);
  const [dynamicCheckedInCount, setDynamicCheckedInCount] = useState<number>(0);
  const [dynamicCheckedInList, setDynamicCheckedInList] = useState<any[]>([]);
  const [dynamicStarting, setDynamicStarting] = useState(false);
  const [dynamicFinalizing, setDynamicFinalizing] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (dynamicModalOpen && dynamicSessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetchWithAuth(`/api/attendance/faculty/dynamic-session/${dynamicSessionId}/poll`);
          if (res.ok) {
            const data = await res.json();
            setDynamicCode(data.current_code || '------');
            setDynamicRemainingSeconds(data.remaining_seconds || 10);
            setDynamicCheckedInCount(data.checked_in_count || 0);
            setDynamicCheckedInList(data.checked_in_students || []);
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [dynamicModalOpen, dynamicSessionId]);

  const handleStartDynamicSession = async () => {
    if (!selectedCourseName || students.length === 0) return;
    setDynamicStarting(true);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuth('/api/attendance/faculty/dynamic-session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedCourseName,
          session_date: sessionDate,
          division_name: selectedDivName,
          batch_name: selectedBatch,
          all_enrolled_student_ids: students.map((s) => s.student_id),
          ...(queryExtraLectureId ? { extra_lecture_id: queryExtraLectureId } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDynamicSessionId(data.session_id);
        setDynamicCode(data.current_code);
        setDynamicRemainingSeconds(data.remaining_seconds);
        setDynamicCheckedInCount(0);
        setDynamicCheckedInList([]);
        setDynamicModalOpen(true);
      } else {
        const err = await res.json();
        setErrorMessage(err.detail || 'Failed to start dynamic attendance session.');
      }
    } catch (e) {
      console.error('Failed to start dynamic session:', e);
      setErrorMessage('Network error while starting projector session.');
    } finally {
      setDynamicStarting(false);
    }
  };

  const handleFinalizeDynamicSession = async () => {
    if (!dynamicSessionId) return;
    setDynamicFinalizing(true);
    try {
      const res = await fetchWithAuth(`/api/attendance/faculty/dynamic-session/${dynamicSessionId}/finalize`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setDynamicModalOpen(false);
        setDynamicSessionId(null);
        setDynamicCheckedInList([]);
        setDynamicCheckedInCount(0);
        loadMarkedSessions(selectedCourseName, sessionDate);
        setResultBanner({
          subject: selectedCourseName,
          total: data.details.total_marked || students.length,
          present: data.details.present_count || dynamicCheckedInCount,
          absent: data.details.absent_count || (students.length - dynamicCheckedInCount),
          sessionNumber: data.details.session_number || 1,
        });
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to finalize attendance session.');
      }
    } catch (e) {
      console.error('Failed to finalize dynamic session:', e);
    } finally {
      setDynamicFinalizing(false);
    }
  };

  const handleCloseProjector = async () => {
    if (!dynamicSessionId) {
      setDynamicModalOpen(false);
      return;
    }

    if (dynamicCheckedInCount > 0) {
      const confirmFinalize = window.confirm(
        `You have ${dynamicCheckedInCount} student(s) checked in.\n\n` +
        `• Click OK to Lock & Finalize this attendance into the database ledger.\n` +
        `• Click Cancel to discard and close projector mode (students will no longer see this session).`
      );
      if (confirmFinalize) {
        await handleFinalizeDynamicSession();
        return;
      }
    }

    // Call backend cancel endpoint so students stop seeing this session
    try {
      await fetchWithAuth(`/api/attendance/faculty/dynamic-session/${dynamicSessionId}/cancel`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('Failed to cancel dynamic session:', e);
    }

    setDynamicModalOpen(false);
    setDynamicSessionId(null);
    setDynamicCheckedInList([]);
    setDynamicCheckedInCount(0);
  };

  const handleRevokeDynamicStudent = async (studentId: string) => {
    if (!dynamicSessionId) return;
    try {
      const res = await fetchWithAuth(`/api/attendance/faculty/dynamic-session/${dynamicSessionId}/revoke-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      if (res.ok) {
        setDynamicCheckedInList((prev) => prev.filter((s) => s.student_id !== studentId));
        setDynamicCheckedInCount((prev) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Failed to revoke student from dynamic session:', e);
    }
  };

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
          if (queryDiv && compDept.divisions.some((d) => d.name.toLowerCase() === queryDiv.toLowerCase())) {
            setSelectedDivName(queryDiv.toUpperCase());
          } else if (compDept.divisions.length > 0) {
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
          if (queryCourse) {
            const cleanQuery = queryCourse.toLowerCase().trim();
            const cleanAbbr = cleanQuery.replace(' lab', '').replace(' practical', '').trim();
            const ABBR_MAP: Record<string, string[]> = {
              'tcs': ['theory of computer science', '25pcc13ce21'],
              'ccl': ['cloud computing', '25vse13ce04'],
              'cn': ['computer networks', '25pcc13ce22'],
              'dwm': ['data warehousing', '25pcc13ce14'],
              'css': ['cryptography', '25pcc13ce19'],
              'bct': ['blockchain', '25pec13ce11'],
              'dl': ['deep learning', '25pec13ce12'],
              'cys': ['cyber security', '25pec13ce13'],
              'bda': ['big data', '25pec13ce14'],
              'ip': ['image processing', '25pecl13ce11'],
              'nlp': ['natural language', '25pecl13ce12'],
              'eh': ['ethical hacking', '25pecl13ce15'],
              'iiot': ['industrial iot', '25pecl13ce13'],
            };
            const targets = ABBR_MAP[cleanAbbr] || [];

            const matched = data.find((c) =>
              c.full_label.toLowerCase().includes(cleanQuery) ||
              c.name.toLowerCase().includes(cleanQuery) ||
              c.code.toLowerCase().includes(cleanQuery) ||
              targets.some((t) => c.name.toLowerCase().includes(t) || c.code.toLowerCase().includes(t))
            );

            if (matched) {
              setSelectedCourseName(matched.full_label);
            } else {
              setSelectedCourseName(data[0].full_label);
            }
          } else {
            setSelectedCourseName(data[0].full_label);
          }
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
    setCopiedBanner(null);
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
        const data: { sessions: MarkedSession[] } = await res.json();
        setMarkedSessions(data.sessions ?? []);
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
    setCopiedBanner(null);
    if (select) {
      setPresentStudentIds(new Set(students.map((s) => s.student_id)));
    } else {
      setPresentStudentIds(new Set());
    }
  };

  const handleCopyPreviousLecture = async () => {
    if (!selectedCourseName || students.length === 0 || isMaxDailyReached) return;

    setCopyingPrevious(true);
    setErrorMessage(null);
    setCopiedBanner(null);
    setResultBanner(null);

    try {
      const res = await fetchWithAuth(
        `/api/attendance/faculty/sessions/previous?subject=${encodeURIComponent(selectedCourseName)}&before_date=${encodeURIComponent(sessionDate)}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.detail || 'Failed to fetch previous lecture attendance.');
        return;
      }

      const data = await res.json();
      if (!data.found) {
        setErrorMessage(`No previous marked lecture found for "${selectedCourseName}" on or before ${sessionDate}.`);
        return;
      }

      const rosterIds = new Set(students.map((s) => s.student_id));
      const prevPresent = new Set<string>(
        (data.present_student_ids || []).filter((id: string) => rosterIds.has(id))
      );
      setPresentStudentIds(prevPresent);
      setCopiedBanner({
        sessionDate: data.session_date,
        sessionNumber: data.session_number,
        matchedCount: prevPresent.size,
      });
    } catch (err) {
      console.error('Failed to copy previous lecture attendance:', err);
      setErrorMessage('Network error while fetching previous lecture attendance.');
    } finally {
      setCopyingPrevious(false);
    }
  };

  const currentDept = departments.find((d) => d.code === selectedDeptCode);
  const availableDivisions = currentDept?.divisions || [];

  const sessionsTodayCount = markedSessions.length;
  // Extra Lectures are exempt from the 2-sessions-per-day cap that applies to normal lectures.
  const isMaxDailyReached = !queryExtraLectureId && sessionsTodayCount >= 2;

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
    setCopiedBanner(null);

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
          all_enrolled_student_ids: allIds,
          ...(queryExtraLectureId ? { extra_lecture_id: queryExtraLectureId } : {})
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 w-full">
        
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

        {/* Timetable Synchronized Session Banner */}
        {isSyncedFromTimetable && (
          <div
            style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '6px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '12px',
              color: '#92400E',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles style={{ width: '15px', height: '15px', color: '#D97706', flexShrink: 0 }} />
              <span>
                <strong>{queryExtraLectureId ? 'Extra Lecture:' : 'Timetable-Linked Session:'}</strong> Pre-populated for Division {selectedDivName} {selectedBatch !== 'ALL' ? `(Batch ${selectedBatch})` : '(Full Division)'} • Scheduled Date: {sessionDate}
              </span>
            </div>
            <span style={{ background: '#FDE68A', color: '#78350F', padding: '3px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800 }}>
              TIMETABLE DIRECT LINK
            </span>
          </div>
        )}

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

          {/* Copied Previous Lecture Banner */}
          {copiedBanner && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Copy style={{ width: '15px', height: '15px', color: '#2563EB', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#1E40AF' }}>
                  Copied attendance from <strong>Session #{copiedBanner.sessionNumber}</strong> ({copiedBanner.sessionDate}) — <strong>{copiedBanner.matchedCount} / {students.length}</strong> marked present. Review and submit when ready.
                </span>
              </div>
            </div>
          )}

          {/* Student Roster Checkbox List */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            
            {/* Header & Quick Filter */}
            <div className="p-3 sm:p-4 bg-[#FAFAFB] border-b border-[#E4E4E7] flex flex-wrap items-center justify-between gap-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users style={{ width: '16px', height: '16px', color: '#FF5500' }} />
                <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 800, color: '#09090B' }}>
                  {selectedDeptCode}-{selectedDivName} Class Roster ({presentStudentIds.size} / {students.length} Present)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search style={{ width: '13px', height: '13px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#71717A' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student..."
                    disabled={isMaxDailyReached}
                    className="w-full sm:w-[180px]"
                    style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '6px 10px 6px 30px', fontSize: '12px', color: '#09090B', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleStartDynamicSession}
                    disabled={isMaxDailyReached || loadingStudents || dynamicStarting || students.length === 0 || !selectedCourseName}
                    style={{
                      padding: '6px 14px',
                      background: '#18181B',
                      border: '1px solid #27272A',
                      borderRadius: '4px',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      cursor: isMaxDailyReached || loadingStudents || dynamicStarting || students.length === 0 || !selectedCourseName ? 'not-allowed' : 'pointer',
                      opacity: isMaxDailyReached || loadingStudents || dynamicStarting || students.length === 0 || !selectedCourseName ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    }}
                  >
                    <QrCode style={{ width: '13px', height: '13px', color: '#FF5500' }} />
                    <span>{dynamicStarting ? 'Initializing...' : 'Projector Mode (Rolling TOTP)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPreviousLecture}
                    disabled={isMaxDailyReached || loadingStudents || copyingPrevious || students.length === 0 || !selectedCourseName}
                    style={{
                      padding: '6px 12px',
                      background: '#FFF7ED',
                      border: '1px solid #FED7AA',
                      borderRadius: '4px',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#C2410C',
                      cursor: isMaxDailyReached || loadingStudents || copyingPrevious || students.length === 0 || !selectedCourseName ? 'not-allowed' : 'pointer',
                      opacity: isMaxDailyReached || loadingStudents || copyingPrevious || students.length === 0 || !selectedCourseName ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Copy style={{ width: '12px', height: '12px' }} />
                    <span>{copyingPrevious ? 'Copying...' : 'Copy Previous Lecture'}</span>
                  </button>
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

        {/* Projector Mode Modal (Software-Based Rolling TOTP) */}
        {dynamicModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.92)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              color: '#FFFFFF',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '720px',
                background: '#111113',
                border: '1.5px solid #27272A',
                borderRadius: '12px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #27272A', paddingBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', display: 'inline-block', boxShadow: '0 0 10px #22C55E' }} />
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 800, color: '#22C55E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      LIVE TOTP PROJECTOR MODE ACTIVE
                    </span>
                  </div>
                  <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', fontWeight: 800, color: '#FFFFFF', marginTop: '6px', letterSpacing: '-0.02em' }}>
                    {selectedCourseName}
                  </h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#D4D4D8', marginTop: '3px' }}>
                    Division {selectedDivName} {selectedBatch !== 'ALL' ? `(Batch ${selectedBatch})` : ''} • Date: {sessionDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseProjector}
                  style={{ background: '#27272A', border: 'none', color: '#A1A1AA', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              </div>

              {/* Central Rolling Token Display */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #131722 0%, #0B0E14 100%)',
                  border: '1.5px solid #2A3342',
                  borderRadius: '12px',
                  padding: '28px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  CLASSROOM CHECK-IN CODE (REFRESHES EVERY 10 SECONDS)
                </div>

                {/* Split Segmented High-Contrast Dual Pods */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', margin: '4px 0' }}>
                  <div
                    style={{
                      background: '#090D16',
                      border: '1.5px solid #0EA5E9',
                      borderRadius: '10px',
                      padding: '12px 26px',
                      boxShadow: '0 0 24px rgba(14, 165, 233, 0.22), inset 0 2px 6px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '56px',
                        fontWeight: 900,
                        letterSpacing: '0.22em',
                        color: '#38BDF8',
                        textShadow: '0 0 20px rgba(56, 189, 248, 0.5)',
                        display: 'inline-block',
                      }}
                    >
                      {dynamicCode.slice(0, 3)}
                    </span>
                  </div>

                  <span style={{ fontSize: '26px', fontWeight: 800, color: '#64748B' }}>-</span>

                  <div
                    style={{
                      background: '#090D16',
                      border: '1.5px solid #0EA5E9',
                      borderRadius: '10px',
                      padding: '12px 26px',
                      boxShadow: '0 0 24px rgba(14, 165, 233, 0.22), inset 0 2px 6px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '56px',
                        fontWeight: 900,
                        letterSpacing: '0.22em',
                        color: '#38BDF8',
                        textShadow: '0 0 20px rgba(56, 189, 248, 0.5)',
                        display: 'inline-block',
                      }}
                    >
                      {dynamicCode.slice(3)}
                    </span>
                  </div>
                </div>

                {/* Progress bar countdown */}
                <div style={{ width: '100%', maxWidth: '340px', height: '6px', background: '#1E293B', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(dynamicRemainingSeconds / 10) * 100}%`,
                      background: dynamicRemainingSeconds <= 3 ? '#EF4444' : 'linear-gradient(90deg, #0EA5E9, #22D3EE)',
                      boxShadow: dynamicRemainingSeconds <= 3 ? '0 0 8px #EF4444' : '0 0 10px #0EA5E9',
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#CBD5E1' }}>
                  Next token rotating in: <strong style={{ color: '#FFFFFF', fontWeight: 800 }}>{dynamicRemainingSeconds}s</strong>
                </div>
              </div>

              {/* Live Attendee Stats */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users style={{ width: '14px', height: '14px', color: '#22C55E' }} />
                    <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                      Live Check-Ins: {dynamicCheckedInCount} / {students.length} Enrolled
                    </span>
                  </div>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#94A3B8' }}>
                    Auto-updating roster
                  </span>
                </div>

                {/* Scrollable live chips */}
                <div
                  style={{
                    maxHeight: '130px',
                    overflowY: 'auto',
                    background: '#09090B',
                    border: '1px solid #27272A',
                    borderRadius: '6px',
                    padding: '10px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  {dynamicCheckedInList.length === 0 ? (
                    <div style={{ width: '100%', textAlign: 'center', padding: '16px', color: '#94A3B8', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>
                      Waiting for students to enter code on their portal...
                    </div>
                  ) : (
                    dynamicCheckedInList.map((stu) => (
                      <span
                        key={stu.student_id}
                        style={{
                          background: '#18181B',
                          border: '1px solid #22C55E',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontFamily: '"JetBrains Mono", monospace',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#FFFFFF',
                        }}
                      >
                        <CheckCircle2 style={{ width: '12px', height: '12px', color: '#22C55E', flexShrink: 0 }} />
                        <span><strong>{stu.name}</strong> ({stu.roll_no})</span>
                        <button
                          type="button"
                          title="Revoke / Disqualify Student"
                          onClick={() => handleRevokeDynamicStudent(stu.student_id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginLeft: '2px',
                            borderRadius: '3px',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#EF4444';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8';
                          }}
                        >
                          <X style={{ width: '11px', height: '11px' }} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #27272A', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={handleCloseProjector}
                  style={{
                    padding: '9px 16px',
                    background: '#27272A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close Projector
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeDynamicSession}
                  disabled={dynamicFinalizing}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    background: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    cursor: dynamicFinalizing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)',
                    opacity: dynamicFinalizing ? 0.6 : 1,
                  }}
                >
                  <ShieldCheck style={{ width: '15px', height: '15px' }} />
                  <span>{dynamicFinalizing ? 'Saving to Database...' : `Lock & Finalize Attendance (${dynamicCheckedInCount} Present)`}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function MarkAttendancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center font-mono text-xs text-zinc-500">Loading Attendance Console...</div>}>
      <MarkAttendanceContent />
    </Suspense>
  );
}
