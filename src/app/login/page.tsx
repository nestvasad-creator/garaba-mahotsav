'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInAction, seedInitialSuperAdmin } from '@/lib/auth/actions';
import {
  CreditCard,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await signInAction({ email, password });
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to sign in. Please check credentials.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleCreateDefaultAdmin = async () => {
    setSeeding(true);
    setErrorMsg(null);
    try {
      const res = await seedInitialSuperAdmin();
      if (res.success) {
        setEmail('superadmin@test.com');
        setPassword('TestUser@2026');
        setSeedSuccess('Test Super Admin ready! Click Sign In.');
      } else {
        setErrorMsg((res as any).error || (res as any).message || 'Admin initialization note: user may already exist.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating initial admin.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 text-slate-100">
      <div className="max-w-md mx-auto w-full pt-8 pb-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30 mb-3">
          <CreditCard className="w-7 h-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          Event ID Card Management System
        </h1>
        <h2 className="text-sm font-semibold text-blue-300 mt-1">
          The New English School Trust, Vasad (NEST)
        </h2>
      </div>

      <div className="max-w-md mx-auto w-full my-auto">
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white">
              System Sign In
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Role-Based Access Control for Trustees, Verifiers, and Operators
            </p>
          </div>

          {seedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{seedSuccess}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="e.g. deo@test.com or superadmin@test.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-900/90 border border-slate-700 pl-10 pr-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-900/90 border border-slate-700 pl-10 pr-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Setup for Initial Super Admin */}
          <div className="border-t border-slate-700/80 pt-4 text-center">
            <p className="text-[11px] text-slate-400 mb-2">
              Default password for all test roles: <strong className="text-amber-300">TestUser@2026</strong>
            </p>
            <button
              type="button"
              onClick={handleCreateDefaultAdmin}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg transition font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {seeding ? 'Initializing...' : 'Pre-fill Test Super Admin (superadmin@test.com)'}
            </button>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 py-4">
        The New English School Trust, Vasad • Enterprise Multi-Event System
      </div>
    </div>
  );
}
