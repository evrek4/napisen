// napisen - Yasal metinler
// Not: Bu metinler genel bir şablondur ve hukuki danışmanlık yerine geçmez.
// Yayına almadan önce bir hukukçuya kontrol ettirmeniz önerilir.

import { LEGAL, MIN_AGE } from '../config/app';

const L = LEGAL;
const controller = `${L.controllerName}${L.controllerAddress ? ` (${L.controllerAddress})` : ''}`;

export const TERMS = {
  path: '/kullanim-kosullari',
  title: 'Kullanım Koşulları',
  sections: [
    {
      title: '1. Taraflar ve kapsam',
      body: [
        `Bu Kullanım Koşulları, ${L.appName} uygulamasını ("Hizmet") kullanan kişi ("Kullanıcı") ile Hizmeti sunan ${controller} ("Biz") arasındaki ilişkiyi düzenler.`,
        'Hizmete kayıt olarak veya Hizmeti kullanarak bu koşulları okuduğunuzu ve kabul ettiğinizi beyan edersiniz. Kabul etmiyorsanız Hizmeti kullanmayınız.',
      ],
    },
    {
      title: '2. Hizmetin tanımı',
      body: [
        `${L.appName}, kullanıcıların birbirleriyle uçtan uca şifreli metin, ses ve görsel mesajlaşmasını sağlayan bir uygulamadır.`,
        'Mesaj içerikleri yalnızca gönderen ve alıcının cihazlarında çözülebilir. Biz ve sunucu sağlayıcımız mesaj içeriklerini okuyamayız.',
        'Hizmet ücretsizdir ve "olduğu gibi" sunulur. Kesintisiz veya hatasız çalışacağı garanti edilmez.',
      ],
    },
    {
      title: '3. Üyelik ve yaş sınırı',
      body: [
        'Üyelik bir Google hesabıyla yapılır. Hesabınızın güvenliğinden siz sorumlusunuz; Google hesabınızda iki adımlı doğrulamayı açmanız önerilir.',
        `Hizmeti kullanmak için en az ${MIN_AGE} yaşında olmalısınız. 18 yaşından küçükseniz Hizmeti veli veya vasinizin izniyle kullanabilirsiniz.`,
        'Başkası adına hesap açmak veya başkasını taklit etmek yasaktır.',
      ],
    },
    {
      title: '4. Yasak içerik ve davranışlar',
      body: ['Hizmeti kullanırken aşağıdakileri yapmamayı kabul edersiniz:'],
      list: [
        'Yürürlükteki mevzuata aykırı içerik paylaşmak veya suç teşkil eden faaliyetlerde bulunmak,',
        'Çocukların cinsel istismarına yönelik her türlü içerik (derhal yetkililere bildirilir),',
        'Taciz, tehdit, şantaj, nefret söylemi veya ayrımcılık,',
        'İstenmeyen toplu mesaj (spam), dolandırıcılık veya kimlik avı (phishing),',
        'Başkalarının kişisel verilerini izinsiz paylaşmak,',
        'Hizmetin güvenliğini veya işleyişini bozmaya, sistemleri izinsiz erişmeye çalışmak,',
        'Fikri mülkiyet haklarını ihlal etmek.',
      ],
    },
    {
      title: '5. Engelleme, şikâyet ve moderasyon',
      body: [
        'Kullanıcılar istemedikleri kişileri engelleyebilir ve kurallara aykırı davranışları şikâyet edebilir.',
        'Mesajlar şifreli olduğundan moderatörler yalnızca şikâyet eden kullanıcının kendi isteğiyle şikâyete eklediği mesajları görebilir.',
        'Bu koşulları ihlal eden hesaplar uyarı yapılmaksızın geçici veya kalıcı olarak askıya alınabilir. Yasal bir talep olması halinde yetkili makamlarla işbirliği yapılır.',
      ],
    },
    {
      title: '6. Sorumluluğun sınırlandırılması',
      body: [
        'Kullanıcılar gönderdikleri içerikten bizzat sorumludur. Biz, kullanıcıların birbirine gönderdiği içerikleri denetlemez ve bu içeriklerden sorumlu tutulamaz.',
        'Mesajlar cihazınızda saklanır. Cihazınızı kaybetmeniz, uygulama verilerini silmeniz veya şifreleme anahtarınızı yeni cihaza taşımamanız halinde mesajlarınız geri getirilemeyebilir.',
        'Yasal olarak izin verilen azami ölçüde, Hizmetin kullanımından doğan dolaylı zararlardan sorumlu değiliz.',
      ],
    },
    {
      title: '7. Hesabın silinmesi',
      body: [
        'Hesabınızı istediğiniz zaman Ayarlar → Hesap → "Hesabımı sil" bölümünden silebilirsiniz. Silme işlemi profilinizi, kişi kodunuzu ve sunucuda bekleyen mesajlarınızı kaldırır.',
      ],
    },
    {
      title: '8. Değişiklikler',
      body: [
        'Bu koşulları güncelleyebiliriz. Önemli değişikliklerde bir sonraki girişinizde yeniden onayınız istenir.',
      ],
    },
    {
      title: '9. Uygulanacak hukuk ve iletişim',
      body: [
        `Bu koşullar ${L.jurisdiction} kanunlarına tabidir. Uyuşmazlıklarda tüketici işlemleri bakımından ilgili mevzuattaki yetkili tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir.`,
        `Sorularınız için: ${L.contactEmail}`,
      ],
    },
  ],
};

