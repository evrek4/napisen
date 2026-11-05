# napisen 🔒

> Uçtan uca şifreli, Android ve web'de çalışan mesajlaşma uygulaması.

---

## Güvenlik modeli

| Katman | Nasıl çalışır |
|---|---|
| **Giriş** | Google hesabı ile (Firebase Authentication). Google hesabınızda iki adımlı doğrulama açıksa o da devrededir. |
| **Üyelik** | Herkes Google hesabıyla üye olabilir. Kayıtta Kullanım Koşulları, Gizlilik Politikası/KVKK Aydınlatma Metni ve yaş (13+) onayı zorunludur; onay tarihi ve sürümü sunucuda saklanır. |
| **Roller** | `achartave@gmail.com` admindir (`firestore.rules` → `owner()`). Admin, **Ayarlar → Yetkiler** bölümünden istediği kişiye moderatör yetkisi verir. Moderatörler şikâyetleri inceler ve hesapları askıya alabilir; mesaj içeriklerini göremezler. |
| **Engelleme ve şikâyet** | Sohbet menüsünden kişi engellenir (sunucu engellenen kişinin mesajını reddeder) veya şikâyet edilir. Şikâyet eden isterse karşı taraftan gelen son 10 mesajı delil olarak ekler. |
| **Kişi bulma** | Kullanıcılar birbirini listeleyemez. Herkesin 8 karakterlik bir **kişi kodu** vardır (ör. `7K3Q-9XW2`); kodu bilen kişi size yazabilir. Kod istendiğinde yenilenebilir. **E-postayla bulunmak isteğe bağlıdır** (varsayılan: kapalı); kapalıyken bir adresin kayıtlı olup olmadığı bile anlaşılamaz. |
| **Şifreleme** | Her cihaz kendi **ECDH P-256** anahtar çiftini üretir. Sohbet anahtarı `ECDH → HKDF-SHA256 → AES-GCM-256` ile türetilir. Özel anahtar cihazdan çıkmaz. Sunucu yalnızca şifreli veriyi görür. |
| **Kişi doğrulama (isteğe bağlı)** | Karşı tarafın anahtarı ilk görüşte kaydedilir. Ekstra güvenlik için **yüz yüze QR okutarak** veya 60 haneli güvenlik numarasını karşılaştırarak doğrulayabilirsiniz. Anahtar sonradan değişirse gönderim durur; siz onaylayana kadar mesaj gitmez. |
| **Sunucu kuralları** | Kimse başkası adına mesaj yazamaz, başkasının mesajını okuyamaz veya başkasının açık anahtarını değiştiremez. Kurallar `tests/rules.test.js` ile test edilir. |

### Gizlilik seçenekleri
* **E-posta adresimle bulunabilirim** (varsayılan: kapalı): Açıkken e-postanızı bilen izinli kullanıcılar da sizi bulabilir.
* **Sunucuda Sakla** (varsayılan: kapalı): Kapalıyken mesaj teslim edildiği an sunucudan silinir. Açıkken şifreli kopya sunucuda kalır; yeni cihaza taşındığınızda geçmiş geri yüklenir.
* **Hayalet Mod** (varsayılan: kapalı): Açıkken mesajlar cihaz hafızasına yazılmaz, sayfa kapanınca kaybolur.

