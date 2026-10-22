# G01 — Sürüm kontrollü kayıt

15 Ekim 2026. Yerel kod tamamlandı; 004 migration'ı canlı journal projesine uygulandı ve şema/izin kontrolleri geçti. Gerçek cihazlarla canlı A/B doğrulaması bekliyor.

## Davranış

- Defter ve sayfalar tek SQL snapshot'ıyla okunur; content_revision istemcide saklanır.
- Kayıt RPC'si defter satırını kilitler, beklenen sürümü denetler, sayfaları ve sürümü tek transaction içinde değiştirir. Uyuşmazlıkta transaction hiçbir sayfayı değiştirmez.
- Eski iki parametreli RPC kaldırılır. Direkt sayfa yazma/silme ve istemciden sürüm alanını değiştirme izinleri kapatılır.
- Çakışma otomatik olarak yeniden denenmez. Kullanıcının şifreli taslağı saklanır; “Taslağı ayrı defter olarak kaydet” metni, sayfaları ve medyayı yeni defterin yeni anahtarıyla yeniden şifreler. Eksik medya varsa kopyalama tamamlanmış sayılmaz.
- Her editör ayrı bir taslak yuvası kullanır. Geç gelen kayıt yanıtı daha yeni veya başka sekmenin taslağını eşitlenmiş olarak işaretleyemez. Yeniden açılışta bekleyen taslaklar bulunur. Sürüm bilgisi bulunmayan eski taslaklar güvenli biçimde çakışma kabul edilir, bulutun üzerine yazılmaz.
- Medya yaşayan defter boyunca korunur. Normal kayıtlar referans dışı dosyaları temizlemez; Storage politikası yaşayan defter dosyalarının silinmesini veya değiştirilmesini engeller. Açık defter silme akışı önce defteri siler, sonra Storage dosyalarını kaldırır.

## Devreye alma

İlk incelemede INACTIVE olan .env.local hedefi iccgvvobcswemwyhpttb / journal kullanıcı tarafından etkinleştirildi. ACTIVE_HEALTHY durumuna geçtikten sonra 004, Supabase CLI Management API üzerinden BEGIN/COMMIT içinde uygulandı; PostgREST şema önbelleği yenilendi. CLI migration geçmiş tablosu bulunmadığı için işlem db push yerine doğrudan SQL olarak yürütüldü; eski migration'lar yeniden çalıştırılmadı.

Canlı doğrulama: content_revision sütunu, snapshot RPC'si ve üç parametreli sync RPC'si mevcut; eski RPC kaldırılmış; authenticated rolü kayıt yapabiliyor; anon rolü yeni RPC'leri çalıştıramıyor; doğrudan sayfa yazımı ve revision alanı güncellemesi kapalı; Storage güncelleme politikası kaldırılmış ve yaşayan defterin dosyalarını koruyan silme politikası mevcut. Supabase varsayılan fonksiyon izinlerinin anon rolüne doğrudan yetki verdiği görülünce 004'teki REVOKE ifadeleri anon rolünü de kapsayacak şekilde düzeltildi ve canlıya uygulandı. Bu düzeltmeyle yerel PostgreSQL testlerinin sekizi de geçti.

22 Ekim 2026 güncellemesi: 003_storage_quota.sql ve 005_bounded_drawing_storage.sql canlı journal projesinde tek transaction içinde uygulandı. Kota RPC'si, şifreli sayfaları kapsayan kullanım hesabı, ortak hesap kilidi, Storage metadata tetikleyicisi ve özel CAS fonksiyonuna doğrudan erişimin kapatılması canlı şema kontrollerinde doğrulandı. Yeni çizimler sınırlı boyutta WebP olarak şifreli sayfa değerini güncelliyor; her darbe için yeni Storage nesnesi oluşturulmuyor. Eski çizim dosyaları çevrimdışı taslak kurtarma için korundu. Sayfa verisini veritabanına almak Storage birikimini durdurur; veritabanı alanı ve kayıt trafiği yine tüketilir ve toplam kota hesabına dahildir. Gerçek Storage HTTP yükleme/silme ve iki fiziksel cihaz provası ayrıca yapılmalı.

