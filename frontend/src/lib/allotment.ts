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
  student_name?: string;
  roll_no?: string;
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
  notices?: string[];
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

// Tier badge colors - Technical Architectural Palette (Zero purple/blue)
export const TIER_COLORS: Record<string, string> = {
  CLASS: 'bg-[#F4F4F6] text-[#09090B] border-[#D4D4D8]',
  DEPARTMENT: 'bg-[#FFF4ED] text-[#FF5500] border-[#FED7AA]',
  INSTITUTE: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
};

export const MODE_COLORS: Record<string, string> = {
  INTEGRATED_TH_PR: 'bg-[#F4F4F6] text-[#09090B] border-[#D4D4D8]',
  PRACTICAL_ONLY: 'bg-[#F4F4F6] text-[#52525B] border-[#D4D4D8]',
  THEORY_TUTORIAL: 'bg-[#F4F4F6] text-[#52525B] border-[#D4D4D8]',
  THEORY_ONLY: 'bg-[#F4F4F6] text-[#52525B] border-[#D4D4D8]',
};

export const MODE_LABELS: Record<string, string> = {
  INTEGRATED_TH_PR: 'Theory + Lab',
  PRACTICAL_ONLY: 'Lab Only',
  THEORY_TUTORIAL: 'Theory + Tutorial',
  THEORY_ONLY: 'Theory Only',
};

export interface FacultyStudentRosterItem {
  id: string;
  student_erp_id?: string | null;
  roll_no?: string | null;
  name: string;
  email: string;
  division?: string | null;
  section_name?: string | null;
  batch_name?: string | null;
}

// Faculty Portal Types
export interface FacultyBatchItem {
  id: string;
  batch_name: string;
  student_count: number;
  section_name: string | null;
  division?: string | null;
  batch_label?: string | null;
  component_type?: string;
  students?: FacultyStudentRosterItem[];
}

export interface FacultySectionItem {
  id: string;
  section_name: string;
  student_count: number;
  division?: string | null;
  component_type?: string;
  students?: FacultyStudentRosterItem[];
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
  divisions?: string[];
  assigned_types?: string[];
  students?: FacultyStudentRosterItem[];
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

