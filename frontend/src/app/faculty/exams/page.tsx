'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, BookOpen, Users, CheckCircle2, Clock, Lock, ChevronRight, Layers, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { fetchFacultyCourses, FacultyCourseOfferingItem } from '@/lib/exams';
import { getStoredUser } from '@/lib/api';

export default function FacultyExamsHubPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<FacultyCourseOfferingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || (user.role !== 'FACULTY' && user.role !== 'ADMIN')) {
      router.push('/login');
      return;
    }

    fetchFacultyCourses()
      .then((data) => {
        setCourses(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load teaching courses.');
        setLoading(false);
      });
  }, [router]);

  const filteredCourses = courses.filter((c) =>
    c.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.course_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lockedCount = courses.filter((c) => c.is_locked).length;
  const activeCount = courses.length - lockedCount;
  const totalStudents = courses.reduce((acc, c) => acc + c.student_count, 0);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] pb-24">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#E4E4E7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#FFF4ED] text-[#FF5500] border border-[#FED7AA]">
                  Autonomous Scheme FRCRCE-3-26
                </span>
                <span className="font-mono text-[10px] font-bold text-[#71717A]">
                  Exam Cell Continuous Evaluation
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#09090B] tracking-tight font-sans">
                Courses & Gradebook Hub
              </h1>
              <p className="text-sm text-[#71717A] mt-1 max-w-2xl">
                Configure your subject assessment scheme (ISE, MSE, Practical/Tutorial), enter marks with keyboard-speed spreadsheets, and generate automated NBA/NAAC CO-PO attainment reports.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-[#F4F4F6] p-2.5 rounded-lg border border-[#E4E4E7] flex-shrink-0">
              <div className="text-center px-3">
                <span className="block font-mono text-[11px] font-semibold text-[#71717A] uppercase">Subjects</span>
                <span className="font-mono text-xl font-extrabold text-[#09090B]">{courses.length}</span>
              </div>
              <div className="text-center px-3 border-x border-[#E4E4E7]">
                <span className="block font-mono text-[11px] font-semibold text-[#71717A] uppercase">Active</span>
                <span className="font-mono text-xl font-extrabold text-[#FF5500]">{activeCount}</span>
              </div>
              <div className="text-center px-3">
                <span className="block font-mono text-[11px] font-semibold text-[#71717A] uppercase">Students</span>
                <span className="font-mono text-xl font-extrabold text-[#09090B]">{totalStudents}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by course code or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
            />
            <BookOpen className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-[#71717A]">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Verification Open
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium ml-3">
              <span className="w-2 h-2 rounded-full bg-[#71717A]" /> Locked
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-3 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-[#71717A]">Loading your assigned course offerings...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Course Cards Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((c) => (
              <div
                key={c.offering_id}
                className="bg-white rounded-xl border border-[#E4E4E7] hover:border-[#FF5500]/50 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5">
                  {/* Card Header Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-extrabold text-[#FF5500] bg-[#FFF4ED] px-2.5 py-0.5 rounded border border-[#FED7AA]">
                      {c.course_code}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#71717A] bg-[#F4F4F6] px-2 py-0.5 rounded uppercase">
                      Sem {c.semester} · {c.academic_term}
                    </span>
                  </div>

                  {/* Course Title */}
                  <h3 className="font-bold text-base text-[#09090B] group-hover:text-[#FF5500] transition-colors leading-snug mb-3">
                    {c.course_name}
                  </h3>

                  {/* Metadata Chips */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs py-1 border-b border-[#F4F4F6]">
                      <span className="text-[#71717A]">Delivery Scheme:</span>
                      <span className="font-mono font-medium text-[#27272A]">{c.delivery_mode.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1 border-b border-[#F4F4F6]">
                      <span className="text-[#71717A]">Enrolled Class Size:</span>
                      <span className="font-mono font-bold text-[#09090B]">{c.student_count} Students</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-[#71717A]">Gradebook Status:</span>
                      {c.is_locked ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#4B5563] bg-[#F3F4F6] px-2 py-0.5 rounded">
                          <Lock className="w-3 h-3 text-[#6B7280]" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#DCFCE7]">
                          <Clock className="w-3 h-3 text-[#16A34A]" /> Open for Review
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="px-5 py-3.5 bg-[#FAFAFA] border-t border-[#E4E4E7] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#3F3F46]">
                    Assessment & OBE Console
                  </span>
                  <Link
                    href={`/faculty/exams/${c.offering_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FF5500] hover:text-[#EA580C] transition-colors"
                  >
                    <span>Open Workspace</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}

            {filteredCourses.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-xl border border-dashed border-[#E4E4E7]">
                <FileSpreadsheet className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
                <h4 className="text-base font-bold text-[#09090B]">No course offerings match your search</h4>
                <p className="text-xs text-[#71717A] mt-1">Try searching by a different course name or code.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
