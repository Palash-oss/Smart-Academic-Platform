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
  MessageSquare,
  Plus,
  UserPlus,
  Download,
  Check,
  Search,
  Filter,
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
    <div
      className={`rounded-2xl border p-6 ${
        success
          ? 'bg-emerald-500/5 border-emerald-500/25'
          : 'bg-amber-500/5 border-amber-500/25'
      }`}
    >
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
            {success ? 'Faculty Teaching Matrix Ingested' : 'Faculty Allocation Complete with Warnings'}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {result.total_assignments_processed ?? 0} teaching assignments processed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          {
            label: 'Assignments Processed',
            value: result.total_assignments_processed ?? 0,
            icon: FileSpreadsheet,
            color: 'text-blue-400',
          },
          {
            label: 'Theory Sections Allocated',
            value: result.sections_assigned ?? 0,
            icon: BookOpen,
            color: 'text-violet-400',
          },
          {
            label: 'Practical Batches Allocated',
            value: result.batches_assigned ?? 0,
            icon: FlaskConical,
            color: 'text-emerald-400',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 text-center">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-[10px] text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {errors.length} notice(s):
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {errors.map((err: string, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-200"
              >
                <span>{err}</span>
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
// Offerings Panel
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
      <div className="text-center py-10 text-zinc-500 text-sm">
        No offerings found for this term.
      </div>
    );
  }

  // Count core vs electives
  const coreCount = offerings.filter((o) => o.course_tier === 'CLASS').length;
  const electiveCount = offerings.filter((o) => o.course_tier === 'DEPARTMENT').length;

  // Filter offerings
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
      {/* Clean Header Toolbar: Department Badge + Category Segmented Control + Search */}
      <div className="space-y-2.5 pb-3 border-b border-zinc-800/80">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Syllabus Category Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('CLASS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'CLASS'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Core Subjects ({coreCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DEPARTMENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'DEPARTMENT'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Electives ({electiveCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === 'ALL'
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <span>All ({offerings.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search subject or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-zinc-950/70 border border-zinc-700/60 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Informative Subline */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-semibold text-zinc-300">
              <Building2 className="w-3 h-3 text-violet-400" />
              Computer Engineering (COMPS)
            </span>
            <span>•</span>
            <span>Official Syllabus Scheme</span>
          </div>
          <span>
            Showing <strong className="text-zinc-200">{filteredOfferings.length}</strong> {activeTab === 'CLASS' ? 'core courses' : 'courses'}
          </span>
        </div>
      </div>

      {/* Compact Course List Container */}
      <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2">
        {filteredOfferings.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-xs bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800">
            No courses match the active search filter.
          </div>
        ) : (
          filteredOfferings.map((o) => {
            const isOpen = expanded === o.id;
            const TierIcon = o.course_tier === 'CLASS' ? Layers : o.course_tier === 'DEPARTMENT' ? Building2 : Globe;

            // Allocation status calculation
            const totalSlots = o.sections.length + o.batches.length;
            const assignedSlots =
              o.sections.filter((s) => s.faculty_id).length +
              o.batches.filter((b) => b.faculty_id).length;
            const isFullyAssigned = totalSlots > 0 && assignedSlots === totalSlots;
            const isPartiallyAssigned = assignedSlots > 0 && assignedSlots < totalSlots;

            return (
              <div
                key={o.id}
                className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'bg-zinc-900/90 border-violet-500/50 shadow-lg shadow-black/30'
                    : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 bg-zinc-800 rounded-lg flex-shrink-0 border border-zinc-700/50">
                      <TierIcon className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs text-white font-bold tracking-wide">
                          {o.course_code}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-medium ${
                            TIER_COLORS[o.course_tier] ?? ''
                          }`}
                        >
                          {o.course_tier === 'CLASS' ? 'Core' : 'Elective'}
                        </span>
                        <span className="text-[9px] text-zinc-400 bg-zinc-800/80 px-1.5 py-0.2 rounded border border-zinc-700/40">
                          {MODE_LABELS[o.delivery_mode]}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-200 truncate mt-0.5">
                        {o.course_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {/* Allocation Status Indicator */}
                    {isFullyAssigned ? (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Allocated
                      </span>
                    ) : isPartiallyAssigned ? (
                      <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {assignedSlots}/{totalSlots} Slots
                      </span>
                    ) : (
                      <span className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700/60 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        Unassigned
                      </span>
                    )}

                    <span className="hidden sm:inline-block font-mono text-[11px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/40">
                      {o.sections.length > 0 && `${o.sections.length} sec`}
                      {o.sections.length > 0 && o.batches.length > 0 && ' • '}
                      {o.batches.length > 0 && `${o.batches.length} lab`}
                    </span>

                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-violet-400' : ''
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-800/70 p-3.5 bg-zinc-950/40 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Theory Sections */}
                    <div>
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-blue-400" /> Theory Sections
                      </p>
                      {o.sections.length === 0 ? (
                        <p className="text-[11px] text-zinc-600 italic">None (Practical Only)</p>
                      ) : (
                        <div className="space-y-1.5">
                          {o.sections.map((s) => (
                            <div
                              key={s.id}
                              className="bg-zinc-800/40 rounded-lg p-2 text-xs border border-zinc-700/30"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-blue-300 font-semibold">{s.section_name}</span>
                                {s.faculty_name && (
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                                    Assigned
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-zinc-500 text-[11px] flex-shrink-0">Faculty:</span>
                                <select
                                  value={s.faculty_id || ''}
                                  disabled={assigningId === s.id}
                                  onChange={async (e) => {
                                    if (!e.target.value) return;
                                    setAssigningId(s.id);
                                    await onAssignSection(s.id, e.target.value);
                                    setAssigningId(null);
                                  }}
                                  className="bg-zinc-900 border border-zinc-700/60 text-xs text-zinc-200 rounded px-2 py-1 flex-1 focus:border-violet-500 focus:outline-none"
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
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <FlaskConical className="w-3 h-3 text-purple-400" /> Practical Batches
                      </p>
                      {o.batches.length === 0 ? (
                        <p className="text-[11px] text-zinc-600 italic">None</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {o.batches.map((b) => (
                            <div
                              key={b.id}
                              className="bg-zinc-800/40 rounded-lg p-2 text-xs border border-zinc-700/30"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-violet-300 font-semibold">{b.batch_name}</span>
                                {b.faculty_name && (
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                                    Assigned
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-zinc-500 text-[11px] flex-shrink-0">Faculty:</span>
                                <select
                                  value={b.faculty_id || ''}
                                  disabled={assigningId === b.id}
                                  onChange={async (e) => {
                                    if (!e.target.value) return;
                                    setAssigningId(b.id);
                                    await onAssignBatch(b.id, e.target.value);
                                    setAssigningId(null);
                                  }}
                                  className="bg-zinc-900 border border-zinc-700/60 text-xs text-zinc-200 rounded px-2 py-1 flex-1 focus:border-violet-500 focus:outline-none"
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
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1f_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1f_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
      </div>

      {/* Unified Role-Aware Navbar */}
      <Navbar />

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
            {/* Segmented Upload Tabs */}
            <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl">
              <button
                type="button"
                onClick={() => setUploadTab('students')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  uploadTab === 'students'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Student Allotment
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('faculty')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  uploadTab === 'faculty'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Faculty Matrix
              </button>
            </div>

            {/* TAB 1: Student Allotment */}
            {uploadTab === 'students' && (
              <>
                <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold text-zinc-200 mb-1 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-violet-400" />
                    Upload Student Allotment Sheet
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
              </>
            )}

            {/* TAB 2: Faculty Teaching Matrix */}
            {uploadTab === 'faculty' && (
              <>
                <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-emerald-400" />
                      Upload Faculty Teaching Matrix
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4">
                    Auto-allocate teachers to proper classes & batches based on teaching specifications.
                  </p>

                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={downloadSampleFacultyMatrix}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 rounded-xl text-xs text-zinc-200 font-medium transition-all"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      Download Sample Faculty Matrix CSV
                    </button>
                  </div>

                  <UploadZone onFileSelect={setFacultyFile} file={facultyFile} loading={uploadingFaculty} />

                  {facultyFile && (
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={handleUploadFacultyMatrix}
                        disabled={uploadingFaculty}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                      >
                        {uploadingFaculty ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Allocating Faculty…
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Run Faculty Allocation
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => { setFacultyFile(null); setFacultyUploadResult(null); }}
                        className="p-3 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-xl border border-zinc-700/40 transition-all"
                      >
                        <X className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Faculty Column Reference */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Faculty Matrix Column Reference
                  </p>
                  <div className="space-y-2">
                    {[
                      ['faculty_email', 'anita.kulkarni@academic.edu', 'Teacher identifier / email / name'],
                      ['course_code', '25PCC13CE14', 'Course / subject code in curriculum'],
                      ['class_div', 'COMP-A', 'Class division to teach'],
                      ['batch_name', 'ALL / COMP-A-B1', 'ALL for theory section; B1/B2 for specific lab'],
                      ['academic_term', '2026-27-SEM5', 'Semester term (optional, defaults to selected)'],
                    ].map(([col, ex, desc]) => (
                      <div key={col} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-emerald-300 w-28 flex-shrink-0">{col}</span>
                        <span className="text-zinc-500 flex-1">{desc}</span>
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
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Course Offerings
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowAddFacultyModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-medium transition-all"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    + Add Faculty
                  </button>
                  <button
                    onClick={handleAutoEnrollCore}
                    disabled={autoEnrollingCore}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                  >
                    <BookOpen className={`w-3 h-3 ${autoEnrollingCore ? 'animate-spin' : ''}`} />
                    {autoEnrollingCore ? 'Enrolling…' : '🎯 Auto-Enroll Core'}
                  </button>
                  <button
                    onClick={handleAutoAssign}
                    disabled={autoAssigning || offerings.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${autoAssigning ? 'animate-spin' : ''}`} />
                    {autoAssigning ? 'Assigning…' : '⚡ Auto-Assign Faculty'}
                  </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/15 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add New Faculty</h3>
                  <p className="text-xs text-zinc-400">Register instructor for class and batch allocation</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddFacultyModal(false)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addFacultySuccess && (
              <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                {addFacultySuccess}
              </div>
            )}

            {addFacultyError && (
              <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {addFacultyError}
              </div>
            )}

            <form onSubmit={handleCreateFaculty} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prof. Anita Kulkarni"
                  value={newFacultyName}
                  onChange={(e) => setNewFacultyName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. anita.kulkarni@academic.edu"
                  value={newFacultyEmail}
                  onChange={(e) => setNewFacultyEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Department</label>
                <select
                  value={newFacultyDept}
                  onChange={(e) => setNewFacultyDept(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="COMP">Computer Engineering (COMP)</option>
                  <option value="AIDS">Artificial Intelligence & Data Science (AIDS)</option>
                  <option value="ECS">Electronics & Computer Science (ECS)</option>
                  <option value="MECH">Mechanical Engineering (MECH)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Initial Password</label>
                <input
                  type="text"
                  value={newFacultyPassword}
                  onChange={(e) => setNewFacultyPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">Faculty can change this after logging in.</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddFacultyModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingFaculty}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
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