1. Bu proje için 004 uygulandı; aynı dosyayı yeniden çalıştırma. Başka bir ortama uygularken önce temel tabloların ve eski sync RPC'sinin bulunduğunu doğrula.
2. Yeni ortamda SQL Editor'da supabase/migrations/004_versioned_page_sync.sql dosyasının tamamını transaction içinde çalıştır. Uygulama sürüm kontrolüne geçtiği için migration olmadan sayfa açma/kayıt başarılı olamaz.
3. Şema önbelleği güncellenmezse SQL Editor'da NOTIFY pgrst, 'reload schema'; çalıştır.
4. Uygulama sürümünü yayınla. Eski açık sekmelerin kaydı güvenli biçimde reddedilir; kullanıcıları yenilemeden önce yerel içeriklerini yedeklemeye yönlendir.
5. Gerçek A/B cihazlarıyla aşağıdaki provayı yap; başarılı sonuçtan sonra G01 kutusunu kapat.

## A/B kabul provası

1. Aynı defteri iki cihazda aç. Başlangıç sürümleri aynı olsun.
2. A'da metin değiştir, sayfa ekle ve fotoğraf ekleyip kaydet.
3. B'de eski görünümden başka metin/fotoğraf ekleyip kaydet. Çakışma bildirimi çıkmalı; A'nın metni, sayfası ve fotoğrafı değişmemeli.
4. B'de “Taslağı ayrı defter olarak kaydet” seç. Ayrı defterde B'nin metni, fotoğrafı ve çizimi açılmalı; A'nın asıl defteri korunmalı.
5. Aynı tarayıcıda iki sekmeyle tekrarla; sekmeleri kapatıp açınca bekleyen taslak kurtarılabilmeli.
6. Eski RPC, doğrudan pages yazma, content_revision değiştirme ve yaşayan defterin Storage dosyasını silme isteklerinin engellendiğini kontrol et.

## Yerel doğrulama

tests/versioned-sync-sql.test.ts migration SQL'ini PGlite PostgreSQL üzerinde gerçekten çalıştırır; sürüm çakışması, aynı sürümden iki istek, izinler, atomik hata/rollback, başka hesaba erişim ve Storage politika davranışını sınar. Bu yerel PostgreSQL testidir; canlı Supabase Storage hizmeti/ağ testi değildir.

tests/journal-sync-conflict.test.tsx iki editörün kayıt ve ayrı kopya davranışını; cloud-drafts.test.ts sekme izolasyonu ve geç yanıtları; conflict-copy.test.ts yeni anahtarla medya kopyalamayı sınar.

## Sınırlar

- Kullanılmayan ve çakışma sırasında yüklenen medya, defter silinene kadar kota tüketebilir. Güvenli sunucu temizliği/retention politikası ayrı iş olarak planlanmalı.
- Yeni çizimler bu eski dosya birikimini artırmaz: aynı sayfa satırı güncellenir. Mevcut tarihî PNG'ler, başka bir cihazın bekleyen taslağına ait olup olmadığı bilinmeden otomatik silinmez.
- Defter silindikten sonra Storage silme ağ hatası alırsa içerik kaydı gitmiş, artık dosyalar kalmış olabilir. Böyle artık dosyalar için tekrar denenebilir sunucu temizliği gerekir; yaşayan defterin medyası silinmez.
- Çevrimdışı taslak cihazda şifrelidir; tarayıcı verileri silinirse kaybolabilir. Sekme kapanışındaki asenkron yazım garantisi G09'un kapsamındadır.
- SQL migration'ını geri almadan eski yazma protokolüne dönmek güvenlik kontrolünü etkisizleştirebilir. Şema geri alma yerine uyumlu uygulama düzeltmesi tercih edilmeli.
