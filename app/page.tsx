'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold text-white mb-4">ScopeLock V1</h1>
        <p className="text-slate-300 mb-8">
          Manage video revisions with confidence and control scope creep
        </p>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            Editor Dashboard
          </Link>
          <p className="text-slate-400 text-sm">
            Clients will receive a magic link to review projects
          </p>
        </div>
      </div>
    </main>
  );
}
