'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Folder, 
  FolderOpen, 
  ChevronDown, 
  ChevronRight,
  BookOpen,
  Building2,
  Plus
} from 'lucide-react';
import Link from 'next/link';

interface SubjectRecord {
  id: string;
  subject: string;
  total_classes: number;
  attended_classes: number;
  percentage: number;
  is_at_risk: boolean;
  classes_needed_to_clear_risk: number;
}

interface StudentOverview {
  student_id: string;
  student_name: string;
  student_email: string;
  department_code: string;
  division_name: string;
  division_label: string;
  overall_percentage: number;
  overall_risk: boolean;
  total_subjects: number;
  subjects_at_risk: number;
  subjects: SubjectRecord[];
}

export default function FacultyDashboardPage() {
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivisionTab, setSelectedDivisionTab] = useState<string>('ALL');
  const [riskFilterOnly, setRiskFilterOnly] = useState(false);
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFacultyData();
  }, []);

  const loadFacultyData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/attendance/faculty/overview');
      if (res.ok) {
        const data: StudentOverview[] = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error('Failed to load faculty overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentExpanded = (studentId: string) => {
    const nextSet = new Set(expandedStudentIds);
    if (nextSet.has(studentId)) {
      nextSet.delete(studentId);
    } else {
      nextSet.add(studentId);
    }
    setExpandedStudentIds(nextSet);
  };

  const expandAll = (expand: boolean) => {
    if (expand) {
      setExpandedStudentIds(new Set(students.map((s) => s.student_id)));
    } else {
      setExpandedStudentIds(new Set());
    }
  };

  // Get unique divisions available for current department
  const availableDivisions = Array.from(new Set(students.map((s) => s.division_label))).sort();
  const departmentCode = students.length > 0 ? students[0].department_code : 'FACULTY';

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDivision = selectedDivisionTab === 'ALL' || student.division_label === selectedDivisionTab;
    const matchesRisk = riskFilterOnly ? student.overall_risk : true;
    return matchesSearch && matchesDivision && matchesRisk;
  });

  const totalStudents = students.length;
  const atRiskCount = students.filter((s) => s.overall_risk).length;

  return (
    <div className="min-h-screen bg-ink flex flex-col font-sans text-paper">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Department Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-paper text-ink font-mono font-bold text-xs rounded uppercase">
                {departmentCode} DEPARTMENT
              </span>
              <span className="text-xs font-mono text-subtle">Faculty Student Directory</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-paper tracking-wide">
              Department Attendance & Compliance Ledger
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <Link
              href="/faculty/mark"
              className="px-4 py-2.5 bg-paper text-ink font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Mark Session Attendance</span>
            </Link>

            <div className="px-3 py-2 bg-surface border border-border rounded-lg flex items-center gap-2 shadow-xs">
              <Users className="h-4 w-4 text-paper" />
              <span>ENROLLED: <strong className="text-paper">{totalStudents}</strong></span>
            </div>

            <div className="px-3 py-2 bg-surface border border-border-strong text-paper rounded-lg flex items-center gap-2 font-bold shadow-xs">
              <AlertTriangle className="h-4 w-4 text-paper" />
              <span>AT RISK (&lt;75%): <strong>{atRiskCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Division Folders / Tabs Bar */}
        <div className="flex items-center justify-between border-b border-border pb-2 overflow-x-auto">
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setSelectedDivisionTab('ALL')}
              className={`px-3 py-2 rounded-t-lg border-t border-x font-semibold transition-all flex items-center gap-2 ${
                selectedDivisionTab === 'ALL'
                  ? 'bg-surface text-paper border-border shadow-xs'
                  : 'bg-ink text-subtle border-transparent hover:text-paper'
              }`}
            >
              <Folder className="h-4 w-4 text-paper" />
              <span>All Divisions ({totalStudents})</span>
            </button>

            {availableDivisions.map((divLabel) => {
              const divCount = students.filter((s) => s.division_label === divLabel).length;
              const isSelected = selectedDivisionTab === divLabel;
              return (
                <button
                  key={divLabel}
                  onClick={() => setSelectedDivisionTab(divLabel)}
                  className={`px-3 py-2 rounded-t-lg border-t border-x font-semibold transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-surface text-paper border-border shadow-xs'
                      : 'bg-ink text-subtle border-transparent hover:text-paper'
                  }`}
                >
                  {isSelected ? <FolderOpen className="h-4 w-4 text-paper" /> : <Folder className="h-4 w-4 text-subtle" />}
                  <span>Folder {divLabel} ({divCount})</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-subtle">
            <button
              onClick={() => expandAll(true)}
              className="hover:text-paper text-[11px] underline"
            >
              Expand All
            </button>
            <span>|</span>
            <button
              onClick={() => expandAll(false)}
              className="hover:text-paper text-[11px] underline"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Search & Filter Control Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-4 border border-border rounded-lg shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name or email..."
              className="w-full bg-ink border border-border focus:border-paper rounded-lg pl-9 pr-4 py-2 text-xs text-paper placeholder-subtle focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setRiskFilterOnly(!riskFilterOnly)}
            className={`px-3.5 py-2 rounded-lg border text-xs font-mono flex items-center gap-2 transition-colors ${
              riskFilterOnly
                ? 'bg-paper text-ink border-paper font-bold'
                : 'bg-ink border-border text-subtle hover:text-paper'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>{riskFilterOnly ? 'SHOWING AT RISK ONLY' : 'FILTER AT RISK (<75%)'}</span>
          </button>
        </div>

        {/* Division Student Folders / Accordion List */}
        <div className="space-y-3 font-sans">
          {loading ? (
            <div className="p-12 text-center bg-surface border border-border rounded-lg text-subtle font-mono text-xs">
              Loading department student directory from PostgreSQL...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-surface border border-border rounded-lg text-subtle font-mono text-xs">
              No student records match the active filter criteria.
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isExpanded = expandedStudentIds.has(student.student_id);
              return (
                <div
                  key={student.student_id}
                  className="bg-surface border border-border rounded-lg overflow-hidden transition-all shadow-xs"
                >
                  {/* Folder Header */}
                  <div
                    onClick={() => toggleStudentExpanded(student.student_id)}
                    className="p-4 bg-surface hover:bg-surface-hover cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/50 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-ink border border-border rounded text-paper shrink-0">
                        {isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4 text-subtle" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-paper">{student.student_name}</h3>
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-ink border border-border text-paper font-bold">
                            {student.division_label}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-subtle">{student.student_email}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 font-mono text-xs">
                      <div className="text-right">
                        <span className="text-subtle text-[10px] uppercase block">Overall Attendance</span>
                        <span className={`text-sm font-bold ${student.overall_risk ? 'text-paper underline' : 'text-paper'}`}>
                          {student.overall_percentage}%
                        </span>
                      </div>

                      <div>
                        {student.overall_risk ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2.5 py-1 rounded bg-paper text-ink border border-paper font-bold">
                            <AlertTriangle className="h-3 w-3 text-ink" />
                            [!] At Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2.5 py-1 rounded bg-ink text-subtle border border-border">
                            <CheckCircle2 className="h-3 w-3 text-subtle" />
                            [OK] Good Standing
                          </span>
                        )}
                      </div>

                      <div className="p-1 text-subtle hover:text-paper">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Folder Content: Per-Subject Detailed Grid */}
                  {isExpanded && (
                    <div className="p-4 bg-ink/60 border-t border-border space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-subtle border-b border-border pb-2">
                        <span className="flex items-center gap-1 font-semibold text-paper">
                          <BookOpen className="h-3.5 w-3.5 text-paper" />
                          Enrolled Courses ({student.subjects.length})
                        </span>
                        <span>Min Threshold: 75.0%</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {student.subjects.map((sub) => (
                          <div
                            key={sub.id}
                            className={`p-3 rounded border text-xs flex flex-col justify-between space-y-2 ${
                              sub.is_at_risk
                                ? 'bg-surface border-border-strong text-paper font-semibold shadow-xs'
                                : 'bg-surface border-border text-subtle'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-paper text-xs leading-snug">{sub.subject}</h4>
                              <span className={`font-mono text-xs shrink-0 font-bold ${sub.is_at_risk ? 'text-paper' : 'text-subtle'}`}>
                                {sub.percentage}%
                              </span>
                            </div>

                            <div className="flex items-center justify-between font-mono text-[11px] text-subtle border-t border-border/40 pt-1.5">
                              <span>{sub.attended_classes} / {sub.total_classes} Attended</span>
                              {sub.is_at_risk && (
                                <span className="text-paper font-bold text-[10px]">
                                  Needs +{sub.classes_needed_to_clear_risk} classes
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
