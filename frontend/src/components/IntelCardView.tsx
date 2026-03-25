import { useState, useEffect } from "react";
import { api } from "../api";

interface Props {
  orgId: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RiskRule {
  name: string;
  rule: string;
  category: string;
  evidence: string;
  criticality: number;
  criticalityLabel: string;
  sightings: number;
  sources: number;
  timestamp: string | null;
}

export default function IntelCardView({ orgId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.getIntelCard(orgId);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load intel card");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-6 text-center text-gray-500">
        {error || "No intelligence card data available."}
      </div>
    );
  }

  // Navigate to the first item's stats
  const item = data?.result?.items?.[0] ?? data?.items?.[0] ?? data;
  const outerStats = item?.stats ?? {};
  const metrics = outerStats?.metrics ?? {};
  // The inner stats.stats has evidenceDetails, riskSummary, recent sightings, etc.
  const innerStats = outerStats?.stats ?? {};
  const evidenceDetails: any[] = innerStats?.evidenceDetails ?? outerStats?.evidenceDetails ?? [];
  const riskSummary = innerStats?.riskSummary ?? outerStats?.riskSummary ?? "";
  const criticalityLabel = innerStats?.criticalityLabel ?? outerStats?.criticalityLabel;

  const riskScore = metrics.riskScore;

  // Recent sightings are in innerStats
  const sightingSource = innerStats.recentDarkWeb ? innerStats : outerStats;

  // Parse risk rules from evidenceDetails
  const riskRules: RiskRule[] = evidenceDetails.map((r: any) => ({
    name: r.Name ?? "",
    rule: r.Rule ?? "",
    category: r.RuleCategory ?? "",
    evidence: cleanEvidence(r.EvidenceString ?? ""),
    criticality: r.Criticality ?? 0,
    criticalityLabel: r.CriticalityLabel ?? "",
    sightings: r.SightingsCount ?? 0,
    sources: r.SourcesCount ?? 0,
    timestamp: r.Timestamp ?? null,
  })).sort((a: RiskRule, b: RiskRule) => b.criticality - a.criticality || b.sightings - a.sightings);

  // Key metrics to display
  const keyMetrics = [
    { label: "Risk Score", value: riskScore, color: riskScoreColor(riskScore ?? 0) },
    { label: "Dark Web Hits", value: metrics.darkWebHits },
    { label: "Underground Forum Hits", value: metrics.undergroundForumHits },
    { label: "Paste Hits", value: metrics.pasteHits },
    { label: "Cyber Attack Hits", value: metrics.cyberAttackHits },
    { label: "Social Media Hits", value: metrics.socialMediaHits },
    { label: "Total Hits", value: metrics.totalHits },
    { label: "Leaked Credentials", value: metrics.leakedCredsHits !== undefined ? metrics.leakedCredsHits : undefined },
    { label: "7 Day Hits", value: metrics.sevenDaysHits },
    { label: "60 Day Hits", value: metrics.sixtyDaysHits },
    { label: "Risk Rules Triggered", value: `${metrics.rules} / ${metrics.maxRules}` },
  ].filter((m) => m.value !== undefined && m.value !== null);

  // Recent notable sightings
  const recentSightings = [
    sightingSource.recentDarkWeb && { label: "Dark Web", ...sightingSource.recentDarkWeb },
    sightingSource.recentUndergroundForum && { label: "Underground Forum", ...sightingSource.recentUndergroundForum },
    sightingSource.recentSocialMedia && { label: "Social Media", ...sightingSource.recentSocialMedia },
    sightingSource.recentCyberAttack && { label: "Cyber Attack", ...sightingSource.recentCyberAttack },
    sightingSource.recentPaste && { label: "Paste Site", ...sightingSource.recentPaste },
    sightingSource.recentInfoSec && { label: "InfoSec", ...sightingSource.recentInfoSec },
  ].filter(Boolean) as any[];

  // Group rules by category
  const rulesByCategory: Record<string, RiskRule[]> = {};
  for (const rule of riskRules) {
    const cat = rule.category || "Other";
    if (!rulesByCategory[cat]) rulesByCategory[cat] = [];
    rulesByCategory[cat].push(rule);
  }

