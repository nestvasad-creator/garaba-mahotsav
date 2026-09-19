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
const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Checking Supabase Storage buckets...');
  const { data: buckets, error } = await adminClient.storage.listBuckets();
  console.log('Buckets list:', buckets?.map(b => ({ id: b.id, name: b.name, public: b.public })), 'Error:', error?.message);

  const required = ['event-photos', 'event-identity-documents', 'event-public-assets'];
  for (const r of required) {
    const found = buckets?.some(b => b.id === r);
    if (!found) {
      console.log(`Bucket ${r} not found, creating...`);
      const { data, error: cErr } = await adminClient.storage.createBucket(r, {
        public: r === 'event-public-assets',
        fileSizeLimit: 10485760, // 10MB
      });
      console.log(`Bucket ${r} creation result:`, data, cErr?.message);
    } else {
      console.log(`Bucket ${r} exists.`);
    }
  }

  // Test uploading a tiny sample image file and creating signed URL
  const testBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const { data: uploadData, error: upErr } = await adminClient.storage
    .from('event-identity-documents')
    .upload('test/test_doc.png', testBuffer, { upsert: true, contentType: 'image/png' });
  console.log('Test doc upload:', uploadData, 'Error:', upErr?.message);

  const { data: signedData, error: signErr } = await adminClient.storage
    .from('event-identity-documents')
    .createSignedUrl('test/test_doc.png', 300);
  console.log('Signed URL (300s expiry):', signedData?.signedUrl ? 'SUCCESS' : 'FAILED', 'URL:', signedData?.signedUrl?.slice(0, 60) + '...', 'Error:', signErr?.message);
}

main().catch(console.error);
