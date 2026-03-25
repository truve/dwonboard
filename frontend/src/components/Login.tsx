import { useState } from "react";
import { api } from "../api";
import { setToken } from "../auth";

interface Props {
  onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(password);
      setToken(result.token);
      onLogin();
    } catch {
      setError("Invalid password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <img
            src="/RFAIlogo.svg"
            alt="Recorded Future AI"
            className="h-8 brightness-0 invert mx-auto mb-6"
          />
          <h2 className="text-xl font-semibold text-white">
            Dark Web Monitoring
          </h2>
          <p className="text-gray-400 text-sm mt-1">Enter password to continue</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#111827] rounded-xl border border-gray-800 p-6 space-y-4"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            required
            className="w-full px-4 py-3 bg-[#0a0e17] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
