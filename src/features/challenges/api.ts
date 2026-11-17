import { db, unwrap } from '@/data/db';
import type { DayKey } from '@/lib/dates';

export type ChallengeKind = 'duel' | 'group' | 'cooperative' | 'team' | 'pact';
export type ChallengeMetric = 'percent' | 'consistency' | 'sessions' | 'quantity' | 'relative';
export type ChallengeStatus = 'pending' | 'active' | 'finished' | 'cancelled';
export type ParticipantStatus = 'invited' | 'accepted' | 'declined' | 'left';

export interface Challenge {
  id: string;
  createdBy: string;
  kind: ChallengeKind;
  title: string;
  description: string | null;
  circleId: string | null;
  metric: ChallengeMetric;
  source: 'focus' | 'habit';
  unit: string;
  startsOn: DayKey;
  endsOn: DayKey;
  tz: string;
  status: ChallengeStatus;
  tieRule: 'shared' | 'consistency';
  percentCap: number;
  minDaily: number | null;
  coopMode: 'collective' | 'distributed' | null;
  coopTarget: number | null;
  coopMinEach: number | null;
  pactSupport: string | null;
  pactCelebration: string | null;
  outcome: 'achieved' | 'not_achieved' | 'completed' | null;
  myStatus: ParticipantStatus;
}

export async function fetchMyChallenges(me: string): Promise<Challenge[]> {
  const rows = unwrap(
    await db().from('challenges').select('*, challenge_participants!inner(user_id, status)').eq('challenge_participants.user_id', me).order('starts_on', { ascending: false }),
  ) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    createdBy: r.created_by as string,
    kind: r.kind as ChallengeKind,
    title: r.title as string,
    description: (r.description as string) ?? null,
    circleId: (r.circle_id as string) ?? null,
    metric: r.metric as ChallengeMetric,
    source: r.source as 'focus' | 'habit',
    unit: r.unit as string,
    startsOn: r.starts_on as DayKey,
    endsOn: r.ends_on as DayKey,
    tz: r.tz as string,
    status: r.status as ChallengeStatus,
    tieRule: r.tie_rule as Challenge['tieRule'],
    percentCap: Number(r.percent_cap),
    minDaily: r.min_daily === null ? null : Number(r.min_daily),
    coopMode: (r.coop_mode as Challenge['coopMode']) ?? null,
    coopTarget: r.coop_target === null ? null : Number(r.coop_target),
    coopMinEach: r.coop_min_each === null ? null : Number(r.coop_min_each),
    pactSupport: (r.pact_support as string) ?? null,
    pactCelebration: (r.pact_celebration as string) ?? null,
    outcome: (r.outcome as Challenge['outcome']) ?? null,
    myStatus: (r.challenge_participants as { status: ParticipantStatus }[])[0]!.status,
  }));
}

export interface Standing {
  userId: string;
  handle: string;
  displayName: string;
  team: number | null;
  status: ParticipantStatus;
  value: number;
  target: number | null;
  score: number;
  sessions: number;
  daysActive: number;
  timerShare: number;
  rank: number;
}

export async function fetchStandings(id: string): Promise<Standing[]> {
  const rows = unwrap(await db().rpc('challenge_standings', { p_challenge: id })) as Record<string, unknown>[];
  return rows.map((r) => ({
    userId: r.user_id as string,
    handle: r.handle as string,
    displayName: r.display_name as string,
    team: (r.team as number) ?? null,
    status: r.status as ParticipantStatus,
    value: Number(r.value),
    target: r.target === null ? null : Number(r.target),
    score: Number(r.score),
    sessions: r.sessions as number,
    daysActive: r.days_active as number,
    timerShare: Number(r.timer_share),
    rank: r.rank as number,
  }));
}

export async function fetchPeople(id: string) {
  const rows = unwrap(await db().rpc('challenge_people', { p_challenge: id })) as { user_id: string; handle: string; display_name: string; team: number | null; status: ParticipantStatus; personal_target: string | null }[];
  return rows.map((r) => ({ userId: r.user_id, handle: r.handle, displayName: r.display_name, team: r.team, status: r.status, personalTarget: r.personal_target === null ? null : Number(r.personal_target) }));
}

export async function fetchResults(id: string) {
  return unwrap(await db().from('challenge_results').select('user_id, team, rank, value, score, days_active, winner, abandoned').eq('challenge_id', id).order('rank')) as {
    user_id: string | null;
    team: number | null;
    rank: number;
    value: number;
    score: number;
    days_active: number;
    winner: boolean;
    abandoned: boolean;
  }[];
}

export async function fetchPactConfirmations(id: string) {
  return unwrap(await db().from('pact_confirmations').select('user_id, about_user, kept, note').eq('challenge_id', id)) as { user_id: string; about_user: string; kept: boolean; note: string | null }[];
}

export interface NewChallenge {
  kind: ChallengeKind;
  title: string;
  description?: string;
  metric: ChallengeMetric;
  source: 'focus' | 'habit';
  unit: string;
  starts_on: DayKey;
  ends_on: DayKey;
  tz: string;
  tie_rule: 'shared' | 'consistency';
  percent_cap?: number;
  min_daily?: number | null;
  coop_mode?: 'collective' | 'distributed' | null;
  coop_target?: number | null;
  coop_min_each?: number | null;
  pact_support?: string | null;
  pact_celebration?: string | null;
  circle_id?: string | null;
  invitees: { user_id: string; team?: number | null }[];
  my_target?: number | null;
  my_habit_id?: string | null;
  my_team?: number | null;
}

export const createChallenge = async (p: NewChallenge) => unwrap(await db().rpc('create_challenge', { p })) as string;
export const acceptChallenge = async (id: string, target: number | null, habitId: string | null) => unwrap(await db().rpc('accept_challenge', { p_challenge: id, p_target: target, p_habit: habitId }));
export const declineChallenge = async (id: string) => unwrap(await db().rpc('decline_challenge', { p_challenge: id }));
export const leaveChallenge = async (id: string) => unwrap(await db().rpc('leave_challenge', { p_challenge: id }));
export const cancelChallenge = async (id: string) => unwrap(await db().rpc('cancel_challenge', { p_challenge: id }));
export const confirmPact = async (id: string, about: string, kept: boolean, note: string | null) => unwrap(await db().rpc('confirm_pact', { p_challenge: id, p_about: about, p_kept: kept, p_note: note }));
