// Allotment Engine TypeScript types for the frontend

export interface TheorySlot {
  section: string;
  faculty: string;
}

export interface PracticalSlot {
  batch: string;
  faculty: string;
}

export interface EnrollmentEntry {
  course_code: string;
  course_name: string;
  tier: 'CLASS' | 'DEPARTMENT' | 'INSTITUTE';
  delivery_mode: 'INTEGRATED_TH_PR' | 'PRACTICAL_ONLY' | 'THEORY_TUTORIAL' | 'THEORY_ONLY';
  theory: TheorySlot | null;
  practical: PracticalSlot | null;
}

export interface MyEnrollmentsResponse {
  student_id: string;
  academic_term: string;
  enrollments: EnrollmentEntry[];
}

export interface AllotmentRowError {
  row: number;
  student_id: string;
  course_code: string;
  error: string;
}

export interface AllotmentUploadResponse {
  status: 'success' | 'partial';
  total_rows_processed: number;
  sections_created: number;
  batches_created: number;
  faculty_slots_generated: number;
  errors: AllotmentRowError[];
}

export interface BatchInfo {
  id: string;
  batch_name: string;
  section_id: string | null;
  faculty_id: string | null;
  faculty_name: string | null;
}

export interface SectionInfo {
  id: string;
  section_name: string;
  faculty_id: string | null;
  faculty_name: string | null;
}

export interface OfferingInfo {
  id: string;
  course_code: string;
  course_name: string;
  course_tier: string;
  delivery_mode: string;
  academic_term: string;
  sections: SectionInfo[];
  batches: BatchInfo[];
}

// Tier badge colors
export const TIER_COLORS: Record<string, string> = {
  CLASS: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  DEPARTMENT: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  INSTITUTE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export const MODE_COLORS: Record<string, string> = {
  INTEGRATED_TH_PR: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  PRACTICAL_ONLY: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  THEORY_TUTORIAL: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  THEORY_ONLY: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

export const MODE_LABELS: Record<string, string> = {
  INTEGRATED_TH_PR: 'Theory + Lab',
  PRACTICAL_ONLY: 'Lab Only',
  THEORY_TUTORIAL: 'Theory + Tutorial',
  THEORY_ONLY: 'Theory Only',
};

// Faculty Portal Types
export interface FacultyBatchItem {
  id: string;
  batch_name: string;
  student_count: number;
  section_name: string | null;
}

export interface FacultySectionItem {
  id: string;
  section_name: string;
  student_count: number;
}

export interface FacultyCourseItem {
  offering_id: string;
  course_code: string;
  course_name: string;
  tier: 'CLASS' | 'DEPARTMENT' | 'INSTITUTE';
  delivery_mode: 'INTEGRATED_TH_PR' | 'PRACTICAL_ONLY' | 'THEORY_TUTORIAL' | 'THEORY_ONLY';
  th_hours: number;
  pr_hours: number;
  tu_hours: number;
  sections: FacultySectionItem[];
  batches: FacultyBatchItem[];
  total_students: number;
}

export interface FacultySubjectsResponse {
  faculty_id: string;
  faculty_name: string;
  department_name: string | null;
  academic_term: string;
  total_courses: number;
  total_sections: number;
  total_batches: number;
  total_students: number;
  courses: FacultyCourseItem[];
}

