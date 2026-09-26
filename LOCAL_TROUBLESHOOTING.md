# Yerel giriş sorunlarını kontrol etme

## Sunucuyu başlatma

`package.json` dosyasının bulunduğu `pin-paper-journal` klasöründe normal bir PowerShell penceresi aç:

```powershell
npm run dev
```

Terminalde `Ready` görünmesini bekle ve `http://localhost:3000` adresini aç. Bu terminali açık tut. Zaten çalışan sunucuyu yeniden başlatacaksan kendi terminalinde `Ctrl+C` ile durdurup komutu tekrar çalıştır.

## Belirtiye göre kontrol

- **ERR_CONNECTION_REFUSED:** Sunucu çalışmıyor veya farklı port kullanıyor olabilir. Terminalde yazan adresi kontrol et. `Test-NetConnection localhost -Port 3000` ile portu kontrol edebilirsin.
- **Giriş ile /journal arasında tekrar tekrar geçiş:** F12 → Network bölümünde `Preserve log` seçeneğini aç. `/` ve `/journal` isteklerinin tekrarlanması yönlendirme döngüsüne işaret eder. Aynı anda sunucu terminalindeki hataları kontrol et.
- **AuthRetryableFetchError, fetch failed veya EACCES:** Sunucunun Supabase'e erişimi başarısız olabilir. Tarayıcıdan giriş yapılabilmesi, Node.js sunucusunun da internete erişebildiğini kanıtlamaz. Özellikle otomasyon araçlarının kısıtlı ortamında başlatılmış sunucuyu normal PowerShell üzerinden yeniden başlat.
- **Şifreleme anahtarı kilitli mesajı:** Parolanı yeniden girerek defter anahtarını aç. Yüksek güvenlik modunda sayfayı tamamen yenilemek bellekteki anahtarı kaldırır; bu nedenle yeniden kilit açma gerekebilir.

Sunucunun Supabase'e ağ erişimini, proje klasöründe anahtar veya parola göstermeden kontrol etmek için:

```powershell
node --env-file=.env.local -e "fetch(new URL('/auth/v1/health', process.env.NEXT_PUBLIC_SUPABASE_URL), {signal: AbortSignal.timeout(8000)}).then(r => console.log('HTTP', r.status)).catch(e => console.log(e.name, e.cause?.code || 'connection-failed'))"
```

Bu anahtarsız kontrolün `HTTP 401` döndürmesi sunucuya ulaşılabildiğini gösterir; kullanıcı girişini doğrulamaz. `EACCES` erişim engeline, `ENOTFOUND` adres/DNS problemine, zaman aşımı ise erişim veya bağlantı problemine işaret eder.

## Düzeltilen akış

2026-09-27 incelemesinde kısıtlı ortamda çalışan Node.js bağlantısı `EACCES` verdi; aynı kontrol normal ağ erişimiyle yanıt aldı. Sunucu normal erişimle yeniden başlatıldıktan sonra kullanıcı kütüphanenin açıldığını doğruladı.

Kod tarafında:

- `app/journal/page.tsx`, doğrulama hizmeti hatasını oturum yokmuş gibi yönlendirmek yerine sabit bir yeniden deneme ekranı gösterir. Doğrulanmış kullanıcı olmadan defteri açmaz.
- `components/journal-access-notice.tsx`, yalnızca kullanıcı istediğinde yeniden dener. Tam sayfa yüklemesi yapmadan sunucu kontrolünü yeniler; bellekteki defter anahtarını korur.
- `app/page.tsx` ve `components/auth-form.tsx`, hata nedeniyle giriş ekranına dönen kullanıcıyı kayıtlı tarayıcı oturumuna bakarak otomatik olarak yeniden deftere göndermez.
- Bekleyen anahtar yükleme işlemleri, yeni bir giriş denemesini veya daha yeni bir yönlendirme kararını geçersiz kılamaz.

İlgili regresyon testleri: `tests/auth-page.test.tsx` ve `tests/journal-access.test.tsx`.
