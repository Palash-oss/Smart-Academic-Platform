'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { Calendar, CheckSquare, Square, Save, CheckCircle2, ArrowLeft, Users, Filter } from 'lucide-react';
import Link from 'next/link';

interface Student {
  student_id: string;
  student_name: string;
  student_email: string;
  overall_percentage: number;
  overall_risk: boolean;
}

const SUBJECTS = [
  "Data Structures & Algorithms",
  "Operating Systems",
  "Database Management Systems",
  "Computer Networks"
];

export default function MarkAttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [sessionDate, setSessionDate] = useState('2026-08-19');
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultBanner, setResultBanner] = useState<{
    subject: string;
    total: number;
    present: number;
    absent: number;
  } | null>(null);

  useEffect(() => {
    loadEnrolledRoster();
  }, []);

  const loadEnrolledRoster = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/attendance/faculty/overview');
      if (res.ok) {
        const data: Student[] = await res.json();
        // Sort students alphabetically by name
        const sorted = data.sort((a, b) => a.student_name.localeCompare(b.student_name));
        setStudents(sorted);
        // Default all students as present
        setPresentStudentIds(new Set(sorted.map((s) => s.student_id)));
      }
    } catch (err) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoading(false);
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
          subject: selectedSubject,
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
                Live Session Attendance Marker
              </h1>
              <p className="text-xs text-subtle font-sans mt-0.5">
                Feature 2: Mark lecture session attendance to update Postgres database live
              </p>
            </div>
          </div>

          <span className="text-xs font-mono px-3 py-1.5 bg-surface border border-border rounded-lg text-paper">
            ENROLLED ROSTER: <strong>{students.length} STUDENTS</strong>
          </span>
        </div>

        {resultBanner && (
          <div className="p-4 bg-surface border-2 border-paper rounded-lg font-mono text-xs space-y-1 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-sm text-paper">
              <CheckCircle2 className="h-4 w-4 text-paper" />
              <span>Session Attendance Recorded Live in Postgres!</span>
            </div>
            <p className="text-subtle">
              Subject: <strong>{resultBanner.subject}</strong> | Total Session Roster: <strong>{resultBanner.total}</strong> | Present: <strong className="text-paper">{resultBanner.present}</strong> | Absent: <strong className="text-paper">{resultBanner.absent}</strong>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Controls: Subject & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface p-5 border border-border rounded-lg shadow-xs">
            <div>
              <label className="block text-xs font-mono text-subtle uppercase mb-1.5">SELECT SUBJECT</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-ink border border-border focus:border-paper rounded-lg px-3 py-2 text-xs font-sans font-semibold text-paper focus:outline-none"
              >
                {SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-subtle uppercase mb-1.5">SESSION DATE</label>
              <div className="relative">
                <Calendar className="h-4 w-4 absolute left-3 top-2.5 text-subtle" />
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full bg-ink border border-border focus:border-paper rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-paper focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Student Roster Checkbox List */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 bg-ink border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif text-sm font-semibold text-paper">
                <Users className="h-4 w-4 text-paper" />
                <span>Class Roster ({presentStudentIds.size} / {students.length} Present)</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => toggleAll(true)}
                  className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-border rounded text-subtle hover:text-paper"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={() => toggleAll(false)}
                  className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-border rounded text-subtle hover:text-paper"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="divide-y divide-border max-h-[450px] overflow-y-auto font-sans">
              {loading ? (
                <div className="p-8 text-center text-subtle font-mono text-xs">
                  Loading class roster from database...
                </div>
              ) : students.length === 0 ? (
                <div className="p-8 text-center text-subtle font-mono text-xs">
                  No enrolled students found. Use Bulk Roster Import first.
                </div>
              ) : (
                students.map((st) => {
                  const isPresent = presentStudentIds.has(st.student_id);
                  return (
                    <div
                      key={st.student_id}
                      onClick={() => toggleStudentPresent(st.student_id)}
                      className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isPresent ? 'bg-surface hover:bg-surface-hover' : 'bg-ink/50 hover:bg-ink'
                      }`}
                    >
                      <div className="flex items-center gap-3">
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
              <span>{submitting ? 'Submitting Session...' : 'Submit Session Attendance'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
