'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  GraduationCap,
  BookOpen,
  FlaskConical,
  Globe,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  Layers,
  ChevronRight,
  Info,
  Calendar,
  Check,
  RotateCcw,
} from 'lucide-react';
import { getStoredToken, getStoredUser, getApiUrl } from '@/lib/api';

interface ElectiveOption {
  code: string;
  name: string;
  course_tier: string;
  delivery_mode: string;
  th_hours: number;
  pr_hours: number;
  credits: number;
  description?: string;
}

interface ElectiveCategory {
  category: string;
  category_label: string;
  description: string;
  min_choices: number;
  max_choices: number;
  options: ElectiveOption[];
}

interface TermConfig {
  academic_term: string;
  semester: number;
  semester_label: string;
  categories: ElectiveCategory[];
}

interface ChoiceItemRead {
  category: string;
  category_label: string;
  preference_1: string;
  preference_1_name?: string;
  preference_2?: string;
  preference_2_name?: string;
  preference_3?: string;
  preference_3_name?: string;
  allotted_course_code?: string;
  allotted_course_name?: string;
  section_name?: string;
  batch_name?: string;
  submitted_at?: string;
}

interface TermStatus {
  academic_term: string;
  semester: number;
  submitted: boolean;
  allotted: boolean;
  submitted_at?: string;
  choices: ChoiceItemRead[];
}

interface StudentStatus {
  eligible: boolean;
  student_id?: string;
  student_erp_id?: string;
  full_name?: string;
  roll_no?: string;
  department_name?: string;
  division_name?: string;
  semester?: number;
  requires_form_prompt?: boolean;
  terms: TermStatus[];
}

function ElectiveSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams?.get('onboarding') === '1';

  // Client-Side Safe Hydration State
  const [mounted, setMounted] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [configs, setConfigs] = useState<TermConfig[]>([]);
  const [statusData, setStatusData] = useState<StudentStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string>('2026-27-SEM5');
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form selections state: { [category]: { p1: '', p2: '', p3: '' } }
  const [selections, setSelections] = useState<Record<string, { p1: string; p2: string; p3: string }>>({
    PEC: { p1: '', p2: '', p3: '' },
    PECL: { p1: '', p2: '', p3: '' },
    OE: { p1: '', p2: '', p3: '' },
  });

  const fetchData = useCallback(async (isSilentRevalidate = false) => {
    const token = getStoredToken();
    if (!token) {
      router.push('/login');
      return;
    }

    if (!isSilentRevalidate) {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      // Parallel Fetch: Fetch both endpoints simultaneously across the network
      const [cfgRes, stRes] = await Promise.all([
        fetch(getApiUrl('/api/v1/electives/config'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(getApiUrl('/api/v1/electives/student-status'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!cfgRes.ok) throw new Error('Failed to load elective curriculum configuration');
      if (!stRes.ok) throw new Error('Failed to load your elective status');

      const [cfgData, stData] = await Promise.all([
        cfgRes.json() as Promise<TermConfig[]>,
        stRes.json() as Promise<StudentStatus>,
      ]);

      setConfigs(cfgData);
      setStatusData(stData);

      // Persist in client-side session cache for 0ms returns
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('cached_elective_config', JSON.stringify(cfgData));
          sessionStorage.setItem('cached_student_status', JSON.stringify(stData));
        } catch {}
      }

      // Pre-fill selections if already submitted
      const activeTermStatus = stData.terms?.find((t) => t.academic_term === selectedTerm);
      if (activeTermStatus && activeTermStatus.choices?.length > 0) {
        const nextSel: Record<string, { p1: string; p2: string; p3: string }> = {
          PEC: { p1: '', p2: '', p3: '' },
          PECL: { p1: '', p2: '', p3: '' },
          OE: { p1: '', p2: '', p3: '' },
        };
        activeTermStatus.choices.forEach((c) => {
          nextSel[c.category] = {
            p1: c.preference_1 || '',
            p2: c.preference_2 || '',
            p3: c.preference_3 || '',
          };
        });
        setSelections(nextSel);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error connecting to elective service');
    } finally {
      setLoading(false);
    }
  }, [router, selectedTerm]);

  useEffect(() => {
    setMounted(true);
    const u = getStoredUser();
    if (u) setCurrentUser(u);

    let hasCached = false;
    if (typeof window !== 'undefined') {
      try {
        const cachedConfig = sessionStorage.getItem('cached_elective_config');
        if (cachedConfig) setConfigs(JSON.parse(cachedConfig));
        const cachedStatus = sessionStorage.getItem('cached_student_status');
        if (cachedStatus) {
          setStatusData(JSON.parse(cachedStatus));
          setLoading(false);
          hasCached = true;
        }
      } catch {}
    }

    fetchData(hasCached);
  }, [fetchData]);

  // When changing term tab, update selections from status
  const handleTermSwitch = (termCode: string) => {
    setSelectedTerm(termCode);
    setSubmitSuccess(null);
    setErrorMessage(null);
    const termStatus = statusData?.terms?.find((t) => t.academic_term === termCode);
    if (termStatus && termStatus.choices?.length > 0) {
      const nextSel: Record<string, { p1: string; p2: string; p3: string }> = {
        PEC: { p1: '', p2: '', p3: '' },
        PECL: { p1: '', p2: '', p3: '' },
        OE: { p1: '', p2: '', p3: '' },
      };
      termStatus.choices.forEach((c) => {
        nextSel[c.category] = {
          p1: c.preference_1 || '',
          p2: c.preference_2 || '',
          p3: c.preference_3 || '',
        };
      });
      setSelections(nextSel);
    } else {
      setSelections({
        PEC: { p1: '', p2: '', p3: '' },
        PECL: { p1: '', p2: '', p3: '' },
        OE: { p1: '', p2: '', p3: '' },
      });
    }
  };

  const handleSelectChange = (category: string, prefKey: 'p1' | 'p2' | 'p3', value: string) => {
    setSelections((prev) => {
      const current = { ...(prev[category] || { p1: '', p2: '', p3: '' }) };
      current[prefKey] = value;

      // Duplicate prevention: if setting p1 to same as p2, clear p2
      if (prefKey === 'p1' && current.p2 === value) current.p2 = '';
      if (prefKey === 'p1' && current.p3 === value) current.p3 = '';
      if (prefKey === 'p2' && current.p1 === value) current.p1 = '';
      if (prefKey === 'p2' && current.p3 === value) current.p3 = '';
      if (prefKey === 'p3' && current.p1 === value) current.p1 = '';
      if (prefKey === 'p3' && current.p2 === value) current.p2 = '';

      return { ...prev, [category]: current };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitSuccess(null);

    const activeConfig = configs.find((c) => c.academic_term === selectedTerm);
    if (!activeConfig) return;

    // Validate that 1st preference is chosen for all categories
    for (const cat of activeConfig.categories) {
      const sel = selections[cat.category];
      if (!sel || !sel.p1) {
        setErrorMessage(`Please select your 1st Preference for "${cat.category_label}".`);
        return;
      }
    }

    const payload = {
      academic_term: selectedTerm,
      choices: activeConfig.categories.map((cat) => {
        const sel = selections[cat.category] || { p1: '', p2: '', p3: '' };
        return {
          category: cat.category,
          preference_1: sel.p1,
          preference_2: sel.p2 || null,
          preference_3: sel.p3 || null,
        };
      }),
    };

    setSubmitting(true);
    const token = getStoredToken();

    try {
      const res = await fetch(getApiUrl('/api/v1/electives/submit'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errDetail = 'Failed to submit elective choices';
        try {
          const errData = await res.json();
          errDetail = errData.detail || errDetail;
        } catch {
          const rawText = await res.text().catch(() => '');
          errDetail = rawText || `Server error (${res.status})`;
        }
        throw new Error(errDetail);
      }

      let resData: any = {};
      try {
        resData = await res.json();
      } catch {
        // Fallback if response is empty
      }
      setSubmitSuccess(resData.message || 'Your elective preferences have been successfully submitted!');
      await fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  const activeConfig = configs.find((c) => c.academic_term === selectedTerm);
  const activeTermStatus = statusData?.terms?.find((t) => t.academic_term === selectedTerm);
  const isAlreadyAllotted = activeTermStatus?.allotted ?? false;
  const isAlreadySubmitted = activeTermStatus?.submitted ?? false;

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-[#09090B]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        {/* Onboarding Alert Banner */}
        {isOnboarding && (
          <div className="mb-6 p-4 bg-[#FFF8E6] border border-[#FFD080] rounded-xl flex items-start gap-3.5 shadow-sm">
            <Sparkles className="w-5 h-5 text-[#FF5500] flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-sm text-[#09090B]">
                Welcome to 3rd Year! Elective Selection Required
              </h2>
              <p className="text-xs text-[#52525B] mt-0.5">
                Before accessing your academic dashboard, please review and submit your elective preferences for Semester 5 and Semester 6 below.
              </p>
            </div>
          </div>
        )}

        {/* Google Form Style Header Card */}
        <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-sm overflow-hidden mb-6">
          {/* Top Decorative College Accent */}
          <div className="h-3.5 bg-gradient-to-r from-[#18181B] via-[#FF5500] to-[#18181B]" />

          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E4E7] pb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#18181B] text-white">
                    <GraduationCap className="w-3.5 h-3.5" />
                    FrCRCE Autonomous Curriculum
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF0E6] text-[#FF5500] border border-[#FFD0B8]">
                    AY 2026–27
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#09090B] tracking-tight">
                  Third Year Elective Selection Form
                </h1>
                <p className="text-xs sm:text-sm text-[#71717A] mt-1.5 leading-relaxed">
                  Department of Computer Engineering • Semester 5 (Autumn 2026) & Semester 6 (Spring 2027)
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 flex-shrink-0">
                {isAlreadyAllotted ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E8F8EE] text-[#1E7E34] border border-[#B7E4C7]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Allotted & Finalized
                  </span>
                ) : isAlreadySubmitted ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                    <Clock className="w-3.5 h-3.5" />
                    Preferences Submitted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFF0E6] text-[#FF5500] border border-[#FFD0B8]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Action Required
                  </span>
                )}
                {mounted && activeTermStatus?.submitted_at && (
                  <span className="text-[10px] text-[#A1A1AA] font-mono" suppressHydrationWarning>
                    Submitted: {new Date(activeTermStatus.submitted_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Student Verified Identity Bar */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl p-3.5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block">Student Name</span>
                <span className="font-semibold text-[#09090B] truncate block" suppressHydrationWarning>
                  {statusData?.full_name || (mounted ? (currentUser?.full_name || 'Loading...') : 'Loading...')}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block">Roll Number</span>
                <span className="font-semibold text-[#09090B] font-mono" suppressHydrationWarning>
                  {statusData?.roll_no || (mounted ? (currentUser?.roll_no || '—') : '—')}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block">Division</span>
                <span className="font-semibold text-[#09090B] font-mono" suppressHydrationWarning>
                  {statusData?.division_name || (mounted ? 'COMP-B' : '—')}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block">Academic Year</span>
                <span className="font-semibold text-[#FF5500] font-bold">Third Year (TE)</span>
              </div>
            </div>

            {/* Instructions Callout */}
            <div className="mt-4 flex items-start gap-2.5 text-xs text-[#52525B] bg-[#F4F4F6] p-3.5 rounded-xl border border-[#E4E4E7]">
              <Info className="w-4 h-4 text-[#71717A] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>
                  <strong>Allotment Rule:</strong> In accordance with college autonomous policy, an elective must meet a minimum threshold of <strong>20 enrolled students</strong> to run.
                </p>
                <p>
                  Rank your preferences carefully. If your 1st choice course does not meet the minimum quota, the Allotment Engine will automatically cascade your allocation to your 2nd or 3rd preference.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Term Tabs (Sem 5 vs Sem 6) */}
        <div className="flex items-center gap-2 mb-6">
          {configs.map((cfg) => {
            const isTabActive = cfg.academic_term === selectedTerm;
            const termStatus = statusData?.terms?.find((t) => t.academic_term === cfg.academic_term);
            const isSubmitted = termStatus?.submitted;
            const isAllotted = termStatus?.allotted;

            return (
              <button
                key={cfg.academic_term}
                type="button"
                onClick={() => handleTermSwitch(cfg.academic_term)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isTabActive
                    ? 'bg-[#18181B] text-white border-[#18181B] shadow-sm'
                    : 'bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#A1A1AA] hover:text-[#09090B]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>{cfg.semester_label}</span>
                {isAllotted ? (
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-[#E8F8EE] text-[#1E7E34] border border-[#B7E4C7]">
                    Allotted
                  </span>
                ) : isSubmitted ? (
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                    Submitted
                  </span>
                ) : (
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-[#FFF0E6] text-[#FF5500] border border-[#FFD0B8]">
                    Pending
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Error and Success Notifications */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl flex items-center gap-3 text-xs text-[#991B1B]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="mb-6 p-4 bg-[#E8F8EE] border border-[#B7E4C7] rounded-xl flex items-center gap-3 text-xs text-[#1E7E34]">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{submitSuccess}</span>
          </div>
        )}

        {/* ALLOTTED STATE CARD: Shows if courses have already been finalized */}
        {isAlreadyAllotted && activeTermStatus && (
          <div className="bg-white rounded-2xl border border-[#B7E4C7] p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2.5 text-[#1E7E34] font-bold text-sm mb-3">
              <CheckCircle2 className="w-5 h-5 text-[#1E7E34]" />
              <span>Official Elective Allocation Confirmed</span>
            </div>
            <p className="text-xs text-[#52525B] mb-4">
              The Department Allotment Engine has finalized course allocations for {activeConfig?.semester_label}. Your confirmed subjects and assigned sections are listed below:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeTermStatus.choices.map((c) => (
                <div key={c.category} className="p-3.5 bg-[#FAFAFA] border border-[#E4E4E7] rounded-xl text-xs">
                  <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-1">
                    {c.category_label}
                  </span>
                  <div className="font-bold text-[#09090B] text-sm">
                    {c.allotted_course_code || 'Allotted'}
                  </div>
                  <div className="text-[#52525B] text-xs mt-0.5 line-clamp-1">
                    {c.allotted_course_name || c.preference_1_name}
                  </div>
                  {(c.section_name || c.batch_name) && (
                    <div className="mt-2 pt-2 border-t border-[#E4E4E7] flex items-center gap-2 text-[11px] font-mono text-[#FF5500]">
                      {c.section_name && <span>Sec: {c.section_name}</span>}
                      {c.batch_name && <span>Batch: {c.batch_name}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[#E4E4E7] flex justify-end">
              <Link
                href="/enrollments"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#18181B] text-white text-xs font-bold hover:bg-black transition-all"
              >
                <span>View Full Curriculum & Attendance</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* GOOGLE FORM STYLE SELECTION CARDS */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeConfig?.categories.map((cat, idx) => {
            const sel = selections[cat.category] || { p1: '', p2: '', p3: '' };
            const Icon = cat.category === 'PECL' ? FlaskConical : cat.category === 'OE' ? Globe : BookOpen;

            return (
              <div
                key={cat.category}
                className="bg-white rounded-2xl border border-[#E4E4E7] p-6 shadow-sm relative overflow-hidden"
              >
                {/* Number Indicator */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F4F4F6] border border-[#E4E4E7] flex items-center justify-center font-mono font-bold text-xs text-[#09090B]">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-[#09090B] flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[#FF5500]" />
                        {cat.category_label}
                        <span className="text-xs font-normal text-rose-600">*</span>
                      </h3>
                      <p className="text-xs text-[#71717A] mt-0.5">{cat.description}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[#F4F4F6] text-[#71717A] rounded border border-[#E4E4E7]">
                    {cat.options.length} Options Available
                  </span>
                </div>

                {/* Subject Options Cards Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
                  {cat.options.map((opt) => {
                    const isPickedAsP1 = sel.p1 === opt.code;
                    const isPickedAsP2 = sel.p2 === opt.code;
                    const isPickedAsP3 = sel.p3 === opt.code;

                    return (
                      <div
                        key={opt.code}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          isPickedAsP1
                            ? 'bg-[#FFF8F3] border-[#FF5500] shadow-xs'
                            : isPickedAsP2
                            ? 'bg-[#F0FDF4] border-[#86EFAC]'
                            : isPickedAsP3
                            ? 'bg-[#EFF6FF] border-[#93C5FD]'
                            : 'bg-[#FAFAFA] border-[#E4E4E7]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono font-bold text-[11px] text-[#71717A]">{opt.code}</span>
                          {isPickedAsP1 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF5500] text-white">
                              Choice #1
                            </span>
                          )}
                          {isPickedAsP2 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#16A34A] text-white">
                              Choice #2
                            </span>
                          )}
                          {isPickedAsP3 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#2563EB] text-white">
                              Choice #3
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-[#09090B] text-xs leading-snug">{opt.name}</h4>
                        {opt.description && (
                          <p className="text-[11px] text-[#71717A] mt-1 leading-normal line-clamp-2">
                            {opt.description}
                          </p>
                        )}
                        <div className="mt-2 pt-2 border-t border-[#E4E4E7] flex items-center justify-between text-[10px] text-[#A1A1AA]">
                          <span>{opt.credits} Credits</span>
                          <span>{opt.th_hours > 0 ? `${opt.th_hours}h Theory` : `${opt.pr_hours}h Practical`}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Preference Dropdowns */}
                <div className="pt-4 border-t border-[#E4E4E7] grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Preference 1 (Required) */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#09090B] mb-1.5">
                      1st Preference <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={sel.p1}
                      disabled={isAlreadyAllotted}
                      onChange={(e) => handleSelectChange(cat.category, 'p1', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#D4D4D8] text-xs font-medium text-[#09090B] focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] disabled:bg-[#F4F4F6] disabled:text-[#A1A1AA]"
                      required
                    >
                      <option value="">-- Select 1st Choice --</option>
                      {cat.options.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.name} ({opt.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preference 2 */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#71717A] mb-1.5">
                      2nd Preference (Fallback)
                    </label>
                    <select
                      value={sel.p2}
                      disabled={isAlreadyAllotted}
                      onChange={(e) => handleSelectChange(cat.category, 'p2', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#D4D4D8] text-xs font-medium text-[#09090B] focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] disabled:bg-[#F4F4F6] disabled:text-[#A1A1AA]"
                    >
                      <option value="">-- Select 2nd Choice --</option>
                      {cat.options
                        .filter((opt) => opt.code !== sel.p1)
                        .map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.name} ({opt.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Preference 3 (if applicable) */}
                  {cat.max_choices >= 3 && (
                    <div>
                      <label className="block text-[11px] font-bold text-[#71717A] mb-1.5">
                        3rd Preference (Fallback)
                      </label>
                      <select
                        value={sel.p3}
                        disabled={isAlreadyAllotted}
                        onChange={(e) => handleSelectChange(cat.category, 'p3', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-[#D4D4D8] text-xs font-medium text-[#09090B] focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] disabled:bg-[#F4F4F6] disabled:text-[#A1A1AA]"
                      >
                        <option value="">-- Select 3rd Choice --</option>
                        {cat.options
                          .filter((opt) => opt.code !== sel.p1 && opt.code !== sel.p2)
                          .map((opt) => (
                            <option key={opt.code} value={opt.code}>
                              {opt.name} ({opt.code})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Form Actions Footer */}
          {!isAlreadyAllotted && (
            <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#71717A]">
                {isAlreadySubmitted ? (
                  <span>
                    Choices currently recorded. You may modify and re-submit your preferences until coordinator allotment runs.
                  </span>
                ) : (
                  <span>All marked fields with (*) are required. Click submit once all choices are chosen.</span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#18181B] text-white text-xs sm:text-sm font-bold hover:bg-black transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Submitting Choices...' : isAlreadySubmitted ? 'Update Preferences' : 'Submit Elective Choices'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}

export default function ElectiveSelectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center font-mono text-xs text-zinc-500">Loading Electives Workspace...</div>}>
      <ElectiveSelectionContent />
    </Suspense>
  );
}