  return (
    <div className="space-y-6">
      {/* Risk Score + Summary */}
      {riskScore != null && (
        <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1f2937" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={riskScoreColor(riskScore)}
                  strokeWidth="8"
                  strokeDasharray={`${(riskScore / 100) * 264} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
                {riskScore}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: riskScoreColor(riskScore) }}>
                {criticalityLabel ?? riskScoreLabel(riskScore)} Risk
              </p>
              {riskSummary && (
                <p className="text-sm text-gray-400 mt-1">{riskSummary}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Key Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {keyMetrics.map((m, i) => (
            <div key={i} className="bg-[#0a0e17] rounded-lg p-3">
              <p className="text-[11px] text-gray-500">{m.label}</p>
              <p className="text-lg font-semibold text-white mt-0.5" style={m.color ? { color: m.color } : undefined}>
                {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Rules by Category */}
      {riskRules.length > 0 && (
        <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Triggered Risk Rules ({riskRules.length})
          </h3>
          <div className="space-y-6">
            {Object.entries(rulesByCategory).map(([category, rules]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {category}
                </h4>
                <div className="space-y-2">
                  {rules.map((rule, i) => (
                    <RiskRuleCard key={i} rule={rule} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sightings */}
      {recentSightings.length > 0 && (
        <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Recent Notable Sightings
          </h3>
          <div className="space-y-3">
            {recentSightings.map((s, i) => (
              <div key={i} className="p-3 bg-[#0a0e17] rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                    {s.label}
                  </span>
                  <span className="text-[10px] text-gray-500">{s.source?.name}</span>
                  {s.published && (
                    <span className="text-[10px] text-gray-500 ml-auto">
                      {new Date(s.published).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
                {s.title && (
                  <p className="text-xs font-medium text-gray-200 mb-1 line-clamp-1">{s.title}</p>
                )}
                {s.fragment && (
                  <p className="text-xs text-gray-400 line-clamp-2">{s.fragment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Data */}
      <RawDataSection data={data} />
    </div>
  );
}

function RiskRuleCard({ rule }: { rule: RiskRule }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#0a0e17] rounded-lg border border-gray-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-gray-800/30 transition-colors"
      >
        <CriticalityBadge criticality={rule.criticality} label={rule.criticalityLabel} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{rule.rule}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-gray-500">
              {rule.sightings > 0 ? `${rule.sightings.toLocaleString()} sightings` : ""}
            </span>
            {rule.sources > 0 && (
              <span className="text-[10px] text-gray-500">{rule.sources} source{rule.sources !== 1 ? "s" : ""}</span>
            )}
            {rule.timestamp && (
              <span className="text-[10px] text-gray-500">
                {new Date(rule.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 flex-shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && rule.evidence && (
        <div className="px-3 pb-3 pt-0">
          <div className="pl-11 border-l-2 border-gray-700 ml-1">
            <p className="text-xs text-gray-400 leading-relaxed">{rule.evidence}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CriticalityBadge({ criticality, label }: { criticality: number; label: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    "Very Critical": { bg: "bg-red-600", text: "text-red-100" },
    "Critical": { bg: "bg-orange-600", text: "text-orange-100" },
    "Moderate": { bg: "bg-yellow-600", text: "text-yellow-100" },
    "Low": { bg: "bg-blue-600", text: "text-blue-100" },
    "Informational": { bg: "bg-gray-600", text: "text-gray-100" },
  };
  const c = colors[label] ?? colors["Informational"];
  return (
    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${c.bg} ${c.text}`}>
      {label || `C${criticality}`}
    </span>
  );
}

function RawDataSection({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Raw Intelligence Card Data
      </button>
      {expanded && (
        <pre className="mt-4 p-4 bg-[#0a0e17] rounded-lg overflow-auto max-h-96 text-xs text-gray-400 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function cleanEvidence(str: string): string {
  // Remove RF entity tags like <e id=xxx>text</e> → text
  return str.replace(/<e[^>]*>/g, "").replace(/<\/e>/g, "");
}

function riskScoreColor(score: number): string {
  if (score >= 75) return "#ef4444";
  if (score >= 50) return "#f97316";
  if (score >= 25) return "#eab308";
  return "#22c55e";
}

function riskScoreLabel(score: number): string {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Moderate";
  return "Low";
}
