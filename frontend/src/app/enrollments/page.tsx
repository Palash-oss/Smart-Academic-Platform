'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  BookOpen,
  FlaskConical,
  GraduationCap,
  Users,
  LogOut,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  Clock,
  Layers,
  BookMarked,
  Building2,
  Globe,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  getStoredToken,
  getStoredUser,
  clearAuthSession,
  fetchWithAuth,
} from '@/lib/api';
import {
  MyEnrollmentsResponse,
  EnrollmentEntry,
  FacultySubjectsResponse,
  FacultyCourseItem,
  FacultySectionItem,
  FacultyBatchItem,
  TIER_COLORS,
  MODE_COLORS,
  MODE_LABELS,
} from '@/lib/allotment';

const ACADEMIC_TERMS = [
  '2026-27-SEM5',
  '2026-27-SEM6',
  '2025-26-SEM5',
  '2025-26-SEM6',
];

const TIER_ICONS = {
  CLASS: Layers,
  DEPARTMENT: Building2,
  INSTITUTE: Globe,
};

const TIER_LABELS = {
  CLASS: 'Class Core',
  DEPARTMENT: 'Department Elective',
  INSTITUTE: 'Institute Open Elective',
};

function FacultyBadge({ name }: { name: string }) {
  const isUnassigned = name === 'To be assigned';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border ${
        isUnassigned
          ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }`}
    >
      {isUnassigned ? (
        <Clock className="w-3 h-3 text-zinc-500" />
      ) : (
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
      )}
      {name}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Components (Architectural Light)
// ─────────────────────────────────────────────────────────────────────────────

function StudentEnrollmentCard({ entry }: { entry: EnrollmentEntry }) {
  const TierIcon = TIER_ICONS[entry.tier] ?? Layers;
  const tierColor = TIER_COLORS[entry.tier];
  const modeColor = MODE_COLORS[entry.delivery_mode];
  const modeLabel = MODE_LABELS[entry.delivery_mode];

  return (
    <div className="relative group bg-white border border-[#E4E4E7] rounded-md overflow-hidden hover:border-[#D4D4D8] transition-all duration-200 shadow-sm">
      <div className="h-[2px] w-full bg-[#FF5500] opacity-80" />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-xs font-bold text-[#09090B] bg-[#F4F4F6] px-2 py-0.5 rounded border border-[#E4E4E7]">
                {entry.course_code}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${tierColor}`}>
                <span className="inline-flex items-center gap-1">
                  <TierIcon className="w-2.5 h-2.5" />
                  {TIER_LABELS[entry.tier]}
                </span>
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${modeColor}`}>
                {modeLabel}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#09090B] leading-snug">
              {entry.course_name}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`rounded-md p-4 border ${
            entry.theory
              ? 'bg-[#F9F9FB] border-[#E4E4E7]'
              : 'bg-[#F4F4F6] border-[#E4E4E7] opacity-60'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded bg-white border border-[#E4E4E7]">
                <BookOpen className="w-3.5 h-3.5 text-[#09090B]" />
              </div>
              <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">
                Theory Lecture
              </span>
            </div>
            {entry.theory ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookMarked className="w-3.5 h-3.5 text-[#FF5500] flex-shrink-0" />
                  <span className="font-mono text-sm font-bold text-[#09090B]">
                    {entry.theory.section}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#E4E4E7]">
                  <p className="text-[10px] text-[#71717A] uppercase tracking-wider mb-1 font-mono">
                    Faculty In-Charge
                  </p>
                  <FacultyBadge name={entry.theory.faculty} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#71717A] italic">No theory component</p>
            )}
          </div>

          <div className={`rounded-md p-4 border ${
            entry.practical
              ? 'bg-[#F9F9FB] border-[#E4E4E7]'
              : 'bg-[#F4F4F6] border-[#E4E4E7] opacity-60'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded bg-white border border-[#E4E4E7]">
                <FlaskConical className="w-3.5 h-3.5 text-[#09090B]" />
              </div>
              <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">
                Practical / Tutorial
              </span>
            </div>
            {entry.practical ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#FF5500] flex-shrink-0" />
                  <span className="font-mono text-sm font-bold text-[#09090B]">
                    {entry.practical.batch}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#E4E4E7]">
                  <p className="text-[10px] text-[#71717A] uppercase tracking-wider mb-1 font-mono">
                    Batch Faculty
                  </p>
                  <FacultyBadge name={entry.practical.faculty} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#71717A] italic">No practical component</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Faculty Components (Architectural Light)
// ─────────────────────────────────────────────────────────────────────────────

function FacultyCourseCard({ course }: { course: FacultyCourseItem }) {
  const TierIcon = TIER_ICONS[course.tier] ?? Layers;
  const tierColor = TIER_COLORS[course.tier];
  const modeColor = MODE_COLORS[course.delivery_mode];
  const modeLabel = MODE_LABELS[course.delivery_mode];

  return (
    <div className="relative group bg-white border border-[#E4E4E7] rounded-md overflow-hidden hover:border-[#D4D4D8] transition-all duration-200 shadow-sm">
      <div className="h-[2px] w-full bg-[#FF5500]" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-xs font-bold text-[#09090B] bg-[#F4F4F6] px-2.5 py-0.5 rounded border border-[#E4E4E7]">
                {course.course_code}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${tierColor}`}>
                <span className="inline-flex items-center gap-1">
                  <TierIcon className="w-2.5 h-2.5" />
                  {TIER_LABELS[course.tier]}
                </span>
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${modeColor}`}>
                {modeLabel}
              </span>

              {/* Teaching Role Indicators */}
              {course.sections.length > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F4F4F6] text-[#09090B] border border-[#E4E4E7] inline-flex items-center gap-1 font-mono">
                  <BookOpen className="w-2.5 h-2.5 text-[#FF5500]" />
                  Theory Lecture
                </span>
              )}
              {course.batches.length > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFF4ED] text-[#FF5500] border border-[#FED7AA] inline-flex items-center gap-1 font-mono">
                  <FlaskConical className="w-2.5 h-2.5 text-[#FF5500]" />
                  Lab Practical
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-[#09090B] leading-snug">
              {course.course_name}
            </h3>

            {/* Division & Batch Quick Summary */}
            {course.divisions && course.divisions.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                <span className="text-[11px] text-[#71717A] font-medium">Assigned Divisions:</span>
                {course.divisions.map((div) => (
                  <span
                    key={div}
                    className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-[#F4F4F6] text-[#09090B] border border-[#E4E4E7] inline-flex items-center gap-1"
                  >
                    <Building2 className="w-3 h-3 text-[#71717A]" />
                    {div}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-[#71717A] mt-2 flex items-center gap-3">
              <span>Theory: <strong className="text-[#09090B]">{course.th_hours} hrs/wk</strong></span>
              <span>•</span>
              <span>Practical: <strong className="text-[#09090B]">{course.pr_hours} hrs/wk</strong></span>
              {course.tu_hours > 0 && (
                <>
                  <span>•</span>
                  <span>Tutorial: <strong className="text-[#09090B]">{course.tu_hours} hrs/wk</strong></span>
                </>
              )}
            </p>
          </div>

          <div className="text-right flex-shrink-0 bg-[#F4F4F6] border border-[#E4E4E7] px-3.5 py-2.5 rounded-md">
            <p className="text-[11px] font-mono text-[#71717A] uppercase">Total Students</p>
            <p className="text-xl font-bold text-[#09090B]">{course.total_students}</p>
          </div>
        </div>

        {/* Breakdown: Theory Sections & Practical Batches */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Assigned Theory Sections */}
          <div className="bg-[#FAFAFB] border border-[#E4E4E7] rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-white border border-[#E4E4E7]">
                  <BookOpen className="w-3.5 h-3.5 text-[#09090B]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#09090B] uppercase tracking-wider block">
                    Theory Sections ({course.sections.length})
                  </span>
                  <span className="text-[10px] text-[#71717A]">Class Lecture Allocation</span>
                </div>
              </div>
            </div>

            {course.sections.length > 0 ? (
              <div className="space-y-2.5">
                {course.sections.map((sec) => (
                  <div
                    key={sec.id}
                    className="p-3 rounded-md bg-white border border-[#E4E4E7] hover:border-[#D4D4D8] transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="font-mono text-xs font-bold text-[#09090B]">
                          {sec.section_name}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#09090B] bg-[#F4F4F6] px-2 py-0.5 rounded border border-[#E4E4E7]">
                        <Users className="w-3 h-3 text-[#71717A]" />
                        {sec.student_count} Students
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[#E4E4E7] text-[10px]">
                      <span className="px-2 py-0.5 rounded font-mono font-medium bg-[#F4F4F6] text-[#09090B] border border-[#E4E4E7]">
                        Div: {sec.division || 'Allotted Class'}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-medium bg-[#F4F4F6] text-[#09090B] border border-[#E4E4E7]">
                        Type: Theory
                      </span>
                      <span className="text-[#71717A] ml-auto font-mono">
                        In-Charge
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#71717A] italic py-4 text-center">
                No theory sections assigned for this course.
              </p>
            )}
          </div>

          {/* Assigned Practical / Lab Batches */}
          <div className="bg-[#FAFAFB] border border-[#E4E4E7] rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-white border border-[#E4E4E7]">
                  <FlaskConical className="w-3.5 h-3.5 text-[#FF5500]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#09090B] uppercase tracking-wider block">
                    Assigned Lab Batches ({course.batches.length})
                  </span>
                  <span className="text-[10px] text-[#71717A]">Practical & Tutorial Batches</span>
                </div>
              </div>
            </div>

            {course.batches.length > 0 ? (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {course.batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="p-3 rounded-md bg-white border border-[#E4E4E7] hover:border-[#D4D4D8] transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="font-mono text-xs font-bold text-[#09090B]">
                          {batch.batch_name}
                        </p>
                        {batch.section_name && (
                          <p className="text-[10px] text-[#71717A]">Parent: {batch.section_name}</p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#09090B] bg-[#F4F4F6] px-2 py-0.5 rounded border border-[#E4E4E7]">
                        <Users className="w-3 h-3 text-[#FF5500]" />
                        {batch.student_count} Students
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[#E4E4E7] text-[10px]">
                      <span className="px-2 py-0.5 rounded font-mono font-medium bg-[#F4F4F6] text-[#09090B] border border-[#E4E4E7]">
                        Div: {batch.division || 'Allotted Class'}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-medium bg-[#FFF4ED] text-[#FF5500] border border-[#FED7AA]">
                        Batch: {batch.batch_label || batch.batch_name}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-medium bg-[#F4F4F6] text-[#09090B] border border-[#E4E4E7]">
                        Type: Lab
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#71717A] italic py-4 text-center">
                No practical batches assigned for this course.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-[#E4E4E7] rounded-md p-4 flex items-center gap-3 shadow-sm">
      <div className="p-2.5 rounded bg-[#F4F4F6] border border-[#E4E4E7] text-[#09090B]">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#09090B] leading-none mb-1">{value}</p>
        <p className="text-xs text-[#71717A] font-medium">{label}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MyEnrollmentsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'STUDENT' | 'FACULTY' | 'ADMIN'>('STUDENT');
  const [userName, setUserName] = useState('');
  const [userErpId, setUserErpId] = useState('');
  
  // Student Data
  const [studentData, setStudentData] = useState<MyEnrollmentsResponse | null>(null);
  // Faculty Data
  const [facultyData, setFacultyData] = useState<FacultySubjectsResponse | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState(ACADEMIC_TERMS[0]);
  const [filterTier, setFilterTier] = useState<string>('ALL');

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUserRole(user.role as any);
    setUserName(user.full_name);
    setUserErpId(user.id);
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isFac = userRole === 'FACULTY' || userRole === 'ADMIN';
      const endpoint = isFac
        ? `/api/v1/faculty/my-subjects?academic_term=${encodeURIComponent(selectedTerm)}`
        : `/api/v1/student/my-enrollments?academic_term=${encodeURIComponent(selectedTerm)}`;

      const res = await fetchWithAuth(endpoint);
      if (!res.ok) {
        throw new Error(`Failed to load data: ${res.statusText}`);
      }
      const data = await res.json();
      if (isFac) {
        setFacultyData(data);
      } else {
        setStudentData(data);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading subject allocations.');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, userRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isFaculty = userRole === 'FACULTY' || userRole === 'ADMIN';

  // Filtered lists
  const filteredStudentEnrollments = studentData?.enrollments.filter(
    (e) => filterTier === 'ALL' || e.tier === filterTier
  ) ?? [];

  const filteredFacultyCourses = facultyData?.courses.filter(
    (c) => filterTier === 'ALL' || c.tier === filterTier
  ) ?? [];

  return (
    <div style={{ minHeight: '100vh', background: '#ECECEE', color: '#09090B', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Unified Role-Aware Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Page Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#FF5500', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Revision FRCRCE-3-26 Autonomous Scheme
              </span>
              <span style={{ color: '#D4D4D8' }}>•</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#71717A', textTransform: 'uppercase' }}>
                {isFaculty ? 'Faculty Teaching Portfolio' : 'Student Allotment Portal'}
              </span>
            </div>
            <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '26px', fontWeight: 800, color: '#09090B', letterSpacing: '-0.02em' }}>
              {isFaculty ? 'My Assigned Subjects & Batches' : 'My Enrolled Subjects'}
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13.5px', color: '#71717A', marginTop: '4px' }}>
              {isFaculty
                ? `Official lecture sections and practical batches assigned to Prof. ${userName}`
                : `Student ERP ID: ${userErpId || '2023CE001'} · View assigned lecture divisions & lab batches`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Term Selector */}
            <div className="relative">
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="appearance-none bg-white border border-[#E4E4E7] hover:border-[#D4D4D8] text-xs text-[#09090B] font-mono pl-3 pr-8 py-2 rounded-md focus:outline-none focus:border-[#FF5500] transition-colors cursor-pointer shadow-sm"
              >
                {ACADEMIC_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#71717A] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-white border border-[#E4E4E7] hover:bg-[#F4F4F6] text-[#09090B] rounded-md transition-all disabled:opacity-50 shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Top KPI Stat Cards */}
        {isFaculty && facultyData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={BookOpen}
              label="Assigned Courses"
              value={facultyData.total_courses}
            />
            <StatCard
              icon={BookMarked}
              label="Theory Sections"
              value={facultyData.total_sections}
            />
            <StatCard
              icon={FlaskConical}
              label="Lab Batches"
              value={facultyData.total_batches}
            />
            <StatCard
              icon={Users}
              label="Students Supervised"
              value={facultyData.total_students}
            />
          </div>
        )}

        {!isFaculty && studentData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={BookOpen}
              label="Total Enrolled"
              value={studentData.enrollments.length}
            />
            <StatCard
              icon={BookMarked}
              label="Theory Lectures"
              value={studentData.enrollments.filter((e) => e.theory !== null).length}
            />
            <StatCard
              icon={FlaskConical}
              label="Lab Batches"
              value={studentData.enrollments.filter((e) => e.practical !== null).length}
            />
            <StatCard
              icon={Users}
              label="Faculty Assigned"
              value={studentData.enrollments.filter((e) => e.theory?.faculty !== 'To be assigned' && e.practical?.faculty !== 'To be assigned').length}
            />
          </div>
        )}

        {/* Tier Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #E4E4E7', paddingBottom: '12px', overflowX: 'auto' }}>
          {[
            { key: 'ALL', label: 'All Tiers' },
            { key: 'CLASS', label: 'Class Core' },
            { key: 'DEPARTMENT', label: 'Department Elective' },
            { key: 'INSTITUTE', label: 'Institute Open Elective' },
          ].map(({ key, label }) => {
            const isActive = filterTier === key;
            return (
              <button
                key={key}
                onClick={() => setFilterTier(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #18181B' : '1px solid #E4E4E7',
                  background: isActive ? '#18181B' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#71717A',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: '6px', padding: '12px 16px', fontSize: '13px', marginBottom: '24px', fontFamily: 'Inter, sans-serif' }}>
            {error}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="text-center py-16">
            <RefreshCw className="w-8 h-8 text-[#FF5500] animate-spin mx-auto mb-3" />
            <p className="text-xs text-[#71717A] font-mono">Loading subject allocations...</p>
          </div>
        )}

        {/* Faculty View Rendering */}
        {!loading && isFaculty && (
          <div>
            {filteredFacultyCourses.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {filteredFacultyCourses.map((course) => (
                  <FacultyCourseCard key={course.offering_id} course={course} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white border border-[#E4E4E7] rounded-md p-8 shadow-sm">
                <BookOpen className="w-12 h-12 text-[#A1A1AA] mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#09090B] mb-1">
                  No Subjects Currently Assigned
                </h3>
                <p className="text-xs text-[#71717A] max-w-md mx-auto mb-5">
                  No theory sections or practical lab batches are currently assigned to your faculty profile for term {selectedTerm}.
                </p>
                <Link
                  href="/admin/allotment"
                  className="inline-flex items-center gap-2 text-xs font-bold bg-[#FF5500] hover:bg-[#E64D00] text-white px-4 py-2.5 rounded-md transition-all shadow-md shadow-orange-500/20"
                >
                  <Layers className="w-4 h-4" />
                  <span>Go to Allotment Engine to Assign Sections</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Student View Rendering */}
        {!loading && !isFaculty && (
          <div>
            {filteredStudentEnrollments.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredStudentEnrollments.map((entry) => (
                  <StudentEnrollmentCard key={entry.course_code} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white border border-[#E4E4E7] rounded-md p-8 shadow-sm">
                <BookOpen className="w-12 h-12 text-[#A1A1AA] mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#09090B] mb-1">
                  No Enrollments Found
                </h3>
                <p className="text-xs text-[#71717A] max-w-md mx-auto">
                  No course allocations found for term {selectedTerm}. Please check with your academic department or administrator.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
