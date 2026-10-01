import { supabase } from "@/integrations/supabase/client";

export type LeaderboardUser = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: string;
  points: number;
  xp: number;
  streak: number;
  studyMinutes: number;
  lessonsCompleted: number;
  quizzesCompleted: number;
  correctAnswers: number;
  totalAnswers: number;
};

type LeaderboardRow = {
  rank: number; user_id: string; display_name: string | null; avatar_url: string | null; jlpt_level: string | null;
  total_points: number | null; xp: number | null; study_minutes: number | null; lessons_completed: number | null;
  quizzes_completed: number | null; correct_answers: number | null; total_answers: number | null; current_streak: number | null;
};

export type CompetitionUser = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  jlptLevel: string;
  periodXp: number;
  totalXp: number;
  points: number;
  streak: number;
};

export async function fetchLeaderboard(limit = 10): Promise<LeaderboardUser[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: safeLimit });
  if (error || !data) return [];
  return (data as LeaderboardRow[]).map((row) => ({
    rank: Number(row.rank ?? 0), userId: row.user_id, displayName: row.display_name?.trim() || "Pengguna ENO NIHONGO",
    avatarUrl: row.avatar_url ?? null, level: row.jlpt_level || "N5", points: Number(row.total_points ?? 0), xp: Number(row.xp ?? 0),
    streak: Number(row.current_streak ?? 0), studyMinutes: Number(row.study_minutes ?? 0), lessonsCompleted: Number(row.lessons_completed ?? 0),
    quizzesCompleted: Number(row.quizzes_completed ?? 0), correctAnswers: Number(row.correct_answers ?? 0), totalAnswers: Number(row.total_answers ?? 0),
  }));
}

export async function fetchCompetitionLeaderboard(period: "weekly" | "monthly", limit = 50): Promise<CompetitionUser[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const { data, error } = await (supabase as any).rpc("get_competition_leaderboard", { p_period: period, p_limit: safeLimit });
  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    rank: Number(row.rank ?? 0), userId: String(row.user_id), displayName: String(row.display_name || "Pengguna ENO NIHONGO"),
    avatarUrl: row.avatar_url ?? null, jlptLevel: String(row.jlpt_level || "N5"), periodXp: Number(row.period_xp ?? 0),
    totalXp: Number(row.total_xp ?? 0), points: Number(row.total_points ?? 0), streak: Number(row.current_streak ?? 0),
  }));
}
