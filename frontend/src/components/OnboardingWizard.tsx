import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import type { Organization, OnboardingStatus, DailyIngestionStats, CollectDayResult, RFEntityCandidate } from "../api";
import IngestionChart from "./IngestionChart";
import IntelCardView from "./IntelCardView";

const LOOKBACK_DAYS = 14;

interface Props {
  onComplete: (org: Organization) => void;
}

const STATUS_LABELS: Record<string, { label: string; description: string }> = {
  pending_confirmation: {
    label: "Awaiting Confirmation",
    description: "Please confirm your organization identity to begin.",
  },
  confirmed: {
    label: "Confirmed",
    description: "Organization confirmed. Starting analysis...",
  },
  profiling: {
    label: "Building Profile",
    description:
      "AI is analyzing public data to build your organization profile. This includes business operations, VIPs, technology stack, and more.",
  },
  profiled: {
    label: "Profile Complete",
    description: "Organization profile generated. Preparing collection...",
  },
  collecting: {
    label: "Fetching Dark Web from the Intelligence Graph",
    description:
      "Querying Recorded Future's Intelligence Graph for dark web references and cyber risk data, day by day over the last 14 days.",
  },
  analyzing: {
    label: "Analyzing Threats",
    description:
      "Matching collected data against your profile using vector similarity and AI classification. Generating risk assessment.",
  },
  onboarded: {
    label: "Onboarding Complete",
    description: "Your dark web monitoring is ready. View your dashboard.",
  },
  error: {
    label: "Error",
    description:
      "Something went wrong during onboarding. Please try again.",
  },
};

