'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import TimetableGrid from '@/components/TimetableGrid';
import {
  fetchTimetableStatus,
  generateTimetable,
  dissolveTimetable,
  fetchMasterTimetable,
  TimetableStatusResponse,
  MasterTimetableResponse,
} from '@/lib/timetable';
import { getStoredUser, User } from '@/lib/api';
import {
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building,
  X,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminTimetablePage() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedTerm, setSelectedTerm] = useState('2026-27-SEM5');
  const [selectedDivision, setSelectedDivision] = useState('B');
  const [status, setStatus] = useState<TimetableStatusResponse | null>(null);
  const [timetableData, setTimetableData] = useState<MasterTimetableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dissolving, setDissolving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showDissolveModal, setShowDissolveModal] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    loadAll(selectedTerm, selectedDivision);
  }, [selectedTerm, selectedDivision]);

  const loadAll = async (term: string, div: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const st = await fetchTimetableStatus(term);
      setStatus(st);

      if (st.timetable_generated) {
        const tt = await fetchMasterTimetable(term, div);
        setTimetableData(tt);
      } else {
        setTimetableData(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!status?.can_generate) {
      setErrorMsg('Cannot generate timetable: Allotment is not completed for this term.');
      return;
    }

    setGenerating(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const room = selectedDivision === 'B' ? '703' : '702';
      const res = await generateTimetable(selectedTerm, room);
      setSuccessMsg(res.message || 'Timetable generated successfully!');
      await loadAll(selectedTerm, selectedDivision);
    } catch (err: any) {
      setErrorMsg(err.message || 'Timetable generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenDissolve = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setShowDissolveModal(true);
  };

  const handleConfirmDissolve = async () => {
    setDissolving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await dissolveTimetable(selectedTerm);
      setSuccessMsg(res.message || 'Timetable dissolved successfully.');
      setTimetableData(null);
      await loadAll(selectedTerm, selectedDivision);
      setShowDissolveModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dissolve timetable');
    } finally {
      setDissolving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFB', color: '#09090B' }}>
      <Navbar />

      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Breadcrumb & Title */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A' }}>
            <Link href="/" style={{ color: '#71717A', textDecoration: 'none' }}>HOME</Link>
            <ChevronRight style={{ width: '12px', height: '12px' }} />
            <Link href="/admin/allotment" style={{ color: '#71717A', textDecoration: 'none' }}>ADMIN</Link>
            <ChevronRight style={{ width: '12px', height: '12px' }} />
            <span style={{ color: '#FF5500', fontWeight: 700 }}>TIMETABLE SCHEDULER</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                Master Timetable Command Center
              </h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A' }}>
                Automated conflict-free scheduling engine operating downstream of committed allotments.
              </p>
            </div>

            {/* Controls Bar: Term & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                style={{
                  padding: '9px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '6px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#09090B',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="2026-27-SEM5">Semester 5 (2026-27-SEM5) [Ongoing]</option>
                <option value="2026-27-SEM6">Semester 6 (2026-27-SEM6) [Upcoming]</option>
              </select>

              {(status?.timetable_generated || (status?.total_slots_count ?? 0) > 0 || timetableData !== null) && (
                <button
                  id="dissolve-timetable-btn"
                  onClick={handleOpenDissolve}
                  disabled={dissolving || generating}
                  title="Dissolve all scheduled slots for this term"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: dissolving || generating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Trash2 style={{ width: '15px', height: '15px' }} />
                  <span>{dissolving ? 'Dissolving...' : 'Dissolve Timetable'}</span>
                </button>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || dissolving || (status ? !status.can_generate : false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  background: status?.can_generate ? '#FF5500' : '#D4D4D8',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: status?.can_generate && !generating && !dissolving ? 'pointer' : 'not-allowed',
                  boxShadow: status?.can_generate ? '0 2px 10px rgba(255, 85, 0, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Sparkles style={{ width: '15px', height: '15px' }} />
                <span>{generating ? 'Scheduling Slots...' : status?.timetable_generated ? 'Re-generate Timetable' : 'Generate Timetable'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px', color: '#DC2626', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px', color: '#059669', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            <CheckCircle2 style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Allotment Guard Check & Status Banner */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E7',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: status?.allotment_completed ? '#ECFDF5' : '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck style={{ width: '22px', height: '22px', color: status?.allotment_completed ? '#059669' : '#DC2626' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: '14.5px' }}>
                  Allotment Engine Dependency Status
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 700,
                    background: status?.allotment_completed ? '#D1FAE5' : '#FEE2E2',
                    color: status?.allotment_completed ? '#065F46' : '#991B1B',
                  }}
                >
                  {status?.allotment_completed ? 'READY FOR TIMETABLE' : 'ALLOTMENT INCOMPLETE'}
                </span>
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', color: '#71717A', margin: 0 }}>
                {status?.message || 'Validating course offerings and batch allocations...'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {status?.allotment_details && (
              <div style={{ display: 'flex', gap: '16px', borderRight: '1px solid #E4E4E7', paddingRight: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '16px', fontWeight: 800 }}>{status.allotment_details.total_offerings}</div>
                  <div style={{ fontSize: '10px', color: '#71717A', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>Courses</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '16px', fontWeight: 800 }}>{status.allotment_details.total_sections}</div>
                  <div style={{ fontSize: '10px', color: '#71717A', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>Sections</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '16px', fontWeight: 800 }}>{status.allotment_details.total_batches}</div>
                  <div style={{ fontSize: '10px', color: '#71717A', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>Lab Batches</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '16px', fontWeight: 800 }}>{status.allotment_details.total_enrollments}</div>
                  <div style={{ fontSize: '10px', color: '#71717A', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>Enrollments</div>
                </div>
              </div>
            )}

            {!status?.allotment_completed && (
              <Link
                href="/admin/allotment"
                style={{
                  padding: '8px 14px',
                  background: '#18181B',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                Go to Allotment Engine →
              </Link>
            )}
          </div>
        </div>

        {/* Division Switcher Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'B', name: 'Division B (T.E. COMP-B)', room: 'Room 703' },
              { id: 'A', name: 'Division A (T.E. COMP-A)', room: 'Room 702' },
            ].map((divTab) => (
              <button
                key={divTab.id}
                onClick={() => setSelectedDivision(divTab.id)}
                style={{
                  padding: '9px 18px',
                  background: selectedDivision === divTab.id ? '#18181B' : '#FFFFFF',
                  color: selectedDivision === divTab.id ? '#FFFFFF' : '#71717A',
                  border: selectedDivision === divTab.id ? '1px solid #18181B' : '1px solid #E4E4E7',
                  borderRadius: '6px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Building style={{ width: '14px', height: '14px', color: selectedDivision === divTab.id ? '#FF5500' : '#71717A' }} />
                <span>{divTab.name}</span>
                <span style={{ fontSize: '11px', opacity: 0.8, fontFamily: '"JetBrains Mono", monospace' }}>[{divTab.room}]</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: '12px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A' }}>
            STATUS: <span style={{ color: status?.timetable_generated ? '#059669' : '#D97706', fontWeight: 700 }}>
              {status?.timetable_generated ? `${status.total_slots_count} SLOTS SCHEDULED` : 'NOT GENERATED'}
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px', padding: '60px', textAlign: 'center' }}>
            <RefreshCw style={{ width: '28px', height: '28px', color: '#FF5500', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717A' }}>Loading master timetable grid...</p>
          </div>
        ) : timetableData ? (
          <TimetableGrid data={timetableData} />
        ) : (
          <div style={{ background: '#FFFFFF', border: '2px dashed #E4E4E7', borderRadius: '8px', padding: '60px', textAlign: 'center' }}>
            <Calendar style={{ width: '36px', height: '36px', color: '#A1A1AA', margin: '0 auto 16px' }} />
            <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
              No Timetable Generated Yet for {selectedTerm}
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13.5px', color: '#71717A', maxWidth: '480px', margin: '0 auto 20px' }}>
              Allotment is verified and ready. Click the button below to auto-schedule parallel lab batches, core theory sessions, break columns, and elective cohorts.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                background: '#FF5500',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(255, 85, 0, 0.25)',
              }}
            >
              <Sparkles style={{ width: '15px', height: '15px' }} />
              <span>{generating ? 'Scheduling...' : 'Generate Conflict-Free Timetable Now'}</span>
            </button>
          </div>
        )}

        {/* Dedicated Dissolve Timetable Confirmation Modal */}
        {showDissolveModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '520px',
                background: '#FFFFFF',
                border: '1px solid #E4E4E7',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25)',
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      padding: '10px',
                      background: '#FEE2E2',
                      borderRadius: '8px',
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 style={{ width: '22px', height: '22px' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '18px', fontWeight: 800, color: '#09090B' }}>
                      Dissolve Master Timetable
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace', color: '#71717A' }}>
                      Academic Term: {selectedTerm}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDissolveModal(false)}
                  disabled={dissolving}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '6px',
                    cursor: 'pointer',
                    color: '#71717A',
                    borderRadius: '6px',
                  }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              {/* Modal Description */}
              <div style={{ marginBottom: '20px', fontSize: '13px', lineHeight: 1.6, color: '#3F3F46' }}>
                <p style={{ margin: '0 0 12px' }}>
                  Are you sure you want to dissolve the master timetable for <strong>{selectedTerm}</strong>?
                </p>

                <div style={{ background: '#FFF1F2', border: '1px solid #FFE4E6', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#BE123C', fontWeight: 600, fontSize: '12.5px', marginBottom: '4px' }}>
                    <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px' }} />
                    <span>Scheduled Slots Removal:</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9F1239', paddingLeft: '24px' }}>
                    All <strong>{status?.total_slots_count || 126}</strong> scheduled time slots (core lectures, parallel lab batches, honors, breaks) across Division A and Division B will be permanently wiped.
                  </p>
                </div>

                <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#15803D', fontWeight: 600, fontSize: '12.5px', marginBottom: '4px' }}>
                    <CheckCircle2 style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px' }} />
                    <span>Underlying Data Safe:</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#166534', paddingLeft: '24px' }}>
                    Student course enrollments, elective allocations, classroom definitions, and faculty assignments remain completely intact. You can click <em>Generate Timetable</em> at any time to re-create conflict-free schedules.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', color: '#DC2626', fontSize: '12.5px' }}>
                  <AlertTriangle style={{ width: '15px', height: '15px', flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid #E4E4E7' }}>
                <button
                  type="button"
                  onClick={() => setShowDissolveModal(false)}
                  disabled={dissolving}
                  style={{
                    padding: '9px 18px',
                    background: '#F4F4F6',
                    color: '#18181B',
                    border: '1px solid #E4E4E7',
                    borderRadius: '6px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: dissolving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="confirm-dissolve-timetable-btn"
                  onClick={handleConfirmDissolve}
                  disabled={dissolving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 20px',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: dissolving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                  }}
                >
                  {dissolving ? (
                    <>
                      <RefreshCw style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
                      <span>Dissolving Slots...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 style={{ width: '15px', height: '15px' }} />
                      <span>Confirm Dissolve</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
