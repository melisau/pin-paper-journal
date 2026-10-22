# Pin & Paper — Öncelikli görev listesi
Tarih: 15 Ekim 2026

Kapsam: yerel kaynak kodu, test yapılandırması, migration dosyaları ve mevcut yayın raporları. Canlı GitHub dalı/CI, deployment, Supabase ayarları ve gerçek telefonlar bu incelemede kontrol edilmedi. “Kodda görüldü” maddeleri kaynak kodu bulgusudur; olası yarış koşulları ayrıca yeniden üretilmelidir. Bu dosya görev planıdır, uygulama düzeltmesi değildir.

Doğrulama: 26 test dosyasında 97 test geçti. Üç sıralı Supabase migration denetimi geçti. İlk test koşusu Windows sandbox geçici dosya ENOENT hatasıyla kesildi; sandbox dışındaki tekrar başarılı oldu. Bu incelemede yeni production build veya mobil E2E koşulmadı.

Mevcut özellikler: hesaplı kullanımda şifreli sayfa/medya ve bulut taslakları; parolalı normal yedek; 1600 px / 0.78 fotoğraf sıkıştırması; 2 MB sıkıştırılmış fotoğraf sınırı; 250 MB Storage kota politikası; görünür sayfa medyası yükleme; şifreli IndexedDB medya önbelleği; Türkçe/İngilizce; açık/koyu tema; okuma modu. Bunların canlı ortamda çalıştığı ayrıca doğrulanmalı.

## P0 — Kullanıcı verisi ve yayın güvenliği

- [ ] G01 — İki cihaz/sekme arasında kayıt çakışmasını çöz.
  Güncelleme (15 Ekim 2026): kod, yerel doğrulama ve canlı 004 migration'ı tamamlandı. Supabase journal projesinde atomik sürüm kontrolü, eski RPC'nin kaldırılması, anon fonksiyon izninin kapatılması ve Storage koruması doğrulandı. Çakışan taslaklar sekme bazlı şifreli saklanıyor ve ayrı defter olarak kurtarılabiliyor. Gerçek cihazlarla canlı A/B provası beklediği için kutu henüz kapatılmadı. Kullanılmayan medya normal kayıtta silinmez; güvenli temizlik tasarlanana kadar kota tüketir. Ayrıntılar: SYNC_CONFLICT_ROLLOUT.md.
  Kanıt: supabase/migrations/002_sync_encrypted_pages.sql tüm sayfa listesini yazar, listede olmayan sayfaları siler; istemcinin beklediği sürüm kontrol edilmiyor. lib/asset-repository.ts referans dışı dosyaları temizliyor.
  Tamamlanma: eski sürümden kayıt reddedilir veya kullanıcıya çakışma çözümü sunulur. A/B cihaz senaryosunda metin, yeni sayfa ve fotoğraflar korunur; temizlik diğer işlemin dosyalarını silemez.

- [ ] G02 — Defter değiştirirken eski asenkron işlemleri ayır.
  Kanıt: components/journal-app.tsx openBook ve queueCloudSync. Eşitleme sonuçları yalnızca syncRequest ile süzülüyor; aktif defter kimliğiyle ayrıca korunmuyor. openBook yüklemeleri için de güncellik kontrolü gerekiyor.
  Tamamlanma: yavaş ağda A defterini kaydedip B'yi açınca A'nın geç yanıtı B'nin görünümünü, fotoğraf referansını veya kayıt durumunu değiştirmez.

- [ ] G03 — Yedeğin eksiksizliğini garanti et.
  Kanıt: lib/cloud-backup.ts makeCloudBackup buluttaki sayfaları okur; bekleyen yerel taslakları bu fonksiyonda birleştirmez. lib/page-repository.ts medya yükleme hatasını sayfa üzerinde tutabilir; portablePage boş kaynağı kabul eder.
  Tamamlanma: bekleyen çevrimdışı değişiklikler de yedeklenir. Eksik fotoğraf/çizim açıkça bildirilir; eksik yedek sessizce başarılı sayılmaz. Boş test hesabına geri yüklemede içerik ve medya eşleşir.

