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

  // Historical reference counts by date
  const rawCounts: Record<string, number> = innerStats?.counts ?? outerStats?.counts ?? {};
  const sortedCounts = Object.entries(rawCounts)
    .map(([date, count]) => ({ date, count: count as number }))
    .sort((a, b) => a.date.localeCompare(b.date));

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

  // Topics data for pie chart
  const rawTopics: Record<string, number> = innerStats?.topics ?? outerStats?.topics ?? {};
  const topicsData = Object.entries(rawTopics)
    .map(([name, count]) => ({ name, count: count as number }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  // Related entity lists by type
  const entityLists = outerStats?.entity_lists ?? innerStats?.entity_lists ?? {};
  const relatedByType: { type: string; label: string; entities: { id: string; name: string; count: number }[] }[] = [];

  const typeLabels: Record<string, string> = {
    RelatedThreatActor: "Threat Actors",
    RelatedMalware: "Malware",
    RelatedCyberVulnerability: "Vulnerabilities",
    RelatedAttackVector: "Attack Vectors",
    RelatedMethod: "Methods (MITRE)",
    RelatedCompany: "Companies",
    RelatedOrganization: "Organizations",
    RelatedInternetDomainName: "Domains",
    RelatedIpAddress: "IP Addresses",
    RelatedEmailAddress: "Email Addresses",
    RelatedHash: "File Hashes",
    RelatedTechnology: "Technologies",
    RelatedProduct: "Products",
    RelatedCountry: "Countries",
    RelatedMalwareCategory: "Malware Categories",
    RelatedUsername: "Usernames",
    RelatedOperation: "Operations",
    RelatedAttacker: "Attackers",
  };

  // Priority order — show threat-relevant types first
  const typePriority = [
    "RelatedThreatActor", "RelatedMalware", "RelatedCyberVulnerability",
    "RelatedAttackVector", "RelatedMethod", "RelatedCompany",
    "RelatedOrganization", "RelatedInternetDomainName", "RelatedIpAddress",
    "RelatedTechnology", "RelatedProduct", "RelatedCountry",
    "RelatedMalwareCategory", "RelatedEmailAddress", "RelatedHash",
    "RelatedUsername", "RelatedOperation", "RelatedAttacker",
  ];

  // Resolved entity names + types from backend
  // Format: { "entityId": { "name": "...", "type": "..." } } or legacy { "entityId": "name" }
  const rawEntityNames: Record<string, any> = data?._entity_names ?? {};
  const getEntityName = (id: string): string => {
    const v = rawEntityNames[id];
    if (!v) return formatEntityId(id);
    if (typeof v === "string") return v;
    return v.name ?? formatEntityId(id);
  };
  const getEntityType = (id: string): string => {
    const v = rawEntityNames[id];
    if (!v || typeof v === "string") return "";
    return v.type ?? "";
  };

  for (const type of typePriority) {
    const list = entityLists[type];
    if (!Array.isArray(list) || list.length === 0) continue;
    const sorted = [...list].sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0));

    if (type === "RelatedThreatActor") {
      // Split into organization-type actors and username/individual actors
      const orgActors: any[] = [];
      const userActors: any[] = [];
      for (const e of sorted) {
        const etype = getEntityType(e.id);
        if (etype === "Username" || etype === "Handle") {
          userActors.push(e);
        } else {
          orgActors.push(e);
        }
      }
      if (orgActors.length > 0) {
        relatedByType.push({
          type: type + "_org",
          label: "Threat Actor Groups",
          entities: orgActors.slice(0, 10).map((e: any) => ({
            id: e.id ?? "",
            name: getEntityName(e.id ?? ""),
            count: e.count ?? 0,
          })),
        });
      }
      if (userActors.length > 0) {
        relatedByType.push({
          type: type + "_user",
          label: "Threat Actor Identities",
          entities: userActors.slice(0, 10).map((e: any) => ({
            id: e.id ?? "",
            name: getEntityName(e.id ?? ""),
            count: e.count ?? 0,
          })),
        });
      }
      continue;
    }

    const top10 = sorted.slice(0, 10);
    relatedByType.push({
      type,
      label: typeLabels[type] ?? type.replace("Related", ""),
      entities: top10.map((e: any) => ({
        id: e.id ?? "",
        name: getEntityName(e.id ?? ""),
        count: e.count ?? 0,
      })),
    });
  }

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

      {/* Reference Activity Line Chart */}
      {sortedCounts.length > 0 && (
        <ReferenceActivityChart data={sortedCounts} />
      )}

      {/* Topics Pie Chart */}
      {topicsData.length > 0 && (
        <TopicsPieChart data={topicsData} />
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

      {/* Related Entities by Type */}
      {relatedByType.length > 0 && (
        <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Related Entities
          </h3>
          <div className="space-y-5">
            {relatedByType.map(({ type, label, entities: ents }) => (
              <RelatedEntitySection key={type} label={label} entities={ents} />
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

function ReferenceActivityChart({ data }: { data: { date: string; count: number }[] }) {
  // Aggregate by month for readability if there are many data points
  const byMonth: Record<string, number> = {};
  for (const d of data) {
    const month = d.date.slice(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] ?? 0) + d.count;
  }
  const points = Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  if (points.length < 2) return null;

  const maxCount = Math.max(...points.map((p) => p.count), 1);
  const chartH = 160;
  const chartW = 100; // percentage-based via viewBox

  // Build SVG polyline points
  const svgPoints = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * chartW;
      const y = chartH - (p.count / maxCount) * (chartH - 10);
      return `${x},${y}`;
    })
    .join(" ");

  // Area fill
  const areaPoints = `0,${chartH} ${svgPoints} ${chartW},${chartH}`;

  // Y-axis ticks
  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Reference Activity Over Time
      </h3>
      <div className="relative" style={{ height: chartH + 30 }}>
        {/* Y-axis labels */}
        {yTicks.map((tick) => {
          const yPct = 100 - (tick / maxCount) * 100;
          return (
            <span
              key={tick}
              className="absolute left-0 text-[10px] text-gray-500 font-mono"
              style={{ top: `${(yPct / 100) * chartH}px`, transform: "translateY(-50%)" }}
            >
              {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
            </span>
          );
        })}

        {/* Chart SVG */}
        <svg
          viewBox={`-2 0 ${chartW + 4} ${chartH}`}
          className="w-full"
          style={{ height: chartH, marginLeft: 35 }}
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = chartH - (tick / maxCount) * (chartH - 10);
            return (
              <line key={tick} x1="0" x2={chartW} y1={y} y2={y} stroke="#1f2937" strokeWidth="0.5" />
            );
          })}
          {/* Area fill */}
          <polygon points={areaPoints} fill="rgba(59,130,246,0.1)" />
          {/* Line */}
          <polyline points={svgPoints} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1" style={{ marginLeft: 35 }}>
          {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 6)) === 0 || i === points.length - 1).map((p) => (
            <span key={p.month} className="text-[10px] text-gray-500">
              {formatMonth(p.month)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#f43f5e", "#a855f7", "#14b8a6",
  "#6366f1", "#d946ef", "#84cc16", "#f59e0b",
];

function TopicsPieChart({ data }: { data: { name: string; count: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Show top 12, group rest as "Other"
  const top = data.slice(0, 12);
  const otherCount = data.slice(12).reduce((s, t) => s + t.count, 0);
  const slices = otherCount > 0 ? [...top, { name: "Other", count: otherCount }] : top;
  const total = slices.reduce((s, t) => s + t.count, 0);

  // Build pie slices as SVG arcs
  let cumAngle = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const angle = (s.count / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;

    const x1 = 50 + 40 * Math.cos(startAngle);
    const y1 = 50 + 40 * Math.sin(startAngle);
    const x2 = 50 + 40 * Math.cos(endAngle);
    const y2 = 50 + 40 * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    return {
      d: `M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`,
      color: PIE_COLORS[i % PIE_COLORS.length],
      ...s,
      pct: ((s.count / total) * 100).toFixed(1),
    };
  });

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Reference Topics
      </h3>
      <div className="flex gap-6">
        {/* Pie */}
        <svg viewBox="0 0 100 100" className="w-48 h-48 flex-shrink-0">
          {arcs.map((arc, i) => (
            <path
              key={i}
              d={arc.d}
              fill={arc.color}
              opacity={hovered === null || hovered === i ? 1 : 0.3}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="transition-opacity cursor-pointer"
            />
          ))}
        </svg>

        {/* Legend */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 content-start">
          {arcs.map((arc, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs py-0.5 transition-opacity ${
                hovered !== null && hovered !== i ? "opacity-40" : ""
              }`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: arc.color }}
              />
              <span className="text-gray-300 truncate">{arc.name}</span>
              <span className="text-gray-500 ml-auto">{arc.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function RelatedEntitySection({ label, entities: ents }: { label: string; entities: { id: string; name: string; count: number }[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ents : ents.slice(0, 5);

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
        <span className="text-gray-600 ml-1 font-normal normal-case">({ents.length})</span>
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((e, i) => (
          <span
            key={i}
            className="px-2.5 py-1 bg-[#0a0e17] border border-gray-800 rounded text-xs text-gray-300"
            title={`${e.id} (${e.count} references)`}
          >
            {e.name}
            <span className="text-gray-600 ml-1">{e.count}</span>
          </span>
        ))}
        {ents.length > 5 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300"
          >
            +{ents.length - 5} more
          </button>
        )}
      </div>
    </div>
  );
}

function formatEntityId(id: string): string {
  // Clean up RF entity IDs for display
  // "idn:swedbank.se" → "swedbank.se"
  // "ip:1.2.3.4" → "1.2.3.4"
  // "email:foo@bar.com" → "foo@bar.com"
  // "hash:abc123..." → "abc123..." (truncated)
  // "mitre:T1498" → "T1498"
  // Other IDs stay as-is (RF internal IDs)
  for (const prefix of ["idn:", "ip:", "email:", "hash:", "mitre:", "source:", "url:"]) {
    if (id.startsWith(prefix)) {
      const val = id.slice(prefix.length);
      if (prefix === "hash:" && val.length > 16) return val.slice(0, 16) + "...";
      if (prefix === "email:" && val.length > 30) return val.slice(0, 30) + "...";
      return val;
    }
  }
  return id;
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
