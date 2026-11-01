# Sophos OTP

### Doğrulama kodunu bilgisayarında üret, Sophos bağlantını tek yerden başlat.

Sophos OTP, VPN’e bağlanırken telefondan doğrulama kodu alıp şifrenin sonuna ekleme işini kolaylaştıran bir masaüstü yardımcısıdır. Bilgisayarında çalışır; arayüzünü tarayıcıdan açarsın.

Kendi hesabına ait QR kodunu veya kurulum anahtarını tanıttığında güncel doğrulama kodunu üretir. Kodu kopyalayıp elle giriş yapabilir ya da kullanıcı adını ve mevcut şifreni girerek Sophos Connect’e tek düğmeyle bağlantı isteği gönderebilirsin.

**Angular 21 · PrimeNG 21 · NestJS · TypeScript**

> Bu proje bağımsız bir yardımcı uygulamadır. Sophos tarafından geliştirilmemiştir.

---

[Ne işe yarar?](#ne-işe-yarar) · [Nasıl çalışır?](#nasıl-çalışır) · [Kurulum](#kurulum) · [Kullanım](#kullanım) · [Gizlilik](#gizlilik-ve-giriş-bilgileri) · [Geliştiriciler](#geliştiriciler-için)

## Ne işe yarar?

Sophos girişinde bazen yalnızca şifre yetmez; telefondaki doğrulama uygulamasının ürettiği kısa süreli kodu da kullanman gerekir. Bu proje, aynı kurulum bilgileriyle kodu bilgisayarında üretmeni ve giriş sırasında kullanmanı sağlar.

| Özellik | Sana ne sağlar? |
| --- | --- |
| QR görseliyle kurulum | Sophos portalındaki QR ekran görüntüsünü seçerek hesabını tanıtırsın. |
| Manuel anahtar girişi | QR yerine Base32 anahtarını veya `otpauth://totp/` adresini kullanabilirsin. |
| Canlı kod ve geri sayım | Güncel kodu ve yenilenmesine kalan süreyi görürsün. |
| Tek tıklamayla kopyalama | Yalnızca kodu, kullanıcı adını veya şifre + kod birleşimini kopyalarsın. |
| Sophos Connect bağlantısı | Kullanıcı adı ve şifre + OTP ile bağlantı isteği gönderirsin. |
| Oturumu temizleme | Uygulamadaki kurulum anahtarını ve giriş alanlarını temizlersin. |

Arayüz, koyu renkler ve yarı saydam panellerle hazırlanmış cam efektli bir tasarıma sahiptir.

## Nasıl çalışır?

**OTP**, girişte kullanılan tek kullanımlık doğrulama kodudur. Bu uygulamanın desteklediği **TOTP** yönteminde kod, gizli kurulum anahtarı ve geçerli zaman kullanılarak hesaplanır.

Uygulama telefondaki kodu okumaz. Aynı anahtar, algoritma, süre ve hane ayarlarıyla kodu yerelde hesaplar. Bu yüzden bilgisayarın saatinin doğru olması gerekir.

Giriş akışı şöyledir:

1. QR kodunu veya kurulum anahtarını tanıtırsın.
2. Uygulama güncel OTP kodunu üretir ve süresi dolunca yeniler.
3. **Sophos’a bağlan** düğmesine bastığında mevcut şifrenin sonuna güncel kod eklenir.
4. Yerel backend bu bilgileri Sophos Connect’in `sccli.exe` aracına iletir.
5. Bağlantı durumunu Sophos Connect ekranından kontrol edersin.

**Şifre alanına yalnızca mevcut şifreni girmen yeterli. OTP’yi uygulama ekler.**

## Kimler için uygun?

Kendi Sophos hesabında TOTP kullanan ve doğrulama işlemini bilgisayardan yapmak isteyen kullanıcılar için hazırlanmıştır.

Otomatik bağlantı özelliği, şifrenin sonuna OTP eklenmesini bekleyen Windows Sophos Connect profilleriyle kullanılabilir. SSO veya ayrı bir OTP alanı kullanan profillerde bu giriş yöntemi uygun olmayabilir.

Yalnızca kod üretmek ve kopyalamak için Sophos Connect kurulumu gerekmez. Kurum hesabında kullanmadan önce kurumunun masaüstünde OTP kullanımına izin verdiğinden emin ol.

## Kurulum

### Gereksinimler

- **Node.js 24 LTS** ve npm.
- Kendi hesabına ait TOTP QR kodu veya kurulum anahtarı.
- Otomatik VPN bağlantısı için Windows ve yapılandırılmış Sophos Connect.

### Başlatma

Projeyi indirip ana klasöründe terminal aç:

```sh
npm ci
npm run dev
```

Ardından tarayıcıda **http://127.0.0.1:4200** adresini aç.

Windows’ta alternatif olarak **BASLAT.cmd** dosyasını çalıştırabilirsin. Başlatıcı, bağımlılıklar henüz kurulmadıysa ilk kurulumu yapar. İlk kurulum internet bağlantısı gerektirir.

Backend ve frontend aynı terminalde çalışır. Durdurmak için `Ctrl+C` kullan.

## Kullanım

### 1. Hesabını tanıt

Sophos kullanıcı portalındaki TOTP QR görselini seç veya **Base32 kurulum anahtarını** ilgili alana gir. Bu alan hesabının şifresi için değildir.

Manuel anahtar kullanıyorsan algoritma, süre ve hane ayarlarını Sophos ayarlarınla eşleştir. TOTP adresi içeren QR kodu seçildiğinde bu bilgiler adresten alınır.

### 2. Kodu üret

**Kodu üret** düğmesine bas. İlk kullanımda ekrandaki kodu telefonundaki doğrulayıcıyla karşılaştır. Kodlar eşleştiğinde giriş için kullanabilirsin.

Desteklenen ayarlar: **SHA1, SHA256, SHA512**; **6 veya 8 hane**; **10–300 saniye** yenileme aralığı.

### 3. Giriş yöntemini seç

**Elle giriş:** **Kodu kopyala** düğmesiyle kodu alıp normal Sophos girişinde kullan. İstersen kullanıcı adını ve **şifre + OTP** birleşimini ayrı düğmelerle de kopyalayabilirsin.

**Uygulamadan bağlantı:**

1. Sophos Connect’teki bağlantı adını boş metin alanına kendin yaz.
2. Kullanıcı adını ve mevcut şifreni gir; şifreye OTP ekleme.
3. **Sophos’a bağlan** düğmesine bas.
4. Sonucu Sophos Connect ekranından kontrol et.

Bağlantı adları otomatik listelenmez veya doldurulmaz. Kodun son 5 saniyesinde uygulama yeni kodu beklemeni ister. Bağlantı isteğinin gönderilmesi, VPN bağlantısının tamamlandığı anlamına gelmez.

### 4. İşin bitince oturumu temizle

**Oturumu temizle**, uygulamadaki anahtarı, kullanıcı adını, şifreyi ve bağlantı alanını temizler. Sekmeyi kapattığında bilgileri yeniden girmen gerekir.

## Gizlilik ve giriş bilgileri

Uygulama bilgilerini kalıcı olarak saklamaz; kullanım sırasında açık sekmenin belleğinde tutar.

| Bilgi | Nasıl işlenir? |
| --- | --- |
| QR görseli | Tarayıcıda okunur; görsel backend’e yüklenmez. |
| OTP kurulum anahtarı | Kod hesaplamak için yerel backend’e gönderilir; diske kaydedilmez. |
| Kullanıcı adı ve şifre | Bağlantı düğmesine bastığında yerel backend üzerinden Sophos komut aracına aktarılır. |
| Kopyalanan değerler | Sistem panosuna yazılır. Oturumu temizlemek panoyu temizlemez. |

Backend yalnızca `127.0.0.1` üzerinde dinler. Giriş bilgileri dosyaya, veritabanına veya `localStorage` içine kaydedilmez; istek gövdeleri loglanmaz.

**Bilmen gereken sınır:** Sophos’un komut aracı şifreyi argüman olarak aldığı için şifre + OTP, aktarım sırasında kısa süreliğine Windows süreç komut satırında bulunabilir. JavaScript belleğindeki bütün kopyaların fiziksel olarak silinmesi de garanti edilmez.

Gerçek QR kodlarını, kurulum anahtarlarını, şifreleri, bağlantı adreslerini veya kişisel ekran görüntülerini GitHub’a yükleme.

## Geliştiriciler için

### Teknolojiler ve klasörler

| Klasör | İçerik |
| --- | --- |
| `frontend/` | Angular 21 ve PrimeNG 21 ile kullanıcı arayüzü |
| `backend/` | NestJS API, Node.js kripto modülüyle TOTP üretimi ve Sophos komut aktarımı |
| `shared/` | İki uygulamanın kullandığı ortak TypeScript API tipleri |
| `BASLAT.cmd` | Windows başlatıcısı |

Proje **npm workspaces** kullanır. Kurulum ve komutları ana klasörden çalıştır.

### Komutlar

```sh
npm run dev     # Backend ve frontend'i başlat
npm run build   # İki uygulamayı derle
npm test        # OTP ve Sophos komut aktarımı testlerini çalıştır
```

Frontend `4200`, backend `3000` portunu kullanır. Frontend geliştirme sunucusu `/api` isteklerini yerel backend’e yönlendirir.

Derleme çıktıları `frontend/dist/browser/` ve `backend/dist/` altındadır. Backend geliştirme komutu başlangıçta TypeScript’i derler; backend kaynaklarını değiştirdiğinde geliştirme sürecini yeniden başlat.

Testler RFC 6238 örneklerini, geçersiz girişleri, kod süresini, profil doğrulamasını ve Sophos komutuna bilgi aktarımını kapsar. Bağlantı testleri sahte komut çalıştırıcısı kullanır; gerçek VPN bağlantısı açmaz.

## Sık karşılaşılan durumlar

| Durum | Ne yapabilirsin? |
| --- | --- |
| Telefonda ve bilgisayarda kodlar farklı | Saati otomatik eşitle; algoritma, süre ve hane ayarlarını karşılaştır. |
| Sophos komut aracı bulunamıyor | Sophos Connect’in standart Windows kurulumunu ve servisinin çalıştığını kontrol et. |
| Bağlantı adı bulunamıyor | Sophos Connect’te görünen bağlantı adını eksiksiz yaz. |
| Backend’e ulaşılamıyor | Geliştirme terminalini ve 3000/4200 portlarını kontrol et. |
| Değişiklikler görünmüyor | Başlatıcıyı yeniden çalıştırıp sayfayı yenile. |

Bu proje yerel kullanım için hazırlanmıştır. İnternete açık barındırma veya çok kullanıcılı bir servis için kimlik doğrulama yapılandırması içermez.
