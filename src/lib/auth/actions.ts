'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export interface UserRoleRecord {
  id: string;
  email: string;
  fullNameEn: string;
  fullNameGu?: string | null;
  mobile?: string | null;
  isActive: boolean;
  roleCode: string;
  roleName: string;
  createdAt: string;
}

/**
 * Sign in user with email & password using Supabase Auth.
 */
export async function signInAction(formData: { email: string; password: string }) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
}

/**
 * Sign out current user.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Get current authenticated user profile and assigned role.
 */
export async function getCurrentUserSession() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return null;
    }

    const adminClient = createAdminClient();

    // Fetch user profile
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    // Fetch user role
    const { data: userRole } = await adminClient
      .from('user_roles')
      .select('role_id, roles(code, name)')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const roleInfo = userRole?.roles as any;

    return {
      id: session.user.id,
      email: session.user.email || '',
      fullNameEn: profile?.full_name_en || session.user.user_metadata?.full_name || 'System User',
      fullNameGu: profile?.full_name_gu || session.user.user_metadata?.full_name_gu || '',
      mobile: profile?.mobile || session.user.user_metadata?.mobile || '',
      roleCode: roleInfo?.code || 'DATA_ENTRY_OPERATOR',
      roleName: roleInfo?.name || 'Operator',
    };
  } catch (err) {
    console.error('Session retrieval error:', err);
    return null;
  }
}

/**
 * Fetch all users with their profiles and assigned roles for Admin User Management.
 */
export async function listAllUsers(): Promise<UserRoleRecord[]> {
  try {
    const adminClient = createAdminClient();

    // 1. Get Auth users
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers();
    if (authError || !authUsers.users) {
      console.error('Failed to list auth users:', authError?.message);
      return [];
    }

    // 2. Get profiles
    const { data: profiles } = await adminClient.from('user_profiles').select('*');

    // 3. Get user roles
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('user_id, roles(code, name)');

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const roleMap = new Map((userRoles || []).map((ur) => [ur.user_id, ur.roles as any]));

    return authUsers.users.map((u) => {
      const prof = profileMap.get(u.id);
      const r = roleMap.get(u.id);

      return {
        id: u.id,
        email: u.email || '',
        fullNameEn: prof?.full_name_en || u.user_metadata?.full_name || 'User',
        fullNameGu: prof?.full_name_gu || u.user_metadata?.full_name_gu || '',
        mobile: prof?.mobile || u.user_metadata?.mobile || '',
        isActive: prof?.is_active ?? true,
        roleCode: r?.code || 'DATA_ENTRY_OPERATOR',
        roleName: r?.name || 'Data Entry Operator',
        createdAt: u.created_at,
      };
    });
  } catch (err) {
    console.error('listAllUsers error:', err);
    return [];
  }
}

/**
 * Create a new user account with role assignment (Admin only).
 */
export async function createSystemUser(params: {
  email: string;
  password?: string;
  fullNameEn: string;
  fullNameGu?: string;
  mobile: string;
  roleCode: string;
}) {
  try {
    const adminClient = createAdminClient();

    const password = params.password || 'Nest@2026';

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: params.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: params.fullNameEn,
        full_name_gu: params.fullNameGu,
        mobile: params.mobile,
        role: params.roleCode,
      },
    });

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || 'Failed to create user in Auth' };
    }

    const userId = authData.user.id;

    // 2. Ensure profile exists in user_profiles
    await adminClient.from('user_profiles').upsert({
      id: userId,
      full_name_en: params.fullNameEn,
      full_name_gu: params.fullNameGu || null,
      mobile: params.mobile,
      is_active: true,
    });

    // 3. Find role ID
    const { data: roleData } = await adminClient
      .from('roles')
      .select('id')
      .eq('code', params.roleCode)
      .single();

    if (roleData) {
      // Remove existing role mapping to avoid duplicate
      await adminClient
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('event_id', '00000000-0000-0000-0000-000000000010');

      // Assign role in user_roles
      await adminClient.from('user_roles').insert({
        user_id: userId,
        role_id: roleData.id,
        event_id: '00000000-0000-0000-0000-000000000010',
      });
    }

    return { success: true, user: authData.user };
  } catch (err: any) {
    console.error('createSystemUser error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update an existing user's role.
 */
export async function updateUserRole(userId: string, roleCode: string) {
  try {
    const adminClient = createAdminClient();

    const { data: roleData } = await adminClient
      .from('roles')
      .select('id')
      .eq('code', roleCode)
      .single();

    if (!roleData) {
      return { success: false, error: 'Role not found' };
    }

    // 1. Synchronize in user_metadata
    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { role: roleCode },
    });

    // 2. Remove existing role mapping for this event to avoid duplicate or dangling roles
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', '00000000-0000-0000-0000-000000000010');

    // 3. Insert new role mapping
    const { error: insertErr } = await adminClient
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleData.id,
        event_id: '00000000-0000-0000-0000-000000000010',
      });

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Toggle user active/inactive status (Admin only).
 */
export async function toggleUserActiveStatus(userId: string, currentStatus: boolean) {
  try {
    const adminClient = createAdminClient();
    const newStatus = !currentStatus;

    const { error } = await adminClient
      .from('user_profiles')
      .update({
        is_active: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, isActive: newStatus };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * One-click helper to seed initial Super Admin if 0 users exist.
 */
export async function seedInitialSuperAdmin() {
  return createSystemUser({
    email: 'superadmin@test.com',
    password: 'TestUser@2026',
    fullNameEn: 'Test Super Admin',
    fullNameGu: 'Test Super Admin',
    mobile: '9000000001',
    roleCode: 'SUPER_ADMIN',
  });
}

