'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { Users, AlertTriangle, CheckCircle2, Search, Filter, Building2, Layers } from 'lucide-react';
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
  const [selectedDeptCode, setSelectedDeptCode] = useState('ALL');
  const [selectedDivName, setSelectedDivName] = useState('ALL');
  const [riskFilterOnly, setRiskFilterOnly] = useState(false);

  useEffect(() => {
    loadFacultyData();
  }, [selectedDeptCode, selectedDivName]);

  const loadFacultyData = async () => {
    setLoading(true);
    try {
      let url = '/api/attendance/faculty/overview';
      const params = new URLSearchParams();
      if (selectedDeptCode !== 'ALL') params.append('dept_code', selectedDeptCode);
      if (selectedDivName !== 'ALL') params.append('div_name', selectedDivName);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error('Failed to load faculty overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = riskFilterOnly ? student.overall_risk : true;
    return matchesSearch && matchesRisk;
  });

  const totalStudents = students.length;
  const atRiskCount = students.filter((s) => s.overall_risk).length;

  return (
    <div className="min-h-screen bg-ink flex flex-col font-sans text-paper">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-paper tracking-wide">
              Faculty Attendance Ledger
            </h1>
            <p className="text-xs text-subtle font-sans mt-0.5">
              Multi-Department Academic Compliance Monitor & At-Risk Audit Ledger (310 Students)
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link
              href="/faculty/mark"
              className="px-4 py-2 bg-paper text-ink font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs"
            >
              <span>+ Mark Live Attendance</span>
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

        {/* Filters */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-surface p-4 border border-border rounded-lg shadow-xs">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or email..."
                className="w-full bg-ink border border-border focus:border-paper rounded-lg pl-9 pr-4 py-2 text-xs text-paper placeholder-subtle focus:outline-none"
              />
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Building2 className="h-4 w-4 text-subtle shrink-0" />
              <select
                value={selectedDeptCode}
                onChange={(e) => {
                  setSelectedDeptCode(e.target.value);
                  setSelectedDivName('ALL');
                }}
                className="bg-ink border border-border focus:border-paper rounded-lg px-3 py-2 text-xs font-mono text-paper focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                <option value="COMP">COMP — Computer</option>
                <option value="AIDS">AIDS — AI & Data Sci</option>
                <option value="ECS">ECS — Electronics</option>
                <option value="MECH">MECH — Mechanical</option>
              </select>
            </div>

            {/* Division Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Layers className="h-4 w-4 text-subtle shrink-0" />
              <select
                value={selectedDivName}
                onChange={(e) => setSelectedDivName(e.target.value)}
                className="bg-ink border border-border focus:border-paper rounded-lg px-3 py-2 text-xs font-mono text-paper focus:outline-none"
              >
                <option value="ALL">All Divisions</option>
                {selectedDeptCode === 'COMP' ? (
                  <>
                    <option value="A">Division A (70)</option>
                    <option value="B">Division B (70)</option>
                  </>
                ) : (
                  <option value="A">Division A</option>
                )}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRiskFilterOnly(!riskFilterOnly)}
            className={`px-3 py-2 rounded-lg border text-xs font-mono flex items-center gap-2 transition-colors ${
              riskFilterOnly
                ? 'bg-paper text-ink border-paper font-bold'
                : 'bg-ink border-border text-subtle hover:text-paper'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>{riskFilterOnly ? 'SHOWING AT RISK ONLY' : 'FILTER AT RISK (<75%)'}</span>
          </button>
        </div>

        {/* Ledger Table */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-ink text-subtle font-mono tracking-wider uppercase">
                <th className="p-4 font-semibold">Student Name</th>
                <th className="p-4 font-semibold">Email</th>
                <th className="p-4 font-semibold text-center">Total Subjects</th>
                <th className="p-4 font-semibold text-center">Subjects at Risk</th>
                <th className="p-4 font-semibold text-right">Overall %</th>
                <th className="p-4 font-semibold text-center">Risk Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-subtle font-mono">
                    Loading student ledger records from PostgreSQL...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-subtle font-mono">
                    No student records match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <React.Fragment key={student.student_id}>
                    <tr className="hover:bg-ink/50 transition-colors">
                      <td className="p-4 font-semibold text-paper">{student.student_name}</td>
                      <td className="p-4 font-mono text-subtle">{student.student_email}</td>
                      <td className="p-4 text-center font-mono text-paper">{student.total_subjects}</td>
                      <td className="p-4 text-center font-mono">
                        {student.subjects_at_risk > 0 ? (
                          <span className="font-bold text-paper border-b-2 border-paper">{student.subjects_at_risk}</span>
                        ) : (
                          <span className="text-subtle">0</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono text-sm font-semibold">
                        <span className={student.overall_risk ? 'font-bold text-paper underline' : 'text-subtle'}>
                          {student.overall_percentage}%
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {student.overall_risk ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase px-2.5 py-1 rounded bg-paper text-ink border border-paper font-bold">
                            <AlertTriangle className="h-3 w-3 text-ink" />
                            [!] At Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase px-2.5 py-1 rounded bg-ink text-subtle border border-border">
                            <CheckCircle2 className="h-3 w-3 text-subtle" />
                            [OK] Good Standing
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Detailed Subject Sub-rows */}
                    <tr className="bg-ink/40 border-b border-border">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {student.subjects.map((sub) => (
                            <div
                              key={sub.id}
                              className={`p-2.5 rounded border flex items-center justify-between text-xs ${
                                sub.is_at_risk
                                  ? 'bg-surface border-border-strong text-paper font-semibold shadow-xs'
                                  : 'bg-surface border-border text-subtle'
                              }`}
                            >
                              <div>
                                <p className="font-semibold text-paper">{sub.subject}</p>
                                <p className="font-mono text-[10px] text-subtle">
                                  {sub.attended_classes} / {sub.total_classes} Attended
                                </p>
                              </div>
                              <div className="text-right">
                                <span className={`font-mono text-xs ${sub.is_at_risk ? 'font-bold text-paper' : 'text-subtle'}`}>
                                  {sub.percentage}%
                                </span>
                                {sub.is_at_risk && (
                                  <p className="text-[10px] font-mono text-paper font-bold">
                                    Needs +{sub.classes_needed_to_clear_risk} classes
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
