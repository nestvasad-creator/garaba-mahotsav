import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  CreditCard,
  Printer,
  QrCode,
  FileSpreadsheet,
  Award,
  Settings,
  Sparkles,
  UserCheck,
  LogIn,
  LogOut,
  User as UserIcon,
  Lock,
} from 'lucide-react';
import { getCurrentUserSession, signOutAction } from '@/lib/auth/actions';
import { ROLE_DEFINITIONS, SystemRoleCode } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUserSession();

  const currentEvent = {
    nameEn: 'Navratri Mahotsav 2026',
    nameGu: 'નવરાત્રી મહોત્સવ ૨૦૨૬',
    code: 'NEST',
    dates: '01 Oct 2026 - 12 Oct 2026',
    organization: 'The New English School Trust, Vasad',
    organizationGu: 'ધ ન્યુ ઇંગ્લિશ સ્કૂલ ટ્રસ્ટ, વાસદ',
  };

  const modules = [
    {
      title: 'Participant Registration',
      titleGu: 'ખેલૈયા નોંધણી અને ડેટા એન્ટ્રી',
      description: 'Enroll participants with Gujarati/English dual input, upload proofs, and auto-detect duplicates.',
      href: '/registrations',
      icon: Users,
      badge: 'DEO / Desk',
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      allowedRoles: ['DATA_ENTRY_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN'],
    },
    {
      title: 'Document Verification',
      titleGu: 'દસ્તાવેજ ચકાસણી (Maker-Checker)',
      description: 'Inspect Aadhaar/proofs via secure 5-min signed URLs, zoom viewer, and approve/reject.',
      href: '/verification',
      icon: ShieldCheck,
      badge: 'Verifier Only',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      allowedRoles: ['VERIFIER', 'EVENT_ADMIN', 'SUPER_ADMIN'],
    },
    {
      title: 'Card Theme & Designer',
      titleGu: 'કાર્ડ થીમ અને રંગ રચના',
      description: 'Dynamic color engine for Category + Gender (Male Blue, Female Pink, VIP Gold, Security Red).',
      href: '/card-designer',
      icon: Sparkles,
      badge: 'Admin Only',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      allowedRoles: ['EVENT_ADMIN', 'SUPER_ADMIN'],
    },
    {
      title: 'Physical Card Printing',
      titleGu: 'CR80 કાર્ડ પ્રિન્ટિંગ કતાર',
      description: 'Direct browser CSS print (@page CR80 85.6x53.98mm) and reprint reason audit controls.',
      href: '/print-queue',
      icon: Printer,
      badge: 'Printer Op',
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      allowedRoles: ['PRINTER_OPERATOR', 'VERIFIER', 'EVENT_ADMIN', 'SUPER_ADMIN'],
    },
    {
      title: 'Special / VIP Cards',
      titleGu: 'વિશેષ પાસ (VIP, મહેમાન, સુરક્ષા)',
      description: 'Controlled non-registered cards requiring server-side permission PRINT_NON_REGISTERED_ID_CARD.',
      href: '/special-cards',
      icon: Award,
      badge: 'Special Auth',
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      allowedRoles: ['SPECIAL_ID_OPERATOR', 'EVENT_ADMIN', 'SUPER_ADMIN'],
    },
    {
      title: 'Gate QR Verification',
      titleGu: 'મોબાઇલ ક્યૂઆર સ્કેનર',
      description: 'Mobile-ready camera scanner for gate guards to verify card validity with zero PII exposure.',
      href: '/scan',
      icon: QrCode,
      badge: 'Security',
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      allowedRoles: ['SECURITY', 'EVENT_ADMIN', 'SUPER_ADMIN'],
    },
    {
      title: 'User Management',
      titleGu: 'વપરાશકર્તાઓ અને રોલ્સ',
      description: 'Create operators, invite staff, assign roles (Super Admin, Verifier, Data Entry, Security).',
      href: '/users',
      icon: UserCheck,
      badge: 'Admin Only',
      color: 'bg-violet-50 text-violet-700 border-violet-200',
      allowedRoles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
    },
    {
      title: 'Reports & Analytics',
      titleGu: 'અહેવાલો અને એક્સેલ એક્સપોર્ટ',
      description: 'Date-wise, category-wise charts, UTF-8 BOM Excel export, and Noto Sans Gujarati PDF.',
      href: '/reports',
      icon: FileSpreadsheet,
      badge: 'Verifiers & Admins',
      color: 'bg-teal-50 text-teal-700 border-teal-200',
      allowedRoles: ['VERIFIER', 'EVENT_ADMIN', 'SUPER_ADMIN'],
    },
    {
      title: 'RBAC & Audit Trail',
      titleGu: 'વપરાશકર્તા અને સુરક્ષા ઓડિટ',
      description: 'Role-based access matrix, server-side permission checks, and immutable security audit logs.',
      href: '/settings',
      icon: Settings,
      badge: 'Super Admin',
      color: 'bg-slate-100 text-slate-700 border-slate-300',
      allowedRoles: ['SUPER_ADMIN', 'EVENT_ADMIN'],
    },
  ];

  const userRoleMeta = user ? ROLE_DEFINITIONS[user.roleCode as SystemRoleCode] : null;

  // Filter modules strictly according to the logged-in user's role
  const visibleModules = user
    ? user.roleCode === 'SUPER_ADMIN'
      ? modules
      : modules.filter((m) => m.allowedRoles.includes(user.roleCode))
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Event ID Card System
              </h1>
              <p className="text-xs text-slate-500">
                {currentEvent.organization}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                ● Active Event: {currentEvent.code}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentEvent.nameEn}
              </p>
            </div>

            {/* Auth Session Section */}
            {user ? (
              <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                    <span>{user.fullNameEn}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                      {user.roleCode}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">{user.email}</div>
                </div>

                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:text-rose-600 hover:border-rose-300 transition flex items-center gap-1 text-xs font-medium"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="pl-3 border-l border-slate-200">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white py-8 px-4 sm:px-6 lg:px-8 shadow-inner">
        <div className="max-w-7xl mx-auto space-y-5">
          {user && (
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/30 border border-blue-400/40 flex items-center justify-center text-blue-200">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-medium text-blue-200 flex items-center gap-2">
                    <span>Logged In: <strong className="text-white">{user.fullNameEn}</strong></span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                      {user.roleCode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    {ROLE_DEFINITIONS[user.roleCode as SystemRoleCode]?.description || 'System Operator'}
                  </div>
                </div>
              </div>

              {ROLE_DEFINITIONS[user.roleCode as SystemRoleCode]?.primaryPath && (
                <Link
                  href={ROLE_DEFINITIONS[user.roleCode as SystemRoleCode].primaryPath}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold shadow transition whitespace-nowrap flex items-center gap-1.5"
                >
                  <span>Open Your Workspace ({ROLE_DEFINITIONS[user.roleCode as SystemRoleCode]?.nameEn})</span>
                  <span>→</span>
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-amber-400 text-xs font-semibold tracking-wider uppercase">
                Multi-Event Reusable Platform
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
                {currentEvent.nameEn}
              </h2>
              <p className="text-sm text-slate-300 mt-2">
                Event Period: <span className="text-white font-medium">{currentEvent.dates}</span> | Organized by {currentEvent.organization}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center min-w-[110px] border border-white/10">
                <div className="text-xl font-bold text-white">Unicode</div>
                <div className="text-xs text-blue-200">Multilingual Ready</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center min-w-[110px] border border-white/10">
                <div className="text-xl font-bold text-amber-400">CR80</div>
                <div className="text-xs text-slate-300">85.6 × 54 mm</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center min-w-[110px] border border-white/10">
                <div className="text-xl font-bold text-emerald-400">RBAC</div>
                <div className="text-xs text-slate-300">Maker-Checker</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Rendered strictly according to user roles */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {user ? (
          <>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  Your Assigned Operational Modules
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Authorized operational modules for role ({userRoleMeta?.nameEn})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {visibleModules.length} Authorized {visibleModules.length === 1 ? 'Module' : 'Modules'}
                </span>
                <span className="text-xs px-3 py-1 rounded-full font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Role: {user.roleCode}
                </span>
              </div>
            </div>

            {visibleModules.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
                <Lock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800">No Modules Assigned</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Your account does not currently have any active operational modules assigned. Please contact the Super Administrator.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {visibleModules.map((m) => {
                  const Icon = m.icon;
                  const isPrimaryWorkspace = userRoleMeta?.primaryPath === m.href;

                  return (
                    <Link
                      key={m.title}
                      href={m.href}
                      className={`group relative rounded-2xl p-5 transition-all flex flex-col justify-between border ${
                        isPrimaryWorkspace
                          ? 'bg-blue-50/60 border-blue-500 shadow-md ring-2 ring-blue-400/40 hover:bg-blue-50'
                          : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2.5 rounded-xl border ${m.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          {isPrimaryWorkspace ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-sm flex items-center gap-1">
                              ★ Your Workspace
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {m.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {m.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                        <span className="text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>{isPrimaryWorkspace ? 'Open Your Workspace' : 'Open Module'}</span>
                          <span>→</span>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* When Unauthenticated: Clean Sign-In Callout */
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Authentication Required to Access Event Modules
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Please sign in to view and access your role-authorized operational workspaces.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Modules are dynamically displayed based on your assigned operator role (Data Entry, Verifier, Printer, Admin).
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md transition"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Your Workspace</span>
              </Link>
            </div>

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <p>
          Event ID Card Management System • Multi-Event Platform • Powered by Next.js & Supabase
        </p>
      </footer>
    </div>
  );
}
