'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Store, Eye, EyeOff, ArrowRight, Zap, Shield, BarChart3, Users } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    router.replace('/');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.ok) {
      router.replace('/');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const fillDemo = () => {
    setEmail('admin@bluefishing.cl');
    setPassword('admin123');
    setError('');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700" />
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black">Bluefishing</h1>
                <p className="text-sm text-white/70">Business Intelligence</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-black leading-tight">
                Data-driven decisions<br />
                for wholesale growth
              </h2>
              <p className="mt-4 text-lg text-white/80 max-w-md">
                Real-time analytics, AI forecasting, and CRM — all in one platform built for Bluefishing.cl
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <BarChart3 className="w-5 h-5" />, label: 'Real-time KPIs', desc: '20+ dashboards' },
                { icon: <Zap className="w-5 h-5" />, label: 'AI Forecasting', desc: 'Prophet models' },
                { icon: <Users className="w-5 h-5" />, label: 'Wholesale CRM', desc: 'Pipeline & calls' },
                { icon: <Shield className="w-5 h-5" />, label: 'Smart Alerts', desc: 'Anomaly detection' },
              ].map((f) => (
                <div key={f.label} className="p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <div className="text-white/90 mb-2">{f.icon}</div>
                  <p className="font-semibold text-sm">{f.label}</p>
                  <p className="text-xs text-white/60">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/40">
            © 2026 Bluefishing BI v2.0 — Powered by Next.js, Supabase & Claude
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">Bluefishing</h1>
                <p className="text-xs text-slate-500">Business Intelligence</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Welcome back
            </h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Sign in to your BI dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@bluefishing.cl"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700
                           bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                           placeholder:text-slate-400 
                           focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           transition-all outline-none text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                             placeholder:text-slate-400 
                             focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                             transition-all outline-none pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium animate-slide-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-base
                         bg-gradient-to-r from-indigo-500 to-purple-600
                         hover:from-indigo-600 hover:to-purple-700
                         shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30
                         transition-all duration-200 disabled:opacity-60
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-slate-50 dark:bg-slate-900 text-slate-400 font-medium">DEMO ACCESS</span>
            </div>
          </div>

          <button
            type="button"
            onClick={fillDemo}
            className="w-full py-3 rounded-xl font-semibold text-indigo-600 dark:text-indigo-400 text-sm
                       bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800
                       hover:bg-indigo-100 dark:hover:bg-indigo-950/50
                       transition-all duration-200"
          >
            Fill demo credentials (admin@bluefishing.cl)
          </button>

          <div className="text-center space-y-2">
            <p className="text-xs text-slate-400">
              Demo accounts: <span className="font-mono text-slate-500">admin / vendedor / bodega</span>@bluefishing.cl
            </p>
            <p className="text-xs text-slate-400">
              Or use <span className="font-mono text-slate-500">demo@demo.com</span> / <span className="font-mono text-slate-500">demo</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
