'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarPlus } from 'lucide-react';
import {
  createExtraLecture,
  fetchExtraLectureOptions,
  ExtraLecture,
  ExtraLectureFormOptions,
} from '@/lib/timetable';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #E4E4E7',
  borderRadius: '6px',
  fontSize: '13px',
  background: '#FFFFFF',
  color: '#09090B',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: '#71717A',
  marginBottom: '4px',
  fontFamily: '"JetBrains Mono", monospace',
};

export function formatExtraDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

interface FormProps {
  term: string;
  onClose: () => void;
  onCreated: (lecture: ExtraLecture) => void;
}

/** Modal form for Add Extra Lecture, driven entirely by the form-options endpoint. */
export function AddExtraLectureModal({ term, onClose, onCreated }: FormProps) {
  const [options, setOptions] = useState<ExtraLectureFormOptions | null>(null);
  const [loadError, setLoadError] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [date, setDate] = useState('');
  const [selected, setSelected] = useState<number[]>([]); // indexes of selected hour slots
  const [room, setRoom] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchExtraLectureOptions(term)
      .then((o) => {
        setOptions(o);
        if (o.divisions.length === 1) pickDivision(o, o.divisions[0].division_id);
        if (o.upcoming_saturdays.length) setDate(o.upcoming_saturdays[0]);
      })
      .catch((e) => setLoadError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const division = useMemo(
    () => options?.divisions.find((d) => d.division_id === divisionId),
    [options, divisionId]
  );

  function pickDivision(o: ExtraLectureFormOptions, id: string) {
    setDivisionId(id);
    const d = o.divisions.find((x) => x.division_id === id);
    setRoom(d?.default_room ?? '');
    setOfferingId(d && d.subjects.length === 1 ? d.subjects[0].offering_id : '');
  }

  // Hour slot i spans boundaries[i] -> boundaries[i+1]. Only a contiguous run can be selected.
  const hourCount = options ? options.hour_boundaries.length - 1 : 0;
  function toggleHour(i: number) {
    setSelected((prev) => {
      if (prev.includes(i)) {
        // Only the first or last of the run can be removed, keeping it contiguous.
        const min = Math.min(...prev);
        const max = Math.max(...prev);
        return i === min || i === max ? prev.filter((x) => x !== i) : [i];
      }
      if (prev.length === 0) return [i];
      const min = Math.min(...prev);
      const max = Math.max(...prev);
      if (i === min - 1 || i === max + 1) return [...prev, i];
      return [i]; // not back-to-back: start a new selection
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!options) return;
    setError('');
    if (selected.length === 0) {
      setError('Select at least one hour.');
      return;
    }
    const start = options.hour_boundaries[Math.min(...selected)];
    const end = options.hour_boundaries[Math.max(...selected) + 1];
    setSubmitting(true);
    try {
      const created = await createExtraLecture({
        academic_term: term,
        division_id: divisionId,
        offering_id: offeringId,
        lecture_date: date,
        start_time: start,
        end_time: end,
        room_number: room,
      });
      onCreated(created);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <form
        onSubmit={submit}
        style={{ background: '#FFFFFF', borderRadius: '10px', width: '100%', maxWidth: '460px', padding: '22px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800 }}>Add Extra Lecture</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {loadError && <p style={{ color: '#B91C1C', fontSize: '13px' }}>{loadError}</p>}
        {!options && !loadError && <p style={{ fontSize: '13px', color: '#71717A' }}>Loading…</p>}
        {options && options.divisions.length === 0 && (
          <p style={{ fontSize: '13px', color: '#71717A' }}>You have no Divisions with timetable slots in this term.</p>
        )}

        {options && options.divisions.length > 0 && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Division</label>
              <select style={fieldStyle} value={divisionId} onChange={(e) => pickDivision(options, e.target.value)} required>
                <option value="" disabled>Select a Division</option>
                {options.divisions.map((d) => (
                  <option key={d.division_id} value={d.division_id}>{d.division_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Subject</label>
              <select style={fieldStyle} value={offeringId} onChange={(e) => setOfferingId(e.target.value)} required disabled={!division}>
                <option value="" disabled>Select a subject</option>
                {division?.subjects.map((s) => (
                  <option key={s.offering_id} value={s.offering_id}>{s.subject_name} ({s.subject_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Saturday</label>
              <select style={fieldStyle} value={date} onChange={(e) => setDate(e.target.value)} required>
                {options.upcoming_saturdays.map((d) => (
                  <option key={d} value={d}>{formatExtraDate(d)} ({d})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Hours (back-to-back)</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Array.from({ length: hourCount }, (_, i) => {
                  const on = selected.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleHour(i)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: `1px solid ${on ? '#FF5500' : '#E4E4E7'}`,
                        background: on ? '#FFF1E8' : '#FFFFFF',
                        color: on ? '#C2410C' : '#374151',
                      }}
                    >
                      {options.hour_boundaries[i]}–{options.hour_boundaries[i + 1]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Room</label>
              <input style={fieldStyle} value={room} onChange={(e) => setRoom(e.target.value)} required maxLength={50} />
            </div>

            {error && (
              <p role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={onClose} style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}>Cancel</button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: '9px 16px', background: '#FF5500', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Adding…' : 'Add Extra Lecture'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export function AddExtraLectureButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', background: '#FF5500', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
    >
      <CalendarPlus style={{ width: '15px', height: '15px' }} />
      <span>Add Extra Lecture</span>
    </button>
  );
}

/** The "Upcoming Extra Lectures" list (this week and later). */
export function UpcomingExtraLectures({ lectures }: { lectures: ExtraLecture[] }) {
  return (
    <section className="no-print" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '16px 20px', marginTop: '20px' }}>
      <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '16px', fontWeight: 800, marginBottom: '10px' }}>
        Upcoming Extra Lectures
      </h3>
      {lectures.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#71717A' }}>No Extra Lectures scheduled.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '8px' }}>
          {lectures.map((el) => {
            const cancelled = el.status === 'CANCELLED';
            return (
              <li key={el.id} style={{ border: '1px solid #E4E4E7', borderRadius: '6px', padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center', opacity: cancelled ? 0.6 : 1 }}>
                <span style={{ fontSize: '10px', fontWeight: 800, background: '#FFEDD5', color: '#C2410C', padding: '2px 6px', borderRadius: '4px' }}>EXTRA</span>
                <strong style={{ fontSize: '13px', textDecoration: cancelled ? 'line-through' : 'none' }}>
                  {el.subject_name} ({el.subject_code})
                </strong>
                <span style={{ fontSize: '12px', color: '#374151' }}>{el.division_name}</span>
                <span style={{ fontSize: '12px', color: '#374151' }}>
                  {formatExtraDate(el.date)} · {el.start_time}–{el.end_time} ({el.hours}h)
                </span>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>📍 {el.room_number}</span>
                {cancelled && <span style={{ fontSize: '11px', fontWeight: 700, color: '#B91C1C' }}>CANCELLED</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