export const PRIVACY = {
  path: '/gizlilik',
  title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni',
  sections: [
    {
      title: '1. Veri sorumlusu',
      body: [
        `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu ${controller}'dir. İletişim: ${L.contactEmail}`,
      ],
    },
    {
      title: '2. Uçtan uca şifreleme',
      body: [
        'Mesajlarınız, sesli mesajlarınız ve fotoğraflarınız cihazınızda şifrelenir ve yalnızca alıcının cihazında çözülür. Şifreleme anahtarınız cihazınızdan çıkmaz. Bu nedenle mesaj içeriklerinize biz dahil kimse erişemez.',
      ],
    },
    {
      title: '3. İşlenen kişisel veriler',
      list: [
        'Kimlik ve iletişim: Google hesabınızın e-posta adresi ve görünen adınız.',
        'Hesap verileri: Kişi kodunuz, açık şifreleme anahtarınız, "e-postayla bulunabilirim" tercihiniz, Kullanım Koşullarını kabul tarihiniz.',
        'İletişim meta verileri: Bir mesajın kimden kime, ne zaman gönderildiği, teslim durumu ve medya boyutu. (Mesaj içeriği şifrelidir ve işlenmez.)',
        'Şikâyet verileri: Bir şikâyet oluşturduğunuzda seçtiğiniz neden, yazdığınız açıklama ve kendi isteğinizle eklediğiniz mesajlar.',
        'Moderasyon kayıtları: Hesap askıya alma kararları ve gerekçeleri.',
        'Teknik veriler: Hizmet altyapısı (Google Firebase) tarafından tutulan IP adresi ve erişim kayıtları.',
      ],
    },
    {
      title: '4. İşleme amaçları ve hukuki sebepler',
      list: [
        'Üyelik oluşturma, kimlik doğrulama ve mesajların iletilmesi — sözleşmenin kurulması ve ifası (KVKK m. 5/2-c).',
        'Güvenlik, kötüye kullanımın önlenmesi, şikâyetlerin incelenmesi — meşru menfaat (KVKK m. 5/2-f).',
        'Yasal taleplerin karşılanması ve kayıt tutma yükümlülükleri — hukuki yükümlülük (KVKK m. 5/2-ç).',
      ],
    },
    {
      title: '5. Verilerin aktarılması',
      body: [
        'Hizmet, Google LLC tarafından sağlanan Firebase altyapısında (kimlik doğrulama, veritabanı ve barındırma) çalışır. Bu nedenle yukarıdaki veriler Google sunucularında, yurt dışında saklanabilir. Aktarım KVKK m. 9 ve ilgili mevzuata uygun olarak, hizmetin sunulması için zorunlu olduğu ölçüde yapılır.',
        'Verileriniz reklam veya pazarlama amacıyla kimseyle paylaşılmaz ve satılmaz. Yetkili kamu kurum ve kuruluşlarına yalnızca yasal zorunluluk halinde aktarılabilir.',
      ],
    },
    {
      title: '6. Saklama süreleri',
      list: [
        'Mesajlar: "Sunucuda Sakla" kapalıyken alıcıya teslim edildiği anda sunucudan silinir. Açıkken şifreli kopya, siz veya karşı taraf silene kadar tutulur.',
        'Cihazınızdaki mesaj geçmişi yalnızca cihazınızdadır; Ayarlar → Hafıza bölümünden silebilirsiniz.',
        'Hesap verileri: Hesabınızı silene kadar saklanır.',
        'Şikâyet ve moderasyon kayıtları: İnceleme tamamlandıktan sonra, olası yasal talepler için makul süre (en fazla 2 yıl) saklanır.',
      ],
    },
    {
      title: '7. Cihazda saklanan veriler',
      body: [
        'Uygulama, çalışabilmesi için cihazınızda şifreleme anahtarınızı, kişi listenizi, tercihlerinizi ve (Hayalet Mod kapalıyken) mesaj geçmişinizi saklar. Reklam veya takip amaçlı çerez kullanılmaz.',
      ],
    },
    {
      title: '8. KVKK kapsamındaki haklarınız',
      body: ['KVKK m. 11 uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, işleme amacını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini, silinmesini veya yok edilmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.'],
      list: [
        `Başvurularınızı ${L.contactEmail} adresine iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.`,
        'Hesabınızı uygulama içinden kendiniz de silebilirsiniz (Ayarlar → Hesap → "Hesabımı sil").',
        'Başvurunuzun reddedilmesi veya yanıtı yetersiz bulmanız halinde Kişisel Verileri Koruma Kurulu’na şikâyette bulunabilirsiniz.',
      ],
    },
    {
      title: '9. Çocukların gizliliği',
      body: [
        `Hizmet ${MIN_AGE} yaşından küçüklere yönelik değildir. ${MIN_AGE} yaşından küçük birine ait hesap tespit edilirse hesap kapatılır.`,
      ],
    },
    {
      title: '10. Değişiklikler',
      body: ['Bu metin güncellenebilir. Önemli değişikliklerde bir sonraki girişinizde onayınız istenir.'],
    },
  ],
};

export const LEGAL_PAGES = [TERMS, PRIVACY];
