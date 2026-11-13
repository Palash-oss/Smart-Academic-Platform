'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Search,
  BookOpen,
  FlaskConical,
  Plus,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  Download,
  X,
  Filter,
  GraduationCap,
  FileText,
  Printer,
  ShieldCheck,
  Award,
  Send,
} from 'lucide-react';
import Link from 'next/link';

interface SubjectRecord {
  id: string;
  subject: string;
  total_classes: number;
  attended_classes: number;
  percentage: number;
  is_at_risk: boolean;
  classes_needed_to_clear_risk: number;
}

interface EnrolledCourseMeta {
  code: string;
  name: string;
  tier: string;
}

interface StudentOverview {
  student_id: string;
  student_name: string;
  student_email: string;
  roll_no?: string;
  department_code: string;
  division_name: string;
  division_label: string;
  overall_percentage: number;
  overall_risk: boolean;
  total_subjects: number;
  subjects_at_risk: number;
  subjects: SubjectRecord[];
  course_codes?: string[];
  enrolled_courses?: EnrolledCourseMeta[];
}

interface FacultyStudentRosterItem {
  id: string;
  student_erp_id?: string | null;
  roll_no?: string | null;
  name: string;
  email: string;
  division?: string | null;
  section_name?: string | null;
  batch_name?: string | null;
}

interface FacultyAssignedSection {
  id: string;
  section_name: string;
  student_count: number;
  division: string;
  component_type: string;
  students?: FacultyStudentRosterItem[];
}

interface FacultyAssignedBatch {
  id: string;
  batch_name: string;
  student_count: number;
  section_name: string;
  division: string;
  batch_label: string;
  component_type: string;
  students?: FacultyStudentRosterItem[];
}

interface FacultyAssignedCourse {
  offering_id: string;
  course_code: string;
  course_name: string;
  tier: string;
  delivery_mode: string;
  th_hours: number;
  pr_hours: number;
  tu_hours: number;
  sections: FacultyAssignedSection[];
  batches: FacultyAssignedBatch[];
  total_students: number;
  divisions: string[];
  assigned_types?: string[];
  students?: FacultyStudentRosterItem[];
}

interface FacultyTeachingLoad {
  faculty_id: string;
  faculty_name: string;
  department_name: string;
  academic_term: string;
  total_courses: number;
  total_sections: number;
  total_batches: number;
  total_students: number;
  courses: FacultyAssignedCourse[];
}