- [ ] G04 — Defter silmeyi yarıda kalmaya dayanıklı yap.
  Kanıt: lib/journal-repository.ts deleteEncryptedJournal önce Storage dosyalarını, sonra defter kaydını siler.
  Tamamlanma: ikinci adım başarısız olduğunda yaşayan defter bozuk fotoğraflarla kalmaz. Silme işaretleme/yeniden deneme ve tercihen çöp kutusu uygulanır.

- [ ] G05 — Canlı staging ortamında iki hesaplı veri ayrımını doğrula.
  Durum: politika kodu var; canlı sonuç bu incelemede doğrulanmadı.
  Tamamlanma: A/B hesaplarıyla journals, pages, encrypted_assets, user_key_bundles ve Storage için doğrudan okuma/yazma/silme denemeleri geçer. Anonim istekler engellenir; tokenlar rapora yazılmaz.

- [ ] G06 — Üretim CSP politikasını güçlendir.
  Kanıt: next.config.ts üretimde script-src için unsafe-inline içeriyor; app/layout.tsx tema başlangıç betiği kullanıyor.
  Tamamlanma: Next.js betikleri ve tema başlangıcıyla uyumlu nonce/hash yaklaşımı değerlendirilip uygulanır; gerçek HTTPS yanıtında başlıklar ve XSS denemeleri doğrulanır.

- [ ] G07 — Eski yerel içerik ve geçiş yedeği için gizlilik açığını kapat.
  Kanıt: /preview yerel modda açık JSON saklar; lib/local-migration.ts downloadMigrationBackup parolasız JSON indirir. Normal yedek alma akışı zaten parolalıdır.
  Tamamlanma: geçiş yedeği parolalı olur. Eski yerel kopyalar için doğrulanmış bulut aktarımından sonra güvenli saklama/kaldırma seçeneği sunulur. /preview üretimde açık bırakılmaz.

## P1 — Güvenilir kayıt, kurtarma ve yayın

- [ ] G08 — Yerelden buluta geçişte bütün sayfa alanlarını koru.
  Kanıt: lib/local-migration.ts normalizePage yeni alanların tamamını taşımıyor; örneğin şablon, tracker maddeleri, haftalık notlar ve liste kartı özelleştirmeleri eksik.
  Tamamlanma: tüm PageData alanları geçişten önce/sonra karşılaştırılır; özel kartlar ve şablonlar kaybolmaz.

- [ ] G09 — Mobil sekme kapanması ve uygulamanın arka plana gitmesinde son değişiklikleri koru.
  Kanıt: components/journal-app.tsx pagehide sırasında şifreli taslak için asenkron iş başlatıyor; tarayıcı kapanışında tamamlanma garantisi yok.
  Tamamlanma: visibilitychange ve kayıt sırası gözden geçirilir; son yazı ve fotoğraf, sekme zorla kapatılıp açıldığında beklenen şekilde korunur.

- [ ] G10 — Depolama kotasını eşzamanlı yüklemelerle sınayarak sağlamlaştır.
  Güncelleme (22 Ekim 2026): 003 ve 005 canlıya uygulandı. Yeni çizimler 1600 px / 512 KiB sınırında şifreli sayfa içinde güncelleniyor; çizim başına ayrı Storage PNG yüklenmiyor. 250 MiB kota sayfa verisi + dosya toplamını kapsıyor. Sayfa kaydı ve Storage son metadata güncellemesi aynı hesap kilidini kullanıyor; kotayı aşan kayıt revision ile birlikte geri alınıyor. Yerel PostgreSQL kota/rollback testleri ve canlı şema/izin kontrolleri geçti. Gerçek paralel HTTP yükleme provası ve tarihî dosyalar için güvenli temizlik planı bekliyor.
  Kanıt: 003_storage_quota.sql mevcut toplam + yeni dosya boyutu kontrolü yapıyor; kullanıcı başına rezervasyon/kilitleme görünmüyor.
  Tamamlanma: 250 MB sınırına yaklaşırken paralel yüklemeler ve eksik boyut metadatası denenir. Aşım yolu bulunursa sunucuda atomik kontrol eklenir; kullanıcıya açık kota mesajı verilir.

