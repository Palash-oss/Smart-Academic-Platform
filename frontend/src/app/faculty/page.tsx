'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Search,
  BookOpen,
  Plus,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
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

interface StudentOverview {
  student_id: string;
  student_name: string;
  student_email: string;
  department_code: string;
  division_name: string;
  division_label: string;
  overall_percentage: number;
  overall_risk: boolean;
  total_subjects: number;
  subjects_at_risk: number;
  subjects: SubjectRecord[];
}

interface FacultyAssignedSection {
  id: string;
  section_name: string;
  student_count: number;
  division: string;
  component_type: string;
}

interface FacultyAssignedBatch {
  id: string;
  batch_name: string;
  student_count: number;
  section_name: string;
  division: string;
  batch_label: string;
  component_type: string;
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
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [teachingLoad, setTeachingLoad] = useState<FacultyTeachingLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivisionTab, setSelectedDivisionTab] = useState<string>('ALL');
  const [riskFilterOnly, setRiskFilterOnly] = useState(false);
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFacultyData();
  }, []);

  const loadFacultyData = async () => {
    setLoading(true);
    try {
      const [overviewRes, loadRes] = await Promise.all([
        fetchWithAuth('/api/attendance/faculty/overview'),
        fetchWithAuth('/api/v1/faculty/my-subjects?academic_term=2026-27-SEM5'),
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

  const availableDivisions = Array.from(new Set(students.map((s) => s.division_label))).sort();
  const departmentCode = students.length > 0 ? students[0].department_code : 'DEPT';

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDivision = selectedDivisionTab === 'ALL' || student.division_label === selectedDivisionTab;
    const matchesRisk = riskFilterOnly ? student.overall_risk : true;
    return matchesSearch && matchesDivision && matchesRisk;
  });

  const totalStudents = students.length;
  const atRiskCount = students.filter((s) => s.overall_risk).length;
  const goodCount = totalStudents - atRiskCount;

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

  return (
    <div style={S.page}>
      <Navbar />

      <main style={S.main}>

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
            onMouseEnter={e => { e.currentTarget.style.background = '#E64D00'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FF5500'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Plus style={{ width: '15px', height: '15px' }} />
            <span>Mark Attendance</span>
          </Link>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Total Enrolled', value: totalStudents, icon: <Users style={{ width: '18px', height: '18px', color: '#09090B' }} />, iconBg: '#F4F4F6', color: '#09090B' },
            { label: 'Good Standing', value: goodCount, icon: <CheckCircle2 style={{ width: '18px', height: '18px', color: '#16A34A' }} />, iconBg: '#F0FDF4', color: '#16A34A' },
            { label: 'At Risk (<75%)', value: atRiskCount, icon: <AlertTriangle style={{ width: '18px', height: '18px', color: '#DC2626' }} />, iconBg: '#FEF2F2', color: '#DC2626' },
            { label: 'Courses Teaching', value: teachingLoad?.total_courses ?? 0, icon: <BookOpen style={{ width: '18px', height: '18px', color: '#FF5500' }} />, iconBg: '#FFF4ED', color: '#FF5500' },
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
              </div>
              <div style={{ display: 'flex', gap: '16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#71717A' }}>
                <span>INSTRUCTOR: <strong style={{ color: '#09090B', fontWeight: 700 }}>{teachingLoad.faculty_name}</strong></span>
                <span>STUDENTS: <strong style={{ color: '#09090B', fontWeight: 700 }}>{teachingLoad.total_students}</strong></span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {teachingLoad.courses.map((course) => (
                <div key={course.offering_id} style={{ background: '#FAFAFB', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#09090B', background: '#FFFFFF', padding: '2px 6px', border: '1px solid #E4E4E7', borderRadius: '3px', display: 'inline-block', marginBottom: '4px' }}>{course.course_code}</span>
                      <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 700, color: '#09090B', lineHeight: 1.3 }}>{course.course_name}</h3>
                    </div>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 600, color: '#52525B', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                      {course.delivery_mode}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {course.sections.map((sec) => (
                      <span key={sec.id} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#09090B', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '4px', padding: '3px 8px' }}>
                        Theory: {sec.section_name} ({sec.student_count})
                      </span>
                    ))}
                    {course.batches.map((batch) => (
                      <span key={batch.id} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#FF5500', background: '#FFF4ED', border: '1px solid #FED7AA', borderRadius: '4px', padding: '3px 8px' }}>
                        Lab: {batch.batch_name} ({batch.student_count})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter / Search Bar */}
        <div style={{ ...S.card, padding: '14px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Division Tabs */}
          <div style={{ display: 'flex', gap: '6px', flex: 1, flexWrap: 'wrap' }}>
            {['ALL', ...availableDivisions].map((div) => {
              const count = div === 'ALL' ? totalStudents : students.filter((s) => s.division_label === div).length;
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
              placeholder="Search students..."
              style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px', padding: '7px 12px 7px 32px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#09090B', outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#FF5500'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; }}
            />
          </div>

          {/* Risk Filter */}
          <button
            onClick={() => setRiskFilterOnly(!riskFilterOnly)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
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
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isExpanded = expandedStudentIds.has(student.student_id);
              const pctColor = getPercentageColor(student.overall_percentage);
              return (
                <div key={student.student_id} style={{ ...S.card, overflow: 'hidden', transition: 'all 0.15s ease' }}>
                  {/* Student Row */}
                  <div
                    onClick={() => toggleStudentExpanded(student.student_id)}
                    style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', cursor: 'pointer', userSelect: 'none', flexWrap: 'wrap' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Avatar */}
                      <div style={{ width: '36px', height: '36px', background: student.overall_risk ? '#FEF2F2' : '#F4F4F6', border: `1px solid ${student.overall_risk ? '#FECACA' : '#E4E4E7'}`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '14px', color: student.overall_risk ? '#DC2626' : '#09090B' }}>
                          {student.student_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', fontWeight: 700, color: '#09090B' }}>{student.student_name}</span>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 700, color: '#09090B', background: '#F4F4F6', border: '1px solid #E4E4E7', borderRadius: '3px', padding: '1px 6px' }}>{student.division_label}</span>
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

                      {/* Risk Badge */}
                      {student.overall_risk ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '3px 8px' }}>
                          <AlertTriangle style={{ width: '11px', height: '11px' }} />
                          At Risk
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 600, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '4px', padding: '3px 8px' }}>
                          <CheckCircle2 style={{ width: '11px', height: '11px' }} />
                          Good Standing
                        </span>
                      )}

                      {isExpanded
                        ? <ChevronDown style={{ width: '15px', height: '15px', color: '#71717A' }} />
                        : <ChevronRight style={{ width: '15px', height: '15px', color: '#71717A' }} />}
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
                          return (
                            <div
                              key={sub.id}
                              style={{ background: '#FFFFFF', border: `1px solid ${subBorder}`, borderRadius: '6px', padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                <h4 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '13px', fontWeight: 700, color: '#09090B', lineHeight: 1.35 }}>{sub.subject}</h4>
                                <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '15px', fontWeight: 800, color: subColor, flexShrink: 0 }}>{sub.percentage}%</span>
                              </div>
                              {/* Progress bar */}
                              <div style={{ height: '4px', background: '#E4E4E7', borderRadius: '99px', overflow: 'hidden', marginBottom: '8px' }}>
                                <div style={{ height: '100%', width: `${Math.min(sub.percentage, 100)}%`, background: subColor, borderRadius: '99px' }} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A' }}>{sub.attended_classes} / {sub.total_classes} classes</span>
                                {sub.is_at_risk && (
                                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10.5px', fontWeight: 700, color: '#DC2626' }}>
                                    +{sub.classes_needed_to_clear_risk} needed
                                  </span>
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
    </div>
  );
}
