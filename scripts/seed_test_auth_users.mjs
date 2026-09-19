import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const lines = fs.readFileSync('.env.local', 'utf-8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
}

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_USERS = [
  {
    email: 'superadmin@test.com',
    fullName: 'Test Super Admin',
    mobile: '9000000001',
    roleCode: 'SUPER_ADMIN',
  },
  {
    email: 'admin@test.com',
    fullName: 'Test Event Admin',
    mobile: '9000000002',
    roleCode: 'EVENT_ADMIN',
  },
  {
    email: 'verifier@test.com',
    fullName: 'Test Verifier',
    mobile: '9000000003',
    roleCode: 'VERIFIER',
  },
  {
    email: 'deo@test.com',
    fullName: 'Test Data Entry Operator',
    mobile: '9000000004',
    roleCode: 'DATA_ENTRY_OPERATOR',
  },
  {
    email: 'specialid@test.com',
    fullName: 'Test Special ID Operator',
    mobile: '9000000005',
    roleCode: 'SPECIAL_ID_OPERATOR',
  },
  {
    email: 'printer@test.com',
    fullName: 'Test Printer Operator',
    mobile: '9000000006',
    roleCode: 'PRINTER_OPERATOR',
  },
  {
    email: 'security@test.com',
    fullName: 'Test Security Officer',
    mobile: '9000000007',
    roleCode: 'SECURITY',
  },
];

const SHARED_PASSWORD = 'TestUser@2026';
const EVENT_ID = '00000000-0000-0000-0000-000000000010';

async function seed() {
  console.log('🚀 Seeding 7 Test User Accounts in Supabase Auth & RBAC...');
  console.log('Target Supabase:', env.NEXT_PUBLIC_SUPABASE_URL);

  // Fetch all existing roles
  const { data: roles, error: rolesErr } = await adminClient.from('roles').select('id, code');
  if (rolesErr) {
    console.error('Error fetching roles from public.roles:', rolesErr.message);
  }
  const roleMap = {};
  roles?.forEach((r) => {
    roleMap[r.code] = r.id;
  });

  // Fetch existing auth users to avoid duplicates
  const { data: existingAuth, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing existing auth users:', listErr.message);
  }
  const existingByEmail = {};
  existingAuth?.users?.forEach((u) => {
    if (u.email) existingByEmail[u.email.toLowerCase()] = u;
  });

  for (const user of TEST_USERS) {
    let userId = null;
    const existing = existingByEmail[user.email.toLowerCase()];

    if (existing) {
      userId = existing.id;
      console.log(`\n🔹 Found existing auth user: ${user.email} (ID: ${userId})`);
      // Update password and confirm email
      const { error: updErr } = await adminClient.auth.admin.updateUserById(userId, {
        password: SHARED_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
          role: user.roleCode,
        },
      });
      if (updErr) {
        console.error(`   ⚠️ Failed to update auth user ${user.email}:`, updErr.message);
      } else {
        console.log(`   ✅ Auth password & metadata updated for ${user.email}`);
      }
    } else {
      console.log(`\n➕ Creating new auth user: ${user.email}`);
      const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
        email: user.email,
        password: SHARED_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
          role: user.roleCode,
        },
      });

      if (createErr) {
        console.error(`   ❌ Failed to create auth user ${user.email}:`, createErr.message);
        continue;
      }
      userId = createData.user.id;
      console.log(`   ✅ Auth user created successfully (ID: ${userId})`);
    }

    if (!userId) continue;

    // 2. Upsert into public.user_profiles
    const { error: profErr } = await adminClient.from('user_profiles').upsert(
      {
        id: userId,
        full_name_en: user.fullName,
        full_name_gu: user.fullName,
        mobile: user.mobile,
        is_active: true,
      },
      { onConflict: 'id' }
    );

    if (profErr) {
      console.error(`   ⚠️ Profile upsert error for ${user.email}:`, profErr.message);
    } else {
      console.log(`   ✅ Profile linked in public.user_profiles`);
    }

    // 3. Link Role in public.user_roles
    const roleId = roleMap[user.roleCode];
    if (roleId) {
      // Remove any prior role assignment
      await adminClient.from('user_roles').delete().eq('user_id', userId);

      const { error: roleErr } = await adminClient.from('user_roles').insert({
        user_id: userId,
        role_id: roleId,
        event_id: EVENT_ID,
      });

      if (roleErr) {
        console.error(`   ⚠️ Role assignment error for ${user.roleCode}:`, roleErr.message);
      } else {
        console.log(`   ✅ Assigned Role: ${user.roleCode}`);
      }
    } else {
      console.log(`   ℹ️ Role code ${user.roleCode} not found in public.roles yet.`);
    }
  }

  console.log('\n======================================================');
  console.log('🎉 All 7 test auth accounts are now active and ready!');
  console.log('Shared Password:', SHARED_PASSWORD);
  console.log('======================================================\n');
}

seed().catch(console.error);
