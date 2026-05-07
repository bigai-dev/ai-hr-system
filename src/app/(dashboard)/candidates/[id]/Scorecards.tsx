'use client';

import { useEffect, useState } from 'react';
import {
  getInterviewsForApplicant,
  getScorecardsForApplicant,
  saveScorecard,
  type Recommendation,
  type Scorecard,
} from '@/app/(dashboard)/actions';
import type { Interview } from '@/lib/types';

const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_hire: 'Strong hire',
  hire: 'Hire',
  no_hire: 'No hire',
  strong_no_hire: 'Strong no-hire',
};

const RECOMMENDATION_TONES: Record<Recommendation, string> = {
  strong_hire: 'bg-success/15 text-success',
  hire: 'bg-success/10 text-success',
  no_hire: 'bg-amber-500/15 text-amber-500',
  strong_no_hire: 'bg-red-500/15 text-red-500',
};

const RATING_LABELS = [
  '',          // index 0 unused
  'Poor',
  'Below avg',
  'Solid',
  'Strong',
  'Exceptional',
];

function parseSkills(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function formatDate(d: string, t: string): string {
  return `${d} · ${t}`;
}

interface ScorecardFormProps {
  interview: Interview;
  requiredSkills: string[];
  onSaved: () => void;
}

function ScorecardForm({ interview, requiredSkills, onSaved }: ScorecardFormProps) {
  const [interviewerName, setInterviewerName] = useState('');
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const [overallRating, setOverallRating] = useState<number>(3);
  const [recommendation, setRecommendation] = useState<Recommendation>('hire');
  const [skillRatings, setSkillRatings] = useState<Record<string, number | null>>(
    Object.fromEntries(requiredSkills.map((s) => [s, null])),
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await saveScorecard({
        interview_id: interview.id,
        interviewer_name: interviewerName,
        interviewer_email: interviewerEmail,
        overall_rating: overallRating,
        recommendation,
        skill_ratings: skillRatings,
        notes,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">{interview.type}</div>
          <div className="text-xs text-muted">
            {formatDate(interview.scheduled_date, interview.scheduled_time)}
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/15 px-2 py-0.5 rounded">
          Pending scorecard
        </span>
      </div>

      <div className="p-5 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-500">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Interviewer name
            </label>
            <input
              type="text"
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Interviewer email
            </label>
            <input
              type="email"
              value={interviewerEmail}
              onChange={(e) => setInterviewerEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {requiredSkills.length > 0 && (
          <div>
            <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
              Per-skill rating <span className="text-muted-foreground">(1 = poor, 5 = exceptional, blank = N/A)</span>
            </label>
            <div className="space-y-1.5">
              {requiredSkills.map((skill) => (
                <div key={skill} className="flex items-center gap-3">
                  <span className="text-sm flex-1 truncate">{skill}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setSkillRatings((prev) => ({
                            ...prev,
                            [skill]: prev[skill] === n ? null : n,
                          }))
                        }
                        className={`w-7 h-7 rounded text-xs font-semibold border transition-colors ${
                          skillRatings[skill] === n
                            ? 'bg-accent border-accent text-white'
                            : 'bg-background border-card-border text-muted hover:border-accent/50'
                        }`}
                        title={RATING_LABELS[n]}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Overall rating
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOverallRating(n)}
                  className={`flex-1 h-9 rounded font-semibold border transition-colors ${
                    overallRating === n
                      ? 'bg-accent border-accent text-white'
                      : 'bg-background border-card-border text-muted hover:border-accent/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-1">{RATING_LABELS[overallRating]}</p>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Recommendation
            </label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value as Recommendation)}
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            >
              {(Object.entries(RECOMMENDATION_LABELS) as [Recommendation, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Specific examples, areas of strength, concerns, follow-up questions for next round…"
            className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors resize-y"
          />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-card-border flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2 text-sm font-bold bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {submitting ? 'Saving…' : 'Submit scorecard'}
        </button>
      </div>
    </div>
  );
}

function ScorecardReadOnly({
  scorecard,
  interview,
  requiredSkills,
}: {
  scorecard: Scorecard;
  interview: Interview | undefined;
  requiredSkills: string[];
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">
            {interview?.type ?? 'Interview'}
            {interview && (
              <span className="text-muted font-normal ml-2 text-xs">
                · {formatDate(interview.scheduled_date, interview.scheduled_time)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted">
            {scorecard.interviewer_name ?? 'Interviewer'}
            {scorecard.interviewer_email && ` · ${scorecard.interviewer_email}`}
          </div>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            RECOMMENDATION_TONES[scorecard.recommendation]
          }`}
        >
          {RECOMMENDATION_LABELS[scorecard.recommendation]}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-bold">{scorecard.overall_rating}</div>
          <div className="text-xs text-muted uppercase tracking-wider">
            overall · {RATING_LABELS[scorecard.overall_rating]}
          </div>
        </div>

        {scorecard.skill_ratings && Object.keys(scorecard.skill_ratings).length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
              Skill ratings
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(scorecard.skill_ratings).map(([skill, rating]) => (
                <div key={skill} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="truncate">{skill}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      rating == null ? 'text-muted-foreground' : ''
                    }`}
                  >
                    {rating ?? '—'}
                  </span>
                </div>
              ))}
            </div>
            {requiredSkills.some((s) => !(s in (scorecard.skill_ratings ?? {}))) && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Some required skills weren't rated on this scorecard.
              </p>
            )}
          </div>
        )}

        {scorecard.notes && (
          <div>
            <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Notes
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted">
              {scorecard.notes}
            </p>
          </div>
        )}
      </div>

      <div className="px-5 py-2 border-t border-card-border text-[10px] text-muted-foreground">
        Submitted {scorecard.submitted_at}
      </div>
    </div>
  );
}

export default function Scorecards({
  applicantId,
  requiredSkills,
}: {
  applicantId: string;
  requiredSkills: string[];
}) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);

  async function refetch() {
    setLoading(true);
    const [iv, sc] = await Promise.all([
      getInterviewsForApplicant(applicantId),
      getScorecardsForApplicant(applicantId),
    ]);
    setInterviews(iv);
    setScorecards(sc);
    setLoading(false);
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicantId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-10 text-center text-sm text-muted">
        No interviews have been scheduled yet. Schedule one from the candidate's profile to capture a scorecard.
      </div>
    );
  }

  // Show: existing scorecards (latest first) + a form for any interview without a scorecard.
  const interviewIdsWithCard = new Set(scorecards.map((s) => s.interview_id));
  const pendingInterviews = interviews.filter((i) => !interviewIdsWithCard.has(i.id));

  return (
    <div className="space-y-4">
      {pendingInterviews.map((iv) => (
        <ScorecardForm
          key={iv.id}
          interview={iv}
          requiredSkills={requiredSkills}
          onSaved={refetch}
        />
      ))}
      {scorecards.map((sc) => (
        <ScorecardReadOnly
          key={sc.id}
          scorecard={sc}
          interview={interviews.find((i) => i.id === sc.interview_id)}
          requiredSkills={requiredSkills}
        />
      ))}
    </div>
  );
}
