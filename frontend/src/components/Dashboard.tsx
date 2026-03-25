import { useState, useEffect } from "react";
import { api } from "../api";
import type { Organization, Profile, AlertList, DailyIngestionStats } from "../api";
import { exportReport } from "../exportPdf";
import ProfileView from "./ProfileView";
import AlertsView from "./AlertsView";
import IngestionChart from "./IngestionChart";
import IntelCardView from "./IntelCardView";

interface Props {
  org: Organization;
}

type Tab = "overview" | "profile" | "alerts" | "intel";

export default function Dashboard({ org }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [alerts, setAlerts] = useState<AlertList | null>(null);
  const [ingestionStats, setIngestionStats] = useState<DailyIngestionStats[] | null>(null);
  const [cyberRiskSummary, setCyberRiskSummary] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [intelCard, setIntelCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, a, s] = await Promise.all([
          api.getProfile(org.id),
          api.getAlerts(org.id),
          api.getStatus(org.id),
        ]);
        setProfile(p);
        setAlerts(a);
        setIngestionStats(s.ingestion_stats);
        setCyberRiskSummary(s.cyber_risk_summary);

        // Fetch risk score from intel card
        if (s.intel_card_ready) {
          try {
            const intel = await api.getIntelCard(org.id);
            setIntelCard(intel);
            const score = intel?.result?.items?.[0]?.stats?.metrics?.riskScore
              ?? intel?.items?.[0]?.stats?.metrics?.riskScore;
            if (typeof score === "number") setRiskScore(score);
          } catch { /* intel card optional */ }
        }
      } catch (e) {
        console.error("Load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [org.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const severityCounts = alerts?.alerts.reduce(
    (acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  const relevanceCounts = alerts?.alerts.reduce(
    (acc, a) => {
      acc[a.relevance] = (acc[a.relevance] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  const categoryCounts = profile?.entries.reduce(
    (acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "profile", label: "Organization Profile" },
    { key: "alerts", label: `Alerts (${alerts?.total ?? 0})` },
    { key: "intel", label: "Intelligence Card" },
  ];

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-800 mb-8 flex items-center justify-between">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button
          onClick={() => {
            if (profile && alerts) {
              exportReport({ org, profile, alerts, ingestionStats, cyberRiskSummary, intelCard });
            }
          }}
          disabled={!profile || !alerts}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export PDF
        </button>
      </div>

      {tab === "overview" && (
        <div className="space-y-8">
          {/* Summary card */}
          {profile && (
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <div className="flex items-start gap-5">
                {/* Logo + Risk Score stacked */}
                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  {org.logo_url && (
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="w-16 h-16 rounded-lg object-contain bg-white p-2"
                    />
                  )}
                  {riskScore !== null && (
                    <div className="relative w-14 h-14">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#1f2937" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r="42" fill="none"
                          stroke={riskScoreColor(riskScore)}
                          strokeWidth="8"
                          strokeDasharray={`${(riskScore / 100) * 264} 264`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                        {riskScore}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Executive Summary
                  </h3>
                  <p className="text-gray-300 leading-relaxed">{profile.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Alerts"
              value={alerts?.total ?? 0}
              color="blue"
            />
            <StatCard
              label="Critical/High"
              value={(severityCounts.critical ?? 0) + (severityCounts.high ?? 0)}
              color="red"
            />
            <StatCard
              label="Direct Matches"
              value={relevanceCounts.direct_match ?? 0}
              color="orange"
            />
            <StatCard
              label="Profile Facts"
              value={profile?.entries.length ?? 0}
              color="green"
            />
          </div>

          {/* Dark web ingestion chart */}
          {ingestionStats && ingestionStats.length > 0 && (
            <IngestionChart stats={ingestionStats} />
          )}

          {/* OSINT Cyber Risk Assessment */}
          {cyberRiskSummary && (
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                OSINT Cyber Risk Assessment
              </h3>
              <div className="prose-dark">
                <RiskSummary text={cyberRiskSummary} />
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Severity breakdown */}
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Alerts by Severity
              </h3>
              <div className="space-y-3">
                {(["critical", "high", "medium", "low", "info"] as const).map(
                  (sev) => {
                    const count = severityCounts[sev] ?? 0;
                    const total = alerts?.total ?? 1;
                    const pct = Math.round((count / total) * 100) || 0;
                    return (
                      <div key={sev}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 capitalize">{sev}</span>
                          <span className="text-gray-400">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${severityBarColor(sev)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Profile categories */}
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Profile Coverage
              </h3>
              <div className="space-y-3">
                {Object.entries(categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-gray-300">
                        {formatCategory(cat)}
                      </span>
                      <span className="text-sm font-mono text-blue-400">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Top alerts preview */}
          {alerts && alerts.alerts.length > 0 && (
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Top Threats
                </h3>
                <button
                  onClick={() => setTab("alerts")}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {alerts.alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 bg-[#0a0e17] rounded-lg"
                  >
                    <SeverityBadge severity={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {alert.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {alert.relevance.replace("_", " ")} &middot;{" "}
                        {alert.classification.replace("_", " ")} &middot;{" "}
                        Score: {(alert.relevance_score * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "profile" && profile && <ProfileView profile={profile} />}
      {tab === "alerts" && alerts && (
        <AlertsView orgId={org.id} initialAlerts={alerts} />
      )}
      {tab === "intel" && <IntelCardView orgId={org.id} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-400",
    red: "text-red-400",
    orange: "text-orange-400",
    green: "text-green-400",
  };
  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color] ?? "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function riskScoreColor(score: number): string {
  if (score >= 75) return "#ef4444";
  if (score >= 50) return "#f97316";
  if (score >= 25) return "#eab308";
  return "#22c55e";
}

export function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-600 text-red-100",
    high: "bg-orange-600 text-orange-100",
    medium: "bg-yellow-600 text-yellow-100",
    low: "bg-blue-600 text-blue-100",
    info: "bg-gray-600 text-gray-100",
  };
  return (
    <span
      className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium uppercase ${colors[severity] ?? colors.info}`}
    >
      {severity}
    </span>
  );
}

function severityBarColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-500",
    info: "bg-gray-500",
  };
  return colors[severity] ?? "bg-gray-500";
}

function formatCategory(cat: string): string {
  if (cat === "vips") return "VIPs";
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function RiskSummary({ text }: { text: string }) {
  const ratingColors: Record<string, string> = {
    CRITICAL: "bg-red-600 text-red-100",
    HIGH: "bg-orange-600 text-orange-100",
    MEDIUM: "bg-yellow-600 text-yellow-100",
    LOW: "bg-green-600 text-green-100",
  };

  const lines = text.split("\n");
  const elements: JSX.Element[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      const heading = trimmed.slice(3);
      // Check for risk rating badge
      if (heading.toLowerCase().includes("risk rating")) {
        const nextLine = lines[i + 1]?.trim() ?? "";
        const ratingMatch = nextLine.match(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/);
        elements.push(
          <div key={i} className="mb-4">
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {heading}
            </h4>
            {ratingMatch && (
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-bold mr-3 ${ratingColors[ratingMatch[1]] ?? "bg-gray-600 text-gray-100"}`}
              >
                {ratingMatch[1]}
              </span>
            )}
            <span className="text-gray-300 text-sm">
              {nextLine.replace(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b:?\s*/, "")}
            </span>
          </div>
        );
        i++; // skip the next line since we consumed it
      } else {
        elements.push(
          <h4
            key={i}
            className="text-sm font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2"
          >
            {heading}
          </h4>
        );
      }
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 mb-1.5">
          <span className="text-blue-400 mt-1 flex-shrink-0">&#8226;</span>
          <p className="text-sm text-gray-300 leading-relaxed">
            {trimmed.slice(2)}
          </p>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\.\s/)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 mb-1.5">
          <span className="text-blue-400 font-mono text-sm flex-shrink-0 w-5">
            {num}.
          </span>
          <p className="text-sm text-gray-300 leading-relaxed">
            {trimmed.replace(/^\d+\.\s/, "")}
          </p>
        </div>
      );
    } else {
      elements.push(
        <p key={i} className="text-sm text-gray-300 leading-relaxed mb-2">
          {trimmed}
        </p>
      );
    }
  }

  return <>{elements}</>;
}
