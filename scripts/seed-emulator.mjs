// Yerel emülatöre izin listesini yazar.
// Kullanım: node scripts/seed-emulator.mjs yonetici@gmail.com kisi2@gmail.com ...
// (İlk e-posta yönetici olur.)
const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
if (emails.length === 0) {
  console.error('Kullanım: node scripts/seed-emulator.mjs yonetici@gmail.com [diğer e-postalar...]');
  process.exit(1);
}
const url =
  'http://127.0.0.1:8080/v1/projects/demo-napisen/databases/(default)/documents/config/allowlist';
const arr = (list) => ({ arrayValue: { values: list.map((stringValue) => ({ stringValue })) } });
const res = await fetch(url, {
  method: 'PATCH',
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { emails: arr(emails), admins: arr([emails[0]]) } }),
});
if (!res.ok) {
  console.error('Yazılamadı. Emülatör çalışıyor mu? (npm run dev:emulators)', await res.text());
  process.exit(1);
}
console.log(`✓ İzin listesi yazıldı. Yönetici: ${emails[0]}  Toplam: ${emails.length}`);
