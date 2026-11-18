'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, BookOpen, CheckCircle2, Clock, ShieldCheck, AlertCircle, BarChart3, TrendingUp } from 'lucide-react';
import { fetchStudentGrades, StudentCourseGradeSummary } from '@/lib/exams';
import { getStoredUser } from '@/lib/api';

export default function StudentGradesPage() {
  const router = useRouter();
  const [grades, setGrades] = useState<StudentCourseGradeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'STUDENT') {
      router.push('/login');
      return;
    }

    fetchStudentGrades()
      .then((data) => {
        setGrades(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load grade report.');
        setLoading(false);
      });
  }, [router]);

  const totalObtained = grades.reduce((acc, g) => acc + g.total_marks_obtained, 0);
  const totalMax = grades.reduce((acc, g) => acc + g.total_max_marks, 0);
  const overallAverage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] pb-24">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#E4E4E7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#FFF4ED] text-[#FF5500] border border-[#FED7AA]">
                  Autonomous Evaluation
                </span>
                <span className="font-mono text-[10px] font-bold text-[#71717A]">
                  Continuous Assessment Record
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#09090B] tracking-tight font-sans">
                My Academic Performance & Grades
              </h1>
              <p className="text-sm text-[#71717A] mt-1 max-w-xl">
                Verified marks record for Theory In-Semester Evaluations (ISE), Mid-Semester Exams (MSE), and Laboratory submissions.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex-shrink-0">
              <div className="text-center px-2">
                <span className="block font-mono text-[10px] font-bold text-[#64748B] uppercase">Total Marks</span>
                <span className="font-mono text-xl font-extrabold text-[#0F172A]">
                  {Math.round(totalObtained)} <span className="text-xs text-[#94A3B8]">/ {totalMax}</span>
                </span>
              </div>
              <div className="h-8 w-px bg-[#E2E8F0]" />
              <div className="text-center px-2">
                <span className="block font-mono text-[10px] font-bold text-[#64748B] uppercase">Aggregate</span>
                <span className="font-mono text-xl font-extrabold text-[#FF5500]">
                  {overallAverage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
        {loading && (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-3 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium text-[#71717A]">Fetching your grade records...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && grades.length === 0 && (
          <div className="py-16 text-center bg-white rounded-xl border border-dashed border-[#E4E4E7]">
            <BookOpen className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
            <h4 className="text-base font-bold text-[#09090B]">No evaluated marks published yet</h4>
            <p className="text-xs text-[#71717A] mt-1">
              Your subject instructors are currently evaluating assessment components. Marks will appear here once submitted.
            </p>
          </div>
        )}

        {!loading && !error && grades.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {grades.map((g) => (
              <div
                key={g.offering_id}
                className="bg-white rounded-xl border border-[#E4E4E7] p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-extrabold text-[#FF5500] bg-[#FFF4ED] px-2.5 py-0.5 rounded border border-[#FED7AA]">
                      {g.course_code}
                    </span>
                    <span className="font-mono text-xs font-extrabold text-[#09090B]">
                      {g.overall_percentage}%
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-[#09090B] mb-4">
                    {g.course_name}
                  </h3>

                  {/* Component Breakdown */}
                  <div className="space-y-2.5">
                    {g.components.map((c: any) => (
                      <div
                        key={c.component_type}
                        className="p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#1F2937]">{c.display_name}</div>
                          <div className="text-[10px] text-[#6B7280] font-mono mt-0.5">
                            Component Max: {c.max_marks} Marks
                          </div>
                        </div>

                        <div className="text-right">
                          {c.has_marks ? (
                            <span className="font-mono font-extrabold text-sm text-[#09090B]">
                              {c.obtained_marks}{' '}
                              <span className="text-[11px] text-[#6B7280]">/ {c.max_marks}</span>
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] text-[#9CA3AF] italic">
                              In Evaluation
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Total */}
                <div className="mt-5 pt-3 border-t border-[#F4F4F6] flex items-center justify-between text-xs">
                  <span className="text-[#71717A] font-medium">Total Evaluated Score</span>
                  <span className="font-mono font-extrabold text-sm text-[#FF5500]">
                    {g.total_marks_obtained} / {g.total_max_marks} Marks
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