### Yasal metinler
* `/kullanim-kosullari` ve `/gizlilik` adreslerinden giriş yapmadan erişilebilir (Google Play için gizlilik politikası URL'si: `https://napisen-a7f4a.web.app/gizlilik`).
* Metinler `src/legal/texts.js`, veri sorumlusu bilgileri `src/config/app.js` içindedir. **Yayından önce veri sorumlusunun gerçek ad/unvan ve adresini girin ve metinleri bir hukukçuya kontrol ettirin.**
* Metinleri değiştirdiğinizde `TERMS_VERSION` değerini güncelleyin; kullanıcılardan yeniden onay istenir.
* Kullanıcılar hesaplarını **Ayarlar → Hesap → Hesabımı sil** ile silebilir (KVKK ve Google Play gereği).

### Bilinen sınırlar
* Bir hesap aynı anda tek bir anahtarla çalışır. Yeni cihaza **taşıma** yapılırsa iki cihaz da aynı anahtarı kullanır; "Sunucuda Sakla" kapalıyken bir mesaj yalnızca onu ilk alan cihazda görünür.
* Uygulama tamamen kapalıyken bildirim gelmez (bunun için FCM ve bir sunucu fonksiyonu gerekir). Uygulama açık veya arka plandayken bildirim gelir.
* Kimin kime, ne zaman yazdığı ve medya boyutu sunucuda görünür; mesaj içeriği ve türü görünmez.
* Bir kişiyle yazıştığınızda onun uygulaması e-posta adresinizi teknik olarak bilir (mesajlar e-posta üzerinden yönlendirilir); arayüzde gösterilmez.

---

## Kurulum (bir kerelik, ~10 dakika)

### 1. Firebase projesi
1. [Firebase Console](https://console.firebase.google.com/) → **Proje ekle**.
2. **Authentication → Sign-in method → Google**'ı etkinleştirin.
3. **Authentication → Settings → Authorized domains** listesine uygulamayı yayınlayacağınız alan adını ekleyin (Firebase Hosting kullanırsanız otomatik eklenir).
4. **Firestore Database → Veritabanı oluştur** (*production mode* seçin; kuralları biz yükleyeceğiz).
5. **Proje ayarları → Web uygulaması ekle (</>)** ve verilen `firebaseConfig` değerlerini not edin.

### 2. Ortam değişkenleri
Bu depo `napisen-a7f4a` projesine bağlıdır (`.env.production`, `.env.development`, `.firebaserc`).
Başka bir Firebase projesi kullanacaksanız bu dosyalardaki değerleri kendi `firebaseConfig` değerlerinizle değiştirin.
Bu değerler gizli değildir; güvenliği kurallar sağlar.

### 3. Güvenlik kurallarını yükleme
```bash
npx firebase login
```
```bash
npm run deploy:rules
```

### 4. Admin
Konsolda belge oluşturmanız **gerekmez**. Admin adresi iki yerde tanımlıdır ve aynı olmalıdır: `firestore.rules` → `owner()` ve `src/config/app.js` → `OWNER_EMAIL` (şu an `achartave@gmail.com`).

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

1. **Üyelik:** Google ile giriş yapın ve koşulları onaylayın. Uygulama bu cihaz için şifreleme anahtarınızı ve kişi kodunuzu otomatik oluşturur. Kodunuz sol üstte, adınızın altında görünür (dokununca kopyalanır).
2. **Sohbet başlatma:** Sol üstteki **Yeni sohbet** simgesine dokunun ve karşı tarafın kişi kodunu girin. Karşı taraf e-postayla bulunmayı açtıysa e-posta adresini de yazabilirsiniz. Size ilk mesajı atan kişi listenize otomatik eklenir.
3. **İsteğe bağlı doğrulama:** Sohbet başlığındaki *Şifreli · doğrula* yazısına dokunun.
   * Bir kişi **Kodum** sekmesindeki QR'ı gösterir, diğeri **Kodu okut** sekmesinden okutur. Sonra roller değişir.
   * Yüz yüze değilseniz **Güvenlik no.** sekmesindeki 60 haneli numarayı telefonda sesli karşılaştırabilirsiniz.
4. **Yeni telefona geçiş:** Yeni cihazda giriş yapın → *Eski cihazımdan taşı*. Eski cihazda **Ayarlar → Güvenlik → Yeni cihazın kodunu okut** ile ekrandaki QR'ı okutun. Anahtarınız ve doğrulamalarınız şifreli olarak aktarılır; kişilerinizin yeniden doğrulama yapması gerekmez.
5. **Android'e yükleme (PWA):** Chrome'da açın → ⋮ menü → **Uygulamayı yükle**.

---

## Geliştirme

### Yerel emülatörle (Firebase hesabı gerekmez)
```bash
npm run dev:emulators
```
Başka bir terminalde:
```bash
npm run dev:local
```
`http://localhost:3000` açılır. Google giriş penceresinde emülatörün sahte hesap ekranı çıkar; herhangi bir adresle giriş yapın (admin olarak denemek için `achartave@gmail.com`). İki kullanıcıyı denemek için ikinci bir gizli pencere açın. Emülatör arayüzü: `http://localhost:4000`.

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
