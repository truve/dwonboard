import { useState } from "react";
import { api } from "../api";
import type { Alert, AlertList } from "../api";
import { SeverityBadge } from "./Dashboard";

interface Props {
  orgId: string;
  initialAlerts: AlertList;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

type SortBy = "date" | "severity";

export default function AlertsView({ orgId, initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<AlertList>(initialAlerts);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [relevanceFilter, setRelevanceFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async (severity?: string, relevance?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (severity) params.severity = severity;
      if (relevance) params.relevance = relevance;
      const result = await api.getAlerts(orgId, params);
      setAlerts(result);
    } catch (e) {
      console.error("Failed to fetch alerts:", e);
    } finally {
      setLoading(false);
    }
  };

  const sortedAlerts = [...alerts.alerts].sort((a, b) => {
    if (sortBy === "date") {
      const dateA = new Date(a.detected_at ?? a.created_at).getTime();
      const dateB = new Date(b.detected_at ?? b.created_at).getTime();
      return dateB - dateA;
    }
    // severity
    return (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5);
  });

  const handleSeverityChange = (val: string) => {
    setSeverityFilter(val);
    fetchAlerts(val, relevanceFilter);
  };

  const handleRelevanceChange = (val: string) => {
    setRelevanceFilter(val);
    fetchAlerts(severityFilter, val);
  };

  const handleUpdateStatus = async (alertId: string, status: string) => {
    try {
      const updated = await api.updateAlert(orgId, alertId, status);
      setAlerts((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) => (a.id === alertId ? updated : a)),
      }));
      if (selectedAlert?.id === alertId) setSelectedAlert(updated);
    } catch (e) {
      console.error("Failed to update alert:", e);
    }
  };

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Alert list */}
      <div className="flex-1 space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <select
            value={severityFilter}
            onChange={(e) => handleSeverityChange(e.target.value)}
            className="px-3 py-2 bg-[#111827] border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>

          <select
            value={relevanceFilter}
            onChange={(e) => handleRelevanceChange(e.target.value)}
            className="px-3 py-2 bg-[#111827] border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Relevance</option>
            <option value="direct_match">Direct Match</option>
            <option value="likely_match">Likely Match</option>
            <option value="ambiguous">Ambiguous</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 bg-[#111827] border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="severity">Sort by Severity</option>
          </select>

          <span className="flex items-center text-sm text-gray-500">
            {alerts.total} alerts
          </span>
        </div>

        {/* Alert list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {sortedAlerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedAlert?.id === alert.id
                    ? "bg-blue-900/20 border-blue-700"
                    : "bg-[#111827] border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={alert.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {alert.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <RelevanceBadge relevance={alert.relevance} />
                      <span className="text-xs text-gray-500">
                        {alert.classification.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-500">
                        Score: {(alert.relevance_score * 100).toFixed(0)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(alert.detected_at ?? alert.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {alert.status !== "new" && (
                        <span className="text-xs text-gray-600 uppercase">
                          {alert.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {alerts.alerts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No alerts match your filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alert detail panel */}
      <div className="w-[440px] flex-shrink-0">
        {selectedAlert ? (
          <div className="bg-[#111827] rounded-xl border border-gray-800 p-6 sticky top-8 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <SeverityBadge severity={selectedAlert.severity} />
              <div className="flex gap-2">
                {selectedAlert.status === "new" && (
                  <>
                    <button
                      onClick={() =>
                        handleUpdateStatus(selectedAlert.id, "reviewed")
                      }
                      className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateStatus(selectedAlert.id, "dismissed")
                      }
                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white">
              {selectedAlert.title}
            </h3>

            <p className="text-sm text-gray-300 leading-relaxed">
              {selectedAlert.description}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <DetailItem label="Relevance">
                <RelevanceBadge relevance={selectedAlert.relevance} />
              </DetailItem>
              <DetailItem label="Score">
                <span className="text-sm font-mono text-white">
                  {(selectedAlert.relevance_score * 100).toFixed(1)}%
                </span>
              </DetailItem>
              <DetailItem label="Classification">
                <span className="text-sm text-gray-300 capitalize">
                  {selectedAlert.classification.replace(/_/g, " ")}
                </span>
              </DetailItem>
              <DetailItem label="Status">
                <span className="text-sm text-gray-300 capitalize">
                  {selectedAlert.status}
                </span>
              </DetailItem>
            </div>

            {/* IOC Enrichments */}
            {selectedAlert.ioc_enrichments && selectedAlert.ioc_enrichments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Indicators of Compromise
                </h4>
                <div className="space-y-2">
                  {selectedAlert.ioc_enrichments.map((ioc, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-[#0a0e17] rounded-lg border border-gray-800">
                      {/* Risk score gauge (small) */}
                      {ioc.risk_score != null ? (
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="#1f2937" strokeWidth="10" />
                            <circle
                              cx="50" cy="50" r="42" fill="none"
                              stroke={iocRiskColor(ioc.risk_score)}
                              strokeWidth="10"
                              strokeDasharray={`${(ioc.risk_score / 100) * 264} 264`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                            {ioc.risk_score}
                          </span>
                        </div>
                      ) : (
                        <div className="w-10 h-10 flex-shrink-0 rounded-full bg-gray-800 flex items-center justify-center">
                          <span className="text-[10px] text-gray-500">N/A</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                            {ioc.type}
                          </span>
                          <span className="text-sm text-white font-mono truncate">{ioc.value}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ioc.criticality && (
                            <span className="text-[10px] text-gray-500">{ioc.criticality}</span>
                          )}
                          {ioc.rules && (
                            <span className="text-[10px] text-gray-500">{ioc.rules} rules</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                AI Analysis
              </h4>
              <div className="bg-[#0a0e17] rounded-lg p-4 border border-gray-800">
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selectedAlert.ai_reasoning}
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Created{" "}
              {new Date(selectedAlert.created_at).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="bg-[#111827] rounded-xl border border-gray-800 p-6 flex items-center justify-center h-64 text-gray-500">
            Select an alert to view details
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function iocRiskColor(score: number): string {
  if (score >= 75) return "#ef4444";
  if (score >= 50) return "#f97316";
  if (score >= 25) return "#eab308";
  return "#22c55e";
}

function RelevanceBadge({ relevance }: { relevance: string }) {
  const colors: Record<string, string> = {
    direct_match: "text-red-400 bg-red-900/30",
    likely_match: "text-orange-400 bg-orange-900/30",
    ambiguous: "text-yellow-400 bg-yellow-900/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${colors[relevance] ?? "text-gray-400 bg-gray-800"}`}
    >
      {relevance.replace(/_/g, " ")}
    </span>
  );
}