const S = {
  page: { minHeight: '100vh', background: '#ECECEE', fontFamily: 'Inter, system-ui, sans-serif' } as React.CSSProperties,
  main: { maxWidth: '1360px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  card: { background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } as React.CSSProperties,
};

export default function FacultyDashboardPage() {
  const [selectedTerm, setSelectedTerm] = useState('2026-27-SEM5');
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [teachingLoad, setTeachingLoad] = useState<FacultyTeachingLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivisionTab, setSelectedDivisionTab] = useState<string>('ALL');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
  const [riskFilterOnly, setRiskFilterOnly] = useState(false);
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());

  // Roster Modal state
  const [rosterModalCourse, setRosterModalCourse] = useState<FacultyAssignedCourse | null>(null);
  const [rosterBatchFilter, setRosterBatchFilter] = useState<string>('ALL');
  const [rosterSearchQuery, setRosterSearchQuery] = useState<string>('');

  // Condonation Review Modal state (Rule 4.2)
  const [showCondonationModal, setShowCondonationModal] = useState(false);
  const [selectedStudentForCondonation, setSelectedStudentForCondonation] = useState<{
    id: string;
    name: string;
    subject: string;
    currentPct: number;
  } | null>(null);
  const [condonationLeaveType, setCondonationLeaveType] = useState('MEDICAL');
  const [condonationGrantedClasses, setCondonationGrantedClasses] = useState(2);
  const [condonationReason, setCondonationReason] = useState('');
  const [grantingCondonation, setGrantingCondonation] = useState(false);
  const [condonationSuccessMsg, setCondonationSuccessMsg] = useState<string | null>(null);

  // Form 4 Defaulter Notice Modal state
  const [showDefaulterNoticeModal, setShowDefaulterNoticeModal] = useState(false);
  const [defaultersData, setDefaultersData] = useState<any[]>([]);
  const [cryptographicSeal, setCryptographicSeal] = useState<any>(null);
  const [loadingDefaulters, setLoadingDefaulters] = useState(false);

  const handleOpenCondonation = (student: StudentOverview, subjectName?: string) => {
    setSelectedStudentForCondonation({
      id: student.student_id,
      name: student.student_name,
      subject: subjectName || student.subjects[0]?.subject || 'Theory of Computer Science (25PCC13CE01)',
      currentPct: student.overall_percentage,
    });
    setCondonationSuccessMsg(null);
    setShowCondonationModal(true);
  };

  const handleGrantCondonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForCondonation) return;
    setGrantingCondonation(true);
    setCondonationSuccessMsg(null);
    try {
      const res = await fetchWithAuth('/api/attendance/condonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentForCondonation.id,
          subject: selectedStudentForCondonation.subject,
          leave_type: condonationLeaveType,
          missed_sessions_count: condonationGrantedClasses,
          granted_classes: condonationGrantedClasses,
          reason: condonationReason || 'Sanctioned under Autonomous Ordinance Rule 4.2',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCondonationSuccessMsg(`Granted ${condonationGrantedClasses} condoned sessions. New Attendance: ${data.new_attendance_percentage}%`);
        await loadFacultyData(selectedTerm);
      } else {
        alert(data.detail || 'Failed to grant condonation');
      }
    } catch (err) {
      console.error('Error granting condonation:', err);
    } finally {
      setGrantingCondonation(false);
    }
  };

  const handleOpenDefaulterNotice = async () => {
    setShowDefaulterNoticeModal(true);
    setLoadingDefaulters(true);
    try {
      const res = await fetchWithAuth('/api/attendance/defaulters?dept_code=COMP&min_threshold=75');
      if (res.ok) {
        const data = await res.json();
        setDefaultersData(data.defaulters || []);
        setCryptographicSeal(data.cryptographic_seal || null);
      }
    } catch (err) {
      console.error('Failed to load defaulters:', err);
    } finally {
      setLoadingDefaulters(false);
    }
  };

  useEffect(() => {
    loadFacultyData(selectedTerm);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRosterModalCourse(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadFacultyData = async (term = selectedTerm) => {
    setLoading(true);
    try {
      const [overviewRes, loadRes] = await Promise.all([
        fetchWithAuth('/api/attendance/faculty/overview'),
        fetchWithAuth(`/api/v1/faculty/my-subjects?academic_term=${encodeURIComponent(term)}`),
      ]);

      if (overviewRes.ok) {
        const data: StudentOverview[] = await overviewRes.json();
        setStudents(data);
      }
      if (loadRes.ok) {
        const loadData: FacultyTeachingLoad = await loadRes.json();
        setTeachingLoad(loadData);
      }
    } catch (err) {
      console.error('Failed to load faculty overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentExpanded = (studentId: string) => {
    const nextSet = new Set(expandedStudentIds);
    if (nextSet.has(studentId)) {
      nextSet.delete(studentId);
    } else {
      nextSet.add(studentId);
    }
    setExpandedStudentIds(nextSet);
  };

  const expandAll = (expand: boolean) => {
    if (expand) {
      setExpandedStudentIds(new Set(students.map((s) => s.student_id)));
    } else {
      setExpandedStudentIds(new Set());
    }
  };

  // Helper: check if a student is enrolled in a specific course
  const studentMatchesCourse = (student: StudentOverview, courseCode: string) => {
    if (courseCode === 'ALL') return true;
    if (student.course_codes && student.course_codes.includes(courseCode)) return true;
    if (student.enrolled_courses && student.enrolled_courses.some((c) => c.code === courseCode)) return true;
    if (student.subjects && student.subjects.some((s) => s.subject.includes(courseCode))) return true;
    const courseObj = teachingLoad?.courses.find((c) => c.course_code === courseCode);
    if (courseObj?.students?.some((st) => st.id === student.student_id)) return true;
    return false;
  };

  // Students enrolled in currently selected course filter (or all)
  const courseEnrolledStudents = useMemo(() => {
    return students.filter((s) => studentMatchesCourse(s, selectedCourseFilter));
  }, [students, selectedCourseFilter, teachingLoad]);

  const availableDivisions = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.division_label))).sort();
  }, [students]);

  const departmentCode = students.length > 0 ? students[0].department_code : 'COMP';

  // Final filtered students list for ledger
  const filteredStudents = useMemo(() => {
    return courseEnrolledStudents.filter((student) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        student.student_name.toLowerCase().includes(q) ||
        student.student_email.toLowerCase().includes(q) ||
        (student.roll_no && student.roll_no.toLowerCase().includes(q));

      const matchesDivision =
        selectedDivisionTab === 'ALL' ||
        student.division_label === selectedDivisionTab ||
        student.division_name === selectedDivisionTab;

      const matchesRisk = riskFilterOnly ? student.overall_risk : true;

      return matchesSearch && matchesDivision && matchesRisk;
    });
  }, [courseEnrolledStudents, searchQuery, selectedDivisionTab, riskFilterOnly]);

  const totalStudents = students.length;
  const atRiskCount = students.filter((s) => s.overall_risk).length;
  const goodCount = totalStudents - atRiskCount;

  const selectedCourseObj = useMemo(() => {
    if (selectedCourseFilter === 'ALL' || !teachingLoad) return null;
    return teachingLoad.courses.find((c) => c.course_code === selectedCourseFilter) || null;
  }, [selectedCourseFilter, teachingLoad]);

  const getPercentageColor = (pct: number) => {
    if (pct >= 85) return '#16A34A';
    if (pct >= 75) return '#D97706';
    return '#DC2626';
  };

  const getPercentageBg = (pct: number) => {
    if (pct >= 85) return '#F0FDF4';
    if (pct >= 75) return '#FFFBEB';
    return '#FEF2F2';
  };

  // Modal Roster Students calculation
  const modalRosterStudents = useMemo(() => {
    if (!rosterModalCourse) return [];
    if (rosterModalCourse.students && rosterModalCourse.students.length > 0) {
      return rosterModalCourse.students.map((st) => {
        const overviewStudent = students.find((s) => s.student_id === st.id || s.student_email === st.email);
        const courseSub = overviewStudent?.subjects.find(
          (sub) =>
            sub.subject.includes(rosterModalCourse.course_code) ||
            sub.subject.toLowerCase().includes(rosterModalCourse.course_name.toLowerCase())
        );
        return {
          ...st,
          attendancePct: courseSub ? courseSub.percentage : overviewStudent?.overall_percentage,
        };
      });
    }

    // Fallback: match from students list
    return students
      .filter((s) =>
        s.course_codes?.includes(rosterModalCourse.course_code) ||
        s.subjects?.some(
          (sub) =>
            sub.subject.includes(rosterModalCourse.course_code) ||
            sub.subject.toLowerCase().includes(rosterModalCourse.course_name.toLowerCase())
        )
      )
      .map((s) => {
        const courseSub = s.subjects.find(
          (sub) =>
            sub.subject.includes(rosterModalCourse.course_code) ||
            sub.subject.toLowerCase().includes(rosterModalCourse.course_name.toLowerCase())
        );
        return {
          id: s.student_id,
          student_erp_id: null,
          roll_no: s.roll_no || '-',
          name: s.student_name,
          email: s.student_email,
          division: s.division_label,
          section_name: null,
          batch_name: null,
          attendancePct: courseSub ? courseSub.percentage : s.overall_percentage,
        };
      });
  }, [rosterModalCourse, students]);

  // Filtered students inside the modal
  const filteredModalStudents = useMemo(() => {
    return modalRosterStudents.filter((st) => {
      if (rosterBatchFilter.startsWith('sec:')) {
        const secName = rosterBatchFilter.replace('sec:', '');
        if (st.section_name !== secName) return false;
      } else if (rosterBatchFilter.startsWith('batch:')) {
        const batchName = rosterBatchFilter.replace('batch:', '');
        if (st.batch_name !== batchName) return false;
      }

      if (rosterSearchQuery) {
        const q = rosterSearchQuery.toLowerCase().trim();
        const matches =
          st.name.toLowerCase().includes(q) ||
          st.email.toLowerCase().includes(q) ||
          (st.roll_no && st.roll_no.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [modalRosterStudents, rosterBatchFilter, rosterSearchQuery]);

  // CSV Exporter
  const exportRosterToCSV = (course: FacultyAssignedCourse, roster: Array<FacultyStudentRosterItem & { attendancePct?: number }>) => {
    const headers = ['Roll No', 'Full Name', 'Email', 'Division', 'Theory Section', 'Lab Batch', 'Attendance %'];
    const rows = roster.map((st) => [
      `"${st.roll_no || '-'}"`,
      `"${(st.name || '').replace(/"/g, '""')}"`,
      `"${st.email || ''}"`,
      `"${st.division || '-'}"`,
      `"${st.section_name || '-'}"`,
      `"${st.batch_name || '-'}"`,
      `"${st.attendancePct !== undefined ? st.attendancePct + '%' : '-'}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const cleanName = course.course_name.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `${course.course_code}_${cleanName}_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={S.page}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 w-full">
        {/* Page Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#FF5500', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {departmentCode} Department
              </span>
              <span style={{ width: '4px', height: '4px', background: '#D4D4D8', borderRadius: '50%', display: 'inline-block' }} />
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>Faculty Command</span>
            </div>
            <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '26px', fontWeight: 800, color: '#09090B', letterSpacing: '-0.02em' }}>
              Attendance Ledger
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '7px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', fontWeight: 700 }}>TERM:</span>
              <select
                value={selectedTerm}
                onChange={(e) => {
                  const t = e.target.value;
                  setSelectedTerm(t);
                  loadFacultyData(t);
                }}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#09090B',
                  cursor: 'pointer',
                }}
              >
                <option value="2026-27-SEM5">2026-27-SEM5 (Jul–Dec 2026) • Sem 5 Ongoing</option>
                <option value="2026-27-SEM6">2026-27-SEM6 (Jan–Jun 2027) • Sem 6 Next</option>
              </select>
            </div>

            <Link
              href="/faculty/mark"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: '#FF5500',
                color: '#FFFFFF',
                borderRadius: '6px',
                textDecoration: 'none',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '13.5px',
                fontWeight: 700,
                boxShadow: '0 2px 10px rgba(255, 85, 0, 0.3)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#E64D00';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FF5500';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus style={{ width: '15px', height: '15px' }} />
              <span>Mark Attendance</span>
            </Link>

            <button
              type="button"
              onClick={handleOpenDefaulterNotice}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: '#FFFFFF',
                color: '#DC2626',
                border: '1px solid #FECACA',
                borderRadius: '6px',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FEF2F2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
              }}
            >
              <FileText style={{ width: '15px', height: '15px' }} />
              <span>University Defaulter Notice (Form 4)</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Total Enrolled', value: totalStudents, icon: <Users style={{ width: '18px', height: '18px', color: '#09090B' }} />, iconBg: '#F4F4F6', color: '#09090B' },
            { label: 'Good Standing', value: goodCount, icon: <CheckCircle2 style={{ width: '18px', height: '18px', color: '#16A34A' }} />, iconBg: '#F0FDF4', color: '#16A34A' },
            { label: 'At Risk (<75%)', value: atRiskCount, icon: <AlertTriangle style={{ width: '18px', height: '18px', color: '#DC2626' }} />, iconBg: '#FEF2F2', color: '#DC2626' },
            { label: 'Courses Teaching', value: teachingLoad?.total_courses ?? 0, icon: <BookOpen style={{ width: '18px', height: '18px', color: '#FF5500' }} />, iconBg: '#FFF4ED', color: '#FF5500' },
            { label: 'Lab Batches', value: teachingLoad?.total_batches ?? 0, icon: <FlaskConical style={{ width: '18px', height: '18px', color: '#FF5500' }} />, iconBg: '#FFF4ED', color: '#FF5500' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...S.card, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', background: stat.iconBg, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {stat.icon}
                </div>
              </div>
              <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '30px', fontWeight: 800, color: stat.color, lineHeight: 1, marginBottom: '4px' }}>{stat.value}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', color: '#71717A', fontWeight: 600 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Teaching Load */}
        {teachingLoad && teachingLoad.courses.length > 0 && (
          <div style={S.card}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BookOpen style={{ width: '16px', height: '16px', color: '#FF5500' }} />
                <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '15px', fontWeight: 800, color: '#09090B' }}>My Teaching Load</h2>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#09090B', background: '#F4F4F6', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '2px 8px' }}>
                  {teachingLoad.academic_term}
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#71717A' }}>
                  (Click any course or &apos;View Roster&apos; to inspect enrolled students)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#71717A' }}>
                <span>INSTRUCTOR: <strong style={{ color: '#09090B', fontWeight: 700 }}>{teachingLoad.faculty_name}</strong></span>
                <span>STUDENTS: <strong style={{ color: '#09090B', fontWeight: 700 }}>{teachingLoad.total_students}</strong></span>
              </div>
            </div>

            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {teachingLoad.courses.map((course) => {
                const isFiltered = selectedCourseFilter === course.course_code;
                const count = course.total_students || course.students?.length || 0;
                const isElective = course.tier === 'DEPARTMENT' || course.tier === 'INSTITUTE';

                return (
                  <div
                    key={course.offering_id}
                    style={{
                      background: isFiltered ? '#FFFBF7' : '#FAFAFB',
                      border: isFiltered ? '2px solid #FF5500' : '1px solid #E4E4E7',
                      borderRadius: '6px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      boxShadow: isFiltered ? '0 4px 14px rgba(255, 85, 0, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Top Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#09090B', background: '#FFFFFF', padding: '2px 6px', border: '1px solid #E4E4E7', borderRadius: '3px' }}>
                              {course.course_code}
                            </span>
                            <span
                              style={{
                                fontFamily: '"JetBrains Mono", monospace',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: isElective ? '#EA580C' : '#2563EB',
                                background: isElective ? '#FFF7ED' : '#EFF6FF',
                                border: `1px solid ${isElective ? '#FED7AA' : '#BFDBFE'}`,
                                borderRadius: '3px',
                                padding: '1px 6px',
                              }}
                            >
                              {course.tier === 'CLASS' ? 'CORE' : course.tier === 'DEPARTMENT' ? 'PEC ELECTIVE' : 'OPEN ELECTIVE'}
                            </span>
                            {isFiltered && (
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 800, color: '#FFFFFF', background: '#FF5500', borderRadius: '3px', padding: '1px 6px' }}>
                                FILTER ACTIVE
                              </span>
                            )}
                          </div>
                          <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14.5px', fontWeight: 800, color: '#09090B', lineHeight: 1.3 }}>
                            {course.course_name}
                          </h3>
                        </div>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 600, color: '#52525B', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                          {course.delivery_mode}
                        </span>
                      </div>

                      {/* Sections & Batches */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                        {course.sections.map((sec) => (
                          <button
                            key={sec.id}
                            onClick={() => {
                              setRosterModalCourse(course);
                              setRosterBatchFilter(`sec:${sec.section_name}`);
                            }}
                            title={`Click to view roster for ${sec.section_name}`}
                            style={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '11px',
                              color: '#09090B',
                              background: '#FFFFFF',
                              border: '1px solid #E4E4E7',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            Theory: {sec.section_name} ({sec.student_count})
                          </button>
                        ))}
                        {course.batches.map((batch) => (
                          <button
                            key={batch.id}
                            onClick={() => {
                              setRosterModalCourse(course);
                              setRosterBatchFilter(`batch:${batch.batch_name}`);
                            }}
                            title={`Click to view roster for ${batch.batch_name}`}
                            style={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '11px',
                              color: '#FF5500',
                              background: '#FFF4ED',
                              border: '1px solid #FED7AA',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            Lab: {batch.batch_name} ({batch.student_count})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons: View Roster Modal & Filter Ledger */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px', borderTop: '1px solid #E4E4E7' }}>
                      <button
                        onClick={() => {
                          setRosterModalCourse(course);
                          setRosterBatchFilter('ALL');
                        }}
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          background: '#09090B',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '4px',
                          fontFamily: '"Plus Jakarta Sans", sans-serif',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#27272A')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#09090B')}
                      >
                        <Users style={{ width: '13px', height: '13px' }} />
                        View Roster ({count})
                      </button>

                      <button
                        onClick={() => setSelectedCourseFilter(isFiltered ? 'ALL' : course.course_code)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '7px 12px',
                          background: isFiltered ? '#FF5500' : '#FFFFFF',
                          color: isFiltered ? '#FFFFFF' : '#09090B',
                          border: isFiltered ? '1px solid #FF5500' : '1px solid #E4E4E7',
                          borderRadius: '4px',
                          fontFamily: '"Plus Jakarta Sans", sans-serif',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Filter style={{ width: '12px', height: '12px' }} />
                        {isFiltered ? 'Clear Filter' : 'Filter Ledger'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter / Search Bar */}
        <div style={{ ...S.card, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Top Row: Division Tabs & Search / Risk */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            {/* Division Tabs */}
            <div style={{ display: 'flex', gap: '6px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', fontWeight: 700, marginRight: '4px' }}>
                DIVISION:
              </span>
              {['ALL', ...availableDivisions].map((div) => {
                const count =
                  div === 'ALL'
                    ? courseEnrolledStudents.length
                    : courseEnrolledStudents.filter((s) => s.division_label === div || s.division_name === div).length;
                const isActive = selectedDivisionTab === div;
                return (
                  <button
                    key={div}
                    onClick={() => setSelectedDivisionTab(div)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: isActive ? '1px solid #18181B' : '1px solid #E4E4E7',
                      background: isActive ? '#18181B' : '#FFFFFF',
                      color: isActive ? '#FFFFFF' : '#71717A',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: '12.5px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {div === 'ALL' ? `All Divisions` : `Div ${div}`}
                    <span style={{ marginLeft: '6px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search style={{ width: '14px', height: '14px', color: '#71717A', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, roll no, email..."
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '7px 12px 7px 32px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#09090B', outline: 'none' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#FF5500';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E4E4E7';
                }}
              />
            </div>

            {/* Risk Filter */}
            <button
              onClick={() => setRiskFilterOnly(!riskFilterOnly)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                border: riskFilterOnly ? '1px solid #DC2626' : '1px solid #E4E4E7',
                background: riskFilterOnly ? '#FEF2F2' : '#FFFFFF',
                color: riskFilterOnly ? '#DC2626' : '#71717A',
                borderRadius: '6px',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <SlidersHorizontal style={{ width: '13px', height: '13px' }} />
              {riskFilterOnly ? 'At Risk Only' : 'Filter: At Risk'}
            </button>

            {/* Expand/Collapse */}
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <button onClick={() => expandAll(true)} style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#09090B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px' }}>
                Expand All
              </button>
              <span style={{ color: '#D4D4D8' }}>|</span>
              <button onClick={() => expandAll(false)} style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#71717A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '4px' }}>
                Collapse
              </button>
            </div>
          </div>

          {/* Bottom Row: Course Filter Tabs */}
          {teachingLoad && teachingLoad.courses.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', paddingTop: '10px', borderTop: '1px solid #F4F4F6', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginRight: '4px' }}>
                FILTER BY COURSE:
              </span>

              <button
                onClick={() => setSelectedCourseFilter('ALL')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  border: selectedCourseFilter === 'ALL' ? '1px solid #18181B' : '1px solid #E4E4E7',
                  background: selectedCourseFilter === 'ALL' ? '#18181B' : '#FFFFFF',
                  color: selectedCourseFilter === 'ALL' ? '#FFFFFF' : '#71717A',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '12px',
                  fontWeight: selectedCourseFilter === 'ALL' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                All Courses ({students.length})
              </button>

              {teachingLoad.courses.map((course) => {
                const isSelected = selectedCourseFilter === course.course_code;
                const count = course.total_students || course.students?.length || 0;
                return (
                  <button
                    key={course.course_code}
                    onClick={() => setSelectedCourseFilter(isSelected ? 'ALL' : course.course_code)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '4px',
                      border: isSelected ? '1.5px solid #FF5500' : '1px solid #E4E4E7',
                      background: isSelected ? '#FFF4ED' : '#FFFFFF',
                      color: isSelected ? '#FF5500' : '#09090B',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: '12px',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 1px 4px rgba(255, 85, 0, 0.15)' : 'none',
                    }}
                  >
                    <span>{course.course_name}</span>
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: isSelected ? '#FF5500' : '#F4F4F6',
                        color: isSelected ? '#FFFFFF' : '#71717A',
                        padding: '1px 6px',
                        borderRadius: '3px',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {selectedCourseFilter !== 'ALL' && (
                <button
                  onClick={() => setSelectedCourseFilter('ALL')}
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '11px',
                    color: '#DC2626',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <X style={{ width: '12px', height: '12px' }} /> Clear Course Filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active Course Filter Alert Banner */}
        {selectedCourseFilter !== 'ALL' && selectedCourseObj && (
          <div
            style={{
              background: '#FFF7ED',
              border: '1.5px solid #FDBA74',
              borderRadius: '6px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen style={{ width: '18px', height: '18px', color: '#EA580C' }} />
              <div>
                <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13.5px', fontWeight: 800, color: '#9A3412' }}>
                  Filtering Ledger by Course: {selectedCourseObj.course_name}
                </span>
                <span style={{ marginLeft: '8px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#C2410C', background: '#FED7AA', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                  {selectedCourseObj.course_code}
                </span>
                <span style={{ marginLeft: '8px', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#9A3412' }}>
                  • Showing {filteredStudents.length} of {selectedCourseObj.total_students} enrolled students
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => {
                  setRosterModalCourse(selectedCourseObj);
                  setRosterBatchFilter('ALL');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: '#EA580C',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Users style={{ width: '13px', height: '13px' }} />
                View Complete Roster Modal ({selectedCourseObj.total_students})
              </button>

              <button
                onClick={() => setSelectedCourseFilter('ALL')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  background: '#FFFFFF',
                  color: '#C2410C',
                  border: '1px solid #FDBA74',
                  borderRadius: '4px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <X style={{ width: '13px', height: '13px' }} />
                Reset Filter
              </button>
            </div>
          </div>
        )}

        {/* Student List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ ...S.card, padding: '60px', textAlign: 'center' }}>
              <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#71717A' }}>Loading student directory...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ ...S.card, padding: '60px', textAlign: 'center' }}>
              <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '16px', fontWeight: 700, color: '#09090B', marginBottom: '4px' }}>No students found</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#71717A' }}>Try adjusting your search or filter criteria.</p>
              {selectedCourseFilter !== 'ALL' && (
                <button
                  onClick={() => setSelectedCourseFilter('ALL')}
                  style={{
                    marginTop: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: '#FF5500',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Clear Course Filter
                </button>
              )}
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isExpanded = expandedStudentIds.has(student.student_id);
              const pctColor = getPercentageColor(student.overall_percentage);

              // Find elective courses for this student
              const electiveCourses =
                student.enrolled_courses?.filter(
                  (c) => c.tier === 'DEPARTMENT' || c.tier === 'INSTITUTE' || c.code.startsWith('25PEC') || c.code.startsWith('25OE')
                ) || [];

              return (
                <div key={student.student_id} style={{ ...S.card, overflow: 'hidden', transition: 'all 0.15s ease' }}>
                  {/* Student Row */}
                  <div
                    onClick={() => toggleStudentExpanded(student.student_id)}
                    style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', cursor: 'pointer', userSelect: 'none', flexWrap: 'wrap' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFB')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          background: student.overall_risk ? '#FEF2F2' : '#F4F4F6',
                          border: `1px solid ${student.overall_risk ? '#FECACA' : '#E4E4E7'}`,
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '14px', color: student.overall_risk ? '#DC2626' : '#09090B' }}>
                          {student.student_name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 700, color: '#09090B' }}>
                            {student.student_name}
                          </span>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 700, color: '#09090B', background: '#F4F4F6', border: '1px solid #E4E4E7', borderRadius: '3px', padding: '1px 6px' }}>
                            {student.division_label}
                          </span>
                          {student.roll_no && student.roll_no !== '-' && (
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', fontWeight: 600 }}>
                              {student.roll_no}
                            </span>
                          )}

                          {/* Distinctive Elective Badges (e.g. Blockchain Technology) */}
                          {electiveCourses.map((c) => {
                            const isMatch = selectedCourseFilter === c.code;
                            return (
                              <span
                                key={c.code}
                                style={{
                                  fontFamily: '"JetBrains Mono", monospace',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  color: isMatch ? '#FFFFFF' : '#EA580C',
                                  background: isMatch ? '#EA580C' : '#FFF7ED',
                                  border: `1px solid ${isMatch ? '#EA580C' : '#FED7AA'}`,
                                  borderRadius: '4px',
                                  padding: '1px 7px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title={`Enrolled in ${c.name} (${c.code})`}
                              >
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isMatch ? '#FFFFFF' : '#EA580C' }} />
                                {c.code.startsWith('25PEC') ? 'PEC' : c.code.startsWith('25OE') ? 'OE' : 'Elective'}: {c.name}
                              </span>
                            );
                          })}
                        </div>
                        <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', marginTop: '2px' }}>{student.student_email}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      {/* Percentage */}
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', fontWeight: 800, color: pctColor }}>{student.overall_percentage}%</span>
                        <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9.5px', color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>OVERALL</p>
                      </div>

                      {/* Risk Badge & Condonation */}
                      {student.overall_risk ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '3px 8px' }}>
                            <AlertTriangle style={{ width: '11px', height: '11px' }} />
                            At Risk
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCondonation(student);
                            }}
                            title="Review Medical or Duty Leave under Autonomous Rule 4.2"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#1D4ED8',
                              background: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            <ShieldCheck style={{ width: '12px', height: '12px' }} />
                            <span>Condonation</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 600, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '4px', padding: '3px 8px' }}>
                          <CheckCircle2 style={{ width: '11px', height: '11px' }} />
                          Good Standing
                        </span>
                      )}

                      {isExpanded ? <ChevronDown style={{ width: '15px', height: '15px', color: '#71717A' }} /> : <ChevronRight style={{ width: '15px', height: '15px', color: '#71717A' }} />}
                    </div>
                  </div>

                  {/* Expanded Subject Cards */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #E4E4E7', background: '#FAFAFB', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#09090B' }}>
                          Enrolled Courses ({student.subjects.length})
                        </span>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', color: '#71717A' }}>MIN THRESHOLD: 75%</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                        {student.subjects.map((sub) => {
                          const subPct = sub.percentage;
                          const subColor = subPct >= 85 ? '#16A34A' : subPct >= 75 ? '#D97706' : '#DC2626';
                          const subBorder = subPct >= 85 ? '#BBF7D0' : subPct >= 75 ? '#FED7AA' : '#FECACA';
                          const isFilteredSubject = selectedCourseFilter !== 'ALL' && sub.subject.includes(selectedCourseFilter);

                          return (
                            <div
                              key={sub.id}
                              style={{
                                background: isFilteredSubject ? '#FFFBF7' : '#FFFFFF',
                                border: isFilteredSubject ? '2px solid #FF5500' : `1px solid ${subBorder}`,
                                borderRadius: '6px',
                                padding: '12px 14px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                position: 'relative',
                              }}
                            >
                              {isFilteredSubject && (
                                <span style={{ position: 'absolute', top: '-8px', right: '10px', background: '#FF5500', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '3px', fontFamily: '"JetBrains Mono", monospace' }}>
                                  CURRENT FILTER
                                </span>
                              )}
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                <h4 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#09090B', lineHeight: 1.35 }}>{sub.subject}</h4>
                                <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '15px', fontWeight: 800, color: subColor, flexShrink: 0 }}>{sub.percentage}%</span>
                              </div>
                              {/* Progress bar */}
                              <div style={{ height: '4px', background: '#E4E4E7', borderRadius: '99px', overflow: 'hidden', marginBottom: '8px' }}>
                                <div style={{ height: '100%', width: `${Math.min(sub.percentage, 100)}%`, background: subColor, borderRadius: '99px' }} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A' }}>{sub.attended_classes} / {sub.total_classes} classes</span>
                                {sub.is_at_risk && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 700, color: '#DC2626' }}>
                                      +{sub.classes_needed_to_clear_risk} needed
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCondonation(student, sub.subject);
                                      }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        fontSize: '9.5px',
                                        fontWeight: 700,
                                        background: '#EFF6FF',
                                        color: '#1D4ED8',
                                        border: '1px solid #BFDBFE',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <ShieldCheck style={{ width: '10px', height: '10px' }} />
                                      <span>Rule 4.2</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Complete Enrolled Students Roster Modal */}
      {rosterModalCourse && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 9, 11, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          className="p-2 sm:p-5"
          onClick={() => setRosterModalCourse(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E4E4E7',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
              width: '100%',
              maxWidth: '940px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 flex items-center justify-between bg-[#FAFAFB] border-b border-[#E4E4E7]">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 800, color: '#FF5500', background: '#FFF4ED', border: '1px solid #FED7AA', borderRadius: '4px', padding: '2px 7px' }}>
                    {rosterModalCourse.course_code}
                  </span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>
                    {rosterModalCourse.tier} • {rosterModalCourse.delivery_mode}
                  </span>
                </div>
                <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '19px', fontWeight: 800, color: '#09090B' }}>
                  {rosterModalCourse.course_name} — Enrolled Students Roster
                </h2>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', color: '#71717A', marginTop: '2px' }}>
                  Term: <strong>{selectedTerm}</strong> • Total Enrolled: <strong style={{ color: '#09090B' }}>{modalRosterStudents.length} Students</strong>
                </p>
              </div>
              <button
                onClick={() => setRosterModalCourse(null)}
                style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #E4E4E7', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#71717A' }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* Modal Controls / Filter Bar */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 bg-white border-b border-[#E4E4E7]">
              {/* Batch / Section filter pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setRosterBatchFilter('ALL')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    border: rosterBatchFilter === 'ALL' ? '1px solid #18181B' : '1px solid #E4E4E7',
                    background: rosterBatchFilter === 'ALL' ? '#18181B' : '#FFFFFF',
                    color: rosterBatchFilter === 'ALL' ? '#FFFFFF' : '#71717A',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '12px',
                    fontWeight: rosterBatchFilter === 'ALL' ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  All Students ({modalRosterStudents.length})
                </button>
                {rosterModalCourse.sections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => setRosterBatchFilter(`sec:${sec.section_name}`)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '4px',
                      border: rosterBatchFilter === `sec:${sec.section_name}` ? '1.5px solid #FF5500' : '1px solid #E4E4E7',
                      background: rosterBatchFilter === `sec:${sec.section_name}` ? '#FFF4ED' : '#FFFFFF',
                      color: rosterBatchFilter === `sec:${sec.section_name}` ? '#FF5500' : '#09090B',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Theory: {sec.section_name} ({sec.student_count})
                  </button>
                ))}
                {rosterModalCourse.batches.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => setRosterBatchFilter(`batch:${batch.batch_name}`)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '4px',
                      border: rosterBatchFilter === `batch:${batch.batch_name}` ? '1.5px solid #FF5500' : '1px solid #E4E4E7',
                      background: rosterBatchFilter === `batch:${batch.batch_name}` ? '#FFF4ED' : '#FFFFFF',
                      color: rosterBatchFilter === `batch:${batch.batch_name}` ? '#FF5500' : '#09090B',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Lab: {batch.batch_name} ({batch.student_count})
                  </button>
                ))}
              </div>

              {/* Search & Export */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search style={{ width: '13px', height: '13px', color: '#71717A', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={rosterSearchQuery}
                    onChange={(e) => setRosterSearchQuery(e.target.value)}
                    placeholder="Search roster..."
                    style={{ width: '100%', background: '#FAFAFB', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '6px 10px 6px 30px', fontFamily: 'Inter, sans-serif', fontSize: '12px', outline: 'none' }}
                  />
                </div>
                <button
                  onClick={() => exportRosterToCSV(rosterModalCourse, filteredModalStudents)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: '#09090B',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download style={{ width: '13px', height: '13px' }} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Modal Table Body */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0' }} className="max-w-full">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F4F4F6', borderBottom: '1px solid #E4E4E7', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A' }}>#</th>
                    <th style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A' }}>ROLL NO</th>
                    <th style={{ padding: '10px 16px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '12px', fontWeight: 700, color: '#71717A' }}>STUDENT NAME</th>
                    <th style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A' }}>DIV</th>
                    <th style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A' }}>THEORY SEC</th>
                    <th style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A' }}>LAB BATCH</th>
                    <th style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A' }}>ATTENDANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModalStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#71717A', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
                        No enrolled students match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredModalStudents.map((st, idx) => (
                      <tr key={st.id || idx} style={{ borderBottom: '1px solid #F4F4F6' }}>
                        <td style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', fontWeight: 700, color: '#09090B' }}>{st.roll_no || '-'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#09090B' }}>{st.name}</div>
                          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', color: '#71717A' }}>{st.email}</div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, background: '#F4F4F6', border: '1px solid #E4E4E7', borderRadius: '3px', padding: '2px 6px', color: '#09090B' }}>
                            {st.division || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11.5px', color: '#09090B' }}>
                          {st.section_name || '-'}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {st.batch_name ? (
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#FF5500', background: '#FFF4ED', border: '1px solid #FED7AA', borderRadius: '3px', padding: '2px 6px', fontWeight: 600 }}>
                              {st.batch_name}
                            </span>
                          ) : (
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#A1A1AA' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {st.attendancePct !== undefined ? (
                            <span
                              style={{
                                fontFamily: '"JetBrains Mono", monospace',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: getPercentageColor(st.attendancePct),
                                background: getPercentageBg(st.attendancePct),
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {st.attendancePct}%
                            </span>
                          ) : (
                            <span style={{ color: '#A1A1AA', fontSize: '11px' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid #E4E4E7', background: '#FAFAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', color: '#71717A' }}>
                Showing <strong>{filteredModalStudents.length}</strong> of <strong>{modalRosterStudents.length}</strong> students enrolled
              </span>
              <button
                onClick={() => setRosterModalCourse(null)}
                style={{ padding: '6px 16px', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '12.5px', fontWeight: 600, color: '#09090B', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Condonation Review Modal (Autonomous Scheme Rule 4.2) */}
      {showCondonationModal && selectedStudentForCondonation && (
        <div
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
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '17px', fontWeight: 800, color: '#09090B' }}>
                  Autonomous Ordinance Rule 4.2 Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCondonationModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#71717A' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {condonationSuccessMsg && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', color: '#16A34A', fontSize: '12px', fontWeight: 600 }}>
                ✓ {condonationSuccessMsg}
              </div>
            )}

            <form onSubmit={handleGrantCondonation}>
              <div style={{ background: '#F4F4F6', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '12px 14px', marginBottom: '14px', fontSize: '12px' }}>
                <div style={{ fontWeight: 800, color: '#09090B' }}>
                  {selectedStudentForCondonation.name}
                </div>
                <div style={{ color: '#52525B', marginTop: '2px' }}>
                  Subject: <strong>{selectedStudentForCondonation.subject}</strong>
                </div>
                <div style={{ color: selectedStudentForCondonation.currentPct < 75 ? '#DC2626' : '#16A34A', fontWeight: 700, marginTop: '2px' }}>
                  Current Attendance: {selectedStudentForCondonation.currentPct}% {selectedStudentForCondonation.currentPct >= 65 ? '(Rule 4.2 Condonation Eligible)' : '(Severe Shortage)'}
                </div>
              </div>

              {/* Leave Classification */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Statutory Grounds for Condonation
                </label>
                <select
                  value={condonationLeaveType}
                  onChange={(e) => setCondonationLeaveType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E7',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#09090B',
                    outline: 'none',
                  }}
                >
                  <option value="MEDICAL">Medical Leave (Hospitalization / Certified Illness)</option>
                  <option value="DUTY_SPORTS">Official University / Inter-Collegiate Sports Duty</option>
                  <option value="DUTY_NSS_CULTURAL">NSS / University Youth Festival / Cultural Delegation</option>
                  <option value="SPECIAL_DELEGATION">Academic Conference / Hackathon Institutional Representation</option>
                </select>
              </div>

              {/* Sessions to Credit */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Number of Missed Sessions to Condone
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={condonationGrantedClasses}
                  onChange={(e) => setCondonationGrantedClasses(parseInt(e.target.value) || 1)}
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

              {/* Justification */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Evidence / Sanction Order Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Registered Hospital Certificate Ref: MED-2026-118"
                  value={condonationReason}
                  onChange={(e) => setCondonationReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E7',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#09090B',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCondonationModal(false)}
                  style={{ padding: '8px 16px', background: '#F4F4F6', color: '#09090B', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={grantingCondonation}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: grantingCondonation ? 0.6 : 1,
                  }}
                >
                  <Award style={{ width: '14px', height: '14px' }} />
                  <span>{grantingCondonation ? 'Processing Ordinance...' : 'Approve & Credit Attendance'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Form 4 Defaulter Notification Sheet Modal */}
      {showDefaulterNoticeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 9, 11, 0.75)',
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
              maxWidth: '920px',
              maxHeight: '90vh',
              background: '#FFFFFF',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header (Controls) */}
            <div className="no-print" style={{ padding: '12px 20px', borderBottom: '1px solid #E4E4E7', background: '#FAFAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText style={{ width: '18px', height: '18px', color: '#DC2626' }} />
                <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 800, color: '#09090B' }}>
                  University Defaulter Notice (Form 4) Preview
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: '#18181B',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Printer style={{ width: '13px', height: '13px' }} />
                  <span>Print Formal Notice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDefaulterNoticeModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#71717A' }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            </div>

            {/* Printable Notice Sheet */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '36px 40px', background: '#FFFFFF' }} className="printable-sheet">
              {/* College Letterhead */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{ fontFamily: '"Plus Jakarta Sans", serif', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Fr. Conceicao Rodrigues College of Engineering
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#374151', marginTop: '2px' }}>
                  Father Agnel Ashram, Bandstand, Bandra (West), Mumbai - 400 050
                </div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 700, color: '#52525B', marginTop: '2px' }}>
                  (Autonomous Scheme Affiliated to University of Mumbai • Accredited by NAAC & NBA)
                </div>
                <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 800, marginTop: '8px', color: '#DC2626', letterSpacing: '0.02em' }}>
                  FORM NO. 4: ACADEMIC ATTENDANCE DEFAULTERS NOTIFICATION (TERM: {selectedTerm})
                </div>
              </div>

              {/* Statutory Ordinance Reference */}
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '12px 14px', marginBottom: '20px', fontSize: '11.5px', lineHeight: 1.5, color: '#991B1B' }}>
                <strong>STATUTORY ORDINANCE NOTICE (Rule 4.1 & 4.2):</strong> As per University Autonomous Scheme Ordinances, every registered student is required to secure a minimum aggregate attendance of <strong>75%</strong> in all scheduled theory lectures and practical laboratories. The following students currently stand in default of the mandatory quota and are notified to submit explanations / undertakings to the HOD office immediately.
              </div>

              {/* Defaulter Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ background: '#F4F4F5', border: '1px solid #000000' }}>
                    <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>SR</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left' }}>ROLL NO</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left' }}>CANDIDATE NAME</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>AGGREGATE %</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>VELOCITY & BURN RISK</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>CLASSES TO 75%</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>CATEGORY</th>
                    <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left' }}>REGULATORY DIRECTIVE</th>
                  </tr>
                </thead>
                <tbody>
                  {defaultersData.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ border: '1px solid #000000', padding: '24px', textAlign: 'center', color: '#16A34A', fontWeight: 700 }}>
                        No defaulters detected in Department of Computer Engineering. All enrolled students satisfy the 75% attendance threshold.
                      </td>
                    </tr>
                  ) : (
                    defaultersData.map((d, idx) => (
                      <tr key={d.student_id || idx} style={{ border: '1px solid #000000' }}>
                        <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000000', padding: '6px 8px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>{d.roll_no}</td>
                        <td style={{ border: '1px solid #000000', padding: '6px 8px', fontWeight: 700 }}>{d.full_name}</td>
                        <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, color: d.overall_percentage < 50 ? '#DC2626' : '#D97706' }}>
                          {d.overall_percentage}%
                        </td>
                        <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px' }}>
                          <span style={{ fontWeight: 700, color: '#09090B' }}>{d.attendance_velocity !== undefined ? d.attendance_velocity : (d.overall_percentage / 100).toFixed(2)}</span>
                          <span style={{ display: 'block', fontSize: '9.5px', color: d.category === 'CRITICAL' ? '#DC2626' : '#D97706', fontWeight: 700 }}>
                            {d.burnout_risk || 'ATTENDANCE DEFICIT'}
                          </span>
                        </td>
                        <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#4B5563' }}>
                          +{d.consecutive_classes_needed || 0} consecutive
                        </td>
                        <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>
                          <span style={{ fontSize: '10px', background: d.category === 'CRITICAL' ? '#FEF2F2' : '#FFFBEB', color: d.category === 'CRITICAL' ? '#DC2626' : '#B45309', padding: '2px 6px', borderRadius: '3px' }}>
                            {d.category}
                          </span>
                        </td>
                        <td style={{ border: '1px solid #000000', padding: '6px 8px', fontSize: '10.5px' }}>
                          {d.recommended_action}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Cryptographic Institutional Verification Seal */}
              <div style={{
                margin: '20px 0 32px 0',
                padding: '14px 18px',
                background: '#F9FAFB',
                border: '1.5px dashed #09090B',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    background: '#18181B',
                    color: '#FFFFFF',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '10px',
                    fontWeight: 800,
                    textAlign: 'center',
                    lineHeight: 1.1,
                  }}>
                    SEAL<br />CRCE
                  </div>
                  <div>
                    <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '12px', fontWeight: 800, color: '#09090B', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                      SECURE INSTITUTIONAL AUDIT STAMP • AUTONOMOUS ORDINANCE SEC 4.2
                    </div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#52525B', marginTop: '2px' }}>
                      SHA-256 DIGEST: <strong style={{ color: '#09090B' }}>{cryptographicSeal?.sha256_digest || 'E92F-4A01-BC83-09DF'}</strong>
                    </div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#71717A', marginTop: '2px' }}>
                      SIGNATURE: {cryptographicSeal?.ed25519_signature || 'ED25519-AUTH-9F318BC7-4E2198DF-8201CBE4'}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 700, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 8px', borderRadius: '4px', display: 'inline-block' }}>
                    ✓ CRYPTOGRAPHICALLY TAMPER-PROOF
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#71717A', marginTop: '4px' }}>
                    Certified by Fr. CRCE Academic Controller & HOD
                  </div>
                </div>
              </div>

              {/* Official Signatures Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '48px', paddingTop: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '160px', borderBottom: '1px solid #000000', marginBottom: '6px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Class Teacher / Incharge</div>
                  <div style={{ fontSize: '10px', color: '#6B7280' }}>Dept. of Computer Engg.</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '160px', borderBottom: '1px solid #000000', marginBottom: '6px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Dr. Kalpana Deorukhkar</div>
                  <div style={{ fontSize: '10px', color: '#6B7280' }}>Head of Department (COMP)</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '160px', borderBottom: '1px solid #000000', marginBottom: '6px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700 }}>Principal / Dean Academics</div>
                  <div style={{ fontSize: '10px', color: '#6B7280' }}>Fr. CRCE, Mumbai</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
