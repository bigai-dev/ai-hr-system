'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getApplicantsByJob,
  updateApplicantStatus,
  archiveApplicant,
  bulkRejectApplicants,
  insertInterview,
  listJobs,
  restoreApplicant,
} from '@/app/(dashboard)/actions';
import {
  Applicant,
  ApplicantStatus,
  Job,
  PIPELINE_STAGES,
  STAGE_LABELS,
  TERMINAL_STAGES,
} from '@/lib/types';
import {
  REJECTION_REASON_LABELS,
  type RejectionReason,
} from '@/lib/email-templates-shared';
import ScheduleInterviewModal, {
  buildScheduleDefaults,
  type ScheduleValues,
} from '@/components/ScheduleInterviewModal';
import RejectReasonModal from '@/components/RejectReasonModal';

const SCORE_COLOR = (score: number | null) => {
  if (score == null) return '#6b7280';
  if (score >= 75) return '#10b981';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#FF6B35';
  return '#ef4444';
};

function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function StaleBadge({ stageChangedAt }: { stageChangedAt: string }) {
  const days = daysSince(stageChangedAt);
  let bg = 'bg-gray-200 dark:bg-[#333]';
  let fg = 'text-gray-600 dark:text-[#9ca3af]';
  let label = days === 0 ? 'today' : `${days}d`;
  if (days >= 14) {
    bg = 'bg-red-500/15';
    fg = 'text-red-500';
    label = `${days}d ⚠`;
  } else if (days >= 7) {
    bg = 'bg-amber-500/15';
    fg = 'text-amber-500';
  }
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${bg} ${fg}`}
      title={`In stage ${days} day${days === 1 ? '' : 's'}`}
    >
      {label}
    </span>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function CardBody({
  a,
  score,
  scoreColor,
}: {
  a: Applicant;
  score: number | null;
  scoreColor: string;
}) {
  return (
    <>
      <div className="flex items-start gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">
          {getInitials(a.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{a.name}</div>
          <div className="text-[11px] text-muted truncate">{a.job_title || '—'}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {score != null ? (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: scoreColor }}
            />
            <span className="text-xs font-semibold" style={{ color: scoreColor }}>
              {score}%
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted italic">no score</span>
        )}
        <StaleBadge stageChangedAt={a.stage_changed_at} />
      </div>
      {a.ai_extracted_skills && a.ai_extracted_skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {a.ai_extracted_skills.slice(0, 2).map((s) => (
            <span
              key={s}
              className="text-[10px] bg-background border border-card-border px-1.5 py-0.5 rounded text-muted"
            >
              {s}
            </span>
          ))}
          {a.ai_extracted_skills.length > 2 && (
            <span className="text-[10px] text-muted">
              +{a.ai_extracted_skills.length - 2}
            </span>
          )}
        </div>
      )}
    </>
  );
}

function CandidateCard({
  a,
  onDragStart,
  isDragging,
  selectMode,
  selected,
  onToggleSelect,
  onRestore,
  onMoveStage,
}: {
  a: Applicant;
  onDragStart: (id: string) => void;
  isDragging: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRestore?: (id: string) => void;
  onMoveStage?: (a: Applicant, target: ApplicantStatus) => void;
}) {
  const score = a.ai_match_score;
  const scoreColor = SCORE_COLOR(score);
  const baseClass = `relative block bg-card border rounded-lg p-3 mb-2 transition-all hover:shadow-md ${
    isDragging ? 'opacity-40' : ''
  } ${
    selected
      ? 'border-accent ring-2 ring-accent/30'
      : 'border-card-border hover:border-accent/50'
  }`;

  // In select mode, the whole card becomes a checkbox toggle (no drag, no nav).
  if (selectMode) {
    return (
      <div
        onClick={() => onToggleSelect(a.id)}
        className={`${baseClass} cursor-pointer select-none`}
      >
        <span
          className={`absolute top-2 right-2 w-4 h-4 rounded border flex items-center justify-center ${
            selected
              ? 'bg-accent border-accent text-white'
              : 'border-card-border bg-card'
          }`}
        >
          {selected && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <CardBody a={a} score={score} scoreColor={scoreColor} />
      </div>
    );
  }

  return (
    <Link
      href={`/candidates/${a.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', a.id);
        onDragStart(a.id);
      }}
      className={`${baseClass} cursor-grab active:cursor-grabbing`}
    >
      <CardBody a={a} score={score} scoreColor={scoreColor} />
      {/* Mobile: tap-to-move replaces drag-and-drop (HTML5 DnD doesn't fire touch events). */}
      {onMoveStage && !onRestore && (
        <div
          className="md:hidden mt-2"
          onClick={(e) => {
            // Don't let taps on the select bubble up to the parent <Link>.
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <select
            value=""
            onChange={(e) => {
              const target = e.target.value as ApplicantStatus;
              if (target) onMoveStage(a, target);
              e.target.value = '';
            }}
            className="w-full text-base bg-background border border-card-border rounded-md px-2 py-1.5 text-foreground"
            aria-label={`Move ${a.name} to a different stage`}
          >
            <option value="" disabled>
              ⇄ Move stage…
            </option>
            {[...PIPELINE_STAGES, ...TERMINAL_STAGES]
              .filter((s) => s !== a.status && s !== 'screening')
              .map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
          </select>
        </div>
      )}
      {onRestore && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRestore(a.id);
          }}
          className="mt-2 w-full text-[11px] font-semibold border border-card-border text-muted hover:text-accent hover:border-accent rounded-md py-1 transition-colors"
          title="Restore to active pipeline"
        >
          ↩ Restore
        </button>
      )}
    </Link>
  );
}

