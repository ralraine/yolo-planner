
"use client";

import { useState } from "react";
import { LogOut, LoaderCircle } from "lucide-react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to log out. Please try again.");
      }

      // Full navigation clears the displayed dashboard.
      window.location.replace("/login");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <LoaderCircle
            size={18}
            className="animate-spin"
          />
        ) : (
          <LogOut size={18} strokeWidth={1.8} />
        )}

        {loading ? "Logging out..." : "Log Out"}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-2 px-4 text-xs text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}
