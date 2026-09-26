'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Layers,
  BookOpen,
  FlaskConical,
  Users,
  X,
  ArrowRight,
  GraduationCap,
  LogOut,
  ChevronDown,
  RefreshCw,
  Building2,
  Globe,
  MessageSquare,
} from 'lucide-react';
import {
  getStoredToken,
  getStoredUser,
  clearAuthSession,
  fetchWithAuth,
} from '@/lib/api';
import {
  AllotmentUploadResponse,
  AllotmentRowError,
  OfferingInfo,
  TIER_COLORS,
  MODE_LABELS,
} from '@/lib/allotment';

// ─────────────────────────────────────────────────────────────────────────────
// Upload Zone
// ─────────────────────────────────────────────────────────────────────────────
function UploadZone({
  onFileSelect,
  file,
  loading,
}: {
  onFileSelect: (f: File) => void;
  file: File | null;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileSelect(dropped);
    },
    [onFileSelect]
  );

  return (
    <div
      id="upload-drop-zone"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 transition-all duration-300 group ${
        dragging
          ? 'border-violet-400/60 bg-violet-500/10'
          : file
          ? 'border-emerald-500/50 bg-emerald-500/5'
          : 'border-zinc-700/60 hover:border-zinc-500/60 bg-zinc-900/40 hover:bg-zinc-800/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        id="allotment-file-input"
      />

      <div className={`p-4 rounded-2xl transition-all duration-300 ${
        file ? 'bg-emerald-500/15' : 'bg-zinc-800/60 group-hover:bg-zinc-700/50'
      }`}>
        {file ? (
          <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
        ) : (
          <Upload className={`w-10 h-10 transition-colors ${
            dragging ? 'text-violet-400' : 'text-zinc-500 group-hover:text-zinc-300'
          }`} />
        )}
      </div>

      {file ? (
        <div className="text-center">
          <p className="text-sm font-semibold text-emerald-300">{file.name}</p>
          <p className="text-xs text-zinc-400 mt-1">
            {(file.size / 1024).toFixed(1)} KB · Click to change
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-semibold text-zinc-300">
            {dragging ? 'Drop the Excel file here' : 'Drag & drop your allotment file'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Supports <span className="text-zinc-300">.xlsx</span> and{' '}
            <span className="text-zinc-300">.csv</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Result Card
// ─────────────────────────────────────────────────────────────────────────────
function UploadResultCard({ result }: { result: AllotmentUploadResponse }) {
  const success = result.status === 'success';
  const errors = result.errors || [];

  return (
    <div className={`rounded-2xl border p-6 ${
      success
        ? 'bg-emerald-500/5 border-emerald-500/25'
        : 'bg-amber-500/5 border-amber-500/25'
    }`}>
      <div className="flex items-start gap-4 mb-5">
        <div className={`p-2.5 rounded-xl ${success ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
          {success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          )}
        </div>
        <div>
          <p className={`font-semibold ${success ? 'text-emerald-300' : 'text-amber-300'}`}>
            {success ? 'Allotment Complete' : 'Upload Status — Review Details'}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {result.total_rows_processed ?? 0} rows processed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Rows Processed', value: result.total_rows_processed ?? 0, icon: FileSpreadsheet, color: 'text-blue-400' },
          { label: 'Sections Created', value: result.sections_created ?? 0, icon: Layers, color: 'text-violet-400' },
          { label: 'Batches Created', value: result.batches_created ?? 0, icon: FlaskConical, color: 'text-emerald-400' },
          { label: 'Faculty Slots', value: result.faculty_slots_generated ?? 0, icon: Users, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 text-center">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-[10px] text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Error list */}
      {errors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {errors.length} validation message(s):
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {errors.map((err: AllotmentRowError, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-lg p-2.5 text-xs"
              >
                {err.row > 0 && (
                  <span className="font-mono text-red-400 flex-shrink-0">Row {err.row}</span>
                )}
                <span className="text-zinc-400">
                  {err.student_id && err.student_id !== '-' && (
                    <><span className="text-zinc-300">{err.student_id}</span> / </>
                  )}
                  {err.course_code && err.course_code !== '-' && (
                    <><span className="font-mono">{err.course_code}</span>: </>
                  )}
                  {err.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Offerings Panel
// ─────────────────────────────────────────────────────────────────────────────
function OfferingsPanel({ offerings }: { offerings: OfferingInfo[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (offerings.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-500 text-sm">
        No offerings found for this term.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {offerings.map((o) => {
        const isOpen = expanded === o.id;
        const TierIcon = o.course_tier === 'CLASS' ? Layers : o.course_tier === 'DEPARTMENT' ? Building2 : Globe;
        return (
          <div key={o.id} className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : o.id)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-800/30 transition-colors"
            >
              <div className="p-2 bg-zinc-800/60 rounded-lg">
                <TierIcon className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-zinc-500">{o.course_code}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TIER_COLORS[o.course_tier] ?? ''}`}>
                    {o.course_tier}
                  </span>
                  <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded border border-zinc-700/40">
                    {MODE_LABELS[o.delivery_mode]}
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-200 truncate mt-0.5">{o.course_name}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-xs text-zinc-500">
                <span>{o.sections.length} sections</span>
                <span>{o.batches.length} batches</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-zinc-800/60 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sections */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" /> Theory Sections
                  </p>
                  {o.sections.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">None</p>
                  ) : (
                    <div className="space-y-2">
                      {o.sections.map((s) => (
                        <div key={s.id} className="bg-zinc-800/40 rounded-lg p-2.5 text-xs border border-zinc-700/30">
                          <p className="font-mono text-blue-300 font-medium">{s.section_name}</p>
                          <p className="text-zinc-400 mt-1">
                            Faculty:{' '}
                            <span className={s.faculty_name ? 'text-emerald-300' : 'text-zinc-500 italic'}>
                              {s.faculty_name ?? 'To be assigned'}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Batches */}
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FlaskConical className="w-3 h-3" /> Practical Batches
                  </p>
                  {o.batches.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">None</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {o.batches.map((b) => (
                        <div key={b.id} className="bg-zinc-800/40 rounded-lg p-2.5 text-xs border border-zinc-700/30">
                          <p className="font-mono text-violet-300 font-medium">{b.batch_name}</p>
                          <p className="text-zinc-400 mt-1">
                            Faculty:{' '}
                            <span className={b.faculty_name ? 'text-emerald-300' : 'text-zinc-500 italic'}>
                              {b.faculty_name ?? 'To be assigned'}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminAllotmentPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AllotmentUploadResponse | null>(null);
  const [offerings, setOfferings] = useState<OfferingInfo[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('2026-27-SEM5');
  const user = typeof window !== 'undefined' ? getStoredUser() : null;

  const loadOfferings = useCallback(async () => {
    setLoadingOfferings(true);
    try {
      const res = await fetchWithAuth(
        `/api/v1/enrollments/offerings?academic_term=${encodeURIComponent(selectedTerm)}`
      );
      if (res.ok) {
        const data: OfferingInfo[] = await res.json();
        setOfferings(data);
      }
    } catch {
      /* swallow */
    } finally {
      setLoadingOfferings(false);
    }
  }, [selectedTerm]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) { router.push('/login'); return; }
    loadOfferings();
  }, [loadOfferings, router]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getStoredToken();
      const res = await fetch('/api/v1/enrollments/upload-allotment', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const errDetail =
          typeof data?.detail === 'string'
            ? data.detail
            : Array.isArray(data?.detail)
            ? JSON.stringify(data.detail)
            : 'Upload failed. Check file format.';

        setResult({
          status: 'partial',
          total_rows_processed: data?.total_rows_processed ?? 0,
          sections_created: 0,
          batches_created: 0,
          faculty_slots_generated: 0,
          errors:
            Array.isArray(data?.errors) && data.errors.length > 0
              ? data.errors
              : [{ row: 0, student_id: '-', course_code: '-', error: errDetail }],
        });
      } else {
        setResult({
          status: data.status || 'success',
          total_rows_processed: data.total_rows_processed ?? 0,
          sections_created: data.sections_created ?? 0,
          batches_created: data.batches_created ?? 0,
          faculty_slots_generated: data.faculty_slots_generated ?? 0,
          errors: data.errors || [],
        });
        await loadOfferings();
        setFile(null);
      }
    } catch {
      setResult({
        status: 'partial',
        total_rows_processed: 0,
        sections_created: 0,
        batches_created: 0,
        faculty_slots_generated: 0,
        errors: [{ row: 0, student_id: '-', course_code: '-', error: 'Network error during upload.' }],
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1f_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1f_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
      </div>

      {/* Nav */}
      <header className="relative z-10 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/chat" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm text-zinc-200">ACADEMIC COMMAND CENTER</span>
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
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/60 px-3 py-2 rounded-lg transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              My Subjects
            </Link>

            {user?.role === 'FACULTY' && (
              <Link
                href="/faculty"
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/60 px-3 py-2 rounded-lg transition-all"
              >
                <Users className="w-3.5 h-3.5" />
                Attendance Ledger
              </Link>
            )}

            <Link
              href="/admin/allotment"
              className="flex items-center gap-1.5 text-xs text-white bg-zinc-800/80 border border-zinc-700/50 px-3 py-2 rounded-lg font-medium"
            >
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              Allotment Engine
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-800/60 rounded-lg border border-zinc-700/40">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-xs text-zinc-300">{user?.full_name ?? 'Admin'}</span>
              <span className="text-[10px] text-zinc-500 font-mono">{user?.role}</span>
            </div>
            <button
              onClick={() => { clearAuthSession(); router.push('/login'); }}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 px-3 py-2 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs font-mono text-violet-400 uppercase tracking-widest mb-1">
            Allotment Engine · Admin Panel
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Student Allotment & Batch Manager
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Upload the semester allotment sheet to auto-create theory sections, lab batches, and faculty slots.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Upload Panel */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-zinc-200 mb-1 flex items-center gap-2">
                <Upload className="w-4 h-4 text-violet-400" />
                Upload Allotment Sheet
              </h2>
              <p className="text-xs text-zinc-500 mb-5">
                Required columns: student_id, roll_no, department, class_div, course_code, academic_term
              </p>
              <UploadZone onFileSelect={setFile} file={file} loading={uploading} />

              {file && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    id="upload-submit-btn"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-violet-500/20"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Run Allotment Engine
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { setFile(null); setResult(null); }}
                    className="p-3 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-xl border border-zinc-700/40 transition-all"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              )}
            </div>

            {/* Column Reference */}
            <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Excel Column Reference
              </p>
              <div className="space-y-2">
                {[
                  ['student_id', 'ST2024001', 'ERP student identifier'],
                  ['roll_no', '24CE101', 'Used for deterministic sort'],
                  ['department', 'Computer', 'Department name'],
                  ['class_div', 'CE-A', 'Class division'],
                  ['course_code', '25PCC13CE19', 'Must exist in courses table'],
                  ['academic_term', '2026-27-SEM5', 'Matches offerings'],
                ].map(([col, ex, desc]) => (
                  <div key={col} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-violet-300 w-28 flex-shrink-0">{col}</span>
                    <span className="text-zinc-500 flex-1">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Results + Offerings */}
          <div className="lg:col-span-3 space-y-6">
            {result && <UploadResultCard result={result} />}

            {/* Offerings Panel */}
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Course Offerings
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      id="admin-term-select"
                      value={selectedTerm}
                      onChange={(e) => setSelectedTerm(e.target.value)}
                      className="appearance-none bg-zinc-800/70 border border-zinc-700/50 text-xs text-zinc-300 pl-2.5 pr-7 py-1.5 rounded-lg"
                    >
                      {['2026-27-SEM5', '2026-27-SEM6', '2025-26-SEM5'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                  </div>
                  <button
                    id="refresh-offerings-btn"
                    onClick={loadOfferings}
                    disabled={loadingOfferings}
                    className="p-1.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 rounded-lg transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loadingOfferings ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {loadingOfferings ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : (
                <OfferingsPanel offerings={offerings} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