const STATUS_ORDER = [
  "confirmed",
  "profiling",
  "collecting",
  "analyzing",
  "onboarded",
];

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<"form" | "select-entity" | "processing">("form");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [org, setOrg] = useState<Organization | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Entity selection
  const [entityCandidates, setEntityCandidates] = useState<RFEntityCandidate[]>([]);

  const [activeTab, setActiveTab] = useState<"progress" | "intel">("progress");
  const [riskScore, setRiskScore] = useState<number | null>(null);

  // Collection state (frontend-driven)
  const [dailyStats, setDailyStats] = useState<DailyIngestionStats[]>([]);
  const [currentSnippet, setCurrentSnippet] = useState<string | null>(null);
  const [daysCollected, setDaysCollected] = useState(0);
  const collectingRef = useRef(false);

  // Poll status for phases the backend controls (profiling, analyzing)
  const pollStatus = useCallback(async () => {
    if (!org) return;
    try {
      const s = await api.getStatus(org.id);
      setStatus(s);

      if (s.status === "onboarded") {
        const updated = await api.getOrg(org.id);
        onComplete(updated);
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, [org, onComplete]);

  useEffect(() => {
    if (step !== "processing" || !org) return;
    const interval = setInterval(pollStatus, 2000);
    pollStatus();
    return () => clearInterval(interval);
  }, [step, org, pollStatus]);

  // Fetch risk score when intel card is ready
  useEffect(() => {
    if (!org || !status?.intel_card_ready || riskScore !== null) return;
    api.getIntelCard(org.id).then((data) => {
      const score = data?.result?.items?.[0]?.stats?.metrics?.riskScore;
      if (typeof score === "number") setRiskScore(score);
    }).catch(() => {});
  }, [org, status?.intel_card_ready, riskScore]);

  // When status transitions to "collecting", start the frontend-driven collection loop
  useEffect(() => {
    if (!org || !status || status.status !== "collecting" || collectingRef.current) return;
    collectingRef.current = true;
    runCollection(org.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, status?.status]);

  const runCollection = async (orgId: string) => {
    const stats: DailyIngestionStats[] = [];

    for (let daysBack = 0; daysBack <= LOOKBACK_DAYS; daysBack++) {
      try {
        const result: CollectDayResult = await api.collectDay(orgId, daysBack);

        stats.push({
          date: result.date,
          darkweb_total: result.darkweb_total,
          darkweb_fetched: result.darkweb_fetched,
          cyber_risk_total: result.cyber_risk_total,
          cyber_risk_fetched: result.cyber_risk_fetched,
        });
        setDailyStats([...stats]);
        setDaysCollected(daysBack + 1);

        // Show a sample snippet from this day's results
        if (result.samples.length > 0) {
          const sample = result.samples[0];
          setCurrentSnippet(sample.title || sample.snippet);
        }
      } catch (e) {
        console.error(`Collection failed for day ${daysBack}:`, e);
      }
    }

    // Collection done — trigger analysis
    try {
      await api.analyze(orgId);
      // Status will transition to "analyzing", polling will pick it up
    } catch (e) {
      console.error("Failed to trigger analysis:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Search for matching RF entities
      const candidates = await api.searchEntities(name);
      if (candidates.length > 1) {
        // Multiple matches — let user choose
        setEntityCandidates(candidates);
        setStep("select-entity");
      } else {
        // 0 or 1 match — proceed directly
        await startOnboarding(candidates[0]?.id ?? undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search entities");
    } finally {
      setLoading(false);
    }
  };

  const startOnboarding = async (rfEntityId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.createOrg({
        name,
        domain: domain || undefined,
        rf_entity_id: rfEntityId,
      });
      const confirmed = await api.confirmOrg(created.id);
      setOrg(confirmed);
      setStep("processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  // Determine active step — use collection state for the collecting phase
  const effectiveStatus = status?.status ?? "";
  const currentStatusIdx = STATUS_ORDER.indexOf(effectiveStatus);

  if (step === "form") {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-3">
            Dark Web Monitoring Setup
          </h2>
          <p className="text-gray-400 text-lg">
            Confirm your organization to begin automated threat intelligence
            monitoring.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#111827] rounded-xl border border-gray-800 p-8 space-y-6"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Organization Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Acme Bank"
              required
              className="w-full px-4 py-3 bg-[#0a0e17] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Domains
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g., acmebank.com, acme.io"
              className="w-full px-4 py-3 bg-[#0a0e17] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated. Leave blank to auto-detect from profile.
            </p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Searching..." : "Confirm & Begin Onboarding"}
          </button>
        </form>
      </div>
    );
  }

  if (step === "select-entity") {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-3">
            Select Organization
          </h2>
          <p className="text-gray-400">
            Multiple matches found for "{name}". Please select the correct entity.
          </p>
        </div>

        <div className="bg-[#111827] rounded-xl border border-gray-800 p-6 space-y-3">
          {entityCandidates.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => startOnboarding(candidate.id)}
              disabled={loading}
              className="w-full text-left p-4 rounded-lg border bg-[#0a0e17] border-gray-800 hover:border-blue-600 hover:bg-blue-900/20 transition-colors disabled:opacity-50"
            >
              <p className="text-sm font-medium text-white">{candidate.name}</p>
              {candidate.description && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{candidate.description}</p>
              )}
              <p className="text-[10px] text-gray-600 mt-1 font-mono">{candidate.id}</p>
            </button>
          ))}

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={() => { setStep("form"); setEntityCandidates([]); }}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors mt-2"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Processing view
  const intelReady = status?.intel_card_ready ?? false;

  return (
    <div className="max-w-3xl mx-auto mt-12">
      <div className="flex items-center justify-center gap-6 mb-6">
        {status?.logo_url && (
          <img
            src={status.logo_url}
            alt={org?.name ?? ""}
            className="w-20 h-20 rounded-xl object-contain bg-white p-2"
          />
        )}
        <div className="text-left">
          <h2 className="text-3xl font-bold text-white mb-1">{org?.name}</h2>
          <p className="text-gray-400">Onboarding in progress</p>
        </div>
        {riskScore !== null && (
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1f2937" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={riskScoreColor(riskScore)}
                strokeWidth="8"
                strokeDasharray={`${(riskScore / 100) * 264} 264`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
              {riskScore}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 mb-6">
        <nav className="flex gap-1 justify-center">
          <button
            onClick={() => setActiveTab("progress")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "progress"
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Onboarding Progress
          </button>
          <button
            onClick={() => intelReady && setActiveTab("intel")}
            disabled={!intelReady}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "intel"
                ? "border-blue-500 text-white"
                : !intelReady
                  ? "border-transparent text-gray-600 cursor-not-allowed"
                  : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Intelligence Card
            {!intelReady && <span className="ml-1 text-[10px] text-gray-600">(loading)</span>}
          </button>
        </nav>
      </div>

      {activeTab === "intel" && org && intelReady ? (
        <IntelCardView orgId={org.id} />
      ) : (
      <div>

      {/* Progress steps */}
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-8">
        <div className="space-y-1">
          {STATUS_ORDER.map((key, idx) => {
            const info = STATUS_LABELS[key];
            const isActive = effectiveStatus === key;
            const isDone = currentStatusIdx > idx;
            const isError = effectiveStatus === "error" && idx === currentStatusIdx;

            return (
              <div key={key} className="flex items-start gap-4 py-3">
                {/* Step indicator */}
                <div className="flex-shrink-0 mt-0.5">
                  {isDone ? (
                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : isActive ? (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  ) : isError ? (
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-gray-700 flex items-center justify-center">
                      <span className="text-xs text-gray-600">{idx + 1}</span>
                    </div>
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${
                      isActive
                        ? "text-white"
                        : isDone
                          ? "text-green-400"
                          : "text-gray-500"
                    }`}
                  >
                    {info.label}
                  </p>
                  {(isActive || isDone) && (
                    <p className="text-sm text-gray-400 mt-1">
                      {info.description}
                    </p>
                  )}
                  {isActive && key === "profiling" && (
                    <ProfilingTicker />
                  )}
                  {isActive && key === "collecting" && daysCollected > 0 && (
                    <p className="text-xs text-blue-400 mt-1">
                      Fetched {daysCollected} of {LOOKBACK_DAYS + 1} days...
                    </p>
                  )}
                  {isActive && key === "collecting" && currentSnippet && (
                    <p
                      className="text-xs text-gray-500 mt-2 italic truncate max-w-lg animate-fadeIn"
                      key={currentSnippet}
                    >
                      "{currentSnippet}"
                    </p>
                  )}
                  {isActive && key === "analyzing" && status?.analysis_progress && (
                    <p
                      className="text-xs text-blue-400 mt-2 animate-fadeIn"
                      key={status.analysis_progress}
                    >
                      {status.analysis_progress}
                    </p>
                  )}
                  {isActive && key === "analyzing" && status?.alerts_count != null && status.alerts_count > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {status.alerts_count} alerts identified so far
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timer */}
        {status?.elapsed_seconds != null && effectiveStatus !== "onboarded" && (
          <div className="mt-6 pt-4 border-t border-gray-800 text-center">
            <span className="text-sm text-gray-500">
              Elapsed: {Math.floor(status.elapsed_seconds)}s
            </span>
          </div>
        )}
      </div>

      {/* Live ingestion chart — grows as days are collected */}
      {dailyStats.length > 0 && (
        <div className="mt-6">
          <IngestionChart stats={dailyStats} />
        </div>
      )}
      </div>
      )}
    </div>
  );
}

const PROFILE_STEPS = [
  "Analyzing business operations and revenue streams...",
  "Identifying key executives and board members...",
  "Mapping brands, subsidiaries, and trade names...",
  "Discovering technology stack from public sources...",
  "Estimating employee count and office locations...",
  "Cataloging digital assets and domains...",
  "Mapping geographic presence and operating regions...",
  "Reviewing regulatory environment and competitors...",
  "Verifying findings and gathering citations...",
];

function riskScoreColor(score: number): string {
  if (score >= 75) return "#ef4444";
  if (score >= 50) return "#f97316";
  if (score >= 25) return "#eab308";
  return "#22c55e";
}

function ProfilingTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % PROFILE_STEPS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className="text-xs text-gray-500 mt-2 italic animate-fadeIn"
      key={index}
    >
      {PROFILE_STEPS[index]}
    </p>
  );
}