- [ ] G11 — Gerçek hesapla giriş, çıkış, yüksek güvenlik ve kurtarma provası yap.
  Tamamlanma: Android/iPhone ve masaüstünde yeniden giriş, oturum süresi dolması, parola sıfırlama, yanlış/kayıp kurtarma kodu ve IndexedDB kullanılamaması denenir. Çıkışta anahtarlar temizlenir; yüksek güvenlik modunda kalıcı anahtar bulunmaz.
  Not: tarayıcı tarafındaki şifreleme, uygulama açıkken çalışan kötü amaçlı kodu tek başına engelleyemez; güvenlik iddiaları buna göre yazılır.

- [ ] G12 — Gerçek telefon testlerini tamamla ve tarayıcı kapsamını genişlet.
  Kanıt: playwright.config.ts üç mobil boyut kullanıyor; mevcut E2E kapsamı Chromium ağırlıklı. Gerçek cihaz sonuçları RELEASE_READINESS.md içinde bekliyor.
  Tamamlanma: Redmi Note 13 Pro ve bir iPhone/Safari üzerinde kayıt, klavye, çizim, görsel, çekmece, tema ve okuma modu senaryoları raporlanır; WebKit kapsamı eklenir.

- [ ] G13 — Güncel tema değişikliklerini commit/push ve CI sonucuyla tamamla.
  Kanıt: bu incelemede app/layout.tsx ve components/language-switcher.tsx değişmiş; tema CSS/TSX/test dosyaları Git'te izlenmiyor. Yerel son commit 077e4c0. Uzak depo ayrıca doğrulanmadı.
  Tamamlanma: ilgili değişiklikler gözden geçirilip kaydedilir, yetkilendirilen push sonrası aynı commit'in CI ve deployment sonucu doğrulanır. Üretilen geçici dosyalar ayıklanır.

- [ ] G14 — CI güvenlik ve tema testlerini tamamla.
  Güncel tarama notu (15 Ekim 2026): npm audit --omit=dev mevcut Next.js, sharp ve source-map-js bağımlılıklarında toplam 1 kritik/2 yüksek uyarı bildirdi. Bu G01 değişikliğinde sürümler yükseltilmedi; yayın öncesi bağımlılık güncellemesi ve regresyon doğrulaması gerekli.
  Kanıt: .github/workflows/ci.yml kalite ve mobil E2E işlerini içeriyor; bağımlılık/gizli anahtar taraması ayrı iş olarak görünmüyor. scripts/verify-themes.mjs CI'a bağlı değil. lib/journal-layout.test.ts mevcut Vitest tests/** filtresinin dışında.
  Tamamlanma: güvenlik taramaları eklenir; tema ve koordinat testleri CI'a dahil edilir. GitHub dal koruması ve istenen iki kişilik yayın onayı ayrıca kontrol edilir.

- [ ] G15 — Geri yükleme ve bağımsız güvenlik denetimini tamamla.
  Tamamlanma: test verisiyle veritabanı/Storage geri yükleme provası, kurtarma yönergesi ve bağımsız inceleme raporu bulunur. Açık kritik/yüksek bulgular kapatılır. Mevcut SECURITY_AUDIT_PLAN.md kapsamı esas alınır.

## P2 — Ürün kalitesi ve sürdürülebilirlik

- [ ] G16 — Sayfa dışa aktarmayı kullanıcı beklentisine uygun hale getir.
  Kanıt: lib/page-export.ts şifresiz .journal.json üretir; PNG/PDF üretmez. Blob medya referansları başka cihazda taşınabilir değildir.
  Tamamlanma: PNG/PDF paylaşımı ve taşınabilir veri dışa aktarma ayrı seçenekler olur. Şifresiz içerik dışarı çıkarken kullanıcı bunu açıkça görür; görseller dosyaya dahil edilir.

