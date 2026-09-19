import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

const client = createClient(url, key);

async function run() {
  const { data: regs, error } = await client
    .from('registrations')
    .select('id, registration_number, full_name_en, status, created_by, verified_by, verified_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching registrations:', error);
    return;
  }

  console.log(`Total registrations: ${regs?.length}`);
  const statusCounts = {};
  for (const r of regs || []) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }
  console.log('Status counts:', statusCounts);
  console.log('Recent 5 registrations:', regs?.slice(0, 5));

  const { data: cards } = await client.from('id_cards').select('id, registration_id, card_number, status, is_active');
  console.log(`Total ID cards: ${cards?.length}`);
  const cardStatuses = {};
  for (const c of cards || []) {
    cardStatuses[c.status] = (cardStatuses[c.status] || 0) + 1;
  }
  console.log('Card status counts:', cardStatuses);
}

run();
