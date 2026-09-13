import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";
import { feedbackEmailEnabled, serverEnv } from "@/infrastructure/config/env";
import { datasets } from "@/infrastructure/db/repositories";

/**
 * Gizlilik bildirimi ve KVKK aydınlatma metni — PROJECT.md §7.18.
 *
 * METİN KODDAN TÜRETİLDİ, ŞABLONDAN DEĞİL. Hazır gizlilik metinleri reklam
 * ortaklarından ve izleme çerezlerinden söz eder; bu sitede ikisi de yok.
 * Analitik ise VAR ama anonim ve çerezsiz — o yüzden gizlenmez, olduğu gibi
 * beyan edilir. Olmayan bir işlemeyi beyan etmek de olanı gizlemek de metni
 * gerçeğe uymayan bir belgeye çevirir; ikisinden de kaçınılır.
 *
 * Buradaki her cümlenin kodda bir karşılığı var ve §7.18'de ölçüldü:
 *   · ölçüm anonim/çerezsiz → `@vercel/analytics`, `document.cookie` yok
 *   · IP loglanmıyor        → `api-handler.ts` yalnızca traceId/rota/durum/süre yazar
 *   · Wikimedia görür       → `club-mark.tsx` düz `<img>` kullanıyor, vekil yok
 *
 * BİR CÜMLE DEĞİŞTİRİLECEKSE önce §7.18 güncellenir. Metin ile davranış
 * ayrışırsa yanlış olan metindir ve yanlış beyan, beyan etmemekten kötüdür.
 *
 * 16 AĞUSTOS 2026'DA YENİDEN YAZILDI (§11.6). Hesap özelliği üç beyanı
 * geçersiz kıldı: "hesap yok", "çerez yok" ve "size ait saklanan kayıt yok".
 * Üçü de artık DOĞRU DEĞİL ve metin buna göre düzeltildi — kuralın kendisi
 * (metin koddan türetilir, şablondan değil) korunarak.
 *
 * 13 EYLÜL 2026'DA ZİYARET ÖLÇÜMÜ EKLENDİ (§7.18). "Ziyaretçi izleyen hiçbir
 * araç yok" ve "analitik aracı yoktur" cümleleri geçersiz kaldı: Vercel Web
 * Analytics eklendi. Anonim, çerezsiz ve birinci taraf olduğu için metin onu
 * yeni bir "Ziyaret ölçümü" bölümüyle dürüstçe beyan eder; "olmayanlar"
 * listesinde yalnızca gerçekten olmayanlar (ısı haritası, oturum kaydı,
 * parmak izi, reklam) kalır.
 */

export const metadata: Metadata = {
  title: "Gizlilik Bildirimi — Futbol Challenge",
  alternates: { canonical: "/gizlilik" },
  description:
    "Bu sitenin hangi verileri işlediği, nereye gittiği ve ne kadar saklandığı.",
};

/** Metnin son gözden geçirildiği tarih — §7.18 ölçümüyle aynı gün. */
const LAST_REVIEWED = "13 Eylül 2026";

