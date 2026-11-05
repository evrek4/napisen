// Yerel emülatöre izin listesini yazar (allowlist/{email} belgeleri).
// Kullanım: node scripts/seed-emulator.mjs kisi1@gmail.com kisi2@gmail.com ...
// Not: firestore.rules içindeki owner() adresi her zaman izinli ve yöneticidir.
const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
if (emails.length === 0) {
  console.error('Kullanım: node scripts/seed-emulator.mjs kisi1@gmail.com [diğer e-postalar...]');
  process.exit(1);
}
const base = 'http://127.0.0.1:8080/v1/projects/demo-napisen/databases/(default)/documents/allowlist';
for (const email of emails) {
  const res = await fetch(`${base}/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        admin: { booleanValue: false },
        addedBy: { stringValue: 'seed' },
        addedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) {
    console.error('Yazılamadı. Emülatör çalışıyor mu? (npm run dev:emulators)', await res.text());
    process.exit(1);
  }
}
console.log(`✓ ${emails.length} adres izin listesine eklendi.`);