function Column({
  stage,
  applicants,
  dragOverStage,
  draggingId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  selectMode,
  selectedIds,
  onToggleSelect,
  onRestore,
  onMoveStage,
}: {
  stage: ApplicantStatus;
  applicants: Applicant[];
  dragOverStage: ApplicantStatus | null;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, stage: ApplicantStatus) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stage: ApplicantStatus) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onRestore?: (id: string) => void;
  onMoveStage?: (a: Applicant, target: ApplicantStatus) => void;
}) {
  const isOver = dragOverStage === stage;
  return (
    <div
      onDragOver={(e) => onDragOver(e, stage)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage)}
      className={`flex flex-col w-72 shrink-0 rounded-xl border bg-background/40 transition-colors ${
        isOver ? 'border-accent bg-accent/5' : 'border-card-border'
      }`}
    >
      <div className="px-3 py-2.5 border-b border-card-border flex items-center justify-between sticky top-0 bg-background/40 backdrop-blur-sm rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider">
            {STAGE_LABELS[stage]}
          </span>
          <span className="text-[11px] text-muted bg-card border border-card-border px-1.5 rounded-full font-medium">
            {applicants.length}
          </span>
        </div>
      </div>
      <div className="p-2 flex-1 min-h-[120px]">
        {applicants.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic text-center py-6 select-none">
            Drop here
          </div>
        ) : (
          applicants.map((a) => (
            <CandidateCard
              key={a.id}
              a={a}
              onDragStart={onDragStart}
              isDragging={draggingId === a.id}
              selectMode={selectMode}
              selected={selectedIds.has(a.id)}
              onToggleSelect={onToggleSelect}
              onRestore={onRestore}
              onMoveStage={onMoveStage}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function CandidateKanban() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobParam = searchParams.get('job');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicantStatus | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // null = closed; otherwise the set of applicant ids the modal is acting on.
  const [rejectModalIds, setRejectModalIds] = useState<string[] | null>(null);
  // Drag-to-schedule target. Set when a candidate is dropped on phone_screen
  // or onsite. The candidate stays in their original stage until the modal is
  // confirmed; cancelling the modal leaves them where they were.
  const [scheduleTarget, setScheduleTarget] = useState<{
    candidate: Applicant;
    targetStage: ApplicantStatus;
  } | null>(null);

  // Active jobs + an "all jobs" pseudo-option.
  const activeJobs = useMemo(() => jobs.filter((j) => j.status === 'active'), [jobs]);

  // Resolve which job to show. Default to "All jobs" when no ?job is set.
  const selectedJobId =
    jobParam && jobParam !== 'all' ? jobParam : null;

  useEffect(() => {
    listJobs().then((j) => setJobs(j));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getApplicantsByJob(selectedJobId).then((data) => {
      if (!cancelled) {
        setApplicants(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  function setJob(jobId: string | 'all') {
    const params = new URLSearchParams(searchParams.toString());
    params.set('job', jobId);
    router.replace(`/candidates?${params.toString()}`);
  }

  function setView(view: 'board' | 'list') {
    const params = new URLSearchParams(searchParams.toString());
    if (view === 'list') params.set('view', 'list');
    else params.delete('view');
    router.replace(`/candidates?${params.toString()}`);
  }

  // Group applicants by stage. 'screening' is folded into 'new' for display
  // because it's a transient AI-in-flight state.
  const byStage = useMemo(() => {
    const map: Record<string, Applicant[]> = {};
    for (const stage of [...PIPELINE_STAGES, ...TERMINAL_STAGES]) {
      map[stage] = [];
    }
    for (const a of applicants) {
      const bucket = a.status === 'screening' ? 'new' : a.status;
      if (!map[bucket]) map[bucket] = [];
      map[bucket].push(a);
    }
    return map;
  }, [applicants]);

  const terminalCount = TERMINAL_STAGES.reduce(
    (sum, s) => sum + (byStage[s]?.length ?? 0),
    0,
  );

  function handleDragOver(e: React.DragEvent, stage: ApplicantStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) setDragOverStage(stage);
  }

  // Core stage-change routing — shared by drag-and-drop (desktop) and the
  // mobile per-card "Move stage" select. Handles the special-case stages
  // (rejected → reason modal, phone_screen/onsite → schedule modal) and
  // performs an optimistic update with rollback for everything else.
  async function moveCandidate(candidate: Applicant, targetStage: ApplicantStatus) {
    if (candidate.status === targetStage) return;

    if (targetStage === 'rejected') {
      setRejectModalIds([candidate.id]);
      return;
    }

    if (targetStage === 'phone_screen' || targetStage === 'onsite') {
      setScheduleTarget({ candidate, targetStage });
      return;
    }

    const prev = applicants;
    const now = new Date().toISOString();
    setApplicants((curr) =>
      curr.map((a) =>
        a.id === candidate.id ? { ...a, status: targetStage, stage_changed_at: now } : a,
      ),
    );
    setToast(`${candidate.name} → ${STAGE_LABELS[targetStage]}`);
    setTimeout(() => setToast(null), 2500);

    try {
      if (targetStage === 'archived') {
        await archiveApplicant(candidate.id);
      } else {
        const result = await updateApplicantStatus(candidate.id, targetStage);
        if (result.cancelledInterviews > 0) {
          const n = result.cancelledInterviews;
          setToast(
            `${candidate.name} → ${STAGE_LABELS[targetStage]} · ${n} future interview${n === 1 ? '' : 's'} cancelled`,
          );
          setTimeout(() => setToast(null), 4000);
        }
      }
    } catch (err) {
      setApplicants(prev);
      setToast(
        `Failed to move ${candidate.name}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function handleDrop(e: React.DragEvent, targetStage: ApplicantStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setDragOverStage(null);
    if (!id) return;
    const candidate = applicants.find((a) => a.id === id);
    if (!candidate) return;
    await moveCandidate(candidate, targetStage);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleConfirmReject(reason: RejectionReason, customNote: string) {
    if (!rejectModalIds || rejectModalIds.length === 0) return;
    const ids = rejectModalIds;
    const targets = applicants.filter((a) => ids.includes(a.id));
    setRejectModalIds(null);

    // Optimistic update.
    const prev = applicants;
    const now = new Date().toISOString();
    setApplicants((curr) =>
      curr.map((a) =>
        ids.includes(a.id) ? { ...a, status: 'rejected', stage_changed_at: now } : a,
      ),
    );
    setToast(
      ids.length === 1
        ? `Rejecting ${targets[0]?.name ?? 'candidate'}…`
        : `Rejecting ${ids.length} candidates…`,
    );

    try {
      const result = await bulkRejectApplicants(ids, reason, customNote || undefined);
      const note =
        result.email_failures > 0
          ? ` (${result.email_failures} email${result.email_failures === 1 ? '' : 's'} failed)`
          : '';
      setToast(
        `Rejected ${result.rejected} • emailed ${result.emailed}${note}`,
      );
      setTimeout(() => setToast(null), 3500);
      exitSelectMode();
    } catch (err) {
      setApplicants(prev);
      setToast(
        `Bulk reject failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function handleRestore(id: string) {
    const candidate = applicants.find((a) => a.id === id);
    if (!candidate) return;
    // Optimistic: card jumps to Screened immediately.
    const prev = applicants;
    const now = new Date().toISOString();
    setApplicants((curr) =>
      curr.map((a) =>
        a.id === id ? { ...a, status: 'screened', stage_changed_at: now } : a,
      ),
    );
    setToast(`${candidate.name} restored to Screened`);
    setTimeout(() => setToast(null), 3000);
    try {
      await restoreApplicant(id);
    } catch (err) {
      setApplicants(prev);
      setToast(
        `Restore failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function handleConfirmSchedule(values: ScheduleValues) {
    if (!scheduleTarget) return;
    const { candidate, targetStage } = scheduleTarget;
    const prev = applicants;
    const now = new Date().toISOString();
    setApplicants((curr) =>
      curr.map((a) =>
        a.id === candidate.id ? { ...a, status: targetStage, stage_changed_at: now } : a,
      ),
    );
    try {
      const result = await insertInterview({
        applicant_id: candidate.id,
        scheduled_date: values.date,
        scheduled_time: values.time,
        duration_minutes: values.durationMinutes,
        type: values.type,
      });
      await updateApplicantStatus(candidate.id, targetStage);
      setScheduleTarget(null);
      const emailNote = result.email_sent ? ' · candidate emailed' : '';
      setToast(
        `${candidate.name} → ${STAGE_LABELS[targetStage]} on ${values.date} ${values.time}${emailNote}`,
      );
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setApplicants(prev);
      // Re-throw so the modal surfaces the error inline.
      throw err;
    }
  }

  function buildStageScheduleDefaults(stage: ApplicantStatus): ScheduleValues {
    const base = buildScheduleDefaults();
    if (stage === 'phone_screen') return { ...base, type: 'Phone Screen', durationMinutes: 30 };
    if (stage === 'onsite') return { ...base, type: 'Onsite', durationMinutes: 60 };
    return base;
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-card border border-card-border rounded-lg shadow-lg px-5 py-3 text-sm">
          {toast}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted uppercase tracking-wider font-semibold">
            Job
          </label>
          <select
            value={selectedJobId ?? 'all'}
            onChange={(e) => setJob(e.target.value as string | 'all')}
            className="bg-card border border-card-border rounded-lg px-3 py-1.5 text-base md:text-sm outline-none focus:border-accent transition-colors"
          >
            <option value="all">All jobs</option>
            {activeJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
            {jobs.some((j) => j.status === 'archived') && (
              <optgroup label="Archived">
                {jobs
                  .filter((j) => j.status === 'archived')
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-card border border-card-border rounded-lg p-0.5">
          <button
            onClick={() => setView('board')}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-accent text-white"
          >
            Board
          </button>
          <button
            onClick={() => setView('list')}
            className="px-3 py-1 text-xs font-semibold rounded-md text-muted hover:text-foreground transition-colors"
          >
            List
          </button>
        </div>

        <button
          onClick={() => {
            if (selectMode) exitSelectMode();
            else setSelectMode(true);
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            selectMode
              ? 'bg-accent text-white border-accent'
              : 'bg-card border-card-border text-muted hover:text-foreground'
          }`}
        >
          {selectMode ? 'Done' : 'Select'}
        </button>

        <div className="ml-auto text-xs text-muted">
          {selectedJob
            ? `${applicants.length} candidate${applicants.length === 1 ? '' : 's'} for ${selectedJob.title}`
            : `${applicants.length} candidate${applicants.length === 1 ? '' : 's'} across all jobs`}
        </div>
      </div>

      {/* Empty state */}
      {!loading && activeJobs.length === 0 && (
        <div className="bg-card border border-card-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm mb-3">No active jobs yet.</p>
          <Link
            href="/jobs/new"
            className="inline-flex items-center px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Create a job
          </Link>
        </div>
      )}

      {/* Board */}
      {(loading || activeJobs.length > 0) && (
        <div data-tour="kanban-board" className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                applicants={byStage[stage] ?? []}
                dragOverStage={dragOverStage}
                draggingId={draggingId}
                onDragStart={setDraggingId}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={handleDrop}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onMoveStage={moveCandidate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Terminal rail (rejected / archived / withdrawn) */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-background/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Rejected · Archived · Withdrawn
            </span>
            <span className="text-[11px] text-muted bg-background border border-card-border px-1.5 rounded-full font-medium">
              {terminalCount}
            </span>
          </div>
          <span className="text-xs text-muted">{showArchived ? '▲ hide' : '▼ show'}</span>
        </button>

        {showArchived && (
          <div className="overflow-x-auto p-3 border-t border-card-border">
            <div className="flex gap-3 min-w-max">
              {TERMINAL_STAGES.map((stage) => (
                <Column
                  key={stage}
                  stage={stage}
                  applicants={byStage[stage] ?? []}
                  dragOverStage={dragOverStage}
                  draggingId={draggingId}
                  onDragStart={setDraggingId}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={handleDrop}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onRestore={handleRestore}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Floating selection action bar — shown when there are selected ids. */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-card-border rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-semibold">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setRejectModalIds(Array.from(selectedIds))}
            className="px-4 py-1.5 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Reject…
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Reject reason modal — used for both single drag-to-rejected and bulk reject. */}
      {rejectModalIds && (
        <RejectReasonModal
          targets={applicants.filter((a) => rejectModalIds.includes(a.id))}
          onCancel={() => setRejectModalIds(null)}
          onConfirm={handleConfirmReject}
        />
      )}

      {/* Schedule modal — opens when a candidate is dropped on phone_screen or onsite. */}
      {scheduleTarget && (
        <ScheduleInterviewModal
          applicant={scheduleTarget.candidate}
          defaults={buildStageScheduleDefaults(scheduleTarget.targetStage)}
          onCancel={() => setScheduleTarget(null)}
          onConfirm={handleConfirmSchedule}
        />
      )}
    </div>
  );
}

// ── Reject Reason Modal ────────────────────────────────────────────────────