export default async function PrivacyPage() {
  const { CONTACT_EMAIL } = serverEnv();
  const dataGeneratedAt = await datasets.getGeneratedAt();
  // Geri bildirim formu yalnızca açıkken e-posta işler; kapalıyken (mailto
  // yedeği ya da hiç) beyan edilecek bir işleme yok (§7.4, §7.18).
  const feedbackForm = feedbackEmailEnabled();

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Gizlilik Bildirimi
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Bu sitede reklam yok ve sizi tanımlayan hiçbir izleyici yok. Tek
          istisna, kaç kişinin uğradığını görmek için kullanılan{" "}
          <strong>anonim ve çerezsiz</strong> bir ziyaret sayacıdır (aşağıda
          &quot;Ziyaret ölçümü&quot;). Hesap açmak{" "}
          <strong>isteğe bağlıdır</strong>: oyunların tamamı hesapsız oynanır,
          hesap yalnızca lider tablosunda yer almak için gerekir. Aşağıdaki
          metin genel bir şablon değil; sitenin gerçekten ne yaptığının dökümü.
        </p>
        <p className="text-sm text-muted">
          Son gözden geçirme: <strong>{LAST_REVIEWED}</strong>
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Tarayıcınızda kalanlar</h2>
        <p className="max-w-prose">
          Görünüm tercihiniz ve günlük oyun ilerlemeniz tarayıcınızın{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-sm">
            localStorage
          </code>{" "}
          alanında tutulur. Bu kayıtlar{" "}
          <strong>sunucuya hiç gönderilmez</strong>; cihazınızdan çıkmazlar.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Kayıt
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Ne tutar
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Ne kadar
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-2 pr-4 font-medium">futbol-quiz:theme</td>
                <td className="py-2 pr-4 text-muted">
                  Açık / koyu görünüm tercihi
                </td>
                <td className="py-2 text-muted">Siz silene kadar</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 pr-4 font-medium">futbol-quiz:grid</td>
                <td className="py-2 pr-4 text-muted">
                  Bugünkü ızgaranın ilerlemesi
                </td>
                <td className="py-2 text-muted">Ertesi gün geçersiz</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 pr-4 font-medium">
                  futbol-quiz:stat-match
                </td>
                <td className="py-2 pr-4 text-muted">
                  Bugünkü istatistik sorusunun ilerlemesi
                </td>
                <td className="py-2 text-muted">Ertesi gün geçersiz</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="max-w-prose text-sm text-muted">
          Hepsini silmek için tarayıcınızın site verilerini temizlemesi
          yeterlidir. Sildiğinizde yalnızca ilerlemeniz kaybolur; site çalışmaya
          devam eder.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Sunucunun gördükleri</h2>
        <p className="max-w-prose">
          <strong>IP adresiniz</strong>, aynı adresten gelen aşırı istekleri
          sınırlamak için kullanılır. Yalnızca sunucunun belleğinde, bir sayaç
          anahtarı olarak durur: <strong>diske yazılmaz</strong>,{" "}
          <strong>kayıt dosyalarına geçmez</strong> ve sunucu yeniden
          başladığında kaybolur.
        </p>
        <p className="max-w-prose">
          Teknik kayıtlara yalnızca isteğin adresi (örneğin{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-sm">
            /api/grid
          </code>
          ), sonuç kodu, süresi ve o isteğe özel rastgele bir numara yazılır. Bu
          numara her istekte yeniden üretilir — istekleri birbirine bağlamaz ve
          kimseyi tanımlamaz.
        </p>
        <p className="max-w-prose">
          Sunucunun tuttuğu veritabanı <strong>salt okunurdur</strong>. Oyun
          oynarken hiçbir şey kaydedilmez: cevaplarınız, skorunuz ve
          seçimleriniz sunucuda saklanmaz.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Ziyaret ölçümü</h2>
        <p className="max-w-prose">
          Sitenin kaç kişi tarafından ziyaret edildiğini görmek için{" "}
          <strong>Vercel Web Analytics</strong> adlı anonim bir ölçüm aracı
          kullanılır. Bu araç <strong>çerez yazmaz</strong> ve sizi tanımlayacak
          hiçbir bilgi toplamaz.
        </p>
        <p className="max-w-prose">Yalnızca toplu ve anonim sayımlar üretir:</p>
        <ul className="flex max-w-prose list-disc flex-col gap-1 ps-5">
          <li>Hangi sayfaların, kaç kez görüntülendiği.</li>
          <li>
            Günlük tekil ziyaretçi sayısı — anonim; aynı kişiyi günler arasında
            veya başka sitelerde <strong>takip etmez</strong>.
          </li>
          <li>
            Hangi siteden geldiğiniz (yönlendiren adres), ülke ve cihaz/tarayıcı
            türü gibi genel bilgiler.
          </li>
        </ul>
        <p className="max-w-prose">
          Bu veriler <strong>toplu</strong> tutulur: tek tek ziyaretçilere
          inilmez, kişisel profil çıkarılmaz ve reklam için kullanılmaz. Ölçüm,
          sitenin barındırıcısı olan <strong>Vercel</strong> tarafından işlenir
          (aşağıda &quot;Üçüncü taraflar&quot;).
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Hesap açarsanız</h2>
        <p className="max-w-prose">
          Hesap açmak isteğe bağlıdır ve yalnızca lider tablosunda yer almak
          için gerekir. Giriş Google ile yapılır. Google&apos;dan{" "}
          <strong>yalnızca kimlik bilgisi</strong> istenir; e-posta adresiniz,
          adınız ve fotoğrafınız bize <strong>hiç gönderilmez</strong>.
        </p>
        <p className="max-w-prose">Hesabınızda tutulan veriler şunlardır:</p>
        <ul className="flex max-w-prose list-disc flex-col gap-1 ps-5">
          <li>
            Google hesabınızın kimlik numarasının <strong>şifreli özeti</strong>{" "}
            — numaranın kendisi saklanmaz ve özetten geri çıkarılamaz.
          </li>
          <li>
            <strong>Kendi seçtiğiniz</strong> görünen ad. Google&apos;daki
            adınız kullanılmaz; gerçek adınızı yazmak zorunda değilsiniz.
          </li>
          <li>Tamamladığınız günlük turların puanları ve tarihleri.</li>
        </ul>
        <p className="max-w-prose">
          <strong>Görünen adınız lider tablosunda herkese açıktır.</strong>{" "}
          Puanlarınız da öyle. Bunun dışındaki hiçbir bilgi yayımlanmaz.
        </p>
        <p className="max-w-prose">
          Giriş yaptığınızda tarayıcınıza bir <strong>oturum çerezi</strong>{" "}
          yazılır. Bu çerez zorunlu-teknik sınıftadır: sizi tanımak dışında bir
          işi yoktur, siteler arası izleme yapmaz ve reklam için kullanılmaz.
          Çıkış yaptığınızda silinir.
        </p>
        <p className="max-w-prose">
          Hesap verileri, futbol verisinden <strong>ayrı</strong> bir
          veritabanında (Turso, İrlanda) tutulur.
        </p>
      </section>

      {feedbackForm && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Geri bildirim gönderirseniz</h2>
          <p className="max-w-prose">
            Sağ alttaki geri bildirim formuna yazdığınız{" "}
            <strong>e-posta adresiniz</strong> ve <strong>mesajınız</strong>,
            site sahibine bir e-posta olarak iletilir. E-posta adresiniz
            yalnızca size <strong>yanıt verebilmek</strong> için kullanılır.
          </p>
          <p className="max-w-prose">
            Bu bilgiler sitenin veritabanına <strong>kaydedilmez</strong>;
            yalnızca e-posta olarak site sahibinin posta kutusuna düşer ve
            postayı ileten servisin (<strong>Resend</strong>, aşağıda)
            altyapısından geçer. Formu kullanmak{" "}
            <strong>isteğe bağlıdır</strong> — oyunları oynamak için gerekmez.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Üçüncü taraflar</h2>
        <p className="max-w-prose">
          <strong>Wikimedia.</strong> Kulüp armaları Wikimedia Commons
          sunucularından doğrudan tarayıcınıza iner. Bu, tarayıcınızın Wikimedia
          ile kurduğu bir bağlantıdır; dolayısıyla Wikimedia IP adresinizi ve
          tarayıcı bilginizi görür. Hangi sayfada olduğunuzu görmez — sitenin
          yönlendirme politikası yalnızca alan adını paylaşır.
        </p>
        <p className="max-w-prose">
          <strong>Vercel (barındırma ve ziyaret ölçümü).</strong> Site Vercel
          adlı bulut sağlayıcısında çalışır; her internet isteği gibi
          bağlantılarınız da onun altyapısından geçer ve Vercel kendi sunucu
          kayıtlarını kendi politikasına göre tutar. Yukarıda anlatılan anonim
          ziyaret ölçümü de <strong>aynı sağlayıcıda</strong> işlenir — veri
          ayrı bir üçüncü şirkete gönderilmez.
        </p>
        {feedbackForm && (
          <p className="max-w-prose">
            <strong>Resend.</strong> Geri bildirim formunu gönderdiğinizde
            mesajınız ve e-posta adresiniz, postayı ileten Resend (bir e-posta
            servisi) üzerinden site sahibine ulaşır. Resend bu iletiyi kendi
            altyapısında işler ve kayıtlarını kendi politikasına göre tutar.
          </p>
        )}
        <p className="max-w-prose text-sm text-muted">
          Bunların dışında hiçbir üçüncü tarafa veri aktarılmaz. Sitede reklam
          ağı, sosyal medya düğmesi ve gömülü içerik yoktur; tek ölçüm aracı
          yukarıda beyan edilen anonim, çerezsiz ziyaret sayacıdır.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Olmayanlar</h2>
        <ul className="flex max-w-prose list-disc flex-col gap-1 ps-5">
          <li>
            İzleme çerezi kullanılmaz. Yalnızca giriş yapanlarda bir
            <strong> oturum çerezi</strong> vardır ve o zorunlu-tekniktir.
          </li>
          <li>
            {feedbackForm ? (
              <>
                Oyun oynamak ve hesap açmak için e-posta, telefon veya gerçek ad{" "}
                <strong>hiç istenmez</strong>. E-posta adresiniz yalnızca geri
                bildirim formuna <strong>kendiniz</strong> yazarsanız alınır
                (yukarıya bakın).
              </>
            ) : (
              <>
                E-posta, telefon veya gerçek ad <strong>hiç istenmez</strong> —
                hesap açarken bile.
              </>
            )}
          </li>
          <li>
            Isı haritası, oturum kaydı veya parmak izi aracı yoktur. Ziyaret
            ölçümü vardır ama anonim ve çerezsizdir (yukarıda &quot;Ziyaret
            ölçümü&quot;).
          </li>
          <li>Reklam gösterilmez, reklam profili çıkarılmaz.</li>
          <li>
            Tarayıcı tabanlı ilgi alanı gruplaması site tarafından reddedilir.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Haklarınız</h2>
        <p className="max-w-prose">
          6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında; işlenen
          verilerinizi öğrenme, düzeltilmesini veya silinmesini isteme ve
          işlemeye itiraz etme haklarına sahipsiniz.
        </p>
        <p className="max-w-prose">
          <strong>Hesabınız yoksa</strong> bu sitede size ait saklanan bir kayıt
          da yoktur: ilerlemeniz yalnızca kendi tarayıcınızdadır ve tarayıcı
          ayarlarından silebilirsiniz. IP adresiniz kalıcı olarak saklanmadığı
          için silinecek bir kayıt oluşmaz.
        </p>
        <p className="max-w-prose">
          <strong>Hesabınız varsa</strong> silme hakkınızı doğrudan
          kullanabilirsiniz:{" "}
          <Link
            href="/hesap"
            className="font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Hesabım
          </Link>{" "}
          sayfasındaki silme düğmesi hesabınızı ve{" "}
          <strong>bütün skorlarınızı</strong> kalıcı olarak siler; lider
          tablosundaki satırlarınız da kaybolur. Başvuru beklemenize gerek
          yoktur ve işlem geri alınamaz.
        </p>
        {CONTACT_EMAIL === undefined ? (
          <p className="max-w-prose text-sm text-muted">
            Başvuru adresi henüz yapılandırılmamıştır.
          </p>
        ) : (
          <p className="max-w-prose">
            Başvuru ve sorularınız için:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Veri kaynakları</h2>
        <p className="max-w-prose">
          Sitedeki futbolcu ve kulüp bilgileri Wikidata ile Vikipedi&apos;den
          derlenmiştir; armaların lisans ve yazar künyesi{" "}
          <Link
            href="/kaynaklar"
            className="font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Arma Kaynakları ve Lisanslar
          </Link>{" "}
          sayfasındadır. Bu veriler herkese açık kaynaklardan gelir ve
          ziyaretçilerle ilgisi yoktur.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Değişiklikler</h2>
        <p className="max-w-prose">
          Sitenin işleyişi değişirse bu metin <em>önce</em> güncellenir.
          Yukarıdaki &quot;son gözden geçirme&quot; tarihi metnin hangi sürüme
          ait olduğunu gösterir.
        </p>
      </section>

      <p>
        <Link
          href="/"
          className="text-sm font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Başa dön
        </Link>
      </p>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
