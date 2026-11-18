/**
 * Exam Cell, Continuous Assessment, Gradebook & OBE Attainment Client API.
 */
import { fetchWithAuth } from './api';

export interface CourseOutcomeDef {
  id: string;
  co_code: string;
  description: string;
  bloom_level: string;
}

export interface ExamSubComponentDef {
  id: string;
  component_id: string;
  title: string;
  sub_type: string;
  max_marks: number;
  mapped_cos: string[];
  order_index: number;
}

export interface ExamComponentDef {
  id: string;
  template_id: string;
  component_type: string;
  display_name: string;
  max_marks: number;
  passing_marks: number;
  weight_percentage: number;
  formula_type: string;
  order_index: number;
  sub_components: ExamSubComponentDef[];
}

export interface ExamTemplateResponse {
  id: string;
  offering_id: string;
  course_code: string;
  course_name: string;
  academic_term: string;
  title: string;
  status: string;
  available_cos: CourseOutcomeDef[];
  components: ExamComponentDef[];
}

export interface GradebookStudentRow {
  student_id: string;
  roll_no: string;
  erp_id?: string;
  full_name: string;
  division_name: string;
  batch_name?: string;
  scores: Record<string, number>;
  absents: Record<string, boolean>;
  component_totals: Record<string, number>;
}

export interface GradebookResponse {
  offering_id: string;
  course_code: string;
  course_name: string;
  academic_term: string;
  is_locked: boolean;
  deadline?: string;
  lock_status_label: string;
  can_edit: boolean;
  columns: ExamComponentDef[];
  students: GradebookStudentRow[];
}

export interface FacultyCourseOfferingItem {
  offering_id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  semester: number;
  academic_term: string;
  delivery_mode: string;
  student_count: number;
  has_template: boolean;
  template_status: string;
  is_locked: boolean;
}

export interface COAttainmentItem {
  co_code: string;
  description: string;
  bloom_level: string;
  total_evaluated_students: number;
  target_marks_threshold_pct: number;
  students_meeting_target: number;
  percentage_attainment: number;
  attainment_level: number;
}

export interface POAttainmentItem {
  po_code: string;
  target_score: number;
  computed_attainment: number;
  attainment_level: number;
}

export interface OBEAttainmentResponse {
  offering_id: string;
  course_code: string;
  course_name: string;
  co_attainments: COAttainmentItem[];
  po_attainments: POAttainmentItem[];
  pso_attainments: POAttainmentItem[];
  summary_text: string;
}

export interface StudentCourseGradeSummary {
  offering_id: string;
  course_code: string;
  course_name: string;
  academic_term: string;
  components: Array<{
    component_type: string;
    display_name: string;
    max_marks: number;
    obtained_marks: number;
    has_marks: boolean;
  }>;
  total_marks_obtained: number;
  total_max_marks: number;
  overall_percentage: number;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

export async function fetchFacultyCourses(): Promise<FacultyCourseOfferingItem[]> {
  const res = await fetchWithAuth('/api/v1/exams/my-courses');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch faculty courses');
  }
  return res.json();
}

export async function fetchCourseTemplate(offeringId: string): Promise<ExamTemplateResponse> {
  const res = await fetchWithAuth(`/api/v1/exams/courses/${offeringId}/template`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch assessment template');
  }
  return res.json();
}

export async function updateCourseTemplate(
  offeringId: string,
  data: { title: string; components: any[] }
): Promise<ExamTemplateResponse> {
  const res = await fetchWithAuth(`/api/v1/exams/courses/${offeringId}/template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update assessment template');
  }
  return res.json();
}

export async function fetchCourseGradebook(offeringId: string): Promise<GradebookResponse> {
  const res = await fetchWithAuth(`/api/v1/exams/courses/${offeringId}/gradebook`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch gradebook');
  }
  return res.json();
}

export async function saveBatchMarks(
  offeringId: string,
  payload: {
    component_type: string;
    updates: Array<{ student_id: string; sub_component_id: string; marks: number; is_absent: boolean; remarks?: string }>;
    change_reason?: string;
  }
): Promise<{ status: string; updated_records: number }> {
  const res = await fetchWithAuth(`/api/v1/exams/courses/${offeringId}/marks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save marks');
  }
  return res.json();
}

export async function lockEvaluationMarks(offeringId: string, componentType: string = 'ALL'): Promise<{ status: string }> {
  const res = await fetchWithAuth(`/api/v1/exams/courses/${offeringId}/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ component_type: componentType, action: 'LOCK' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to lock marks');
  }
  return res.json();
}

export async function requestUnlockMarks(
  offeringId: string,
  componentType: string,
  reason: string
): Promise<{ id: string; status: string }> {
  const res = await fetchWithAuth(`/api/v1/exams/courses/${offeringId}/unlock-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ component_type: componentType, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit unlock request');
  }
  return res.json();
}

export async function fetchOBEAttainment(offeringId: string): Promise<OBEAttainmentResponse> {
  const res = await fetchWithAuth(`/api/v1/exams/courses/${offeringId}/attainment`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to compute OBE attainment');
  }
  return res.json();
}

export async function fetchStudentGrades(): Promise<StudentCourseGradeSummary[]> {
  const res = await fetchWithAuth('/api/v1/exams/student/my-grades');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch student grades');
  }
  return res.json();
}
