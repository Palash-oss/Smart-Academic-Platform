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
  slot_type: 'THEORY' | 'PRACTICAL' | 'BREAK' | 'HONORS' | 'PROJECT' | 'EMPTY' | 'EXTRA';
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
  slot_id?: string;
  is_substituted?: boolean;
  original_faculty_name?: string;
  substitute_faculty_name?: string;
  swap_request_id?: string;
  is_extra?: boolean;
  extra_lecture_id?: string;
  extra_date?: string;
  extra_status?: 'SCHEDULED' | 'CANCELLED';
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
  extra_lectures?: ExtraLecture[];
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

export interface ExtraLecture {
  id: string;
  subject_name: string;
  subject_code: string;
  faculty_name: string;
  division_name: string;
  date: string;
  start_time: string;
  end_time: string;
  room_number: string;
  status: 'SCHEDULED' | 'CANCELLED';
  attendance_marked: boolean;
  hours: number;
}

export interface ExtraLectureSlotPreset {
  start_time: string;
  end_time: string;
  label: string;
  period: 'MORNING' | 'AFTERNOON';
}

export interface ExtraLectureFormOptions {
  divisions: Array<{
    division_id: string;
    division_name: string;
    default_room: string;
    subjects: Array<{ offering_id: string; subject_name: string; subject_code: string }>;
  }>;
  hour_boundaries: string[];
  upcoming_saturdays: string[];
  slot_presets?: ExtraLectureSlotPreset[];
}

export interface ExtraLectureCreatePayload {
  academic_term: string;
  division_id: string;
  offering_id: string;
  lecture_date: string;
  start_time: string;
  end_time: string;
  room_number: string;
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
  extra_lectures: ExtraLecture[];
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
  extra_lectures: ExtraLecture[];
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

export async function fetchExtraLectureOptions(term: string = '2026-27-SEM5'): Promise<ExtraLectureFormOptions> {
  const res = await fetchWithAuth(`/api/v1/timetable/extra-lectures/options?academic_term=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error('Failed to load Extra Lecture options');
  return res.json();
}

export async function createExtraLecture(payload: ExtraLectureCreatePayload): Promise<ExtraLecture> {
  const res = await fetchWithAuth('/api/v1/timetable/extra-lectures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = Array.isArray(err.detail) ? err.detail.map((d: any) => d.msg).join('; ') : err.detail;
    throw new Error(detail || 'Failed to create Extra Lecture');
  }
  return res.json();
}

export async function cancelExtraLecture(id: string): Promise<ExtraLecture> {
  const res = await fetchWithAuth(`/api/v1/timetable/extra-lectures/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to cancel Extra Lecture');
  }
  return res.json();
}
