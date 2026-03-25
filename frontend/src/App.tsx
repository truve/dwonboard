import { useState, useEffect, useRef } from "react";
import { api } from "./api";
import type { Organization } from "./api";
import { getToken } from "./auth";
import Login from "./components/Login";
import OnboardingWizard from "./components/OnboardingWizard";
import Dashboard from "./components/Dashboard";

type View = "wizard" | "dashboard";

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [view, setView] = useState<View>("wizard");
  const [org, setOrg] = useState<Organization | null>(null);
  const checkedRef = useRef(false);

  // Check auth once on load
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const token = getToken();
    if (token) {
      // Have a stored token — verify it
      api.checkAuth()
        .then(() => setAuthenticated(true))
        .catch(() => setAuthenticated(false));
    } else {
      // No token — check if auth is disabled on the server
      api.checkAuth()
        .then(() => setAuthenticated(true))
        .catch(() => setAuthenticated(false));
    }
  }, []);

  const handleOnboarded = (organization: Organization) => {
    setOrg(organization);
    setView("dashboard");
  };

  const handleReset = () => {
    setOrg(null);
    setView("wizard");
  };

  // Loading state
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Login gate
  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-[#060911]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/RFAIlogo.svg"
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
