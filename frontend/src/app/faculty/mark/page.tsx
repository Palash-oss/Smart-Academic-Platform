'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { Calendar, CheckSquare, Square, Save, CheckCircle2, ArrowLeft, Users, Search, Building2, BookOpen } from 'lucide-react';
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

export default function MarkAttendancePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptCode, setSelectedDeptCode] = useState('COMP');
  const [selectedDivName, setSelectedDivName] = useState('A');
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseName, setSelectedCourseName] = useState('');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sessionDate, setSessionDate] = useState('2026-08-24');
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [resultBanner, setResultBanner] = useState<{
    subject: string;
    total: number;
    present: number;
    absent: number;
  } | null>(null);

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

  // 3. Fetch Students when Department or Division changes
  useEffect(() => {
    if (selectedDeptCode && selectedDivName) {
      loadStudents(selectedDeptCode, selectedDivName);
    }
  }, [selectedDeptCode, selectedDivName]);

  const loadDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const res = await fetchWithAuth('/api/attendance/faculty/departments');
      if (res.ok) {
        const data: Department[] = await res.json();
        setDepartments(data);
        if (data.length > 0) {
          setSelectedDeptCode(data[0].code);
          if (data[0].divisions.length > 0) {
            setSelectedDivName(data[0].divisions[0].name);
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
      const res = await fetchWithAuth(`/api/attendance/faculty/courses?dept_code=${deptCode}`);
      if (res.ok) {
        const data: Course[] = await res.json();
        setCourses(data);
        if (data.length > 0) {
          setSelectedCourseName(data[0].full_label);
        }
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadStudents = async (deptCode: string, divName: string) => {
    setLoadingStudents(true);
    try {
      const res = await fetchWithAuth(`/api/attendance/faculty/students?dept_code=${deptCode}&div_name=${divName}`);
      if (res.ok) {
        const data: Student[] = await res.json();
        setStudents(data);
        // Default all students to Present
        setPresentStudentIds(new Set(data.map((s) => s.student_id)));
      }
    } catch (err) {
      console.error('Failed to load student roster:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const currentDeptObj = departments.find((d) => d.code === selectedDeptCode);
  const availableDivisions = currentDeptObj ? currentDeptObj.divisions : [];

  const handleDeptChange = (newDeptCode: string) => {
    setSelectedDeptCode(newDeptCode);
    const newDeptObj = departments.find((d) => d.code === newDeptCode);
    if (newDeptObj && newDeptObj.divisions.length > 0) {
      setSelectedDivName(newDeptObj.divisions[0].name);
    }
  };

  const toggleStudentPresent = (id: string) => {
    const nextSet = new Set(presentStudentIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    setPresentStudentIds(nextSet);
  };

  const toggleAll = (selectPresent: boolean) => {
    if (selectPresent) {
      setPresentStudentIds(new Set(students.map((s) => s.student_id)));
    } else {
      setPresentStudentIds(new Set());
    }
  };

  const filteredStudents = students.filter((st) =>
    st.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.student_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResultBanner(null);

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
          absent: data.absent_count
        });
      }
    } catch (err) {
      console.error('Failed to submit attendance session:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex flex-col font-sans text-paper">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Navigation back to Ledger */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/faculty"
              className="p-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-paper transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-wide text-paper">
                Live Lecture Attendance Marker
              </h1>
              <p className="text-xs text-subtle font-sans mt-0.5">
                Department & Division Scoped Live Session Attendance Register
              </p>
            </div>
          </div>

          <span className="text-xs font-mono px-3 py-1.5 bg-surface border border-border rounded-lg text-paper font-semibold">
            SELECTED CLASS: {selectedDeptCode}-{selectedDivName} ({students.length} STUDENTS)
          </span>
        </div>

        {resultBanner && (
          <div className="p-4 bg-surface border-2 border-paper rounded-lg font-mono text-xs space-y-1 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-sm text-paper">
              <CheckCircle2 className="h-4 w-4 text-paper" />
              <span>Session Attendance Successfully Recorded Live in Postgres!</span>
            </div>
            <p className="text-subtle">
              Course: <strong>{resultBanner.subject}</strong> | Total Class Roster: <strong>{resultBanner.total}</strong> | Present: <strong className="text-paper">{resultBanner.present}</strong> | Absent: <strong className="text-paper">{resultBanner.absent}</strong>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Controls: Department, Division, Course & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-surface p-5 border border-border rounded-lg shadow-xs">
            {/* Department Dropdown */}
            <div>
              <label className="block text-xs font-mono text-subtle uppercase mb-1.5 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-paper" />
                <span>DEPARTMENT / BRANCH</span>
              </label>
              <select
                value={selectedDeptCode}
                onChange={(e) => handleDeptChange(e.target.value)}
                disabled={loadingDepartments}
                className="w-full bg-ink border border-border focus:border-paper rounded-lg px-3 py-2 text-xs font-sans font-semibold text-paper focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Division Dropdown */}
            <div>
              <label className="block text-xs font-mono text-subtle uppercase mb-1.5 flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-paper" />
                <span>DIVISION / CLASS</span>
              </label>
              <select
                value={selectedDivName}
                onChange={(e) => setSelectedDivName(e.target.value)}
                disabled={availableDivisions.length === 0}
                className="w-full bg-ink border border-border focus:border-paper rounded-lg px-3 py-2 text-xs font-sans font-semibold text-paper focus:outline-none"
              >
                {availableDivisions.map((div) => (
                  <option key={div.name} value={div.name}>
                    Division {div.name} ({div.student_count} Capacity)
                  </option>
                ))}
              </select>
            </div>

            {/* Course Dropdown */}
            <div>
              <label className="block text-xs font-mono text-subtle uppercase mb-1.5 flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 text-paper" />
                <span>ASSIGNED COURSE</span>
              </label>
              <select
                value={selectedCourseName}
                onChange={(e) => setSelectedCourseName(e.target.value)}
                disabled={loadingCourses || courses.length === 0}
                className="w-full bg-ink border border-border focus:border-paper rounded-lg px-3 py-2 text-xs font-sans font-semibold text-paper focus:outline-none truncate"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.full_label}>
                    {c.full_label}
                  </option>
                ))}
              </select>
            </div>

            {/* Session Date Picker */}
            <div>
              <label className="block text-xs font-mono text-subtle uppercase mb-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-paper" />
                <span>SESSION DATE</span>
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full bg-ink border border-border focus:border-paper rounded-lg px-3 py-2 text-xs font-mono text-paper focus:outline-none"
              />
            </div>
          </div>

          {/* Student Roster Checkbox List */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
            {/* Header & Quick Filter */}
            <div className="p-4 bg-ink border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-serif text-sm font-semibold text-paper">
                <Users className="h-4 w-4 text-paper" />
                <span>
                  {selectedDeptCode}-{selectedDivName} Class Roster ({presentStudentIds.size} / {students.length} Present)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-subtle" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student name..."
                    className="bg-surface border border-border focus:border-paper rounded-lg pl-8 pr-3 py-1.5 text-xs text-paper placeholder-subtle focus:outline-none w-48"
                  />
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded text-subtle hover:text-paper"
                  >
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded text-subtle hover:text-paper"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Roster Table List */}
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto font-sans">
              {loadingStudents ? (
                <div className="p-8 text-center text-subtle font-mono text-xs">
                  Loading class roster for Division {selectedDeptCode}-{selectedDivName}...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-subtle font-mono text-xs">
                  No students found matching your search filter.
                </div>
              ) : (
                filteredStudents.map((st, idx) => {
                  const isPresent = presentStudentIds.has(st.student_id);
                  return (
                    <div
                      key={st.student_id}
                      onClick={() => toggleStudentPresent(st.student_id)}
                      className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isPresent ? 'bg-surface hover:bg-surface-hover' : 'bg-ink/60 hover:bg-ink'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-subtle w-6 shrink-0">{idx + 1}.</span>
                        {isPresent ? (
                          <CheckSquare className="h-5 w-5 text-paper shrink-0" />
                        ) : (
                          <Square className="h-5 w-5 text-subtle shrink-0" />
                        )}
                        <div>
                          <p className={`text-xs font-semibold ${isPresent ? 'text-paper' : 'text-subtle'}`}>
                            {st.student_name}
                          </p>
                          <p className="text-[10px] font-mono text-subtle">{st.student_email}</p>
                        </div>
                      </div>

                      <div className="font-mono text-xs">
                        <span className={`px-2.5 py-1 rounded border uppercase text-[10px] font-bold ${
                          isPresent 
                            ? 'bg-paper text-ink border-paper' 
                            : 'bg-ink text-subtle border-border'
                        }`}>
                          {isPresent ? 'PRESENT' : 'ABSENT'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || students.length === 0}
              className="px-6 py-3 bg-paper text-ink font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm disabled:opacity-40 shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>{submitting ? 'Recording Live Session...' : `Submit Attendance for ${selectedDeptCode}-${selectedDivName}`}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
