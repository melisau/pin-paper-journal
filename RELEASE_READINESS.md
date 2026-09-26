# Yayın öncesi kontrol — 26 Eylül 2026

Kapsam: yerel kaynak kodu ve `/preview` üzerinde otomatik tarayıcı testleri. Canlı Supabase, dağıtım, gerçek telefon ve GitHub koruma ayarları bu raporda doğrulanmadı. Testlerde gerçek günlük içeriği yerine örnek veri kullanılmalıdır.

Karar: **Henüz yayına hazır değil.** Bu çalışma ağacında bulut taslaklarının `localStorage` içinde açık metin tutulması giderildi: taslak gövdesi hesap anahtarıyla AES-GCM kullanılarak şifreleniyor; eski açık taslaklar ilgili hesap açıldığında şifreli biçime taşınıyor. Yerel testler şifreli depolamayı, eski taslak geçişini, yanlış/tahrif edilmiş şifreli veriyi ve çevrimdışı sırayı kapsıyor. Eski kullanıcı verisiyle gerçek hesapta geçiş ve çıkış/yeniden giriş provası hâlâ yapılmalı. Canlı Supabase, dağıtım, gerçek telefon ve GitHub koruma ayarları da bu raporda doğrulanmadı.

## 23 kontrol

Durumlar: **Geçti** = yerel test veya doğrudan kod kanıtı; **Kısmi** = yerel kanıt var, canlı doğrulama eksik; **Engel** = giderilmeden yayınlanmamalı; **Bekliyor** = erişim veya dış onay gerekli.

| # | Kontrol | Durum | Kanıt / eksik adım |
|---|---|---|---|
| 1 | Production build | Geçti | `npm run build` tamamlandı. |
| 2 | TypeScript | Geçti | Production build TypeScript aşamasını tamamladı. |
| 3 | Lint | Geçti | `npm run lint` hata vermedi. |
| 4 | Birim testleri | Geçti | `npm test`: 25 dosyada 92/92; kayıtlı oturum ve sunucu doğrulama hatalarının yönlendirme döngüsü oluşturmaması da test ediliyor. |
| 5 | Migration sırası ve temel güvenlik denetimi | Geçti | `npm run migration:check`: 3 sıralı migration. Canlı veritabanına uygulanmış olmaları ayrıca doğrulanmalı. |
| 6 | CI kalite kapısı | Kısmi | `.github/workflows/ci.yml` lint, test, build, migration ve mobil E2E içeriyor; bu çalışma ağacının uzaktaki CI sonucu henüz yok. |
| 7 | Kaynakta gizli anahtar bulunmaması | Kısmi | İzlenen env dosyası `.env.example`; service-role anahtarı görülmedi. GitHub secret scanning ayrıca açılmalı. |
| 8 | `/journal` erişim koruması | Kısmi | `app/journal/page.tsx` geçersiz claims için yönlendiriyor; staging'de anonim ve farklı hesap denemeleri gerekli. |
| 9 | Giriş, oturum yenileme ve çıkış | Kısmi | Yerel auth testleri var; gerçek Supabase/telefon üzerinde yeniden giriş ve çıkış henüz denenmedi. |
| 10 | Parola kurtarma | Kısmi | Kurtarma kodu birim testleri geçiyor; üretim e-postası ve kayıp kod senaryosu denenmedi. |
| 11 | Sayfa ve medya şifreleme | Geçti | AES-GCM, rastgele IV, parola/kurtarma sarmalama ve medya baytları birim testleriyle doğrulanıyor. |
| 12 | Bulut taslaklarının cihazda şifrelenmesi | Kısmi | Taslak gövdesi AES-GCM/hesap anahtarıyla şifreli; eski taslaklar şifreli biçime taşınıyor. Birim testleri geçti; gerçek hesapta eski verinin migrasyonu ve sign-out/re-login provası bekliyor. |
| 13 | Anahtarın cihazda tutulması | Kısmi | `lib/key-vault.ts` normal modda çıkarılabilir `CryptoKey` değerini IndexedDB'de saklıyor; yüksek güvenlik modu bellekte tutuyor. Paylaşılan cihaz ve XSS riski ayrıca değerlendirilmeli. |
| 14 | Şifreli yedek dışa/içe aktarma | Geçti | Birim ve mobil E2E yedek akışı geçti. Gerçek bulut yedeğiyle geri yükleme provası bekliyor. |
| 15 | Fotoğraf yükleme, yeniden açma ve önbellek | Kısmi | Sıkıştırma, şifreli varlık, IndexedDB önbelleği, görünür sayfayı yükleme ve URL temizliği kod/test düzeyinde var; gerçek düşük bellekli telefonda doğrulanmalı. |
| 16 | Dosya sınırı ve kullanıcı kotası | Kısmi | 10 MB kaynak, 2 MB sıkıştırılmış fotoğraf ve 250 MB Storage politikası kodda var; canlı Supabase kota sınırı test edilmedi. |
| 17 | Otomatik kayıt ve çevrimdışı eşitleme | Kısmi | 1000 ms debounce ve taslak/senkronizasyon testleri var; iki cihaz çakışması ve ağ kesintisi staging'de denenmeli. |
| 18 | Hata sınırı ve özel verisiz operasyon kayıtları | Geçti | `app/error.tsx` ve `lib/error-monitoring.ts` genel durum/kod kaydediyor; içerik ve stack göndermiyor. |
| 19 | CSP ve güvenlik başlıkları | Kısmi | `next.config.ts` CSP, frame, MIME ve izin başlıklarını tanımlıyor; gerçek dağıtım yanıt başlıkları ve XSS denemeleri bekliyor. |
| 20 | İki hesap arasında RLS/Storage ayrımı | Bekliyor | SQL'de sahiplik politikaları var; A/B staging hesaplarıyla doğrudan REST ve Storage saldırı matrisi çalıştırılmadı. |
| 21 | Türkçe/İngilizce ve önizlemeden çıkış | Geçti | E2E, Türkçe “Defteri önizle” → “Önizlemeden çık” → düzenleme dönüşünü üç profilde doğruladı. |
| 22 | Bağımlılık güvenlik taraması | Kısmi | Ağ erişimiyle yeniden çalıştırılan `npm audit --omit=dev --audit-level=high`: 0 bulgu. Ancak CI'da otomatik dependency/secret scan işi yok. |
| 23 | Yayın operasyon onayı | Bekliyor | Gerçek telefon, canlı URL, Supabase Spend Cap/uyarıları, iki kişilik GitHub/deployment onayı ve bağımsız güvenlik denetimi doğrulanmadı. |

