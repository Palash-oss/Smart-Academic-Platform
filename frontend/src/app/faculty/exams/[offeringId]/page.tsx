'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Award,
  Layers,
  FileSpreadsheet,
  Lock,
  Unlock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Save,
  Download,
  Upload,
  Plus,
  Trash2,
  ChevronLeft,
  RefreshCw,
  Info,
  ShieldCheck,
  Printer,
  Search,
  Filter,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  fetchCourseTemplate,
  updateCourseTemplate,
  fetchCourseGradebook,
  saveBatchMarks,
  lockEvaluationMarks,
  requestUnlockMarks,
  fetchOBEAttainment,
  ExamTemplateResponse,
  GradebookResponse,
  OBEAttainmentResponse,
  ExamComponentDef,
  ExamSubComponentDef,
} from '@/lib/exams';
import { getStoredUser } from '@/lib/api';

export default function CourseExamWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const offeringId = String(params.offeringId || '');

  const [activeTab, setActiveTab] = useState<'blueprint' | 'gradebook' | 'attainment'>('gradebook');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Workspace Data
  const [template, setTemplate] = useState<ExamTemplateResponse | null>(null);
  const [gradebook, setGradebook] = useState<GradebookResponse | null>(null);
  const [attainment, setAttainment] = useState<OBEAttainmentResponse | null>(null);

  // Gradebook Local Editing State
  const [editedScores, setEditedScores] = useState<Record<string, number>>({}); // key: `${student_id}:${sub_id}`
  const [editedAbsents, setEditedAbsents] = useState<Record<string, boolean>>({}); // key: `${student_id}:${sub_id}`
  const [savingMarks, setSavingMarks] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Unlock Request Modal State
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockComponent, setUnlockComponent] = useState('ALL');
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);

  // Blueprint Editing State
  const [blueprintTitle, setBlueprintTitle] = useState('');
  const [blueprintComponents, setBlueprintComponents] = useState<ExamComponentDef[]>([]);
  const [savingBlueprint, setSavingBlueprint] = useState(false);

  // Dedicated Component View in Gradebook ('ALL' | 'THEORY_ISE' | 'THEORY_MSE' | 'THEORY_ESE' | 'LAB_ISE' | 'TUT_ISE')
  const [gradebookComponentTab, setGradebookComponentTab] = useState<string>('ALL');

  // Add Component Modal / Dropdown state
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [newCompType, setNewCompType] = useState('THEORY_ESE');
  const [newCompTitle, setNewCompTitle] = useState('End-Semester Examination (ESE)');
  const [newCompMarks, setNewCompMarks] = useState(50);

  // Filter & Search State
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [filterBatch, setFilterBatch] = useState<string>('ALL');
  const [studentSearch, setStudentSearch] = useState<string>('');

  const availableCOs = useMemo(() => {
    if (template && template.available_cos && template.available_cos.length > 0) {
      return template.available_cos;
    }
    return [
      { id: 'co1', co_code: 'CO1', description: 'Fundamental principles and concepts', bloom_level: 'L1_REMEMBER' },
      { id: 'co2', co_code: 'CO2', description: 'Theoretical problem solving', bloom_level: 'L3_APPLY' },
      { id: 'co3', co_code: 'CO3', description: 'Analytical modeling & algorithms', bloom_level: 'L4_ANALYZE' },
      { id: 'co4', co_code: 'CO4', description: 'System design under realistic constraints', bloom_level: 'L6_CREATE' },
      { id: 'co5', co_code: 'CO5', description: 'Evaluation & comparative analysis', bloom_level: 'L5_EVALUATE' },
      { id: 'co6', co_code: 'CO6', description: 'Practical modern tool implementation', bloom_level: 'L3_APPLY' },
    ];
  }, [template]);

  const displayedComponents = useMemo(() => {
    if (!template) return [];
    if (gradebookComponentTab === 'ALL') return template.components;
    return template.components.filter((c) => c.component_type === gradebookComponentTab);
  }, [template, gradebookComponentTab]);

  const divisions = useMemo(() => {
    if (!gradebook) return [];
    return Array.from(new Set(gradebook.students.map((s) => s.division_name).filter(Boolean)));
  }, [gradebook]);

  const batches = useMemo(() => {
    if (!gradebook) return [];
    return Array.from(new Set(gradebook.students.map((s) => s.batch_name).filter(Boolean))) as string[];
  }, [gradebook]);

  const displayedStudents = useMemo(() => {
    if (!gradebook) return [];
    return gradebook.students.filter((st) => {
      if (filterDivision !== 'ALL' && st.division_name !== filterDivision) return false;
      if (filterBatch !== 'ALL' && st.batch_name !== filterBatch) return false;
      if (studentSearch) {
        const q = studentSearch.toLowerCase();
        return (
          st.full_name.toLowerCase().includes(q) ||
          st.roll_no.toLowerCase().includes(q) ||
          (st.erp_id && st.erp_id.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [gradebook, filterDivision, filterBatch, studentSearch]);

  // 1-Click ISE Presets
  const applyISEPreset = (presetType: 'split' | 'full_exam' | 'two_tests' | 'continuous') => {
    const newComps = [...blueprintComponents];
    const iseIdx = newComps.findIndex((c) => c.component_type === 'THEORY_ISE');
    if (iseIdx === -1) return;

    if (presetType === 'split') {
      newComps[iseIdx].sub_components = [
        {
          id: `sub-${Date.now()}-1`,
          component_id: newComps[iseIdx].id,
          title: 'Formative Activity / Mini Assignment',
          sub_type: 'ACTIVITY',
          max_marks: 10,
          mapped_cos: ['CO1'],
          order_index: 1,
        },
        {
          id: `sub-${Date.now()}-2`,
          component_id: newComps[iseIdx].id,
          title: 'Class Unit Test 1',
          sub_type: 'TEST',
          max_marks: 10,
          mapped_cos: ['CO2'],
          order_index: 2,
        },
      ];
    } else if (presetType === 'full_exam') {
      newComps[iseIdx].sub_components = [
        {
          id: `sub-${Date.now()}-1`,
          component_id: newComps[iseIdx].id,
          title: 'Comprehensive In-Semester Written Exam',
          sub_type: 'TEST',
          max_marks: 20,
          mapped_cos: ['CO1', 'CO2'],
          order_index: 1,
        },
      ];
    } else if (presetType === 'two_tests') {
      newComps[iseIdx].sub_components = [
        {
          id: `sub-${Date.now()}-1`,
          component_id: newComps[iseIdx].id,
          title: 'Unit Test 1',
          sub_type: 'TEST',
          max_marks: 10,
          mapped_cos: ['CO1'],
          order_index: 1,
        },
        {
          id: `sub-${Date.now()}-2`,
          component_id: newComps[iseIdx].id,
          title: 'Unit Test 2',
          sub_type: 'TEST',
          max_marks: 10,
          mapped_cos: ['CO2'],
          order_index: 2,
        },
      ];
    } else if (presetType === 'continuous') {
      newComps[iseIdx].sub_components = [
        { id: `sub-${Date.now()}-1`, component_id: newComps[iseIdx].id, title: 'Activity 1: Concept Quiz', sub_type: 'QUIZ', max_marks: 5, mapped_cos: ['CO1'], order_index: 1 },
        { id: `sub-${Date.now()}-2`, component_id: newComps[iseIdx].id, title: 'Activity 2: Assignment / Case Problem', sub_type: 'ASSIGNMENT', max_marks: 5, mapped_cos: ['CO2'], order_index: 2 },
        { id: `sub-${Date.now()}-3`, component_id: newComps[iseIdx].id, title: 'Activity 3: Mini Presentation / Viva', sub_type: 'PRESENTATION', max_marks: 5, mapped_cos: ['CO3'], order_index: 3 },
        { id: `sub-${Date.now()}-4`, component_id: newComps[iseIdx].id, title: 'Activity 4: Applied Problem Solving', sub_type: 'ACTIVITY', max_marks: 5, mapped_cos: ['CO4'], order_index: 4 },
      ];
    }
    setBlueprintComponents(newComps);
    setSuccessMsg('Applied ISE assessment preset. Click "Save Blueprint" to save changes.');
  };

  // Add Question / Activity to a Component
  const handleAddSubComponent = (compIdx: number) => {
    const newComps = [...blueprintComponents];
    const comp = newComps[compIdx];
    const nextIdx = comp.sub_components.length + 1;
    const isEse = comp.component_type === 'THEORY_ESE';
    const isMse = comp.component_type === 'THEORY_MSE';
    const defaultTitle = isEse ? `Q${nextIdx}: Problem Formulation` : isMse ? `Q${nextIdx}: Analytical Problem` : `Activity ${nextIdx}`;
    const defaultType = isEse || isMse ? 'TEST' : 'ACTIVITY';

    comp.sub_components.push({
      id: `new-sub-${Date.now()}`,
      component_id: comp.id,
      title: defaultTitle,
      sub_type: defaultType,
      max_marks: 10,
      mapped_cos: ['CO1'],
      order_index: nextIdx,
    });
    setBlueprintComponents(newComps);
  };

  // Delete SubComponent
  const handleDeleteSubComponent = (compIdx: number, subIdx: number) => {
    const newComps = [...blueprintComponents];
    newComps[compIdx].sub_components.splice(subIdx, 1);
    setBlueprintComponents(newComps);
  };

  // Add Assessment Component
  const handleAddNewComponent = () => {
    const newComps = [...blueprintComponents];
    newComps.push({
      id: `new-comp-${Date.now()}`,
      template_id: template?.id || '',
      component_type: newCompType,
      display_name: newCompTitle,
      max_marks: Number(newCompMarks),
      passing_marks: Number(newCompMarks) * 0.4,
      weight_percentage: Number(newCompMarks),
      formula_type: 'SUM',
      order_index: newComps.length + 1,
      sub_components: [
        {
          id: `new-sub-${Date.now()}-1`,
          component_id: `new-comp-${Date.now()}`,
          title: `${newCompTitle} Q1`,
          sub_type: 'TEST',
          max_marks: Number(newCompMarks),
          mapped_cos: ['CO1'],
          order_index: 1,
        },
      ],
    });
    setBlueprintComponents(newComps);
    setShowAddComponent(false);
  };

  // Delete Assessment Component
  const handleDeleteComponent = (compIdx: number) => {
    const comp = blueprintComponents[compIdx];
    if (!window.confirm(`Are you sure you want to remove ${comp.display_name}?`)) return;
    const newComps = [...blueprintComponents];
    newComps.splice(compIdx, 1);
    setBlueprintComponents(newComps);
  };

  // Load All Data
  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError('');
      const [tmplData, gbData, attData] = await Promise.all([
        fetchCourseTemplate(offeringId),
        fetchCourseGradebook(offeringId),
        fetchOBEAttainment(offeringId).catch(() => null),
      ]);
      setTemplate(tmplData);
      setGradebook(gbData);
      setAttainment(attData);

      setBlueprintTitle(tmplData.title);
      setBlueprintComponents(tmplData.components);

      // Initialize local gradebook state
      const initialScores: Record<string, number> = {};
      const initialAbsents: Record<string, boolean> = {};
      gbData.students.forEach((s) => {
        Object.entries(s.scores).forEach(([subId, val]) => {
          initialScores[`${s.student_id}:${subId}`] = val;
        });
        Object.entries(s.absents).forEach(([subId, val]) => {
          initialAbsents[`${s.student_id}:${subId}`] = val;
        });
      });
      setEditedScores(initialScores);
      setEditedAbsents(initialAbsents);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load course workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    if (!user || (user.role !== 'FACULTY' && user.role !== 'ADMIN')) {
      router.push('/login');
      return;
    }
    if (offeringId) {
      loadWorkspace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, router]);

  // Handle cell edit
  const handleScoreChange = (studentId: string, subId: string, value: string, maxMarks: number) => {
    const num = parseFloat(value);
    const finalVal = isNaN(num) ? 0 : Math.min(Math.max(0, num), maxMarks);
    setEditedScores((prev) => ({
      ...prev,
      [`${studentId}:${subId}`]: finalVal,
    }));
    setHasUnsavedChanges(true);
  };

  const handleAbsentToggle = (studentId: string, subId: string) => {
    setEditedAbsents((prev) => {
      const cur = prev[`${studentId}:${subId}`] || false;
      return {
        ...prev,
        [`${studentId}:${subId}`]: !cur,
      };
    });
    setHasUnsavedChanges(true);
  };

  // Save all modified marks
  const handleSaveMarks = async () => {
    if (!gradebook || !template) return;
    try {
      setSavingMarks(true);
      setError('');
      setSuccessMsg('');

      const updates: Array<{ student_id: string; sub_component_id: string; marks: number; is_absent: boolean }> = [];
      gradebook.students.forEach((st) => {
        template.components.forEach((c) => {
          c.sub_components.forEach((sub) => {
            const key = `${st.student_id}:${sub.id}`;
            const marks = editedScores[key] ?? 0;
            const isAbs = editedAbsents[key] ?? false;
            updates.push({
              student_id: st.student_id,
              sub_component_id: sub.id,
              marks,
              is_absent: isAbs,
            });
          });
        });
      });

      await saveBatchMarks(offeringId, {
        component_type: 'ALL',
        updates,
        change_reason: 'Faculty gradebook update',
      });

      setSuccessMsg('All student marks updated and saved successfully.');
      setHasUnsavedChanges(false);
      // Refresh OBE attainment
      const att = await fetchOBEAttainment(offeringId).catch(() => null);
      setAttainment(att);
    } catch (err: any) {
      setError(err.message || 'Failed to save marks.');
    } finally {
      setSavingMarks(false);
    }
  };

  // Lock Component
  const handleLockComponent = async (cType: string) => {
    if (!window.confirm(`Are you sure you want to permanently lock marks for ${cType}? Once locked, edits require Exam Cell approval.`)) {
      return;
    }
    try {
      setLoading(true);
      await lockEvaluationMarks(offeringId, cType);
      await loadWorkspace();
      setSuccessMsg(`Marks for ${cType} have been locked.`);
    } catch (err: any) {
      setError(err.message || 'Failed to lock marks.');
      setLoading(false);
    }
  };

  // Submit Unlock Request
  const handleSubmitUnlockRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockReason.trim()) return;
    try {
      setUnlockSubmitting(true);
      setError('');
      await requestUnlockMarks(offeringId, unlockComponent, unlockReason);
      setUnlockModalOpen(false);
      setUnlockReason('');
      setSuccessMsg('Formal unlock request submitted to Exam Cell. You will be notified once approved.');
    } catch (err: any) {
      setError(err.message || 'Failed to submit unlock request.');
    } finally {
      setUnlockSubmitting(false);
    }
  };

  // Save Blueprint Scheme
  const handleSaveBlueprint = async () => {
    try {
      setSavingBlueprint(true);
      setError('');
      setSuccessMsg('');
      const updated = await updateCourseTemplate(offeringId, {
        title: blueprintTitle,
        components: blueprintComponents,
      });
      setTemplate(updated);
      setBlueprintComponents(updated.components);
      await loadWorkspace();
      setSuccessMsg('Assessment Blueprint updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update blueprint.');
    } finally {
      setSavingBlueprint(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!gradebook || !template) return;
    const headerCols = ['Roll No', 'Division', 'Student Name'];
    template.components.forEach((c) => {
      c.sub_components.forEach((sub) => {
        headerCols.push(`${c.component_type} - ${sub.title} (Max ${sub.max_marks})`);
      });
      headerCols.push(`${c.component_type} Total`);
    });

    const rows = [headerCols.join(',')];
    gradebook.students.forEach((st) => {
      const row = [st.roll_no, st.division_name, `"${st.full_name}"`];
      template.components.forEach((c) => {
        let compSum = 0;
        c.sub_components.forEach((sub) => {
          const key = `${st.student_id}:${sub.id}`;
          const isAbs = editedAbsents[key];
          const val = isAbs ? 'AB' : (editedScores[key] ?? 0);
          row.push(String(val));
          if (!isAbs) compSum += (editedScores[key] ?? 0);
        });
        row.push(String(compSum));
      });
      rows.push(row.join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.course_code}_Gradebook_${template.academic_term}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !template) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium text-[#71717A]">Opening Course Gradebook Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] pb-32">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-[#E4E4E7] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/faculty/exams"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#71717A] hover:text-[#FF5500] transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>All Courses</span>
                </Link>
                <span className="text-[#D4D4D8]">/</span>
                <span className="font-mono text-xs font-bold text-[#FF5500] bg-[#FFF4ED] px-2 py-0.5 rounded border border-[#FED7AA]">
                  {template?.course_code}
                </span>
                <span className="font-mono text-xs text-[#71717A]">
                  Autonomous Scheme FRCRCE-3-26
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#09090B] tracking-tight">
                {template?.course_name}
              </h1>
            </div>

            {/* Lock Status & Actions */}
            <div className="flex items-center gap-2.5">
              {gradebook?.is_locked ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] text-xs font-bold text-[#4B5563]">
                  <Lock className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Locked by Exam Cell</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] text-xs font-bold text-[#16A34A]">
                  <Clock className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Review Window Active</span>
                </div>
              )}

              {gradebook?.is_locked && (
                <button
                  type="button"
                  onClick={() => setUnlockModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white text-xs font-bold text-[#FF5500] hover:bg-[#FFF4ED] transition-colors"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Request Unlock</span>
                </button>
              )}

              {!gradebook?.is_locked && (
                <button
                  type="button"
                  onClick={() => handleLockComponent('ALL')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white text-xs font-bold text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F6] transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Final Lock</span>
                </button>
              )}
            </div>
          </div>

          {/* Clean 3-Tab Navigator */}
          <div className="flex items-center gap-2 mt-5 border-t border-[#F4F4F6] pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('gradebook')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'gradebook'
                  ? 'bg-[#FF5500] text-white shadow-xs'
                  : 'text-[#71717A] hover:bg-[#F4F4F6] hover:text-[#09090B]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Marks Gradebook</span>
              {gradebook && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'gradebook' ? 'bg-white/20 text-white' : 'bg-[#E4E4E7] text-[#71717A]'}`}>
                  {gradebook.students.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('blueprint')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'blueprint'
                  ? 'bg-[#FF5500] text-white shadow-xs'
                  : 'text-[#71717A] hover:bg-[#F4F4F6] hover:text-[#09090B]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Assessment Blueprint</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'blueprint' ? 'bg-white/20 text-white' : 'bg-[#E4E4E7] text-[#71717A]'}`}>
                {template?.components.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('attainment')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'attainment'
                  ? 'bg-[#FF5500] text-white shadow-xs'
                  : 'text-[#71717A] hover:bg-[#F4F4F6] hover:text-[#09090B]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>NBA / NAAC Attainment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
        {error && (
          <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-medium flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] text-[#16A34A] text-xs font-medium flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- TAB 2: GRADEBOOK */}
      {activeTab === 'gradebook' && gradebook && template && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 space-y-4">
          {/* Action & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] space-y-3 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Search roll, name..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5" />
                </div>

                {/* Division Filter */}
                {divisions.length > 1 && (
                  <select
                    value={filterDivision}
                    onChange={(e) => setFilterDivision(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white font-medium text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                  >
                    <option value="ALL">All Divisions</option>
                    {divisions.map((d) => (
                      <option key={d} value={d}>Division {d}</option>
                    ))}
                  </select>
                )}

                {/* Batch Filter */}
                {batches.length > 0 && (
                  <select
                    value={filterBatch}
                    onChange={(e) => setFilterBatch(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white font-medium text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                  >
                    <option value="ALL">All Practical Batches</option>
                    {batches.map((b) => (
                      <option key={b} value={b}>Batch {b}</option>
                    ))}
                  </select>
                )}

                <span className="font-mono text-xs font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-1 rounded-md">
                  Showing {displayedStudents.length} of {gradebook.students.length} students
                </span>

                {hasUnsavedChanges && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#EA580C] bg-[#FFF7ED] border border-[#FFEDD5] px-2 py-0.5 rounded animate-pulse">
                    Unsaved Edits
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white text-xs font-bold text-[#374151] hover:bg-[#F4F4F6] transition-colors"
                  title="Download spreadsheet to grade on Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveMarks}
                  disabled={savingMarks || !hasUnsavedChanges || gradebook.is_locked}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#FF5500] text-white text-xs font-extrabold hover:bg-[#EA580C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMarks ? 'Saving...' : 'Save All Marks'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Component Tabs Switcher (Dedicated Views for ISE, MSE, ESE, Lab) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setGradebookComponentTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                gradebookComponentTab === 'ALL'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'bg-white text-[#64748B] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
              }`}
            >
              All Components (Master)
            </button>
            {template.components.map((c) => {
              const isActive = gradebookComponentTab === c.component_type;
              const label = c.component_type === 'THEORY_ISE'
                ? 'ISE (20M)'
                : c.component_type === 'THEORY_MSE'
                ? 'MSE (30M)'
                : c.component_type === 'THEORY_ESE'
                ? 'ESE (50M)'
                : c.component_type === 'LAB_ISE'
                ? 'Lab (50M)'
                : c.component_type === 'TUT_ISE'
                ? 'Tutorials (50M)'
                : `${c.display_name} (${c.max_marks}M)`;
              return (
                <button
                  key={c.id || c.component_type}
                  type="button"
                  onClick={() => setGradebookComponentTab(c.component_type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FF5500] text-white shadow-xs'
                      : 'bg-white text-[#64748B] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Spreadsheet Table Container */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left border-collapse">
                {/* Header Row */}
                <thead className="bg-[#F8FAFC] text-[11px] font-mono font-bold text-[#475569] uppercase tracking-wider sticky top-0 z-20 shadow-xs">
                  <tr>
                    <th className="py-3 px-3 border-b border-r border-[#E2E8F0] sticky left-0 bg-[#F8FAFC] z-30 min-w-[70px]">
                      Roll No
                    </th>
                    <th className="py-3 px-4 border-b border-r border-[#E2E8F0] sticky left-[70px] bg-[#F8FAFC] z-30 min-w-[180px]">
                      Student Name
                    </th>
                    <th className="py-3 px-3 border-b border-r border-[#E2E8F0] text-center min-w-[60px]">
                      Div
                    </th>
                    {/* Component Columns */}
                    {displayedComponents.map((c) =>
                      c.sub_components.map((sub) => (
                        <th
                          key={sub.id}
                          className="py-3 px-3 border-b border-r border-[#E2E8F0] text-center min-w-[130px] bg-[#F8FAFC]"
                        >
                          <div className="text-[10px] text-[#64748B] font-semibold">{c.display_name.split(' ')[0]}</div>
                          <div className="text-[#0F172A] truncate" title={sub.title}>{sub.title}</div>
                          <div className="text-[10px] text-[#FF5500] font-extrabold">Max: {sub.max_marks}</div>
                        </th>
                      ))
                    )}
                    {/* Component Totals */}
                    {displayedComponents.map((c) => (
                      <th
                        key={c.id}
                        className="py-3 px-3 border-b border-r border-[#E2E8F0] text-center min-w-[90px] bg-[#FFF8F5] text-[#C2410C]"
                      >
                        <div>{c.component_type.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] font-extrabold">({c.max_marks}M)</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Body Rows */}
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {displayedStudents.map((st, sIdx) => {
                    return (
                      <tr key={st.student_id} className={sIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}>
                        {/* Sticky Roll No */}
                        <td className="py-2.5 px-3 border-r border-[#E2E8F0] font-mono font-bold text-[#0F172A] sticky left-0 bg-inherit z-10">
                          {st.roll_no}
                        </td>
                        {/* Sticky Name */}
                        <td className="py-2.5 px-4 border-r border-[#E2E8F0] font-medium text-[#1E293B] sticky left-[70px] bg-inherit z-10 truncate max-w-[200px]" title={st.full_name}>
                          {st.full_name}
                        </td>
                        {/* Div */}
                        <td className="py-2.5 px-3 border-r border-[#E2E8F0] text-center font-mono text-[#64748B]">
                          {st.division_name}
                        </td>

                        {/* Question Inputs */}
                        {displayedComponents.map((c) =>
                          c.sub_components.map((sub) => {
                            const key = `${st.student_id}:${sub.id}`;
                            const val = editedScores[key] ?? 0;
                            const isAbs = editedAbsents[key] ?? false;
                            const isExceeded = val > sub.max_marks;

                            return (
                              <td
                                key={sub.id}
                                className={`py-1.5 px-2 border-r border-[#E2E8F0] text-center ${
                                  isAbs ? 'bg-[#FEF2F2]' : isExceeded ? 'bg-[#FEE2E2]' : ''
                                }`}
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    max={sub.max_marks}
                                    step="0.5"
                                    disabled={isAbs || gradebook.is_locked}
                                    value={isAbs ? '' : val}
                                    placeholder={isAbs ? 'AB' : '0'}
                                    onChange={(e) => handleScoreChange(st.student_id, sub.id, e.target.value, sub.max_marks)}
                                    className={`w-16 text-center font-mono text-xs py-1 px-1.5 rounded border ${
                                      isExceeded
                                        ? 'border-[#EF4444] text-[#B91C1C] bg-white'
                                        : 'border-[#CBD5E1] bg-white text-[#0F172A] focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500]'
                                    } disabled:opacity-50 disabled:bg-[#F1F5F9] focus:outline-none`}
                                  />
                                  <button
                                    type="button"
                                    title={isAbs ? 'Mark Present' : 'Mark Absent'}
                                    disabled={gradebook.is_locked}
                                    onClick={() => handleAbsentToggle(st.student_id, sub.id)}
                                    className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded transition-colors ${
                                      isAbs
                                        ? 'bg-[#DC2626] text-white'
                                        : 'bg-[#E2E8F0] text-[#64748B] hover:bg-[#CBD5E1]'
                                    }`}
                                  >
                                    AB
                                  </button>
                                </div>
                              </td>
                            );
                          })
                        )}

                        {/* Calculated Component Totals */}
                        {displayedComponents.map((c) => {
                          let sum = 0;
                          c.sub_components.forEach((sub) => {
                            const key = `${st.student_id}:${sub.id}`;
                            if (!editedAbsents[key]) {
                              sum += editedScores[key] ?? 0;
                            }
                          });
                          return (
                            <td
                              key={c.id}
                              className="py-2.5 px-3 border-r border-[#E2E8F0] text-center font-mono font-extrabold text-[#C2410C] bg-[#FFF8F5]"
                            >
                              {roundNumber(sum, 1)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- TAB 1: BLUEPRINT */}
      {activeTab === 'blueprint' && template && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-4 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-[#E4E4E7] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#FFF4ED] text-[#FF5500] border border-[#FED7AA]">
                    Flexible Blueprint Editor
                  </span>
                  <span className="font-mono text-[10px] text-[#71717A]">Autonomous Scheme FRCRCE-3-26</span>
                </div>
                <h3 className="font-bold text-lg text-[#09090B]">Assessment Scheme Blueprint</h3>
                <p className="text-xs text-[#71717A] mt-0.5">
                  Divide ISE marks (activities vs exams), configure MSE & ESE written questions, and tag each item directly to syllabus Course Outcomes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveBlueprint}
                  disabled={savingBlueprint || gradebook?.is_locked}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF5500] text-white text-xs font-extrabold hover:bg-[#EA580C] transition-colors disabled:opacity-50 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingBlueprint ? 'Saving Blueprint...' : 'Save Blueprint'}</span>
                </button>
              </div>
            </div>

            {/* Scheme Title */}
            <div className="mb-6">
              <label className="block font-mono text-[11px] font-bold uppercase text-[#71717A] mb-1.5">
                Scheme Title
              </label>
              <input
                type="text"
                value={blueprintTitle}
                disabled={gradebook?.is_locked}
                onChange={(e) => setBlueprintTitle(e.target.value)}
                className="w-full text-xs py-2 px-3 rounded-lg border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
              />
            </div>

            {/* Components & Sub-Components */}
            <div className="space-y-6">
              {blueprintComponents.map((comp, cIdx) => {
                const subTotal = comp.sub_components.reduce((sum, s) => sum + (Number(s.max_marks) || 0), 0);
                const isBalanced = Math.abs(subTotal - comp.max_marks) < 0.01;

                return (
                  <div key={comp.id || cIdx} className="p-4 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] space-y-4">
                    {/* Component Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-[#FF5500] bg-[#FFF4ED] px-2.5 py-1 rounded border border-[#FED7AA]">
                          {comp.component_type}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-[#09090B]">{comp.display_name}</h4>
                          <span className="text-[11px] text-[#64748B]">
                            Passing: {comp.passing_marks}M · Weight: {comp.weight_percentage}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Balance Badge */}
                        <span
                          className={`font-mono text-[11px] font-extrabold px-2.5 py-1 rounded-md border flex items-center gap-1 ${
                            isBalanced
                              ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                              : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                          }`}
                        >
                          {isBalanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          <span>Allocated: {subTotal} / {comp.max_marks} Marks</span>
                        </span>

                        {/* Delete Component Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteComponent(cIdx)}
                          disabled={gradebook?.is_locked}
                          title="Delete this entire component"
                          className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#94A3B8] hover:text-[#DC2626] hover:border-[#FCA5A5] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* ISE Split 1-Click Presets */}
                    {comp.component_type === 'THEORY_ISE' && (
                      <div className="p-3 bg-white rounded-lg border border-[#E2E8F0] space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#FF5500]" />
                          <span className="font-mono text-[11px] font-bold text-[#0F172A] uppercase">
                            1-Click ISE Breakdown Presets:
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => applyISEPreset('split')}
                            disabled={gradebook?.is_locked}
                            className="px-2.5 py-1 rounded-md border border-[#E2E8F0] bg-[#FAFAFA] text-xs font-semibold text-[#334155] hover:bg-[#FFF4ED] hover:border-[#FED7AA] hover:text-[#FF5500] transition-colors"
                          >
                            Split: 10M Activity + 10M Test
                          </button>
                          <button
                            type="button"
                            onClick={() => applyISEPreset('full_exam')}
                            disabled={gradebook?.is_locked}
                            className="px-2.5 py-1 rounded-md border border-[#E2E8F0] bg-[#FAFAFA] text-xs font-semibold text-[#334155] hover:bg-[#FFF4ED] hover:border-[#FED7AA] hover:text-[#FF5500] transition-colors"
                          >
                            Full Exam: 20M Written Test
                          </button>
                          <button
                            type="button"
                            onClick={() => applyISEPreset('two_tests')}
                            disabled={gradebook?.is_locked}
                            className="px-2.5 py-1 rounded-md border border-[#E2E8F0] bg-[#FAFAFA] text-xs font-semibold text-[#334155] hover:bg-[#FFF4ED] hover:border-[#FED7AA] hover:text-[#FF5500] transition-colors"
                          >
                            Two Unit Tests: 10M + 10M
                          </button>
                          <button
                            type="button"
                            onClick={() => applyISEPreset('continuous')}
                            disabled={gradebook?.is_locked}
                            className="px-2.5 py-1 rounded-md border border-[#E2E8F0] bg-[#FAFAFA] text-xs font-semibold text-[#334155] hover:bg-[#FFF4ED] hover:border-[#FED7AA] hover:text-[#FF5500] transition-colors"
                          >
                            Continuous: 4 × 5M Activities
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sub components list */}
                    <div className="space-y-3">
                      {comp.sub_components.map((sub, sIdx) => (
                        <div
                          key={sub.id || sIdx}
                          className="p-3 bg-white rounded-lg border border-[#E4E4E7] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="md:col-span-2">
                              <span className="block font-mono text-[10px] text-[#71717A] uppercase font-bold mb-1">
                                Question / Activity Title
                              </span>
                              <input
                                type="text"
                                value={sub.title}
                                disabled={gradebook?.is_locked}
                                onChange={(e) => {
                                  const newComps = [...blueprintComponents];
                                  newComps[cIdx].sub_components[sIdx].title = e.target.value;
                                  setBlueprintComponents(newComps);
                                }}
                                className="w-full text-xs py-1.5 px-2.5 rounded border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                              />
                            </div>

                            <div>
                              <span className="block font-mono text-[10px] text-[#71717A] uppercase font-bold mb-1">
                                Max Marks
                              </span>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={sub.max_marks}
                                disabled={gradebook?.is_locked}
                                onChange={(e) => {
                                  const newComps = [...blueprintComponents];
                                  newComps[cIdx].sub_components[sIdx].max_marks = parseFloat(e.target.value) || 0;
                                  setBlueprintComponents(newComps);
                                }}
                                className="w-full text-xs py-1.5 px-2.5 rounded border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                              />
                            </div>

                            <div>
                              <span className="block font-mono text-[10px] text-[#71717A] uppercase font-bold mb-1">
                                Assessment Type
                              </span>
                              <select
                                value={sub.sub_type}
                                disabled={gradebook?.is_locked}
                                onChange={(e) => {
                                  const newComps = [...blueprintComponents];
                                  newComps[cIdx].sub_components[sIdx].sub_type = e.target.value;
                                  setBlueprintComponents(newComps);
                                }}
                                className="w-full text-xs py-1.5 px-2.5 rounded border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                              >
                                <option value="TEST">Written Test</option>
                                <option value="ACTIVITY">Formative Activity</option>
                                <option value="ASSIGNMENT">Assignment</option>
                                <option value="QUIZ">Quiz</option>
                                <option value="PRESENTATION">Presentation</option>
                                <option value="EXPERIMENT">Lab Experiment</option>
                                <option value="TUTORIAL">Tutorial</option>
                                <option value="ORAL">Oral / Viva</option>
                              </select>
                            </div>
                          </div>

                          {/* CO Tagging Badges & Delete Button */}
                          <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-mono text-[10px] text-[#71717A] font-bold uppercase mr-1">COs:</span>
                              {availableCOs.map((co) => {
                                const isTagged = sub.mapped_cos.includes(co.co_code);
                                return (
                                  <button
                                    key={co.co_code}
                                    type="button"
                                    disabled={gradebook?.is_locked}
                                    title={co.description}
                                    onClick={() => {
                                      const newComps = [...blueprintComponents];
                                      const cur = newComps[cIdx].sub_components[sIdx].mapped_cos || [];
                                      if (cur.includes(co.co_code)) {
                                        newComps[cIdx].sub_components[sIdx].mapped_cos = cur.filter((x) => x !== co.co_code);
                                      } else {
                                        newComps[cIdx].sub_components[sIdx].mapped_cos = [...cur, co.co_code];
                                      }
                                      setBlueprintComponents(newComps);
                                    }}
                                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded transition-colors ${
                                      isTagged
                                        ? 'bg-[#FF5500] text-white shadow-2xs'
                                        : 'bg-[#F4F4F6] text-[#71717A] hover:bg-[#E4E4E7]'
                                    }`}
                                  >
                                    {co.co_code}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Delete Question / Activity */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSubComponent(cIdx, sIdx)}
                              disabled={gradebook?.is_locked}
                              title="Delete this question / activity"
                              className="p-1 rounded text-[#A1A1AA] hover:text-[#DC2626] transition-colors ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add Question / Activity Button */}
                    <button
                      type="button"
                      onClick={() => handleAddSubComponent(cIdx)}
                      disabled={gradebook?.is_locked}
                      className="w-full py-2 border-2 border-dashed border-[#CBD5E1] rounded-lg text-xs font-bold text-[#475569] hover:border-[#FF5500] hover:text-[#FF5500] hover:bg-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Question / Activity to {comp.display_name}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Assessment Component Toolbar */}
            <div className="mt-8 pt-6 border-t border-[#E4E4E7]">
              {showAddComponent ? (
                <div className="p-4 rounded-xl border border-[#FED7AA] bg-[#FFFBF7] space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#09090B]">Add Assessment Component</h4>
                    <button
                      type="button"
                      onClick={() => setShowAddComponent(false)}
                      className="text-xs font-bold text-[#71717A] hover:text-[#09090B]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="block font-mono text-[10px] text-[#71717A] uppercase font-bold mb-1">
                        Component Type
                      </span>
                      <select
                        value={newCompType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewCompType(val);
                          if (val === 'THEORY_ESE') {
                            setNewCompTitle('End-Semester Examination (ESE)');
                            setNewCompMarks(50);
                          } else if (val === 'THEORY_MSE') {
                            setNewCompTitle('Mid-Semester Examination (MSE)');
                            setNewCompMarks(30);
                          } else if (val === 'THEORY_ISE') {
                            setNewCompTitle('In-Semester Evaluation (ISE)');
                            setNewCompMarks(20);
                          } else if (val === 'LAB_ISE') {
                            setNewCompTitle('Laboratory Continuous Assessment & Oral');
                            setNewCompMarks(50);
                          } else if (val === 'TUT_ISE') {
                            setNewCompTitle('Continuous Tutorial Evaluation');
                            setNewCompMarks(50);
                          }
                        }}
                        className="w-full text-xs py-2 px-2.5 rounded border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                      >
                        <option value="THEORY_ESE">THEORY_ESE (End Semester Exam)</option>
                        <option value="THEORY_MSE">THEORY_MSE (Mid Semester Exam)</option>
                        <option value="THEORY_ISE">THEORY_ISE (In-Semester Evaluation)</option>
                        <option value="LAB_ISE">LAB_ISE (Laboratory & Oral)</option>
                        <option value="TUT_ISE">TUT_ISE (Tutorial Assessment)</option>
                        <option value="PROJECT_ISE">PROJECT_ISE (Project / Capstone)</option>
                        <option value="CUSTOM">CUSTOM (Other Evaluation)</option>
                      </select>
                    </div>

                    <div>
                      <span className="block font-mono text-[10px] text-[#71717A] uppercase font-bold mb-1">
                        Display Name
                      </span>
                      <input
                        type="text"
                        value={newCompTitle}
                        onChange={(e) => setNewCompTitle(e.target.value)}
                        className="w-full text-xs py-2 px-2.5 rounded border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                      />
                    </div>

                    <div>
                      <span className="block font-mono text-[10px] text-[#71717A] uppercase font-bold mb-1">
                        Total Marks
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={newCompMarks}
                        onChange={(e) => setNewCompMarks(Number(e.target.value))}
                        className="w-full text-xs py-2 px-2.5 rounded border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddComponent(false)}
                      className="px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white text-xs font-semibold text-[#71717A] hover:bg-[#F4F4F6]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNewComponent}
                      className="px-4 py-1.5 rounded-lg bg-[#FF5500] text-white text-xs font-bold hover:bg-[#EA580C]"
                    >
                      Add Component
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddComponent(true)}
                  disabled={gradebook?.is_locked}
                  className="w-full py-2.5 border border-[#CBD5E1] bg-[#F8FAFC] rounded-xl text-xs font-bold text-[#334155] hover:bg-white hover:border-[#FF5500] hover:text-[#FF5500] transition-colors flex items-center justify-center gap-2 shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-[#FF5500]" />
                  <span>Add Assessment Component (ESE, MSE, ISE, Lab, Tutorial)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- TAB 3: OBE ATTAINMENT */}
      {activeTab === 'attainment' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 space-y-6">
          {/* Summary Banner */}
          <div className="bg-white p-6 rounded-xl border border-[#E4E4E7] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-mono text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#FFF4ED] text-[#FF5500] border border-[#FED7AA]">
                  National Board of Accreditation (NBA)
                </span>
                <h3 className="font-bold text-lg text-[#09090B] mt-2">
                  Direct Outcome Attainment Analysis
                </h3>
                <p className="text-xs text-[#71717A] mt-0.5">
                  Target criteria: Percentage of students scoring $\ge 60\%$ in evaluation components mapped to each Course Outcome.
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E4E4E7] bg-white text-xs font-bold text-[#09090B] hover:bg-[#F4F4F6] transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Sheet</span>
              </button>
            </div>
          </div>

          {/* CO Attainment Table */}
          {attainment && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden shadow-xs">
              <div className="p-4 border-b border-[#E4E4E7] bg-[#FAFAFA]">
                <h4 className="font-bold text-sm text-[#09090B]">Course Outcome (CO) Attainment Levels</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] font-mono text-[11px] font-bold text-[#475569] uppercase border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4">CO Code</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-3 text-center">Bloom Level</th>
                      <th className="py-3 px-3 text-center">Evaluated Students</th>
                      <th className="py-3 px-3 text-center">Met Target (&ge;60%)</th>
                      <th className="py-3 px-3 text-center">% Attainment</th>
                      <th className="py-3 px-4 text-center">NBA Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {attainment.co_attainments.map((co) => (
                      <tr key={co.co_code} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-4 font-mono font-bold text-[#FF5500]">{co.co_code}</td>
                        <td className="py-3 px-4 text-[#334155] max-w-md">{co.description}</td>
                        <td className="py-3 px-3 text-center font-mono text-[#64748B]">{co.bloom_level}</td>
                        <td className="py-3 px-3 text-center font-mono font-semibold">{co.total_evaluated_students}</td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-[#16A34A]">{co.students_meeting_target}</td>
                        <td className="py-3 px-3 text-center font-mono font-extrabold text-[#0F172A]">{co.percentage_attainment}%</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block font-mono text-xs font-extrabold px-2.5 py-0.5 rounded ${
                              co.attainment_level === 3
                                ? 'bg-[#DCFCE7] text-[#15803D]'
                                : co.attainment_level === 2
                                ? 'bg-[#FEF9C3] text-[#A16207]'
                                : co.attainment_level === 1
                                ? 'bg-[#FFEDD5] text-[#C2410C]'
                                : 'bg-[#FEE2E2] text-[#B91C1C]'
                            }`}
                          >
                            Level {co.attainment_level} / 3
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PO & PSO Attainment Grid */}
          {attainment && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* POs */}
              <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs">
                <h4 className="font-bold text-sm text-[#09090B] mb-3">
                  Program Outcomes (PO1 to PO12) Attainment
                </h4>
                <div className="space-y-2.5">
                  {attainment.po_attainments.map((po) => (
                    <div key={po.po_code} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono font-bold text-[#334155] w-12">{po.po_code}</span>
                      <div className="flex-1 bg-[#F1F5F9] h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#FF5500] h-full rounded-full transition-all duration-500"
                          style={{ width: `${(po.computed_attainment / 3.0) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono font-extrabold text-[#0F172A] w-14 text-right">
                        {po.computed_attainment} / 3.0
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PSOs */}
              <div className="bg-white p-5 rounded-xl border border-[#E4E4E7] shadow-xs">
                <h4 className="font-bold text-sm text-[#09090B] mb-3">
                  Program Specific Outcomes (PSOs) Attainment
                </h4>
                <div className="space-y-3">
                  {attainment.pso_attainments.map((pso) => (
                    <div key={pso.po_code} className="p-3 rounded-lg border border-[#E2E8F0] bg-[#FAFAFA]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-[#FF5500]">{pso.po_code}</span>
                        <span className="font-mono font-extrabold text-[#0F172A]">{pso.computed_attainment} / 3.0</span>
                      </div>
                      <div className="bg-[#E2E8F0] h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#16A34A] h-full rounded-full"
                          style={{ width: `${(pso.computed_attainment / 3.0) * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-2">
                        {pso.po_code === 'PSO1'
                          ? 'PSO1: Develop Artificial Intelligence and Machine Learning systems.'
                          : 'PSO2: Apply cyber security mechanisms to protect information technology assets.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unlock Request Modal */}
      {unlockModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-[#09090B] mb-1">
              Request Post-Deadline Marks Correction
            </h3>
            <p className="text-xs text-[#71717A] mb-4">
              Marks for this course offering are locked. Submit a formal request to the Exam Cell and HOD specifying the exact justification.
            </p>

            <form onSubmit={handleSubmitUnlockRequest} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#71717A] mb-1">
                  Evaluation Component
                </label>
                <select
                  value={unlockComponent}
                  onChange={(e) => setUnlockComponent(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                >
                  <option value="ALL">All Components</option>
                  <option value="THEORY_ISE">Theory ISE (In-Semester Evaluation)</option>
                  <option value="THEORY_MSE">Theory MSE (Mid-Semester Exam)</option>
                  <option value="LAB_ISE">Laboratory Continuous Assessment</option>
                  <option value="TUT_ISE">Tutorial Continuous Assessment</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#71717A] mb-1">
                  Justification / Grievance Details
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Recalculation after student paper review, correction of paper addition error..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#E4E4E7] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUnlockModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#E4E4E7] text-xs font-bold text-[#71717A] hover:bg-[#F4F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlockSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-[#FF5500] text-white text-xs font-bold hover:bg-[#EA580C] disabled:opacity-50"
                >
                  {unlockSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function roundNumber(num: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
