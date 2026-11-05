# napisen 🔒

> Uçtan uca şifreli, yalnızca davetlilere açık, Android ve web'de çalışan mesajlaşma uygulaması.

---

## Güvenlik modeli

| Katman | Nasıl çalışır |
|---|---|
| **Giriş** | Google hesabı ile (Firebase Authentication). Google hesabınızda iki adımlı doğrulama açıksa o da devrededir. |
| **İzin listesi** | Sunucuda (`config/allowlist` belgesi) tutulur ve `firestore.rules` ile zorunlu kılınır. Listede olmayan bir hesap, giriş yapsa bile hiçbir veriye erişemez. |
| **Şifreleme** | Her cihaz kendi **ECDH P-256** anahtar çiftini üretir. Sohbet anahtarı `ECDH → HKDF-SHA256 → AES-GCM-256` ile türetilir. Özel anahtar cihazdan çıkmaz. Sunucu yalnızca şifreli veriyi görür. |
| **Kişi doğrulama** | Mesaj gönderebilmek için karşı tarafın anahtarı **yüz yüze QR okutarak** (veya 60 haneli güvenlik numarası karşılaştırılarak) doğrulanmalıdır. Anahtar değişirse gönderim otomatik durur ve uyarı çıkar. |
| **Sunucu kuralları** | Kimse başkası adına mesaj yazamaz, başkasının mesajını okuyamaz veya başkasının açık anahtarını değiştiremez. Kurallar `tests/rules.test.js` ile test edilir. |

### Gizlilik seçenekleri
* **Sunucuda Sakla** (varsayılan: kapalı): Kapalıyken mesaj teslim edildiği an sunucudan silinir. Açıkken şifreli kopya sunucuda kalır; yeni cihaza taşındığınızda geçmiş geri yüklenir.
* **Hayalet Mod** (varsayılan: kapalı): Açıkken mesajlar cihaz hafızasına yazılmaz, sayfa kapanınca kaybolur.

### Bilinen sınırlar
* Bir hesap aynı anda tek bir anahtarla çalışır. Yeni cihaza **taşıma** yapılırsa iki cihaz da aynı anahtarı kullanır; "Sunucuda Sakla" kapalıyken bir mesaj yalnızca onu ilk alan cihazda görünür.
* Uygulama tamamen kapalıyken bildirim gelmez (bunun için FCM ve bir sunucu fonksiyonu gerekir). Uygulama açık veya arka plandayken bildirim gelir.
* Kimin kime, ne zaman yazdığı ve medya boyutu sunucuda görünür; mesaj içeriği ve türü görünmez.

---

## Kurulum (bir kerelik, ~10 dakika)

### 1. Firebase projesi
1. [Firebase Console](https://console.firebase.google.com/) → **Proje ekle**.
2. **Authentication → Sign-in method → Google**'ı etkinleştirin.
3. **Authentication → Settings → Authorized domains** listesine uygulamayı yayınlayacağınız alan adını ekleyin (Firebase Hosting kullanırsanız otomatik eklenir).
4. **Firestore Database → Veritabanı oluştur** (*production mode* seçin; kuralları biz yükleyeceğiz).
5. **Proje ayarları → Web uygulaması ekle (</>)** ve verilen `firebaseConfig` değerlerini not edin.

### 2. Ortam değişkenleri
```bash
cp .env.example .env.local
```
`.env.local` dosyasına `firebaseConfig` değerlerini yazın. Bu değerler gizli değildir; güvenliği kurallar sağlar.

### 3. Güvenlik kurallarını yükleme
```bash
npx firebase login
```
```bash
npx firebase use --add
```
```bash
npm run deploy:rules
```

### 4. İzin listesini oluşturma (ilk yönetici)
Firebase Console → Firestore → **Koleksiyon başlat**:
* Koleksiyon kimliği: `config`
* Belge kimliği: `allowlist`
* Alanlar:
  * `emails` (array): izin verilecek tüm Gmail adresleri, **küçük harfle**
  * `admins` (array): listeyi uygulama içinden yönetebilecek adresler (ör. yalnızca siz)

Sonraki eklemeleri yönetici olarak uygulamanın **Ayarlar → İzin Listesi** bölümünden yapabilirsiniz.

### 5. Yayınlama
```bash
npm install
```
```bash
npm run deploy
```
Firebase Hosting kullanmak istemezseniz `npm run build` ile oluşan `dist/` klasörünü HTTPS destekleyen herhangi bir statik barındırmaya koyabilirsiniz (kamera ve bildirimler için HTTPS zorunludur).

---

## Kullanım

1. **İlk giriş:** Google ile giriş yapın. Uygulama bu cihaz için şifreleme anahtarınızı otomatik oluşturur.
2. **Kişiyi doğrulama (yüz yüze, bir kez):** Sohbeti açın → başlıktaki *Doğrulanmadı* yazısına dokunun.
   * Bir kişi **Kodum** sekmesindeki QR'ı gösterir, diğeri **Kodu okut** sekmesinden okutur.
   * Sonra roller değişir. **İki taraf da** okutmalıdır.
   * Yüz yüze değilseniz **Güvenlik no.** sekmesindeki 60 haneli numarayı telefonda sesli karşılaştırabilirsiniz.
3. **Yeni telefona geçiş:** Yeni cihazda giriş yapın → *Eski cihazımdan taşı*. Eski cihazda **Ayarlar → Güvenlik → Yeni cihazın kodunu okut** ile ekrandaki QR'ı okutun. Anahtarınız ve doğrulamalarınız şifreli olarak aktarılır; kişilerinizin yeniden doğrulama yapması gerekmez.
4. **Android'e yükleme (PWA):** Chrome'da açın → ⋮ menü → **Uygulamayı yükle**.

---

## Geliştirme

### Yerel emülatörle (Firebase hesabı gerekmez)
```bash
npm run dev:emulators
```
Başka bir terminalde izin listesini yazın (ilk adres yönetici olur):
```bash
npm run seed:emulator -- siz@gmail.com arkadas@gmail.com
```
```bash
npm run dev:local
```
`http://localhost:3000` açılır. Google giriş penceresinde emülatörün sahte hesap ekranı çıkar; izin listesindeki bir adresi yazarak giriş yapın. İki kullanıcıyı denemek için ikinci bir gizli pencere açın. Emülatör arayüzü: `http://localhost:4000`.

### Testler
```bash
npm test
```
```bash
npm run test:rules
```
* `tests/crypto.test.js`: şifreleme, güvenlik numarası ve cihaz taşıma
* `tests/rules.test.js`: Firestore güvenlik kuralları (emülatörde çalışır, Java gerektirir)

### Proje yapısı
```
firestore.rules            Sunucu tarafı güvenlik kuralları
src/services/crypto.js     ECDH/HKDF/AES-GCM, güvenlik numarası, QR kodları, cihaz taşıma
src/services/firebase.js   Google girişi, izin listesi, mesaj kuyruğu, parçalı medya
src/services/db.js         IndexedDB: anahtar, doğrulanmış kişiler, mesaj geçmişi
src/hooks/useIdentity.js   Cihaz anahtarı kurulumu ve taşıma
src/hooks/useMessenger.js  Gönderme/alma, teslim durumu, tekrarları önleme
public/sw.js               PWA service worker (yalnızca uygulama kabuğunu önbelleğe alır)
```
