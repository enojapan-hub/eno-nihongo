import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Flame, Gift, Medal, Trophy, Sparkles, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCompetitionLeaderboard, fetchLeaderboard } from "@/lib/leaderboard";
import { getLeague, LEAGUES } from "@/lib/progression";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — ENO NIHONGO" }] }),
  component: LeaderboardPage,
});
function LeaderboardPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "all">("weekly");
  const [level, setLevel] = useState("Semua");
  const [tab, setTab] = useState<"ranking" | "league">("ranking");
  const leaderboard = useQuery({
    queryKey: ["leaderboard", 100],
    queryFn: () => fetchLeaderboard(100),
    staleTime: 30000,
  });
  const weeklyRanks = useQuery({
    queryKey: ["competition-leaderboard", "weekly"],
    queryFn: () => fetchCompetitionLeaderboard("weekly", 100),
    staleTime: 30000,
  });
  const monthlyRanks = useQuery({
    queryKey: ["competition-leaderboard", "monthly"],
    queryFn: () => fetchCompetitionLeaderboard("monthly", 100),
    staleTime: 30000,
  });
  const me = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: 60000,
  });
  const myWeeklyRow = weeklyRanks.data?.find((u) => u.userId === me.data);
  const myLeague = getLeague(myWeeklyRow?.periodXp ?? 0);
  const rankRows = useMemo(() => {
    const src =
      period === "all"
        ? (leaderboard.data ?? []).map((x) => ({
            userId: x.userId,
            displayName: x.displayName,
            avatarUrl: x.avatarUrl,
            level: x.level,
            points: x.points,
            streak: x.streak,
          }))
        : (period === "weekly" ? (weeklyRanks.data ?? []) : (monthlyRanks.data ?? [])).map((x) => ({
            userId: x.userId,
            displayName: x.displayName,
            avatarUrl: x.avatarUrl,
            level: x.jlptLevel,
            points: x.periodXp,
            streak: x.streak,
          }));
    return (level === "Semua" ? src : src.filter((x) => x.level === level)).map((x, i) => ({
      ...x,
      rank: i + 1,
    }));
  }, [period, level, leaderboard.data, weeklyRanks.data, monthlyRanks.data]);
  const mine = rankRows.find((x) => x.userId === me.data);
  const top3 = rankRows.slice(0, 3);
  return (
    <AppShell compact title="Leaderboard">
      <div className="mx-auto max-w-3xl space-y-4 pb-8 eno-rise">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-primary to-emerald-700 p-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/65">
                Kompetisi ENO NIHONGO
              </p>
              <h1 className="mt-1 text-2xl font-black">Leaderboard</h1>
              <p className="mt-1 text-[10px] text-white/70">
                Belajar konsisten, kumpulkan Poin, dan naik bersama.
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
              <Trophy className="size-5" />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 rounded-2xl bg-black/10 p-1">
            <button
              onClick={() => setTab("ranking")}
              className={
                "rounded-xl py-2 text-[10px] font-bold " +
                (tab === "ranking" ? "bg-white text-emerald-900 shadow" : "text-white/70")
              }
            >
              Peringkat
            </button>
            <button
              onClick={() => setTab("league")}
              className={
                "rounded-xl py-2 text-[10px] font-bold " +
                (tab === "league" ? "bg-white text-emerald-900 shadow" : "text-white/70")
              }
            >
              Liga Mingguan
            </button>
          </div>
        </section>
        {tab === "ranking" ? (
          <>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1">
              {(
                [
                  ["weekly", "Mingguan"],
                  ["monthly", "Bulanan"],
                  ["all", "Sepanjang Masa"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPeriod(id)}
                  className={
                    "rounded-xl px-1 py-2.5 text-[9px] font-bold " +
                    (period === id
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["Semua", "N5", "N4", "N3", "N2", "N1"].map((x) => (
                <button
                  key={x}
                  onClick={() => setLevel(x)}
                  className={
                    "shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-bold " +
                    (level === x
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground")
                  }
                >
                  {x}
                </button>
              ))}
            </div>
            {rankRows.length > 0 && (
              <Card className="rounded-[1.8rem] border-primary/15 bg-gradient-to-b from-primary/[.07] to-background">
                <CardContent className="p-4">
                  <p className="mb-5 text-center text-[9px] font-black uppercase tracking-[.14em] text-muted-foreground">
                    Top Pembelajar
                  </p>
                  <div className="grid grid-cols-3 items-end gap-2">
                    {[top3[1], top3[0], top3[2]].map((u, i) =>
                      u ? (
                        <div key={u.userId} className={"text-center " + (i === 1 ? "pb-4" : "")}>
                          <div className="relative mx-auto w-fit">
                            {i === 1 && (
                              <Crown className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 text-amber-500" />
                            )}
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt=""
                                className="size-14 rounded-full border-2 border-background object-cover shadow"
                              />
                            ) : (
                              <span className="grid size-14 place-items-center rounded-full border-2 border-background bg-primary/10 font-black text-primary">
                                {u.displayName[0]}
                              </span>
                            )}
                            <span
                              className={
                                "absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full text-[8px] font-black text-white " +
                                (u.rank === 1
                                  ? "bg-amber-500"
                                  : u.rank === 2
                                    ? "bg-slate-400"
                                    : "bg-orange-600")
                              }
                            >
                              {u.rank}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-[10px] font-black">{u.displayName}</p>
                          <p className="text-[8px] text-muted-foreground">{u.level}</p>
                          <p className="mt-1 text-[9px] font-black text-primary">
                            {u.points.toLocaleString("id-ID")} Poin
                          </p>
                        </div>
                      ) : (
                        <div key={i} />
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {mine && (
              <Card className="rounded-2xl border-primary/30 bg-primary/[.06]">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary text-[10px] font-black text-primary-foreground">
                    #{mine.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black">Posisi kamu</p>
                    <p className="text-[8px] text-muted-foreground">
                      {mine.level} · Streak {mine.streak} hari
                    </p>
                  </div>
                  <b className="text-[10px] text-primary">
                    {mine.points.toLocaleString("id-ID")} Poin
                  </b>
                </CardContent>
              </Card>
            )}
            <Card className="rounded-2xl">
              <CardContent className="p-2">
                {rankRows.slice(3).map((user, i) => (
                  <div
                    key={user.userId}
                    className={
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 " +
                      (user.userId === me.data ? "bg-primary/[.06]" : i % 2 ? "bg-muted/20" : "")
                    }
                  >
                    <span className="w-7 text-center text-[10px] font-black text-muted-foreground">
                      #{user.rank}
                    </span>
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="size-8 rounded-full border object-cover"
                      />
                    ) : (
                      <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {user.displayName[0]}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold">{user.displayName}</p>
                      <p className="text-[8px] text-muted-foreground">
                        {user.level} · 🔥 {user.streak} hari
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-primary">
                      {user.points.toLocaleString("id-ID")} Poin
                    </span>
                  </div>
                ))}
                {!rankRows.length && (
                  <p className="py-8 text-center text-[10px] text-muted-foreground">
                    Belum ada aktivitas untuk filter ini.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-primary/15 bg-primary/[.03]">
              <CardContent className="flex items-center gap-3 p-3">
                <Sparkles className="size-4 text-primary" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold">Tukar Poin Premium</p>
                  <p className="text-[8px] text-muted-foreground">
                    Fitur penukaran sedang dipersiapkan.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-bold text-muted-foreground">
                  <LockKeyhole className="size-2.5" />
                  Segera
                </span>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="rounded-[1.8rem] border-primary/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      Liga Kamu
                    </p>
                    <h2 className="mt-1 text-xl font-black">{myLeague.name}</h2>
                    <p className="mt-1 text-[9px] text-muted-foreground">Reset Senin 00:00 JST</p>
                  </div>
                  <span className="grid size-12 place-items-center rounded-2xl bg-amber-500/10">
                    <Crown className="size-6 text-amber-500" />
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: String(myLeague.progress) + "%" }}
                  />
                </div>
                <p className="mt-2 text-[8px] text-muted-foreground">
                  {myLeague.next
                    ? myLeague.xpToNext.toLocaleString("id-ID") +
                      " Poin lagi ke " +
                      myLeague.next.name
                    : "Liga tertinggi tercapai."}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.6rem]">
              <CardContent className="space-y-2 p-4">
                <p className="mb-3 text-[11px] font-black">Jalur Liga</p>
                {LEAGUES.map((x, i) => (
                  <div
                    key={x.name}
                    className={
                      "flex items-center gap-3 rounded-2xl border p-3 " +
                      (myLeague.index === i ? "border-primary/40 bg-primary/[.06]" : "")
                    }
                  >
                    <span
                      className={
                        "grid size-9 place-items-center rounded-xl text-[10px] font-black " +
                        (myLeague.index === i
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-[10px] font-black">{x.name}</p>
                      <p className="text-[8px] text-muted-foreground">
                        Mulai {x.minWeeklyXp.toLocaleString("id-ID")} Poin
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-muted-foreground">Hadiah</p>
                      <p className="text-[9px] font-bold text-primary">{x.rewardLabel}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-amber-500/15 bg-amber-500/[.04]">
              <CardContent className="flex gap-3 p-4">
                <Gift className="size-4 text-amber-500" />
                <p className="text-[9px] leading-4 text-muted-foreground">
                  Hadiah liga mengikuti liga yang dicapai pada akhir periode mingguan.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
