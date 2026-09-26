'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
        isUnassigned
          ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50'
          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
      }`}
    >
      {isUnassigned ? (
        <Clock className="w-3 h-3" />
      ) : (
        <CheckCircle2 className="w-3 h-3" />
      )}
      {name}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Components
// ─────────────────────────────────────────────────────────────────────────────

function StudentEnrollmentCard({ entry }: { entry: EnrollmentEntry }) {
  const TierIcon = TIER_ICONS[entry.tier] ?? Layers;
  const tierColor = TIER_COLORS[entry.tier];
  const modeColor = MODE_COLORS[entry.delivery_mode];
  const modeLabel = MODE_LABELS[entry.delivery_mode];

  return (
    <div className="relative group bg-zinc-900/60 border border-zinc-800/70 rounded-2xl overflow-hidden hover:border-zinc-600/60 transition-all duration-300 hover:shadow-lg hover:shadow-black/30">
      <div className="h-[2px] w-full bg-gradient-to-r from-violet-500/40 via-blue-500/40 to-cyan-500/40 opacity-60 group-hover:opacity-100 transition-opacity" />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-xs text-zinc-500 bg-zinc-800/70 px-2 py-0.5 rounded border border-zinc-700/50">
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
            <h3 className="text-base font-semibold text-white leading-snug">
              {entry.course_name}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`rounded-xl p-4 border ${
            entry.theory
              ? 'bg-blue-500/5 border-blue-500/20'
              : 'bg-zinc-800/30 border-zinc-700/30 opacity-50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg ${entry.theory ? 'bg-blue-500/15' : 'bg-zinc-700/30'}`}>
                <BookOpen className={`w-3.5 h-3.5 ${entry.theory ? 'text-blue-400' : 'text-zinc-500'}`} />
              </div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Theory Lecture
              </span>
            </div>
            {entry.theory ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookMarked className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="font-mono text-sm font-bold text-blue-300">
                    {entry.theory.section}
                  </span>
                </div>
                <div className="pt-1 border-t border-zinc-800/60">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                    Faculty In-Charge
                  </p>
                  <FacultyBadge name={entry.theory.faculty} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No theory component</p>
            )}
          </div>

          <div className={`rounded-xl p-4 border ${
            entry.practical
              ? 'bg-violet-500/5 border-violet-500/20'
              : 'bg-zinc-800/30 border-zinc-700/30 opacity-50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg ${entry.practical ? 'bg-violet-500/15' : 'bg-zinc-700/30'}`}>
                <FlaskConical className={`w-3.5 h-3.5 ${entry.practical ? 'text-violet-400' : 'text-zinc-500'}`} />
              </div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Practical / Tutorial
              </span>
            </div>
            {entry.practical ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                  <span className="font-mono text-sm font-bold text-violet-300">
                    {entry.practical.batch}
                  </span>
                </div>
                <div className="pt-1 border-t border-zinc-800/60">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                    Batch Faculty
                  </p>
                  <FacultyBadge name={entry.practical.faculty} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No practical component</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Faculty Components
// ─────────────────────────────────────────────────────────────────────────────

function FacultyCourseCard({ course }: { course: FacultyCourseItem }) {
  const TierIcon = TIER_ICONS[course.tier] ?? Layers;
  const tierColor = TIER_COLORS[course.tier];
  const modeColor = MODE_COLORS[course.delivery_mode];
  const modeLabel = MODE_LABELS[course.delivery_mode];

  return (
    <div className="relative group bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-zinc-600/70 transition-all duration-300 hover:shadow-xl hover:shadow-black/40">
      <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-blue-500/50 opacity-70 group-hover:opacity-100 transition-opacity" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/25">
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
            </div>
            <h3 className="text-lg font-bold text-white leading-snug">
              {course.course_name}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-3">
              <span>Theory: <strong className="text-zinc-200">{course.th_hours} hrs/wk</strong></span>
              <span>•</span>
              <span>Practical: <strong className="text-zinc-200">{course.pr_hours} hrs/wk</strong></span>
              {course.tu_hours > 0 && (
                <>
                  <span>•</span>
                  <span>Tutorial: <strong className="text-zinc-200">{course.tu_hours} hrs/wk</strong></span>
                </>
              )}
            </p>
          </div>

          <div className="text-right flex-shrink-0 bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 rounded-xl">
            <p className="text-xs text-zinc-400">Total Students</p>
            <p className="text-lg font-bold text-white">{course.total_students}</p>
          </div>
        </div>

        {/* Breakdown: Theory Sections & Practical Batches */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Assigned Theory Sections */}
          <div className="bg-zinc-950/60 border border-zinc-800/70 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/15">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Theory Sections ({course.sections.length})
                </span>
              </div>
            </div>

            {course.sections.length > 0 ? (
              <div className="space-y-2">
                {course.sections.map((sec) => (
                  <div
                    key={sec.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-blue-300">
                        {sec.section_name}
                      </p>
                      <p className="text-[10px] text-zinc-400">Lecture Faculty In-Charge</p>
                    </div>
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-zinc-300 bg-zinc-800/80 px-2 py-1 rounded">
                      <Users className="w-3 h-3 text-blue-400" />
                      {sec.student_count} Students
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic py-2">
                No theory sections assigned for this course.
              </p>
            )}
          </div>

          {/* Assigned Practical / Lab Batches */}
          <div className="bg-zinc-950/60 border border-zinc-800/70 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/15">
                  <FlaskConical className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Assigned Lab Batches ({course.batches.length})
                </span>
              </div>
            </div>

            {course.batches.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {course.batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-violet-300">
                        {batch.batch_name}
                      </p>
                      {batch.section_name && (
                        <p className="text-[10px] text-zinc-400">Section: {batch.section_name}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-zinc-300 bg-zinc-800/80 px-2 py-1 rounded">
                      <Users className="w-3 h-3 text-violet-400" />
                      {batch.student_count} Students
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic py-2">
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
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/70 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/40 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-zinc-400">{label}</p>
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
    setUserRole((user.role as any) || 'STUDENT');
    setUserName(user.full_name || '');
  }, [router]);

  const loadData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const user = getStoredUser();
    const isFaculty = user?.role === 'FACULTY' || user?.role === 'ADMIN';

    setLoading(true);
    setError(null);

    try {
      if (isFaculty) {
        const res = await fetchWithAuth(
          `/api/v1/faculty/my-subjects?academic_term=${encodeURIComponent(selectedTerm)}`
        );
        if (res.ok) {
          const data: FacultySubjectsResponse = await res.json();
          setFacultyData(data);
        } else {
          setError('Failed to load faculty subject assignments.');
        }
      } else {
        const res = await fetchWithAuth(
          `/api/v1/student/my-enrollments?academic_term=${encodeURIComponent(selectedTerm)}`
        );
        if (res.ok) {
          const data: MyEnrollmentsResponse = await res.json();
          setStudentData(data);
          setUserErpId(data.student_id);
        } else {
          setError('Failed to load student enrollment records.');
        }
      }
    } catch {
      setError('Network connection error. Please verify your backend server.');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/login');
  };

  const isFaculty = userRole === 'FACULTY' || userRole === 'ADMIN';

  // Filtered lists
  const filteredStudentEnrollments = studentData?.enrollments.filter(
    (e) => filterTier === 'ALL' || e.tier === filterTier
  ) ?? [];

  const filteredFacultyCourses = facultyData?.courses.filter(
    (c) => filterTier === 'ALL' || c.tier === filterTier
  ) ?? [];

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1f_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1f_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />
      </div>

      {/* Authenticated Top Header */}
      <header className="relative z-10 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/chat" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
              <GraduationCap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors">
              ACADEMIC COMMAND CENTER
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/chat"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/60 px-3 py-2 rounded-lg transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              AI Chat
            </Link>

            <Link
              href="/enrollments"
              className="flex items-center gap-1.5 text-xs text-white bg-zinc-800/80 border border-zinc-700/50 px-3 py-2 rounded-lg font-medium"
            >
              <BookOpen className="w-3.5 h-3.5 text-violet-400" />
              My Subjects
            </Link>

            {isFaculty && (
              <Link
                href="/faculty"
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/60 px-3 py-2 rounded-lg transition-all"
              >
                <Users className="w-3.5 h-3.5" />
                Attendance Ledger
              </Link>
            )}

            {(userRole === 'ADMIN' || userRole === 'FACULTY') && (
              <Link
                href="/admin/allotment"
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/60 px-3 py-2 rounded-lg transition-all"
              >
                <Layers className="w-3.5 h-3.5" />
                Allotment Engine
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-white">{userName}</p>
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                {userRole}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-all"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Page Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-violet-400 uppercase tracking-wider">
                Revision FRCRCE-3-26 Autonomous Scheme
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-400">
                {isFaculty ? 'Faculty Teaching Portfolio' : 'Student Allotment Portal'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {isFaculty ? 'My Assigned Subjects & Batches' : 'My Enrolled Subjects'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
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
                className="appearance-none bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 font-mono pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
              >
                {ACADEMIC_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all disabled:opacity-50"
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
              color="text-blue-400"
            />
            <StatCard
              icon={BookMarked}
              label="Theory Sections"
              value={facultyData.total_sections}
              color="text-violet-400"
            />
            <StatCard
              icon={FlaskConical}
              label="Lab Batches"
              value={facultyData.total_batches}
              color="text-emerald-400"
            />
            <StatCard
              icon={Users}
              label="Students Supervised"
              value={facultyData.total_students}
              color="text-amber-400"
            />
          </div>
        )}

        {!isFaculty && studentData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={BookOpen}
              label="Total Enrolled"
              value={studentData.enrollments.length}
              color="text-blue-400"
            />
            <StatCard
              icon={BookMarked}
              label="Theory Lectures"
              value={studentData.enrollments.filter((e) => e.theory !== null).length}
              color="text-violet-400"
            />
            <StatCard
              icon={FlaskConical}
              label="Lab Batches"
              value={studentData.enrollments.filter((e) => e.practical !== null).length}
              color="text-emerald-400"
            />
            <StatCard
              icon={Users}
              label="Faculty Assigned"
              value={studentData.enrollments.filter((e) => e.theory?.faculty !== 'To be assigned' && e.practical?.faculty !== 'To be assigned').length}
              color="text-emerald-400"
            />
          </div>
        )}

        {/* Tier Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800/60 pb-3 overflow-x-auto">
          {[
            { key: 'ALL', label: 'All Tiers' },
            { key: 'CLASS', label: 'Class Core' },
            { key: 'DEPARTMENT', label: 'Department Elective' },
            { key: 'INSTITUTE', label: 'Institute Open Elective' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterTier(key)}
              className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                filterTier === key
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-xs mb-6">
            {error}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="text-center py-16">
            <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
            <p className="text-xs text-zinc-400">Loading subject allocations...</p>
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
              <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-8">
                <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-zinc-300 mb-1">
                  No Subjects Currently Assigned
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto mb-5">
                  No theory sections or practical lab batches are currently assigned to your faculty profile for term {selectedTerm}.
                </p>
                <Link
                  href="/admin/allotment"
                  className="inline-flex items-center gap-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl transition-all shadow-md shadow-violet-600/20"
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
              <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-8">
                <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-zinc-300 mb-1">
                  No Enrollments Found
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
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
