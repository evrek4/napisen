# napisen 🔒
> **Uçtan Uca Şifreli (E2EE), Sıfır Sunucu Depolamalı, Özel İzin Listeli Mesajlaşma Uygulaması**

---

## 🌟 Temel Özellikler

1. **Özel İzin Listesi (Whitelist):**
   * Yalnızca belirlenen e-posta adresleri sisteme dahil olabilir.
   * Tanımlı Varsayılan Adresler:
     - `fthtrgl@gmail.com`
     - `mehmetbacar@gmail.com`
     - `urfahibe@gmail.com`
   * Yetkisiz hiçbir e-posta adresi uygulamaya giriş yapamaz.

2. **Gelişmiş Depolama ve Gizlilik Seçenekleri:**
   * **Sunucuda Sakla (İsteğe Bağlı):**
     - *Kapalıyken (Varsayılan):* Mesaj karşı tarafa ulaştığı an Google Firebase'den kalıcı olarak silinir (**0 Bayt depolama**).
     - *Açıkken:* Uçtan uca şifreli mesajlar sunucuda tutulur, böylece başka bir cihazdan giriş yapıldığında sohbetler geri yüklenebilir.
   * **Yazılar Cihazda Tutulmasın (Hayalet Mod):**
     - *Kapalıyken (Varsayılan):* Sohbet geçmişi kullanıcının telefonunun/bilgisayarının kendi yerel hafızasında (IndexedDB) saklanır.
     - *Açıkken:* Yazışmalar cihaza **kesinlikle kaydedilmez**. Yalnızca aktif oturumda görünür; uygulama veya sekme kapatıldığında cihazdan iz bırakmadan silinir.
   * *Not:* Bu iki seçeneği hem sağ üstteki **Ayarlar (⚙️) -> Gizlilik Seçenekleri** sekmesinden hem de doğrudan sohbet başlığındaki hızlı butonlardan tek tıkla değiştirebilirsiniz.

3. **Android ve Web Desteği:**
   * Hem bilgisayar tarayıcısında (WhatsApp Web gibi) hem de Android cihazlarda çalışır.
   * **PWA (Progressive Web App):** Android telefonda Chrome ile açıp *"Ana Ekrana Ekle"* dendiğinde tam ekran, bildirim destekli, native benzeri bir mobil uygulama haline gelir.

4. **Zengin İletişim:**
   * Canlı ses kaydı (süreli mikrofon kaydı, dinleme ve gönderme).
   * Fotoğraf / görsel gönderme ve tam ekran görüntüleyici.
   * İletim durumu tikleri (Tek tik: Gönderildi, Çift tik: Teslim edildi).

---

## 🚀 Hızlı Başlangıç

### 1. Geliştirme Sunucusunu Başlatma:
```bash
npm run dev
```
Uygulama `http://localhost:3000` adresinde açılır.

### 2. İki Farklı Kullanıcı Gibi Anında Test Etme:
1. Birinci tarayıcı sekmesini açın ve `fthtrgl@gmail.com` ile giriş yapın.
2. İkinci bir gizli sekme veya farklı bir pencere açın ve `mehmetbacar@gmail.com` ile giriş yapın.
3. Uygulamanın dahili **Mesh Köprüsü (BroadcastChannel)** sayesinde Firebase hesabı bağlamadan bile sekmeler arası canlı, uçtan uca şifreli mesaj, ses kaydı ve fotoğraf gönderimini anında test edebilirsiniz!

---

## ☁️ Google Firebase (Ücretsiz Spark Planı) Kurulumu

Canlı ortamda iki farklı telefon/bilgisayar arasında kullanmak için tamamen ücretsiz Google Firebase hesabınızı 2 dakikada bağlayabilirsiniz:

1. [Google Firebase Console](https://console.firebase.google.com/) adresine gidin ve **"Proje Ekle"** butonuna tıklayın (Adını örneğin `napisen` yapın).
2. **Firestore Database** sekmesine girip veritabanını oluşturun (Test modunda başlatabilirsiniz).
3. Firestore Güvenlik Kurallarına (Rules) aşağıdaki kuralı yapıştırın:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /temp_queue/{messageId} {
         // Yalnızca geçici iletim için okuma/yazma/silme izni
         allow read, write, delete: if true;
       }
     }
   }
   ```
4. Proje Ayarları -> **"Web Uygulaması Ekle"** (</> simgesi) seçin.
5. Size verilen `firebaseConfig` bilgilerini uygulamanın sağ üstündeki **Ayarlar ⚙️ -> Google Firebase Bağlantısı** sekmesine yapıştırıp kaydedin.

---

## 📱 Android Cihaza Yükleme (PWA)

1. Android telefonunuzda Chrome tarayıcısını açıp uygulamanın adresine gidin.
2. Sağ üstteki **üç nokta (⋮)** menüsüne tıklayın.
3. **"Uygulamayı Yükle"** veya **"Ana Ekrana Ekle"** seçeneğine dokunun.
4. `napisen` telefonunuzun ana ekranına bağımsız bir uygulama simgesi olarak eklenecek, tarayıcı çubuğu olmadan tam ekran açılacaktır.

