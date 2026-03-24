import { useState } from "react";
import type { Organization } from "./api";
import OnboardingWizard from "./components/OnboardingWizard";
import Dashboard from "./components/Dashboard";

type View = "wizard" | "dashboard";

export default function App() {
  const [view, setView] = useState<View>("wizard");
  const [org, setOrg] = useState<Organization | null>(null);

  const handleOnboarded = (organization: Organization) => {
    setOrg(organization);
    setView("dashboard");
  };

  const handleReset = () => {
    setOrg(null);
    setView("wizard");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-[#060911]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/rf-ai-logo.png"
              alt="Recorded Future AI"
              className="h-8 brightness-0 invert"
            />
          </div>
          {view === "dashboard" && org && (
            <div className="flex items-center gap-4">
              {org.logo_url && (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="h-7 w-7 rounded object-contain bg-white p-0.5"
                />
              )}
              <span className="text-sm text-gray-400">{org.name}</span>
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                New Organization
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {view === "wizard" ? (
          <OnboardingWizard onComplete={handleOnboarded} />
        ) : org ? (
          <Dashboard org={org} />
        ) : null}
      </main>
    </div>
  );
}
