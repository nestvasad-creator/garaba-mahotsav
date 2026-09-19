'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  ArrowLeft,
  Shield,
  Search,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserX,
} from 'lucide-react';
import { listAllUsers, createSystemUser, updateUserRole, toggleUserActiveStatus, getCurrentUserSession, UserRoleRecord } from '@/lib/auth/actions';
import { RoleAccessGate } from '@/components/auth/RoleAccessGate';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserRoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Nest@2026');
  const [newNameEn, setNewNameEn] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newRole, setNewRole] = useState('DATA_ENTRY_OPERATOR');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const sess = await getCurrentUserSession();
      setCurrentUserRole(sess?.roleCode);
      const data = await listAllUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await createSystemUser({
        email: newEmail,
        password: newPassword,
        fullNameEn: newNameEn,
        fullNameGu: newNameEn,
        mobile: newMobile,
        roleCode: newRole,
      });

      if (!res.success) {
        setFeedback(`Error: ${res.error}`);
        setSubmitting(false);
        return;
      }

      setFeedback(`User ${newEmail} created and assigned role ${newRole}!`);
      setShowAddModal(false);
      setNewEmail('');
      setNewNameEn('');
      setNewMobile('');
      await fetchUsers();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRoleCode: string) => {
    try {
      const res = await updateUserRole(userId, newRoleCode);
      if (res.success) {
        setFeedback(`Role updated to ${newRoleCode}`);
        await fetchUsers();
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean, userName: string) => {
    try {
      const res = await toggleUserActiveStatus(userId, currentStatus);
      if (res.success) {
        setFeedback(`User ${userName} is now ${res.isActive ? 'Active' : 'Suspended'}`);
        await fetchUsers();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback(`Failed to update status: ${res.error}`);
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(`Error: ${err.message}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullNameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.mobile && u.mobile.includes(searchTerm));

    const matchesRole = roleFilter === 'ALL' || u.roleCode === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (code: string) => {
    switch (code) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'EVENT_ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'VERIFIER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'SPECIAL_ID_OPERATOR':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'PRINTER_OPERATOR':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'SECURITY':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Verifying administrator privileges...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleAccessGate
      currentRoleCode={currentUserRole}
      allowedRoles={['SUPER_ADMIN', 'EVENT_ADMIN']}
      moduleNameEn="Admin User Management"
      moduleNameGu="User Management & Role Control"
    >
      <div className="min-h-screen bg-slate-100 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              User Management & Role Assignment
            </h1>
            <p className="text-xs text-slate-500">
              System operators, access control, and role assignments (NEST Vasad)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            className="p-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            Add New User
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">
        {feedback && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {feedback}
          </div>
        )}

        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Total Accounts
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{users.length}</div>
            <span className="text-[10px] text-slate-500">Active system users</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Super & Event Admins
            </span>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {users.filter((u) => u.roleCode === 'SUPER_ADMIN' || u.roleCode === 'EVENT_ADMIN').length}
            </div>
            <span className="text-[10px] text-purple-700 font-semibold">System Administrators</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Verifiers (Maker-Checker)
            </span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {users.filter((u) => u.roleCode === 'VERIFIER').length}
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold">Document Reviewers</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Operators & Security
            </span>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {users.filter((u) => ['DATA_ENTRY_OPERATOR', 'SPECIAL_ID_OPERATOR', 'PRINTER_OPERATOR', 'SECURITY'].includes(u.roleCode)).length}
            </div>
            <span className="text-[10px] text-blue-700 font-semibold">DEO / Print / Gate</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, email, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Shield className="w-4 h-4 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Administrator</option>
              <option value="EVENT_ADMIN">Event Administrator</option>
              <option value="VERIFIER">Verifier</option>
              <option value="DATA_ENTRY_OPERATOR">Data Entry Operator</option>
              <option value="SPECIAL_ID_OPERATOR">Special ID Operator</option>
              <option value="PRINTER_OPERATOR">Printer Operator</option>
              <option value="SECURITY">Security Gatekeeper</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Change Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {loading ? 'Loading users...' : 'No users found matching filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/75 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {u.fullNameEn}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 flex items-center gap-1.5 mt-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {u.email}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {u.mobile ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {u.mobile}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${getRoleBadge(u.roleCode)}`}>
                          {u.roleCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u.id, u.isActive, u.fullNameEn)}
                          title={u.isActive ? 'Click to suspend user account' : 'Click to activate user account'}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition hover:opacity-80 cursor-pointer ${
                            u.isActive
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200'
                          }`}
                        >
                          {u.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3 text-rose-600" /> Suspended
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(u.createdAt).toISOString().split('T')[0]}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <select
                          value={u.roleCode}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="text-[11px] font-semibold rounded-lg border border-slate-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="EVENT_ADMIN">Event Admin</option>
                          <option value="VERIFIER">Verifier</option>
                          <option value="DATA_ENTRY_OPERATOR">Data Entry</option>
                          <option value="SPECIAL_ID_OPERATOR">Special ID</option>
                          <option value="PRINTER_OPERATOR">Printer Op</option>
                          <option value="SECURITY">Security</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                Add & Invite System Operator
              </h3>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vijaysinh Chavda"
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@nestvasad.org"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={newMobile}
                    onChange={(e) => setNewMobile(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign System Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DATA_ENTRY_OPERATOR">Data Entry Operator (DEO)</option>
                  <option value="VERIFIER">Document Verifier (Maker-Checker)</option>
                  <option value="SPECIAL_ID_OPERATOR">Special ID Operator (VIP / Guest Passes)</option>
                  <option value="PRINTER_OPERATOR">Printer Operator (CR80 Print Queue)</option>
                  <option value="SECURITY">Security Gatekeeper (Mobile QR Scanner)</option>
                  <option value="EVENT_ADMIN">Event Administrator</option>
                  <option value="SUPER_ADMIN">Super Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Temporary Password
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 font-mono"
                />
                <span className="text-[10px] text-slate-400">User can change after logging in</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create & Assign Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </RoleAccessGate>
  );
}
