import { useState } from "react";
import type { Profile } from "../api";

interface Props {
  profile: Profile;
}

const CATEGORY_ICONS: Record<string, string> = {
  business_operations: "briefcase",
  environment: "globe",
  vips: "users",
  brands: "tag",
  technology_stack: "cpu",
  employee_info: "user-group",
  assets: "database",
  geography: "map-pin",
};

const CATEGORY_ORDER = [
  "business_operations",
  "vips",
  "brands",
  "technology_stack",
  "employee_info",
  "assets",
  "geography",
  "environment",
];

export default function ProfileView({ profile }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "business_operations"
  );
  const [showCitations, setShowCitations] = useState(true);

  const grouped = profile.entries.reduce(
    (acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(entry);
      return acc;
    },
    {} as Record<string, typeof profile.entries>
  );

  const sortedCategories = CATEGORY_ORDER.filter((c) => grouped[c]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">
            Organization Profile
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Show citations</label>
            <button
              onClick={() => setShowCitations(!showCitations)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                showCitations ? "bg-blue-600" : "bg-gray-700"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  showCitations ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>
        <p className="text-gray-300 leading-relaxed">{profile.summary}</p>
        {profile.generated_at && (
          <p className="text-xs text-gray-500 mt-3">
            Generated{" "}
            {new Date(profile.generated_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {sortedCategories.map((category) => {
          const entries = grouped[category];
          const isExpanded = expandedCategory === category;
          const _icon = CATEGORY_ICONS[category];

          return (
            <div
              key={category}
              className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedCategory(isExpanded ? null : category)
                }
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon name={_icon} />
                  <span className="font-medium text-white">
                    {formatCategory(category)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {entries.length} facts
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-6 pb-4 border-t border-gray-800">
                  <div className="divide-y divide-gray-800/50">
                    {entries.map((entry) => (
                      <div key={entry.id} className="py-3">
                        <div className="flex items-start gap-4">
                          <span className="text-sm font-medium text-gray-400 w-40 flex-shrink-0">
                            {formatKey(entry.key)}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm text-white">{entry.value}</p>
                            {showCitations && entry.citation_url && (
                              <div className="mt-2 pl-3 border-l-2 border-gray-700">
                                <a
                                  href={entry.citation_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 break-all"
                                >
                                  {entry.citation_url}
                                </a>
                                {entry.citation_text && (
                                  <p className="text-xs text-gray-500 mt-1 italic">
                                    "{entry.citation_text}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    briefcase: (
      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    globe: (
      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    tag: (
      <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    cpu: (
      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
    "user-group": (
      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    database: (
      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    "map-pin": (
      <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  };
  return icons[name] ?? icons.briefcase;
}

function formatCategory(cat: string): string {
  if (cat === "vips") return "VIPs";
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
