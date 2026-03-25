const BASE = "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

// Types
export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  status: string;
  logo_url: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface DailyIngestionStats {
  date: string;
  darkweb_total: number;
  darkweb_fetched: number;
  cyber_risk_total: number;
  cyber_risk_fetched: number;
}

export interface RecentItem {
  title: string | null;
  source: string;
  item_type: string;
  posted_at: string;
  snippet: string;
}

export interface OnboardingStatus {
  org_id: string;
  status: string;
  profile_ready: boolean;
  alerts_count: number;
  elapsed_seconds: number | null;
  logo_url: string | null;
  ingestion_stats: DailyIngestionStats[] | null;
  cyber_risk_summary: string | null;
  analysis_progress: string | null;
  intel_card_ready: boolean;
  recent_items: RecentItem[] | null;
}

export interface ProfileEntry {
  id: string;
  category: string;
  key: string;
  value: string;
  citation_url: string | null;
  citation_text: string | null;
}

export interface Profile {
  id: string;
  org_id: string;
  summary: string;
  generated_at: string | null;
  entries: ProfileEntry[];
}

export interface Alert {
  id: string;
  org_id: string;
  darkweb_item_id: string;
  title: string;
  description: string;
  severity: string;
  relevance: string;
  relevance_score: number;
  classification: string;
  ai_reasoning: string;
  status: string;
  created_at: string;
  detected_at: string | null;
  matched_profile_entries: string[] | null;
}

export interface AlertList {
  total: number;
  alerts: Alert[];
}

// API calls
export const api = {
  createOrg: (data: { name: string; domain?: string; industry?: string }) =>
    request<Organization>("/organizations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  confirmOrg: (orgId: string) =>
    request<Organization>(`/organizations/${orgId}/confirm`, {
      method: "POST",
    }),

  getOrg: (orgId: string) => request<Organization>(`/organizations/${orgId}`),

  getStatus: (orgId: string) =>
    request<OnboardingStatus>(`/organizations/${orgId}/status`),

  getProfile: (orgId: string) =>
    request<Profile>(`/organizations/${orgId}/profile`),

  getIntelCard: (orgId: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request<any>(`/organizations/${orgId}/intel-card`),

  getAlerts: (orgId: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<AlertList>(`/organizations/${orgId}/alerts${qs}`);
  },

  getAlert: (orgId: string, alertId: string) =>
    request<Alert>(`/organizations/${orgId}/alerts/${alertId}`),

  updateAlert: (orgId: string, alertId: string, status: string) =>
    request<Alert>(`/organizations/${orgId}/alerts/${alertId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  collectDay: (orgId: string, daysBack: number) =>
    request<CollectDayResult>(
      `/organizations/${orgId}/collect-day?days_back=${daysBack}`,
      { method: "POST" }
    ),

  analyze: (orgId: string) =>
    request<{ status: string }>(`/organizations/${orgId}/analyze`, {
      method: "POST",
    }),
};

export interface CollectDayResult {
  date: string;
  darkweb_total: number;
  darkweb_fetched: number;
  cyber_risk_total: number;
  cyber_risk_fetched: number;
  samples: { title: string | null; source: string; item_type: string; snippet: string }[];
}
