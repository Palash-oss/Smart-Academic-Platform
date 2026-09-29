import { fetchWithAuth } from './api';

export interface TimeSlotDef {
  start_time: string;
  end_time: string;
  label: string;
  is_break: boolean;
  break_title?: string;
}

export interface ParallelBatchItem {
  course_code: string;
  course_abbr: string;
  course_name: string;
  batch_name: string;
  faculty_initials: string;
  faculty_name: string;
  room_number: string;
}

export interface TimetableCell {
  day_of_week: string;
  start_time: string;
  end_time: string;
  slot_type: 'THEORY' | 'PRACTICAL' | 'BREAK' | 'HONORS' | 'PROJECT' | 'EMPTY';
  col_span: number;
  room_number?: string;
  custom_title?: string;
  course_code?: string;
  course_abbr?: string;
  course_name?: string;
  faculty_initials?: string;
  faculty_name?: string;
  section_name?: string;
  batch_name?: string;
  is_parallel?: boolean;
  parallel_items?: ParallelBatchItem[];
}

export interface LegendItem {
  abbr: string;
  name: string;
  code?: string;
}

export interface MasterTimetableHeader {
  class_name: string;
  division_name: string;
  room_number: string;
  class_teacher: string;
  effective_dates: string;
  academic_term: string;
}

export interface MasterTimetableResponse {
  header: MasterTimetableHeader;
  time_slots: TimeSlotDef[];
  days: string[];
  grid: Record<string, TimetableCell[]>;
  subject_legend: LegendItem[];
  faculty_legend: LegendItem[];
}

export interface PersonalizedSlotItem {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  component_type: string;
  course_code: string;
  course_abbr: string;
  course_name: string;
  division_name?: string;
  batch_name?: string;
  room_number: string;
  teacher_or_student_name?: string;
}

export interface FacultyTimetableResponse {
  faculty_id: string;
  faculty_name: string;
  faculty_initials: string;
  email: string;
  academic_term: string;
  total_weekly_hours: number;
  theory_hours: number;
  practical_hours: number;
  assigned_courses_count: number;
  time_slots: TimeSlotDef[];
  days: string[];
  schedule: Record<string, TimetableCell[]>;
  upcoming_lectures: PersonalizedSlotItem[];
}

export interface StudentTimetableResponse {
  student_id: string;
  student_name: string;
  roll_no: string;
  erp_id?: string;
  division_name: string;
  batch_name: string;
  academic_term: string;
  total_weekly_hours: number;
  theory_hours: number;
  practical_hours: number;
  time_slots: TimeSlotDef[];
  days: string[];
  schedule: Record<string, TimetableCell[]>;
  today_schedule: PersonalizedSlotItem[];
}

export interface TimetableStatusResponse {
  academic_term: string;
  allotment_completed: boolean;
  allotment_details: {
    total_offerings: number;
    total_sections: number;
    total_batches: number;
    total_enrollments: number;
  };
  timetable_generated: boolean;
  total_slots_count: number;
  can_generate: boolean;
  message: string;
}

export async function fetchTimetableStatus(term: string = '2026-27-SEM5'): Promise<TimetableStatusResponse> {
  const res = await fetchWithAuth(`/api/v1/timetable/status?academic_term=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error('Failed to fetch timetable status');
  return res.json();
}

export async function generateTimetable(term: string = '2026-27-SEM5', roomNumber: string = '703'): Promise<any> {
  const res = await fetchWithAuth('/api/v1/timetable/generate', {
    method: 'POST',
    body: JSON.stringify({ academic_term: term, room_number: roomNumber, overwrite: true }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to generate timetable');
  }
  return res.json();
}

export async function fetchMasterTimetable(term: string = '2026-27-SEM5', division: string = 'B'): Promise<MasterTimetableResponse> {
  const res = await fetchWithAuth(`/api/v1/timetable/master?academic_term=${encodeURIComponent(term)}&division_name=${encodeURIComponent(division)}`);
  if (!res.ok) throw new Error('Failed to load master timetable');
  return res.json();
}

export async function fetchFacultyTimetable(term: string = '2026-27-SEM5'): Promise<FacultyTimetableResponse> {
  const res = await fetchWithAuth(`/api/v1/timetable/faculty/me?academic_term=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error('Failed to load faculty timetable');
  return res.json();
}

export async function fetchStudentTimetable(term: string = '2026-27-SEM5'): Promise<StudentTimetableResponse> {
  const res = await fetchWithAuth(`/api/v1/timetable/student/me?academic_term=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error('Failed to load student timetable');
  return res.json();
}

export async function dissolveTimetable(term: string = '2026-27-SEM5'): Promise<any> {
  const encTerm = encodeURIComponent(term);
  
  // Try POST first (most reliable across Next.js rewrites and proxies)
  let res = await fetchWithAuth(`/api/v1/timetable/clear?academic_term=${encTerm}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ academic_term: term }),
  });

  // If POST returned 404 or 405, fallback to DELETE
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await fetchWithAuth(`/api/v1/timetable/clear?academic_term=${encTerm}`, {
      method: 'DELETE',
    });
  }

  // If still not ok and 404, fallback to /dissolve alias
  if (!res.ok && res.status === 404) {
    res = await fetchWithAuth(`/api/v1/timetable/dissolve?academic_term=${encTerm}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academic_term: term }),
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to dissolve timetable (HTTP ${res.status})`);
  }
  return res.json();
}