- [ ] G17 — Dil değişiminin kullanıcı içeriğine dokunmasını önle.
  Kanıt: components/journal-app.tsx kullanıcı başlığı, not ve kart metinlerini de t(...) üzerinden gösteriyor. Sözlükle birebir eşleşen kullanıcı metni dil değişince farklı görünebilir.
  Tamamlanma: yalnızca arayüz ve açıkça işaretlenmiş varsayılan metinler çevrilir. Kullanıcı metni korunur; hata mesajlarının Türkçe karşılıkları tamamlanır.

- [ ] G18 — Koyu tema ve erişilebilirliği bütün pencerelerde tamamla.
  Kanıt: app/themes.css genel tema içeriyor; kapak seçim penceresinin app/globals.css içindeki sabit renkleri ayrıca tema uyarlaması gerektiriyor. Kapak penceresinde Escape/fokus yönetimi görünmüyor.
  Tamamlanma: kapak seçici, hatalar ve kurtarma ekranı iki temada okunur. Klavye odağı pencere içinde kalır, Escape kapatır, kapanınca odağı geri verir; mobil dokunma alanları kontrol edilir.

- [ ] G19 — Tracker ve planner şablonlarına sabitleme ekle.
  Kanıt: Photo, Sticker, FreeText ve liste kartında kilit alanı var; PageData içinde şablon kilidi görünmüyor.
  Tamamlanma: habit/mood/weekly/todo alanları da kilitlenip açılır; tercih yeniden açılışta ve bulut kaydında korunur.

- [ ] G20 — Büyük defter ve fotoğraflı yedeklerde performansı ölç ve iyileştir.
  Kanıt: sayfalar açılışta topluca çekilip çözülüyor; her sync tüm sayfaları yeniden şifreliyor; büyük bulut yedeği tüm medya/base64 içeriğini bellekte topluyor.
  Tamamlanma: 100–500 sayfa ve kotaya yakın medya ile düşük bellekli telefon testi yapılır. Değişen sayfaları kaydetme, sayfalama ve parça parça yedekleme uygulanır; yükleme süresi/bellek sonuçları kaydedilir.

- [ ] G21 — Hesap ve gizlilik yönetimi ekranını tamamla.
  Durum: kaynakta kullanıcıya yönelik kapsamlı hesap silme, kurtarma kodu yönetimi, tüm cihazlardan çıkış ve gizlilik açıklaması akışları görünmüyor.
  Tamamlanma: hesap silme/veri temizleme, yüksek güvenlik ayarı ve kurtarma bilgileri anlaşılır bir ayarlar ekranından yönetilir; gizlilik ve kullanım metinleri ürünün gerçek davranışını açıklar.

- [ ] G22 — Operasyon, maliyet ve bakım planını tamamla.
  Kanıt: lib/error-monitoring.ts olayları yalnızca sessionStorage içinde saklıyor. Merkezi hata/uptime uyarısı ve Supabase Spend Cap ayarları burada doğrulanmadı. journal-app.tsx ve globals.css çok sayıda sorumluluk/sabit stil içeriyor; RELEASE_READINESS.md eski sayılar ve tamamlanmış taslak şifrelemesini tekrar görev olarak içeriyor.
  Tamamlanma: içerik içermeyen hata/erişilebilirlik uyarıları, Supabase harcama ve kullanım bildirimleri kurulur. Editör/kayıt/medya kodu ayrıştırılır, tema tokenları yaygınlaştırılır, README ve yayın raporu güncellenir.

Önerilen başlangıç: G01 → G02 → G03 → G04 → G08. Canlı ortam yetkisi gerektiren G05/G10/G11 görevleri staging ortamında ayrı doğrulama olarak yürütülür.