## 20 telefon senaryosu

Otomatik kapsam: `e2e/mobile-journal.spec.ts` dosyasında 20 senaryo, 320/390/430 px Chromium mobil profillerinde toplam **60/60 başarılı** (`--workers 3`). Bazı senaryolar masaüstü görünümüne geçerek karşılaştırma yapıyor; bu sonuçlar **gerçek telefonda test edildi** anlamına gelmez. Varsayılan 6 işçili ilk koşuda bir defter-açma zamanlaması hatası görüldü (59/60); tek başına üç tekrar ve 3 işçili tam koşu geçti. Kararlılık izlemesi sürmeli.

Gerçek Android/iPhone üzerinde aşağıdaki 20 adım henüz işaretlenmedi:

1. HTTPS adreste giriş ve Web Crypto kullanılabilirliği.
2. Uygulamayı yenileyince oturumun ve defter listesinin korunması.
3. Çıkış yapınca oturumun kapanması; başka hesapla veri ayrımı.
4. Parola kurtarma bağlantısı ve kurtarma koduyla mevcut defterin açılması.
5. Çok defterli rafta yatay kaydırma; ilk ve son kapağın erişilebilirliği.
6. Kapakların eşit görsel boyutu ve raf üstünde kesilmemesi.
7. Defter açılış süresi ve boş ekran/geri bildirim davranışı.
8. Tek sayfa oranı, alt kenara erişim ve doğal dikey kaydırma.
9. Üst bardaki geri, sayfa değişimi, yeni sayfa, sayfalar ve kaydet dokunma alanları.
10. Alt araç düğmelerinin tek elle ve büyük parmakla rahat seçilmesi.
11. Creative drawer açıkken paneli ve defter sayfasını ayrı ayrı kaydırma.
12. “Defteri önizle” → “Önizlemeden çık”; araçların gizlenip geri gelmesi.
13. Türkçe/İngilizce geçişte başlık, düğme ve varsayılan sayfa metinleri.
14. Yazı yazma, 1 saniyelik otomatik kayıt ve yeniden açınca metnin korunması.
15. Uçak modunda yazma, çevrimiçi dönünce güvenli eşitleme.
16. Little joys kartında çok satır, üstünü çizme ve taşma olmaması.
17. Fotoğraf/sticker/not seçme, taşıma, döndürme, kilitleme ve kilit açma.
18. Kalem, fosforlu kalem ve tekli silgide ilk dokunuştan itibaren çizim.
19. Büyük/çoklu fotoğraf ekleme; yeniden açma, bozuk fotoğraf hata kartı ve tekrar deneme.
20. Şifreli yedek alma ve boş bir test hesabına geri yükleme; metin/fotoğraf bütünlüğü.

Gerçek cihaz sonuçlarında her adım için cihaz modeli, Android/iOS sürümü, tarayıcı, bağlantı tipi, geçti/kaldı, kısa gözlem ve kişisel içerik içermeyen ekran görüntüsü kaydedilmeli.

## Yayın engelleri ve sonraki kapı

1. Bulut taslaklarını cihazda şifrelemek ve çıkıştan sonra kalan taslaklar için güvenli geçiş testi eklemek.
2. Staging'de iki hesaplı RLS/Storage saldırı matrisi ve yedekten geri yükleme provası yapmak.
3. Gerçek telefonda 20 adımı tamamlamak; 6 işçili E2E zamanlama sapmasını izlemek.
4. Bağımlılık/secret taramasını CI'a eklemek; yayın commit'inin uzaktaki CI sonucunu görmek.
5. Canlı HTTPS, Supabase harcama uyarıları, iki kişilik onay ve bağımsız denetim kanıtını toplamak.
