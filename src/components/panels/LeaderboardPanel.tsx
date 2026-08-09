"use client";

import { useEffect, useState } from "react";
import { Trophy as TrophyIcon, Medal, Award } from "lucide-react";

type Row = {
  id: string;
  name: string;
  avatar?: string | null;
  trophies: number;
  badges: number;
  isMe?: boolean;
  isOwner?: boolean;
};

const MEDAL = ["#f59e0b", "#9ca3af", "#cd7f32"]; // gold / silver / bronze

export function LeaderboardPanel() {
  const [data, setData] = useState<{ leaderboard: Row[]; myRank?: number } | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="p-8 text-sm meta animate-fade-up" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        Loading leaderboard…
      </div>
    );
  }

  if (data.leaderboard.length <= 1) {
    return (
      <div className="p-8 animate-fade-up" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <Header />
        <p className="text-sm meta">Be the first! The leaderboard ranks users by trophies. As others sign up, you'll see competition here.</p>
        <div className="mt-4">
          {data.leaderboard.map((u, i) => (
            <LeaderRow key={u.id} rank={i + 1} u={u} />
          ))}
        </div>
      </div>
    );
  }

  const top3 = data.leaderboard.slice(0, 3);
  const rest = data.leaderboard.slice(3);

  return (
    <div className="animate-fade-up">
      <Header withRank={data.myRank} />

      {/* Podium for the top 3 — circular gauges + medals */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {top3.map((u, i) => (
          <PodiumCard key={u.id} u={u} rank={i + 1} />
        ))}
      </div>

      {/* Rest of the rows */}
      {rest.length > 0 && (
        <div className="space-y-1.5">
          {rest.map((u, i) => (
            <LeaderRow key={u.id} rank={i + 4} u={u} />
          ))}
        </div>
      )}

      {/* Rank progress bar for the current user */}
      {data.myRank && data.myRank > 3 && (
        <RankProgress rank={data.myRank} total={data.leaderboard.length} trophies={data.leaderboard[data.myRank - 1]?.trophies ?? 0} />
      )}
    </div>
  );
}

function Header({ withRank }: { withRank?: number }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
          <TrophyIcon className="h-4 w-4 text-white" />
        </div>
        <h2 className="text-xl font-bold text-ink">Community Leaderboard</h2>
      </div>
      <p className="text-xs meta">
        Ranked by trophies · 5 badges = 30 trophies.
        {withRank ? <> Your rank: <b className="text-ink">#{withRank}</b>.</> : null}
      </p>
    </div>
  );
}

function PodiumCard({ u, rank }: { u: Row; rank: number }) {
  const initials = (u.name || "U").split(/[ @]/).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "U";
  const ringColor = MEDAL[rank - 1] ?? "#9ca3af";
  // Circular gauge: ratio of this user's trophies vs the leader (rank 1).
  const leaderTrophies = Math.max(1, u.trophies);
  const pct = rank === 1 ? 100 : Math.round((u.trophies / leaderTrophies) * 100);
  const C = 2 * Math.PI * 26;

  return (
    <div
      className={"relative p-4 rounded-[20px] overflow-hidden " + (u.isMe ? "ring-2" : "")}
      style={{
        background: "var(--bg)",
        border: "1px solid var(--line)",
        // taller card for the #1 to create a podium silhouette
        transform: rank === 1 ? "translateY(-8px)" : "none",
        boxShadow: rank === 1 ? "0 18px 40px rgba(245,158,11,.18)" : "none",
      }}
    >
      {/* radial glow */}
      <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl opacity-30" style={{ background: ringColor }} />
      <div className="flex items-center justify-center mb-3">
        <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
          <circle cx="34" cy="34" r="26" fill="none" stroke="var(--line-soft)" strokeWidth="6" />
          <circle
            cx="34" cy="34" r="26" fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - (pct / 100) * C}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)" }}
          />
        </svg>
        <div className="absolute" style={{ marginTop: 0 }}>
          {u.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover" style={{ border: `2px solid ${ringColor}` }} />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white text-sm font-bold" style={{ border: `2px solid ${ringColor}` }}>{initials}</div>
          )}
        </div>
      </div>

      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: ringColor }}>
          {rank === 1 ? "🥇 1st" : rank === 2 ? "🥈 2nd" : "🥉 3rd"}
        </div>
        <div className="text-sm font-semibold text-ink truncate" title={u.name}>
          {u.name}{u.isMe && <span className="ml-1 text-xs meta">(you)</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <Stat icon={<TrophyIcon className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />} value={u.trophies} label="trophies" />
        <Stat icon={<Medal className="h-3.5 w-3.5" style={{ color: "#3b82f6" }} />} value={u.badges} label="badges" />
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-[10px] py-1.5 px-1" style={{ background: "var(--bg-2)" }}>
      <div className="flex items-center justify-center gap-1 text-sm font-bold text-ink tabular-nums">{icon}{value}</div>
      <div className="text-[9px] uppercase tracking-wider meta">{label}</div>
    </div>
  );
}

function LeaderRow({ rank, u }: { rank: number; u: Row }) {
  const initials = (u.name || "U").split(/[ @]/).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "U";
  const maxTrophies = Math.max(1, u.trophies);
  const barPct = Math.round((u.trophies / maxTrophies) * 100);

  return (
    <div
      className={"relative flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] overflow-hidden " + (u.isMe ? "ring-1" : "")}
      style={{ background: u.isMe ? "var(--green-50)" : "var(--bg)", border: "1px solid var(--line-soft)" }}
    >
      {/* animated progress fill behind the row */}
      <div
        className="absolute inset-y-0 left-0 opacity-[0.08]"
        style={{
          width: `${barPct}%`,
          background: "linear-gradient(90deg, #f59e0b, #fde68a)",
          transition: "width 1s cubic-bezier(.16,1,.3,1)",
        }}
      />
      <div className="relative w-7 text-center font-bold text-ink tabular-nums">#{rank}</div>
      {u.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.avatar} alt="" className="relative h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="relative grid h-8 w-8 place-items-center rounded-full bg-ink text-white text-xs font-bold">{initials}</div>
      )}
      <div className="relative flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink truncate">{u.name}{u.isMe && <span className="ml-1 text-xs meta">(you)</span>}</div>
      </div>
      <div className="relative flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
          <Medal className="h-3.5 w-3.5" style={{ color: "#3b82f6" }} />
          <span className="tabular-nums">{u.badges}</span>
        </div>
        <div className="flex items-center gap-1 font-bold text-ink">
          <TrophyIcon className="h-4 w-4" style={{ color: "#f59e0b" }} />
          <span className="tabular-nums">{u.trophies}</span>
        </div>
      </div>
    </div>
  );
}

function RankProgress({ rank, total, trophies }: { rank: number; total: number; trophies: number }) {
  const better = rank - 1;
  const pct = total > 1 ? Math.round((better / (total - 1)) * 100) : 0;
  return (
    <div className="mt-5 p-4 rounded-[16px]" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
      <div className="flex items-center justify-between text-xs meta mb-2">
        <span>Your climb to the top</span>
        <span>#{rank} of {total} · {trophies} trophies</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg,#f59e0b,#22a558)",
            transition: "width 1.2s cubic-bezier(.16,1,.3,1)",
          }}
        />
      </div>
      <div className="mt-1.5 text-[11px] meta flex items-center gap-1">
        <Award className="h-3 w-3" style={{ color: "#22a558" }} />
        Beat {better} {better === 1 ? "person" : "people"} above you to reach #1.
      </div>
    </div>
  );
}
