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

// ─────────────────────────────────────────────────────────────────────────────
// Faculty Upload Result Card
// ─────────────────────────────────────────────────────────────────────────────
function FacultyUploadResultCard({
  result,
}: {
  result: {
    status: string;
    total_assignments_processed: number;
    sections_assigned: number;
    batches_assigned: number;
    errors: string[];
  };
}) {
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
            {success ? 'Faculty Teaching Matrix Ingested' : 'Faculty Allocation Notice'}
          </p>
          <p className="text-xs text-[#71717A] mt-0.5 font-mono">
            {result.total_assignments_processed ?? 0} teaching assignments processed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { label: 'Assignments', value: result.total_assignments_processed ?? 0, icon: FileSpreadsheet },
          { label: 'Theory Sections', value: result.sections_assigned ?? 0, icon: BookOpen },
          { label: 'Practical Batches', value: result.batches_assigned ?? 0, icon: FlaskConical },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#FAFAFB] border border-[#E4E4E7] rounded p-2.5 text-center">
            <Icon className="w-4 h-4 mx-auto mb-1 text-[#09090B]" />
            <p className="text-xl font-bold text-[#09090B] leading-none">{value}</p>
            <p className="text-[10px] text-[#71717A] font-mono mt-1">{label}</p>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {errors.map((err: string, i: number) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900 font-mono">
              {err}
            </div>
          ))}
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
          <div className="flex items-center gap-1 p-1 bg-[#F4F4F6] rounded-md border border-[#E4E4E7]">
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
          <div className="relative flex-1 max-w-xs">
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

  // Tabs: students vs faculty
  const [uploadTab, setUploadTab] = useState<'students' | 'faculty'>('students');
  const [facultyFile, setFacultyFile] = useState<File | null>(null);
  const [uploadingFaculty, setUploadingFaculty] = useState(false);
  const [facultyUploadResult, setFacultyUploadResult] = useState<{
    status: string;
    total_assignments_processed: number;
    sections_assigned: number;
    batches_assigned: number;
    errors: string[];
  } | null>(null);

  // Manual Add Faculty Modal State
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newFacultyDept, setNewFacultyDept] = useState('COMP');
  const [newFacultyPassword, setNewFacultyPassword] = useState('faculty123');
  const [addingFaculty, setAddingFaculty] = useState(false);
  const [addFacultySuccess, setAddFacultySuccess] = useState<string | null>(null);
  const [addFacultyError, setAddFacultyError] = useState<string | null>(null);

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

  const handleUploadFacultyMatrix = async () => {
    if (!facultyFile) return;
    setUploadingFaculty(true);
    setFacultyUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', facultyFile);
      const token = getStoredToken();
      const res = await fetch(
        `/api/v1/admin/upload-faculty-allocation?academic_term=${encodeURIComponent(selectedTerm)}`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setFacultyUploadResult({
          status: 'partial',
          total_assignments_processed: data?.total_assignments_processed ?? 0,
          sections_assigned: 0,
          batches_assigned: 0,
          errors: Array.isArray(data?.detail) ? data.detail : [data?.detail || 'Upload failed'],
        });
      } else {
        setFacultyUploadResult(data);
        await loadOfferings();
        await loadFaculty();
        setFacultyFile(null);
      }
    } catch {
      setFacultyUploadResult({
        status: 'error',
        total_assignments_processed: 0,
        sections_assigned: 0,
        batches_assigned: 0,
        errors: ['Network error while uploading faculty matrix'],
      });
    } finally {
      setUploadingFaculty(false);
    }
  };

  const downloadSampleFacultyMatrix = () => {
    const csvContent =
      'faculty_email,faculty_name,course_code,class_div,batch_name,academic_term\n' +
      'anita.kulkarni@academic.edu,Prof. Anita Kulkarni,25PCC13CE14,COMP-A,ALL,2026-27-SEM5\n' +
      'rajesh.iyer@academic.edu,Prof. Rajesh Iyer,25PCC13CE19,COMP-A,ALL,2026-27-SEM5\n' +
      'sneha.deshmukh@academic.edu,Prof. Sneha Deshmukh,25PCC13CE21,COMP-A,ALL,2026-27-SEM5\n' +
      'vikram.malhotra@academic.edu,Prof. Vikram Malhotra,25PCC13CE22,COMP-A,ALL,2026-27-SEM5\n' +
      'arjun.nair@academic.edu,Prof. Arjun Nair,25VSE13CE04,COMP-A,COMP-A-B1,2026-27-SEM5\n' +
      'arjun.nair@academic.edu,Prof. Arjun Nair,25VSE13CE04,COMP-A,COMP-A-B2,2026-27-SEM5\n' +
      'priya.sharma@academic.edu,Prof. Priya Sharma,25VSE13CE04,COMP-A,COMP-A-B3,2026-27-SEM5\n' +
      'vikram.malhotra@academic.edu,Prof. Vikram Malhotra,25PEC13CE11,COMP-A,ALL,2026-27-SEM5\n' +
      'priya.sharma@academic.edu,Prof. Priya Sharma,25PEC13CE12,COMP-A,ALL,2026-27-SEM5\n' +
      'rajesh.iyer@academic.edu,Prof. Rajesh Iyer,25PEC13CE13,COMP-A,ALL,2026-27-SEM5\n' +
      'anita.kulkarni@academic.edu,Prof. Anita Kulkarni,25PEC13CE14,COMP-A,ALL,2026-27-SEM5\n' +
      'rajesh.iyer@academic.edu,Prof. Rajesh Iyer,25PECL13CE15,COMP-A,COMP-A-B1,2026-27-SEM5\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_faculty_allocation_matrix.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 700, color: '#FF5500', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Allotment Engine — Admin Panel
          </p>
          <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '26px', fontWeight: 800, color: '#09090B', letterSpacing: '-0.02em' }}>
            Student Allotment & Batch Manager
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A', marginTop: '4px' }}>
            Upload the semester allotment sheet to auto-create theory sections, lab batches, and faculty slots.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Upload Panel */}
          <div className="lg:col-span-2 space-y-5">
            {/* Segmented Upload Tabs */}
            <div className="flex items-center gap-1 p-1 bg-white border border-[#E4E4E7] rounded-md shadow-sm">
              <button
                type="button"
                onClick={() => setUploadTab('students')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all ${
                  uploadTab === 'students'
                    ? 'bg-[#18181B] text-white shadow-sm'
                    : 'text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F6]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Student Allotment
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('faculty')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all ${
                  uploadTab === 'faculty'
                    ? 'bg-[#18181B] text-white shadow-sm'
                    : 'text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F6]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Faculty Matrix
              </button>
            </div>

            {/* TAB 1: Student Allotment */}
            {uploadTab === 'students' && (
              <>
                <div className="bg-white border border-[#E4E4E7] rounded-md p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-[#09090B] mb-1 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#FF5500]" />
                    Upload Student Allotment Sheet
                  </h2>
                  <p className="text-xs text-[#71717A] mb-4">
                    Required columns: student_id, roll_no, department, class_div, course_code, academic_term
                  </p>
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
              </>
            )}

            {/* TAB 2: Faculty Teaching Matrix */}
            {uploadTab === 'faculty' && (
              <>
                <div className="bg-white border border-[#E4E4E7] rounded-md p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-bold text-[#09090B] flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-[#FF5500]" />
                      Upload Faculty Teaching Matrix
                    </h2>
                  </div>
                  <p className="text-xs text-[#71717A] mb-4">
                    Auto-allocate teachers to proper classes & batches based on teaching specifications.
                  </p>

                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={downloadSampleFacultyMatrix}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#F4F4F6] hover:bg-zinc-200 border border-[#E4E4E7] rounded text-xs text-[#09090B] font-bold transition-all"
                    >
                      <Download className="w-3.5 h-3.5 text-[#FF5500]" />
                      Download Sample Faculty Matrix CSV
                    </button>
                  </div>

                  <UploadZone onFileSelect={setFacultyFile} file={facultyFile} loading={uploadingFaculty} />

                  {facultyFile && (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={handleUploadFacultyMatrix}
                        disabled={uploadingFaculty}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#FF5500] hover:bg-[#E64D00] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded transition-all shadow-md shadow-orange-500/20"
                      >
                        {uploadingFaculty ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Allocating Faculty…
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Run Faculty Allocation
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => { setFacultyFile(null); setFacultyUploadResult(null); }}
                        className="p-2.5 bg-[#F4F4F6] hover:bg-zinc-200 rounded border border-[#E4E4E7] transition-all text-[#71717A]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Faculty Column Reference */}
                <div className="bg-white border border-[#E4E4E7] rounded-md p-5 shadow-sm">
                  <p className="text-xs font-bold text-[#09090B] uppercase tracking-wider mb-3 font-mono">
                    Faculty Matrix Column Reference
                  </p>
                  <div className="space-y-2">
                    {[
                      ['faculty_email', 'anita.kulkarni@academic.edu', 'Teacher identifier / email'],
                      ['course_code', '25PCC13CE14', 'Course code in curriculum'],
                      ['class_div', 'COMP-A', 'Class division to teach'],
                      ['batch_name', 'ALL / COMP-A-B1', 'ALL for theory; B1/B2 for practical lab'],
                      ['academic_term', '2026-27-SEM5', 'Semester term'],
                    ].map(([col, ex, desc]) => (
                      <div key={col} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-[#09090B] font-bold bg-[#F4F4F6] px-1.5 py-0.5 rounded border border-[#E4E4E7] w-28 flex-shrink-0">{col}</span>
                        <span className="text-[#71717A] flex-1">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Results + Offerings */}
          <div className="lg:col-span-3 space-y-6">
            {result && <UploadResultCard result={result} />}
            {facultyUploadResult && <FacultyUploadResultCard result={facultyUploadResult} />}

            {/* Offerings Panel */}
            <div className="bg-white border border-[#E4E4E7] rounded-md p-6 shadow-sm">
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
                  <div className="relative">
                    <select
                      id="admin-term-select"
                      value={selectedTerm}
                      onChange={(e) => setSelectedTerm(e.target.value)}
                      className="appearance-none bg-white border border-[#E4E4E7] text-xs text-[#09090B] font-mono pl-2.5 pr-7 py-1.5 rounded focus:outline-none focus:border-[#FF5500]"
                    >
                      {['2026-27-SEM5', '2026-27-SEM6', '2025-26-SEM5'].map((t) => (
                        <option key={t} value={t}>{t}</option>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white border border-[#E4E4E7] rounded-md p-6 shadow-2xl">
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
    </div>
  );
}
