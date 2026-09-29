'use client';

import React, { useState } from 'react';
import { MasterTimetableResponse, TimetableCell, ParallelBatchItem } from '@/lib/timetable';
import { Printer, Info, Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react';

interface TimetableGridProps {
  data: MasterTimetableResponse;
  titleOverride?: string;
  showPrintButton?: boolean;
}

export default function TimetableGrid({ data, titleOverride, showPrintButton = true }: TimetableGridProps) {
  const [activeTooltip, setActiveTooltip] = useState<{
    cell: TimetableCell;
    x: number;
    y: number;
  } | null>(null);

  const { header, time_slots, days, grid, subject_legend, faculty_legend } = data;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="timetable-container" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Top Toolbar (Hidden during print) */}
      {showPrintButton && (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: '#18181B',
              color: '#FFFFFF',
              border: '1px solid #27272A',
              borderRadius: '6px',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#27272A')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#18181B')}
          >
            <Printer style={{ width: '15px', height: '15px' }} />
            <span>Print Timetable (Official Format)</span>
          </button>
        </div>
      )}

      {/* Main Official Document Wrapper */}
      <div
        className="printable-sheet"
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          color: '#000000',
        }}
      >
        {/* Header Block Matching Reference */}
        <div style={{ borderBottom: '2px solid #000000', paddingBottom: '8px', marginBottom: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', fontWeight: 700 }}>
            <div>
              <span>Class: </span>
              <span style={{ textTransform: 'uppercase' }}>{titleOverride || header.class_name}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span>Room Number: </span>
              <span>{header.room_number}</span>
            </div>
            <div>
              <span>Class Teacher: </span>
              <span style={{ textTransform: 'uppercase' }}>{header.class_teacher}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span>With Effect From: </span>
              <span>{header.effective_dates}</span>
            </div>
          </div>
        </div>

        {/* Timetable Matrix */}
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '2px solid #000000',
              textAlign: 'center',
              fontSize: '11px',
              tableLayout: 'fixed',
            }}
          >
            <thead>
              <tr style={{ background: '#F4F4F5', borderBottom: '2px solid #000000' }}>
                <th
                  style={{
                    width: '90px',
                    padding: '8px 4px',
                    border: '1px solid #000000',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Day / Time
                </th>
                {time_slots.map((slot, sIdx) => (
                  <th
                    key={sIdx}
                    style={{
                      width: slot.is_break ? '55px' : '105px',
                      padding: '6px 2px',
                      border: '1px solid #000000',
                      fontWeight: 700,
                      background: slot.is_break ? '#E4E4E7' : '#F4F4F5',
                      fontSize: slot.is_break ? '9.5px' : '10.5px',
                      lineHeight: 1.25,
                    }}
                  >
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dayCells = grid[day] || [];
                return (
                  <tr key={day} style={{ borderBottom: '1px solid #000000', minHeight: '65px' }}>
                    {/* Day Column */}
                    <td
                      style={{
                        padding: '10px 4px',
                        border: '1px solid #000000',
                        fontWeight: 800,
                        background: '#FAFAFB',
                        fontFamily: '"Plus Jakarta Sans", sans-serif',
                        fontSize: '12px',
                      }}
                    >
                      {day}
                    </td>

                    {/* Cells for this Day */}
                    {dayCells.map((cell, cIdx) => {
                      // 1. Break Columns
                      if (cell.slot_type === 'BREAK') {
                        return (
                          <td
                            key={cIdx}
                            colSpan={cell.col_span}
                            style={{
                              border: '1px solid #000000',
                              background: '#F4F4F5',
                              padding: '4px',
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                              fontWeight: 800,
                              fontSize: '9.5px',
                              letterSpacing: '0.08em',
                              color: '#52525B',
                              textAlign: 'center',
                            }}
                          >
                            {cell.custom_title}
                          </td>
                        );
                      }

                      // 2. Parallel Multi-Batch Practical Lab Slot or Elective Theory Slot
                      if (cell.is_parallel && cell.parallel_items && cell.parallel_items.length > 0) {
                        const isTheoryParallel = cell.slot_type === 'THEORY';
                        const distinctCourses = Array.from(new Set(cell.parallel_items.map((p) => p.course_abbr)));
                        const coursesLine = distinctCourses.length === 1 && cell.parallel_items.length > 1
                          ? distinctCourses[0]
                          : distinctCourses.length < cell.parallel_items.length
                          ? distinctCourses.join('/')
                          : cell.parallel_items.map((p) => p.course_abbr).join('/');
                        
                        const distinctBatches = Array.from(new Set(cell.parallel_items.map((p) => p.batch_name).filter(Boolean)));
                        const batchesLine = (!isTheoryParallel && distinctBatches.length > 1 && distinctBatches.every(b => ['B1', 'B2', 'B3', 'B4'].includes(b)))
                          ? distinctBatches.join('/')
                          : '';
                        
                        const distinctFaculty = Array.from(new Set(cell.parallel_items.map((p) => p.faculty_initials).filter(Boolean)));
                        const facultyLine = distinctFaculty.length === 1 && cell.parallel_items.length > 1 && !isTheoryParallel
                          ? distinctFaculty[0]
                          : distinctFaculty.join('/');

                        return (
                          <td
                            key={cIdx}
                            colSpan={cell.col_span}
                            style={{
                              border: '1px solid #000000',
                              padding: '8px 4px',
                              verticalAlign: 'middle',
                              background: '#FFFFFF',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActiveTooltip({ cell, x: rect.left, y: rect.bottom + window.scrollY });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                          >
                            <div style={{ fontWeight: 800, fontSize: isTheoryParallel ? '11.5px' : '11px', color: '#09090B', lineHeight: 1.3 }}>
                              {coursesLine}
                            </div>
                            {!isTheoryParallel && batchesLine && (
                              <div style={{ fontSize: '10px', color: '#52525B', fontWeight: 600, letterSpacing: '0.04em' }}>
                                {batchesLine}
                              </div>
                            )}
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#18181B' }}>
                              {facultyLine}
                            </div>
                          </td>
                        );
                      }

                      // 3. Special Cohorts (Honors, Mini Project)
                      if (cell.slot_type === 'HONORS' || cell.slot_type === 'PROJECT') {
                        return (
                          <td
                            key={cIdx}
                            colSpan={cell.col_span}
                            style={{
                              border: '1px solid #000000',
                              padding: '10px 4px',
                              background: cell.slot_type === 'PROJECT' ? '#EFF6FF' : '#FAF5FF',
                              fontWeight: 800,
                              fontSize: cell.slot_type === 'PROJECT' ? '12px' : '11px',
                              color: cell.slot_type === 'PROJECT' ? '#1E40AF' : '#6B21A8',
                              letterSpacing: '0.02em',
                              textAlign: 'center',
                            }}
                          >
                            {cell.custom_title || (cell.slot_type === 'PROJECT' ? 'Mini Project' : 'Honors')}
                          </td>
                        );
                      }

                      // 4. Theory Slot
                      if (cell.slot_type === 'THEORY') {
                        return (
                          <td
                            key={cIdx}
                            colSpan={cell.col_span}
                            style={{
                              border: '1px solid #000000',
                              padding: '8px 4px',
                              verticalAlign: 'middle',
                              background: '#FFFFFF',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActiveTooltip({ cell, x: rect.left, y: rect.bottom + window.scrollY });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                          >
                            <div style={{ fontWeight: 800, fontSize: '11.5px', color: '#09090B', lineHeight: 1.25 }}>
                              {cell.course_abbr}
                            </div>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#27272A', marginTop: '2px' }}>
                              {cell.faculty_initials}
                            </div>
                          </td>
                        );
                      }

                      // 5. Empty / Free Slot
                      return (
                        <td
                          key={cIdx}
                          colSpan={cell.col_span}
                          style={{
                            border: '1px solid #000000',
                            padding: '6px',
                            background: '#FFFFFF',
                          }}
                        >
                          <span style={{ color: '#D4D4D8' }}>—</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Tables Matching the Picture (Subject Legend & Faculty Legend) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '8px' }}>
          {/* Subject Abbreviations */}
          <div>
            <div
              style={{
                background: '#F4F4F5',
                border: '1px solid #000000',
                borderBottom: 'none',
                padding: '4px 8px',
                fontWeight: 800,
                fontSize: '11.5px',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Subject Abbreviation
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1px solid #000000',
                fontSize: '10.5px',
              }}
            >
              <tbody>
                {Array.from({ length: Math.ceil(subject_legend.length / 3) }).map((_, rIdx) => {
                  const items = subject_legend.slice(rIdx * 3, rIdx * 3 + 3);
                  return (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #000000' }}>
                      {items.map((sub, sIdx) => (
                        <React.Fragment key={sIdx}>
                          <td style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 800, width: '60px', background: '#FAFAFB' }}>
                            {sub.abbr}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '4px 6px', color: '#18181B' }}>
                            {sub.name}
                          </td>
                        </React.Fragment>
                      ))}
                      {/* Empty filler cells if not complete row of 3 */}
                      {items.length < 3 &&
                        Array.from({ length: 3 - items.length }).map((_, fIdx) => (
                          <React.Fragment key={`filler-${fIdx}`}>
                            <td style={{ border: '1px solid #000000', padding: '4px 6px', width: '60px' }}></td>
                            <td style={{ border: '1px solid #000000', padding: '4px 6px' }}></td>
                          </React.Fragment>
                        ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Faculty Abbreviations */}
          <div>
            <div
              style={{
                background: '#F4F4F5',
                border: '1px solid #000000',
                borderBottom: 'none',
                padding: '4px 8px',
                fontWeight: 800,
                fontSize: '11.5px',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Faculty Abbreviation
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1px solid #000000',
                fontSize: '10.5px',
              }}
            >
              <tbody>
                {Array.from({ length: Math.ceil(faculty_legend.length / 3) }).map((_, rIdx) => {
                  const items = faculty_legend.slice(rIdx * 3, rIdx * 3 + 3);
                  return (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #000000' }}>
                      {items.map((fac, sIdx) => (
                        <React.Fragment key={sIdx}>
                          <td style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 800, width: '50px', background: '#FAFAFB' }}>
                            {fac.abbr}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '4px 6px', color: '#18181B' }}>
                            {fac.name}
                          </td>
                        </React.Fragment>
                      ))}
                      {items.length < 3 &&
                        Array.from({ length: 3 - items.length }).map((_, fIdx) => (
                          <React.Fragment key={`filler-f-${fIdx}`}>
                            <td style={{ border: '1px solid #000000', padding: '4px 6px', width: '50px' }}></td>
                            <td style={{ border: '1px solid #000000', padding: '4px 6px' }}></td>
                          </React.Fragment>
                        ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Interactive Tooltip */}
      {activeTooltip && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(activeTooltip.x, window.innerWidth - 320)}px`,
            top: `${activeTooltip.y + 6}px`,
            zIndex: 999,
            background: '#18181B',
            color: '#FFFFFF',
            border: '1px solid #3F3F46',
            borderRadius: '6px',
            padding: '10px 14px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            maxWidth: '320px',
            fontSize: '12px',
            lineHeight: 1.4,
            pointerEvents: 'none',
          }}
        >
          {activeTooltip.cell.is_parallel ? (
            <div>
              <div style={{ fontWeight: 800, color: '#FF5500', marginBottom: '6px', textTransform: 'uppercase', fontSize: '10.5px' }}>
                Parallel Practical Session ({activeTooltip.cell.start_time} - {activeTooltip.cell.end_time})
              </div>
              {activeTooltip.cell.parallel_items?.map((item, pIdx) => (
                <div key={pIdx} style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #27272A' }}>
                  <div style={{ fontWeight: 700, color: '#FAFAFA' }}>
                    Batch {item.batch_name}: {item.course_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#A1A1AA' }}>
                    Faculty: {item.faculty_name} ({item.faculty_initials}) • {item.room_number}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 800, color: '#FF5500', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10.5px' }}>
                Theory Lecture ({activeTooltip.cell.start_time} - {activeTooltip.cell.end_time})
              </div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#FFFFFF', marginBottom: '2px' }}>
                {activeTooltip.cell.course_name} ({activeTooltip.cell.course_code})
              </div>
              <div style={{ color: '#D4D4D8', fontSize: '11.5px' }}>
                Faculty: <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{activeTooltip.cell.faculty_name}</span> ({activeTooltip.cell.faculty_initials})
              </div>
              <div style={{ color: '#A1A1AA', fontSize: '11px', marginTop: '2px' }}>
                Room: {activeTooltip.cell.room_number || header.room_number}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          nav, header, footer, .no-print {
            display: none !important;
          }
          .timetable-container {
            width: 100% !important;
            max-width: 100% !important;
          }
          .printable-sheet {
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            page-break-inside: avoid !important;
            padding: 8px !important;
          }
          table {
            page-break-inside: avoid !important;
          }
          @page {
            size: landscape;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
}
