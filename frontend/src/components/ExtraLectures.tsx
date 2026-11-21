'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarPlus, Clock, Sun, Sunset, Check, MapPin } from 'lucide-react';
import {
  cancelExtraLecture,
  createExtraLecture,
  fetchExtraLectureOptions,
  ExtraLecture,
  ExtraLectureFormOptions,
  ExtraLectureSlotPreset,
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

const DEFAULT_PRESETS: ExtraLectureSlotPreset[] = [
  { start_time: '08:45', end_time: '09:45', label: '08:45–09:45', period: 'MORNING' },
  { start_time: '09:45', end_time: '10:45', label: '09:45–10:45', period: 'MORNING' },
  { start_time: '11:00', end_time: '12:00', label: '11:00–12:00', period: 'MORNING' },
  { start_time: '12:00', end_time: '13:00', label: '12:00–13:00', period: 'MORNING' },
  { start_time: '13:30', end_time: '14:30', label: '13:30–14:30', period: 'AFTERNOON' },
  { start_time: '14:30', end_time: '15:30', label: '14:30–15:30', period: 'AFTERNOON' },
  { start_time: '15:30', end_time: '16:30', label: '15:30–16:30', period: 'AFTERNOON' },
  { start_time: '16:30', end_time: '17:30', label: '16:30–17:30', period: 'AFTERNOON' },
];

export function localIsoDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatExtraDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDuration(startTime: string, endTime: string): string {
  try {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return '0 hrs';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
    return `${m} mins`;
  } catch {
    return '';
  }
}

/** Link to the marking page, prefilled with this Extra Lecture's subject, Division and date. */
export function attendanceUrl(el: ExtraLecture): string {
  const div = el.division_name.replace('COMP-', '').replace('Division ', '');
  return `/faculty/mark?course=${encodeURIComponent(el.subject_name)}&div=${encodeURIComponent(div)}&batch=ALL&date=${el.date}&extra_lecture=${el.id}`;
}

interface FormProps {
  term: string;
  onClose: () => void;
  onCreated: (lecture: ExtraLecture) => void;
}

/** Modal form for Add Extra Lecture, supporting both Morning/Afternoon Presets (with back-to-back selection) and Custom Times. */
export function AddExtraLectureModal({ term, onClose, onCreated }: FormProps) {
  const [options, setOptions] = useState<ExtraLectureFormOptions | null>(null);
  const [loadError, setLoadError] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [date, setDate] = useState('');
  const [timeMode, setTimeMode] = useState<'preset' | 'custom'>('preset');
  const [selected, setSelected] = useState<number[]>([]); // indexes in presets array
  const [customStart, setCustomStart] = useState('09:00');
  const [customEnd, setCustomEnd] = useState('11:00');
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

  const presets: ExtraLectureSlotPreset[] = useMemo(() => {
    if (options?.slot_presets && options.slot_presets.length > 0) {
      return options.slot_presets;
    }
    return DEFAULT_PRESETS;
  }, [options]);

  const morningSlots = useMemo(
    () => presets.map((p, idx) => ({ ...p, originalIndex: idx })).filter((p) => p.period === 'MORNING'),
    [presets]
  );

  const afternoonSlots = useMemo(
    () => presets.map((p, idx) => ({ ...p, originalIndex: idx })).filter((p) => p.period === 'AFTERNOON'),
    [presets]
  );

  function pickDivision(o: ExtraLectureFormOptions, id: string) {
    setDivisionId(id);
    const d = o.divisions.find((x) => x.division_id === id);
    setRoom(d?.default_room ?? '');
    setOfferingId(d && d.subjects.length === 1 ? d.subjects[0].offering_id : '');
  }

  // Toggle hour index. Keeps selection contiguous (back-to-back blocks).
  function toggleHour(i: number) {
    setSelected((prev) => {
      if (prev.includes(i)) {
        if (prev.length <= 1) return [];
        const min = Math.min(...prev);
        const max = Math.max(...prev);
        if (i === min) return prev.filter((x) => x !== i);
        if (i === max) return prev.filter((x) => x !== i);
        return [i]; // clicked middle, collapse to this single slot
      }
      if (prev.length === 0) return [i];
      const min = Math.min(...prev);
      const max = Math.max(...prev);
      if (i === min - 1 || i === max + 1) {
        return [...prev, i].sort((a, b) => a - b);
      }
      // Non-contiguous click: start fresh selection
      return [i];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!options) return;
    setError('');

    let start = '';
    let end = '';

    if (timeMode === 'preset') {
      if (selected.length === 0) {
        setError('Please select at least one hour slot.');
        return;
      }
      const min = Math.min(...selected);
      const max = Math.max(...selected);
      start = presets[min].start_time;
      end = presets[max].end_time;
    } else {
      if (!customStart || !customEnd) {
        setError('Please enter both start time and end time.');
        return;
      }
      if (customStart >= customEnd) {
        setError('End time must be later than start time.');
        return;
      }
      if (customStart < '08:00' || customEnd > '18:30') {
        setError('Extra lectures must be scheduled between 08:00 and 18:30.');
        return;
      }
      start = customStart;
      end = customEnd;
    }

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
      setError(err.message || 'Failed to add extra lecture.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '480px',
          padding: '22px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800, margin: 0, color: '#09090B' }}>
              Add Extra Lecture
            </h2>
            <p style={{ fontSize: '12px', color: '#71717A', margin: '2px 0 0' }}>
              Schedule Saturday morning or afternoon sessions
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {loadError && <p style={{ color: '#B91C1C', fontSize: '13px' }}>{loadError}</p>}
        {!options && !loadError && <p style={{ fontSize: '13px', color: '#71717A' }}>Loading form options…</p>}
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
              <label style={labelStyle}>Saturday Date</label>
              <select style={fieldStyle} value={date} onChange={(e) => setDate(e.target.value)} required>
                {options.upcoming_saturdays.map((d) => (
                  <option key={d} value={d}>{formatExtraDate(d)} ({d})</option>
                ))}
              </select>
            </div>

            {/* Timing Mode & Slots */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={labelStyle}>Lecture Timing</label>
                <div style={{ display: 'inline-flex', padding: '2px', background: '#F4F4F5', borderRadius: '6px', border: '1px solid #E4E4E7' }}>
                  <button
                    type="button"
                    onClick={() => setTimeMode('preset')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 9px',
                      borderRadius: '5px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: timeMode === 'preset' ? '#FFFFFF' : 'transparent',
                      color: timeMode === 'preset' ? '#FF5500' : '#71717A',
                      boxShadow: timeMode === 'preset' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <Clock style={{ width: '12px', height: '12px' }} />
                    <span>Preset Slots</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeMode('custom')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 9px',
                      borderRadius: '5px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: timeMode === 'custom' ? '#FFFFFF' : 'transparent',
                      color: timeMode === 'custom' ? '#FF5500' : '#71717A',
                      boxShadow: timeMode === 'custom' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <CalendarPlus style={{ width: '12px', height: '12px' }} />
                    <span>Custom Time</span>
                  </button>
                </div>
              </div>

              {timeMode === 'preset' ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {/* Morning presets */}
                  <div style={{ background: '#FFFDF9', border: '1px solid #FEF3C7', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <Sun style={{ width: '13px', height: '13px', color: '#D97706' }} />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Morning Sessions (08:45 – 13:00)
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                      {morningSlots.map((p) => {
                        const on = selected.includes(p.originalIndex);
                        return (
                          <button
                            key={p.originalIndex}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleHour(p.originalIndex)}
                            style={{
                              padding: '7px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
                              border: `1px solid ${on ? '#FF5500' : '#E5E7EB'}`,
                              background: on ? '#FFF1E8' : '#FFFFFF',
                              color: on ? '#C2410C' : '#374151',
                            }}
                          >
                            {on && <Check style={{ width: '12px', height: '12px', strokeWidth: 3 }} />}
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Afternoon presets */}
                  <div style={{ background: '#FFFBF9', border: '1px solid #FFEDD5', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <Sunset style={{ width: '13px', height: '13px', color: '#EA580C' }} />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#9A3412', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Afternoon Sessions (13:30 – 17:30)
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                      {afternoonSlots.map((p) => {
                        const on = selected.includes(p.originalIndex);
                        return (
                          <button
                            key={p.originalIndex}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleHour(p.originalIndex)}
                            style={{
                              padding: '7px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
                              border: `1px solid ${on ? '#FF5500' : '#E5E7EB'}`,
                              background: on ? '#FFF1E8' : '#FFFFFF',
                              color: on ? '#C2410C' : '#374151',
                            }}
                          >
                            {on && <Check style={{ width: '12px', height: '12px', strokeWidth: 3 }} />}
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selected.length > 0 ? (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#FFF7ED',
                        border: '1px solid #FFEDD5',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: '#C2410C',
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        Selected: <strong>{presets[Math.min(...selected)].start_time} – {presets[Math.max(...selected)].end_time}</strong>
                      </span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', background: '#FF5500', color: '#FFFFFF', borderRadius: '10px', fontWeight: 700 }}>
                        {formatDuration(presets[Math.min(...selected)].start_time, presets[Math.max(...selected)].end_time)}
                      </span>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '11px', color: '#71717A', fontStyle: 'italic' }}>
                      Select a slot, or select consecutive slots for a continuous back-to-back block.
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '10px', marginBottom: '3px' }}>Start Time</label>
                      <input
                        type="time"
                        style={fieldStyle}
                        value={customStart}
                        min="08:00"
                        max="18:00"
                        step="300"
                        onChange={(e) => setCustomStart(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '10px', marginBottom: '3px' }}>End Time</label>
                      <input
                        type="time"
                        style={fieldStyle}
                        value={customEnd}
                        min="08:30"
                        max="18:30"
                        step="300"
                        onChange={(e) => setCustomEnd(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase', marginBottom: '5px', fontFamily: '"JetBrains Mono", monospace' }}>
                      Quick Ranges
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[
                        { start: '09:00', end: '11:00', label: '09:00–11:00 (2h)' },
                        { start: '10:00', end: '12:00', label: '10:00–12:00 (2h)' },
                        { start: '11:00', end: '13:00', label: '11:00–13:00 (2h)' },
                        { start: '14:00', end: '16:00', label: '14:00–16:00 (2h)' },
                        { start: '15:00', end: '17:00', label: '15:00–17:00 (2h)' },
                      ].map((chip) => {
                        const isMatch = customStart === chip.start && customEnd === chip.end;
                        return (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => {
                              setCustomStart(chip.start);
                              setCustomEnd(chip.end);
                            }}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              border: `1px solid ${isMatch ? '#FF5500' : '#D1D5DB'}`,
                              background: isMatch ? '#FFF1E8' : '#FFFFFF',
                              color: isMatch ? '#C2410C' : '#4B5563',
                            }}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {customStart && customEnd && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: customStart < customEnd ? '#FFF7ED' : '#FEF2F2',
                        border: `1px solid ${customStart < customEnd ? '#FFEDD5' : '#FECACA'}`,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: customStart < customEnd ? '#C2410C' : '#B91C1C',
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        Custom: <strong>{customStart} – {customEnd}</strong>
                      </span>
                      {customStart < customEnd ? (
                        <span style={{ fontSize: '11px', padding: '2px 8px', background: '#FF5500', color: '#FFFFFF', borderRadius: '10px', fontWeight: 700 }}>
                          {formatDuration(customStart, customEnd)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 700 }}>
                          End time must be after start
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
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
export function UpcomingExtraLectures({
  lectures,
  onCancelled,
  readOnly = false,
}: {
  lectures: ExtraLecture[];
  onCancelled?: (lecture: ExtraLecture) => void;
  /** Student view: no actions, and the faculty member is shown. */
  readOnly?: boolean;
}) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  async function cancel(el: ExtraLecture) {
    const ok = window.confirm(
      `Cancel the Extra Lecture for ${el.subject_name} on ${formatExtraDate(el.date)} (${el.start_time}–${el.end_time})? Students will be told it is cancelled.`
    );
    if (!ok) return;
    setError('');
    setBusyId(el.id);
    try {
      onCancelled?.(await cancelExtraLecture(el.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="no-print" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '16px 20px', marginTop: '20px' }}>
      <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '16px', fontWeight: 800, marginBottom: '10px' }}>
        Upcoming Extra Lectures
      </h3>
      {error && (
        <p role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', marginBottom: '10px' }}>
          {error}
        </p>
      )}
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
                <span style={{ fontSize: '12px', color: '#374151' }}>{readOnly ? el.faculty_name : el.division_name}</span>
                <span style={{ fontSize: '12px', color: '#374151' }}>
                  {formatExtraDate(el.date)} · {el.start_time}–{el.end_time} ({el.hours}h)
                </span>
                <span style={{ fontSize: '12px', color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <MapPin style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                  <span>{el.room_number}</span>
                </span>
                {cancelled && <span style={{ fontSize: '11px', fontWeight: 700, color: '#B91C1C' }}>Cancelled</span>}
                {!readOnly && !cancelled && el.status === 'SCHEDULED' && el.date === localIsoDate() && !el.attendance_marked && (
                  <a
                    href={attendanceUrl(el)}
                    style={{ marginLeft: 'auto', padding: '5px 10px', background: '#FF5500', color: '#FFFFFF', borderRadius: '6px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
                  >
                    Take attendance
                  </a>
                )}
                {!readOnly && el.attendance_marked && <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D' }}>Attendance taken</span>}
                {!readOnly && !cancelled && el.status === 'SCHEDULED' && el.date >= localIsoDate() && !el.attendance_marked && (
                  <button
                    type="button"
                    onClick={() => cancel(el)}
                    disabled={busyId === el.id}
                    style={{ marginLeft: 'auto', padding: '5px 10px', background: '#FFFFFF', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: busyId === el.id ? 0.6 : 1 }}
                  >
                    {busyId === el.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
