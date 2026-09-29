'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
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
  Plus,
  UserPlus,
  Download,
  Check,
  Search,
  SlidersHorizontal,
  Sparkles,
  Clock,
  Trash2,
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
// Upload Zone (Technical Light Style)
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
      className={`relative cursor-pointer rounded-md border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 transition-all duration-200 group ${
        dragging
          ? 'border-[#FF5500] bg-[#FFF4ED]'
          : file
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-[#D4D4D8] hover:border-[#FF5500] bg-[#FAFAFB] hover:bg-[#FFF4ED]/30'
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

      <div className={`p-3 rounded-md transition-all duration-200 ${
        file ? 'bg-emerald-100' : 'bg-white border border-[#E4E4E7]'
      }`}>
        {file ? (
          <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
        ) : (
          <Upload className={`w-8 h-8 transition-colors ${
            dragging ? 'text-[#FF5500]' : 'text-[#71717A] group-hover:text-[#FF5500]'
          }`} />
        )}
      </div>

      {file ? (
        <div className="text-center">
          <p className="text-sm font-bold text-emerald-800">{file.name}</p>
          <p className="text-xs text-emerald-600 mt-0.5 font-mono">
            {(file.size / 1024).toFixed(1)} KB · Click to change file
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-bold text-[#09090B]">
            {dragging ? 'Drop file to upload' : 'Drag & drop allotment sheet'}
          </p>
          <p className="text-xs text-[#71717A] mt-1 font-mono">
            Supported formats: <strong className="text-[#09090B]">.xlsx</strong>, <strong className="text-[#09090B]">.csv</strong>
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
    <div className={`rounded-md border p-5 bg-white ${
      success ? 'border-emerald-300' : 'border-amber-300'
    }`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded ${success ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {success ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
        </div>
        <div>
          <p className={`font-bold ${success ? 'text-emerald-800' : 'text-amber-800'}`}>
            {success ? 'Allotment Processing Complete' : 'Upload Status — Review Warnings'}
          </p>
          <p className="text-xs text-[#71717A] mt-0.5 font-mono">
            {result.total_rows_processed ?? 0} rows processed successfully
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {[
          { label: 'Rows Processed', value: result.total_rows_processed ?? 0, icon: FileSpreadsheet },
          { label: 'Sections Created', value: result.sections_created ?? 0, icon: Layers },
          { label: 'Batches Created', value: result.batches_created ?? 0, icon: FlaskConical },
          { label: 'Faculty Slots', value: result.faculty_slots_generated ?? 0, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#FAFAFB] border border-[#E4E4E7] rounded p-2.5 text-center">
            <Icon className="w-4 h-4 mx-auto mb-1 text-[#09090B]" />
            <p className="text-xl font-bold text-[#09090B] leading-none">{value}</p>
            <p className="text-[10px] text-[#71717A] font-mono mt-1">{label}</p>
          </div>
        ))}
      </div>

      {result.notices && result.notices.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-sky-800 mb-2 flex items-center gap-1.5 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            FCFS Allotment & Min 20 Students Optimization ({result.notices.length}):
          </p>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {result.notices.map((notice: string, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded p-2 text-xs text-sky-900"
              >
                <Check className="w-3.5 h-3.5 text-sky-600 flex-shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div>
          <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5 font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            {errors.length} notice(s):
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {errors.map((err: AllotmentRowError, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 text-xs"
              >
                {err.row > 0 && (
                  <span className="font-mono text-red-700 font-bold flex-shrink-0">Row {err.row}</span>
                )}
                <span className="text-red-900">
                  {err.student_id && err.student_id !== '-' && (
                    <><span className="font-bold">{err.student_id}</span> / </>
                  )}
                  {err.course_code && err.course_code !== '-' && (
                    <><span className="font-mono font-bold">{err.course_code}</span>: </>
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



interface FacultyOption {
  id: string;
  full_name: string;
  email: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offerings Panel (Clean Technical Architectural Theme)
// ─────────────────────────────────────────────────────────────────────────────
function OfferingsPanel({
  offerings,
  facultyList,
  onAssignSection,
  onAssignBatch,
}: {
  offerings: OfferingInfo[];
  facultyList: FacultyOption[];
  onAssignSection: (sectionId: string, facultyId: string) => Promise<void>;
  onAssignBatch: (batchId: string, facultyId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'CLASS' | 'DEPARTMENT' | 'ALL'>('CLASS');

  if (offerings.length === 0) {
    return (
      <div className="text-center py-10 text-[#71717A] text-xs font-mono">
        No course offerings found for this academic term.
      </div>
    );
  }

  const coreCount = offerings.filter((o) => o.course_tier === 'CLASS').length;
  const electiveCount = offerings.filter((o) => o.course_tier === 'DEPARTMENT').length;

  const filteredOfferings = offerings.filter((o) => {
    if (activeTab !== 'ALL' && o.course_tier !== activeTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const codeMatch = o.course_code.toLowerCase().includes(q);
      const nameMatch = o.course_name.toLowerCase().includes(q);
      const secMatch = o.sections.some(
        (s) =>
          s.section_name.toLowerCase().includes(q) ||
          (s.faculty_name && s.faculty_name.toLowerCase().includes(q))
      );
      const batchMatch = o.batches.some(
        (b) =>
          b.batch_name.toLowerCase().includes(q) ||
          (b.faculty_name && b.faculty_name.toLowerCase().includes(q))
      );
      if (!codeMatch && !nameMatch && !secMatch && !batchMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Header Toolbar: Category Tabs + Search */}
      <div className="space-y-2.5 pb-3 border-b border-[#E4E4E7]">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#F4F4F6] rounded-md border border-[#E4E4E7] overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('CLASS')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'CLASS'
                  ? 'bg-[#18181B] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#09090B] hover:bg-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Core Subjects ({coreCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DEPARTMENT')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'DEPARTMENT'
                  ? 'bg-[#18181B] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#09090B] hover:bg-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Electives ({electiveCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'ALL'
                  ? 'bg-[#18181B] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#09090B] hover:bg-white'
              }`}
            >
              <span>All ({offerings.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search subject or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-[#E4E4E7] rounded-md text-xs text-[#09090B] placeholder-[#71717A] focus:outline-none focus:border-[#FF5500]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#09090B]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Subline */}
        <div className="flex items-center justify-between text-[11px] text-[#71717A] font-mono px-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-[#09090B]">
              <Building2 className="w-3 h-3 text-[#FF5500]" />
              Computer Engineering (COMPS)
            </span>
            <span>•</span>
            <span>Official Syllabus Scheme</span>
          </div>
          <span>
            Showing <strong className="text-[#09090B]">{filteredOfferings.length}</strong> courses
          </span>
        </div>
      </div>

      {/* Course List */}
      <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2">
        {filteredOfferings.length === 0 ? (
          <div className="text-center py-10 text-[#71717A] text-xs bg-[#FAFAFB] rounded-md border border-dashed border-[#E4E4E7] font-mono">
            No courses match the active search filter.
          </div>
        ) : (
          filteredOfferings.map((o) => {
            const isOpen = expanded === o.id;
            const TierIcon = o.course_tier === 'CLASS' ? Layers : o.course_tier === 'DEPARTMENT' ? Building2 : Globe;

            const totalSlots = o.sections.length + o.batches.length;
            const assignedSlots =
              o.sections.filter((s) => s.faculty_id).length +
              o.batches.filter((b) => b.faculty_id).length;
            const isFullyAssigned = totalSlots > 0 && assignedSlots === totalSlots;
            const isPartiallyAssigned = assignedSlots > 0 && assignedSlots < totalSlots;

            return (
              <div
                key={o.id}
                className={`border rounded-md transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'bg-white border-[#FF5500] shadow-md'
                    : 'bg-white border-[#E4E4E7] hover:border-[#D4D4D8]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 bg-[#F4F4F6] rounded flex-shrink-0 border border-[#E4E4E7]">
                      <TierIcon className="w-3.5 h-3.5 text-[#09090B]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs text-[#09090B] font-bold tracking-wide">
                          {o.course_code}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-medium ${
                          TIER_COLORS[o.course_tier] ?? ''
                        }`}>
                          {o.course_tier === 'CLASS' ? 'Core' : 'Elective'}
                        </span>
                        <span className="text-[9px] text-[#52525B] bg-[#F4F4F6] px-1.5 py-0.2 rounded border border-[#E4E4E7] font-mono">
                          {MODE_LABELS[o.delivery_mode]}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#09090B] truncate mt-0.5">
                        {o.course_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {isFullyAssigned ? (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded font-mono font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Allocated
                      </span>
                    ) : isPartiallyAssigned ? (
                      <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-mono font-medium inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        {assignedSlots}/{totalSlots} Slots
                      </span>
                    ) : (
                      <span className="text-[9px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded font-mono font-medium inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        Unassigned
                      </span>
                    )}

                    <span className="hidden sm:inline-block font-mono text-[11px] text-[#71717A] bg-[#F4F4F6] px-2 py-0.5 rounded border border-[#E4E4E7]">
                      {o.sections.length > 0 && `${o.sections.length} sec`}
                      {o.sections.length > 0 && o.batches.length > 0 && ' • '}
                      {o.batches.length > 0 && `${o.batches.length} lab`}
                    </span>

                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#71717A] transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#FF5500]' : ''
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[#E4E4E7] p-3.5 bg-[#FAFAFB] grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Theory Sections */}
                    <div>
                      <p className="text-[11px] font-bold text-[#09090B] uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                        <BookOpen className="w-3 h-3 text-[#FF5500]" /> Theory Sections
                      </p>
                      {o.sections.length === 0 ? (
                        <p className="text-[11px] text-[#71717A] italic">None (Practical Only)</p>
                      ) : (
                        <div className="space-y-1.5">
                          {o.sections.map((s) => (
                            <div
                              key={s.id}
                              className="bg-white rounded p-2.5 text-xs border border-[#E4E4E7] shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[#09090B] font-bold">{s.section_name}</span>
                                {s.faculty_name && (
                                  <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                                    Assigned
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[#71717A] text-[11px] font-mono flex-shrink-0">Faculty:</span>
                                <select
                                  value={s.faculty_id || ''}
                                  disabled={assigningId === s.id}
                                  onChange={async (e) => {
                                    if (!e.target.value) return;
                                    setAssigningId(s.id);
                                    await onAssignSection(s.id, e.target.value);
                                    setAssigningId(null);
                                  }}
                                  className="bg-white border border-[#E4E4E7] text-xs text-[#09090B] rounded px-2 py-1 flex-1 focus:border-[#FF5500] focus:outline-none"
                                >
                                  <option value="">-- Assign Faculty --</option>
                                  {facultyList.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.full_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Practical Batches */}
                    <div>
                      <p className="text-[11px] font-bold text-[#09090B] uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                        <FlaskConical className="w-3 h-3 text-[#FF5500]" /> Practical Batches
                      </p>
                      {o.batches.length === 0 ? (
                        <p className="text-[11px] text-[#71717A] italic">None</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {o.batches.map((b) => (
                            <div
                              key={b.id}
                              className="bg-white rounded p-2.5 text-xs border border-[#E4E4E7] shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[#09090B] font-bold">{b.batch_name}</span>
                                {b.faculty_name && (
                                  <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                                    Assigned
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[#71717A] text-[11px] font-mono flex-shrink-0">Faculty:</span>
                                <select
                                  value={b.faculty_id || ''}
                                  disabled={assigningId === b.id}
                                  onChange={async (e) => {
                                    if (!e.target.value) return;
                                    setAssigningId(b.id);
                                    await onAssignBatch(b.id, e.target.value);
                                    setAssigningId(null);
                                  }}
                                  className="bg-white border border-[#E4E4E7] text-xs text-[#09090B] rounded px-2 py-1 flex-1 focus:border-[#FF5500] focus:outline-none"
                                >
                                  <option value="">-- Assign Faculty --</option>
                                  {facultyList.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.full_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
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
  const [facultyList, setFacultyList] = useState<FacultyOption[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [autoEnrollingCore, setAutoEnrollingCore] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ full_name?: string; role?: string } | null>(null);

  // Manual Add Faculty Modal State
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newFacultyDept, setNewFacultyDept] = useState('COMP');
  const [newFacultyPassword, setNewFacultyPassword] = useState('faculty123');
  const [addingFaculty, setAddingFaculty] = useState(false);
  const [addFacultySuccess, setAddFacultySuccess] = useState<string | null>(null);
  const [addFacultyError, setAddFacultyError] = useState<string | null>(null);

  // Allotment Dissolve State
  const [showDissolveModal, setShowDissolveModal] = useState(false);
  const [dissolvingAllotment, setDissolvingAllotment] = useState(false);
  const [dissolveSuccessMsg, setDissolveSuccessMsg] = useState<string | null>(null);
  const [dissolveErrorMsg, setDissolveErrorMsg] = useState<string | null>(null);

  const loadFaculty = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/v1/faculty/all');
      if (res.ok) {
        const data = await res.json();
        setFacultyList(data);
      }
    } catch {
      /* ignore */
    }
  }, []);

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
    const stored = getStoredUser();
    if (stored) {
      setCurrentUser(stored);
      if (stored.role !== 'ADMIN') {
        router.push(stored.role === 'FACULTY' ? '/faculty' : '/chat');
        return;
      }
    }
    loadOfferings();
    loadFaculty();
  }, [loadOfferings, loadFaculty, router]);

  const handleAssignSection = async (sectionId: string, facultyId: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/sections/${sectionId}/assign-faculty`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty_id: facultyId }),
      });
      if (res.ok) {
        loadOfferings();
      }
    } catch {
      /* ignore */
    }
  };

  const handleAssignBatch = async (batchId: string, facultyId: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/batches/${batchId}/assign-faculty`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty_id: facultyId }),
      });
      if (res.ok) {
        loadOfferings();
      }
    } catch {
      /* ignore */
    }
  };

  const handleAutoEnrollCore = async () => {
    setAutoEnrollingCore(true);
    try {
      const res = await fetchWithAuth(
        `/api/v1/admin/auto-enroll-core?academic_term=${encodeURIComponent(selectedTerm)}`,
        { method: 'POST' }
      );
      if (res.ok) {
        await loadOfferings();
      }
    } catch {
      /* ignore */
    } finally {
      setAutoEnrollingCore(false);
    }
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      const res = await fetchWithAuth(
        `/api/v1/admin/auto-assign-faculty?academic_term=${encodeURIComponent(selectedTerm)}`,
        { method: 'POST' }
      );
      if (res.ok) {
        await loadOfferings();
      }
    } catch {
      /* ignore */
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleDissolveAllotment = async () => {
    setDissolvingAllotment(true);
    setDissolveSuccessMsg(null);
    setDissolveErrorMsg(null);
    try {
      const res = await fetchWithAuth(
        `/api/v1/admin/dissolve-allotment?academic_term=${encodeURIComponent(selectedTerm)}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) {
        setDissolveErrorMsg(data?.detail || 'Failed to dissolve elective allotments.');
      } else {
        setDissolveSuccessMsg(data?.message || 'Elective allotments dissolved successfully.');
        setResult(null);
        await loadOfferings();
        setTimeout(() => {
          setShowDissolveModal(false);
        }, 1200);
      }
    } catch {
      setDissolveErrorMsg('Network error while dissolving elective allotments.');
    } finally {
      setDissolvingAllotment(false);
    }
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingFaculty(true);
    setAddFacultySuccess(null);
    setAddFacultyError(null);
    try {
      const res = await fetchWithAuth('/api/v1/faculty/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newFacultyName,
          email: newFacultyEmail,
          department_code: newFacultyDept,
          password: newFacultyPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddFacultyError(data?.detail || 'Failed to create faculty member');
      } else {
        setAddFacultySuccess(`Prof. ${newFacultyName} registered successfully!`);
        setNewFacultyName('');
        setNewFacultyEmail('');
        await loadFaculty();
        setTimeout(() => {
          setShowAddFacultyModal(false);
          setAddFacultySuccess(null);
        }, 1500);
      }
    } catch {
      setAddFacultyError('Network error while registering faculty member');
    } finally {
      setAddingFaculty(false);
    }
  };

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
          notices: data.notices || [],
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
    <div style={{ minHeight: '100vh', background: '#ECECEE', color: '#09090B', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Unified Role-Aware Navbar */}
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#FF5500', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Allotment Engine — Admin Panel
          </p>
          <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '24px', fontWeight: 800, color: '#09090B', letterSpacing: '-0.02em' }} className="sm:text-[26px]">
            Student Allotment & Batch Manager
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#71717A', marginTop: '4px' }} className="sm:text-sm">
            Upload the semester allotment sheet to auto-create theory sections, lab batches, and faculty slots.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
          {/* Left: Upload Panel */}
          <div className="lg:col-span-2 space-y-5">
            {/* Student Allotment Panel */}
            <div className="bg-white border border-[#E4E4E7] rounded-md p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-[#09090B] mb-1 flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#FF5500]" />
                Upload Student Allotment Sheet
              </h2>
              <p className="text-xs text-[#71717A] mb-4">
                Required columns: student_id, roll_no, department, class_div, academic_term, preference_1, preference_2, preference_3
              </p>

              <div className="mb-4">
                <a
                  href="/allotment_sem5_student_choices.csv"
                  download="allotment_sem5_student_choices.csv"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#FFF4ED] hover:bg-[#FFE8D9] border border-[#FED7AA] rounded text-xs text-[#C2410C] font-bold transition-all shadow-sm group"
                >
                  <Download className="w-3.5 h-3.5 text-[#FF5500] group-hover:scale-110 transition-transform" />
                  <span>Download Test Allotment CSV (140 Students • FCFS & Min-20 Rule)</span>
                </a>
              </div>

              {/* Dissolve Helper Card */}
              <div className="mb-4 flex items-center justify-between p-3 bg-rose-50/70 border border-rose-200/80 rounded-md">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-rose-100 text-rose-600 rounded">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-950 leading-tight">Need to Re-Run Allotment?</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">Dissolve current PEC & OE student electives before uploading a new CSV.</p>
                  </div>
                </div>
                <button
                  type="button"
                  id="dissolve-helper-btn"
                  onClick={() => {
                    setDissolveSuccessMsg(null);
                    setDissolveErrorMsg(null);
                    setShowDissolveModal(true);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Dissolve</span>
                </button>
              </div>

              <UploadZone onFileSelect={setFile} file={file} loading={uploading} />

              {file && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    id="upload-submit-btn"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#FF5500] hover:bg-[#E64D00] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded transition-all shadow-md shadow-orange-500/20"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5" />
                        Run Allotment Engine
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { setFile(null); setResult(null); }}
                    className="p-2.5 bg-[#F4F4F6] hover:bg-zinc-200 rounded border border-[#E4E4E7] transition-all text-[#71717A]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Column Reference */}
            <div className="bg-white border border-[#E4E4E7] rounded-md p-5 shadow-sm">
              <p className="text-xs font-bold text-[#09090B] uppercase tracking-wider mb-3 font-mono">
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
                    <span className="font-mono text-[#09090B] font-bold bg-[#F4F4F6] px-1.5 py-0.5 rounded border border-[#E4E4E7] w-28 flex-shrink-0">{col}</span>
                    <span className="text-[#71717A] flex-1">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Results + Offerings */}
          <div className="lg:col-span-3 space-y-6">
            {dissolveSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-start justify-between gap-3 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-950">Elective Allotments Dissolved</p>
                    <p className="text-emerald-800 mt-0.5">{dissolveSuccessMsg}</p>
                    <p className="text-[11px] text-emerald-700 mt-1 font-mono">
                      ✓ Core mandatory courses intact • Official college faculty mapped and ready for fresh allotment engine run.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDissolveSuccessMsg(null)}
                  className="text-emerald-600 hover:text-emerald-800 p-0.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {result && <UploadResultCard result={result} />}

            {/* Offerings Panel */}
            <div className="bg-white border border-[#E4E4E7] rounded-md p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <h2 className="text-sm font-bold text-[#09090B] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FF5500]" />
                  Course Offerings
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowAddFacultyModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-white rounded text-xs font-bold transition-all shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    + Add Faculty
                  </button>
                  <button
                    onClick={handleAutoEnrollCore}
                    disabled={autoEnrollingCore}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F4F6] hover:bg-zinc-200 text-[#09090B] border border-[#E4E4E7] rounded text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <BookOpen className={`w-3 h-3 ${autoEnrollingCore ? 'animate-spin' : ''}`} />
                    {autoEnrollingCore ? 'Enrolling…' : 'Auto-Enroll Core'}
                  </button>
                  <button
                    onClick={handleAutoAssign}
                    disabled={autoAssigning || offerings.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5500] hover:bg-[#E64D00] text-white rounded text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${autoAssigning ? 'animate-spin' : ''}`} />
                    {autoAssigning ? 'Assigning…' : 'Auto-Assign Faculty'}
                  </button>
                  <button
                    id="dissolve-allotment-btn"
                    onClick={() => {
                      setDissolveSuccessMsg(null);
                      setDissolveErrorMsg(null);
                      setShowDissolveModal(true);
                    }}
                    disabled={dissolvingAllotment}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                    title="Dissolve all student elective allotments (PEC, PECL, OE) for re-testing"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Dissolve Electives
                  </button>
                  <div className="relative">
                    <select
                      id="admin-term-select"
                      value={selectedTerm}
                      onChange={(e) => setSelectedTerm(e.target.value)}
                      className="appearance-none bg-white border border-[#E4E4E7] text-xs text-[#09090B] font-mono pl-2.5 pr-7 py-1.5 rounded focus:outline-none focus:border-[#FF5500]"
                    >
                      {[
                        { value: '2026-27-SEM5', label: '2026-27-SEM5 (Jul–Dec 2026) • Ongoing' },
                        { value: '2026-27-SEM6', label: '2026-27-SEM6 (Jan–Jun 2027) • Next Sem' },
                      ].map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#71717A] pointer-events-none" />
                  </div>
                  <button
                    id="refresh-offerings-btn"
                    onClick={loadOfferings}
                    disabled={loadingOfferings}
                    className="p-1.5 bg-white hover:bg-[#F4F4F6] border border-[#E4E4E7] rounded transition-all text-[#71717A]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingOfferings ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {loadingOfferings ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <OfferingsPanel
                  offerings={offerings}
                  facultyList={facultyList}
                  onAssignSection={handleAssignSection}
                  onAssignBatch={handleAssignBatch}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Manual Add Faculty Modal */}
      {showAddFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white border border-[#E4E4E7] rounded-md p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#F4F4F6] rounded text-[#09090B] border border-[#E4E4E7]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#09090B]">Add New Faculty</h3>
                  <p className="text-xs text-[#71717A]">Register instructor for class and batch allocation</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddFacultyModal(false)}
                className="p-1.5 text-[#71717A] hover:text-[#09090B] rounded hover:bg-[#F4F4F6] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addFacultySuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                {addFacultySuccess}
              </div>
            )}

            {addFacultyError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                {addFacultyError}
              </div>
            )}

            <form onSubmit={handleCreateFaculty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#09090B] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prof. Anita Kulkarni"
                  value={newFacultyName}
                  onChange={(e) => setNewFacultyName(e.target.value)}
                  className="w-full bg-white border border-[#E4E4E7] rounded px-3 py-2 text-sm text-[#09090B] placeholder-[#71717A] focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#09090B] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. anita.kulkarni@academic.edu"
                  value={newFacultyEmail}
                  onChange={(e) => setNewFacultyEmail(e.target.value)}
                  className="w-full bg-white border border-[#E4E4E7] rounded px-3 py-2 text-sm text-[#09090B] placeholder-[#71717A] focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#09090B] mb-1">Department</label>
                <select
                  value={newFacultyDept}
                  onChange={(e) => setNewFacultyDept(e.target.value)}
                  className="w-full bg-white border border-[#E4E4E7] rounded px-3 py-2 text-sm text-[#09090B] focus:outline-none focus:border-[#FF5500]"
                >
                  <option value="COMP">Computer Engineering (COMP)</option>
                  <option value="AIDS">Artificial Intelligence & Data Science (AIDS)</option>
                  <option value="ECS">Electronics & Computer Science (ECS)</option>
                  <option value="MECH">Mechanical Engineering (MECH)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#09090B] mb-1">Initial Password</label>
                <input
                  type="text"
                  value={newFacultyPassword}
                  onChange={(e) => setNewFacultyPassword(e.target.value)}
                  className="w-full bg-white border border-[#E4E4E7] rounded px-3 py-2 font-mono text-xs text-[#09090B] focus:outline-none focus:border-[#FF5500]"
                />
                <p className="text-[11px] text-[#71717A] mt-1 font-mono">Faculty can change this after logging in.</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddFacultyModal(false)}
                  className="px-4 py-2 bg-[#F4F4F6] hover:bg-zinc-200 text-[#09090B] text-xs font-bold rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingFaculty}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#FF5500] hover:bg-[#E64D00] text-white text-xs font-bold rounded shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all"
                >
                  {addingFaculty ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {addingFaculty ? 'Creating...' : 'Create Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dissolve Allotment Confirmation Modal */}
      {showDissolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white border border-[#E4E4E7] rounded-md p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 rounded text-rose-600 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#09090B]">Dissolve Elective Allotments</h3>
                  <p className="text-xs text-[#71717A] font-mono">{selectedTerm}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDissolveModal(false)}
                className="p-1.5 text-[#71717A] hover:text-[#09090B] rounded hover:bg-[#F4F4F6] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5 text-xs text-[#3F3F46]">
              <p>
                This action will wipe all student enrollments, theory sections, and lab batches for elective courses in <strong className="text-[#09090B]">{selectedTerm}</strong>:
              </p>
              
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded font-mono text-[11px] space-y-1.5">
                <div className="text-amber-900 font-bold flex items-start gap-1.5">
                  <span className="text-[#FF5500] font-mono">1.</span>
                  <span>Department Electives (PEC / PECL):</span>
                </div>
                <p className="text-amber-800 pl-4 font-sans text-xs">
                  Blockchain Technology, Deep Learning, Cyber Security, Natural Language Processing Lab, Image Processing Lab, Industrial IoT Lab.
                </p>

                <div className="text-amber-900 font-bold flex items-start gap-1.5 pt-1">
                  <span className="text-[#FF5500] font-mono">2.</span>
                  <span>Institute Open Electives (OE):</span>
                </div>
                <p className="text-amber-800 pl-4 font-sans text-xs">
                  Health, Wellness & Psychology, Emotional & Spiritual Intelligence.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-950 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Core Mandatory Courses & Student Data Preserved:</span>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    Data Warehousing, Computer Networks, Cryptography, TCS, Cloud Computing Lab, and all 140 student accounts remain 100% untouched.
                  </p>
                </div>
              </div>

              <p className="text-[#71717A] text-[11px]">
                After dissolving, you can re-run the Allotment Engine test fresh. The engine will assign the 22 official college faculty members to all courses.
              </p>
            </div>

            {dissolveErrorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{dissolveErrorMsg}</span>
              </div>
            )}

            {dissolveSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{dissolveSuccessMsg}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() => setShowDissolveModal(false)}
                disabled={dissolvingAllotment}
                className="px-4 py-2 bg-[#F4F4F6] hover:bg-zinc-200 text-[#09090B] text-xs font-bold rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-dissolve-btn"
                onClick={handleDissolveAllotment}
                disabled={dissolvingAllotment}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all"
              >
                {dissolvingAllotment ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Dissolving Allotments…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Confirm & Dissolve Electives
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

