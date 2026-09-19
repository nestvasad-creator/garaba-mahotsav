import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const lines = fs.readFileSync('.env.local', 'utf-8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const DEFAULT_EVENT_ID = '00000000-0000-0000-0000-000000000010';
const DEFAULT_CATEGORY_ID = '10000000-0000-0000-0000-000000000001';

async function seed() {
  const { data: op } = await adminClient
    .from('user_profiles')
    .select('id')
    .eq('mobile', '9876543211')
    .single();

  const operatorId = op?.id || '602824a3-04ff-4a12-9da9-9768ef70cf91';

  // Seed 1: Female participant (Pink Theme)
  const reg1Number = `NEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const { data: reg1 } = await adminClient
    .from('registrations')
    .insert({
      event_id: DEFAULT_EVENT_ID,
      category_id: DEFAULT_CATEGORY_ID,
      registration_number: reg1Number,
      full_name_en: 'Pooja Sanjaybhai Shah',
      full_name_gu: 'પૂજા સંજયભાઈ શાહ',
      father_husband_name_en: 'Sanjaybhai Shah',
      father_husband_name_gu: 'સંજયભાઈ શાહ',
      gender: 'FEMALE',
      dob: '1998-09-22',
      mobile: '9825100001',
      address_en: 'B-202, Gokul Heights, Vasad',
      address_gu: 'બી-૨૦૨, ગોકુલ હાઈટ્સ, વાસદ',
      city: 'Vasad',
      state: 'Gujarat',
      pincode: '388306',
      area_zone: 'North Zone / ઉત્તર ઝોન',
      status: 'SUBMITTED',
      created_by: operatorId,
    })
    .select()
    .single();

  // Seed 2: Male participant (Blue Theme)
  const reg2Number = `NEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const { data: reg2 } = await adminClient
    .from('registrations')
    .insert({
      event_id: DEFAULT_EVENT_ID,
      category_id: DEFAULT_CATEGORY_ID,
      registration_number: reg2Number,
      full_name_en: 'Amit Kiritkumar Joshi',
      full_name_gu: 'અમિત કિરીટકુમાર જોશી',
      father_husband_name_en: 'Kiritkumar Joshi',
      father_husband_name_gu: 'કિરીટકુમાર જોશી',
      gender: 'MALE',
      dob: '1992-11-05',
      mobile: '9825100002',
      address_en: '15, Station Road, Vasad',
      address_gu: '૧૫, સ્ટેશન રોડ, વાસદ',
      city: 'Vasad',
      state: 'Gujarat',
      pincode: '388306',
      area_zone: 'Station Area / સ્ટેશન વિસ્તાર',
      status: 'SUBMITTED',
      created_by: operatorId,
    })
    .select()
    .single();

  console.log(`Seeded pending records: ${reg1Number} (Female, Pink), ${reg2Number} (Male, Blue)`);
}

seed();
