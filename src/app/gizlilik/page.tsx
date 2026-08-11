import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { serverEnv } from "@/infrastructure/config/env";
import { datasets } from "@/infrastructure/db/repositories";

/**
 * Gizlilik bildirimi ve KVKK aydınlatma metni — PROJECT.md §7.18.
 *
 * METİN KODDAN TÜRETİLDİ, ŞABLONDAN DEĞİL. Hazır gizlilik metinleri çerezden,
 * analitikten ve reklam ortaklarından söz eder; bu sitede üçü de yok. Olmayan
 * bir işlemeyi beyan etmek, olanı gizlemekle aynı kapıya çıkar — ikisi de
 * metni gerçeğe uymayan bir belgeye çevirir.
 *
 * Buradaki her cümlenin kodda bir karşılığı var ve §7.18'de ölçüldü:
 *   · çerez yok        → `document.cookie` kod tabanında hiç geçmiyor
 *   · izleyici yok     → `package.json`'da analitik paketi yok
 *   · IP loglanmıyor   → `api-handler.ts` yalnızca traceId/rota/durum/süre yazar
 *   · Wikimedia görür  → `club-mark.tsx` düz `<img>` kullanıyor, vekil yok
 *
 * BİR CÜMLE DEĞİŞTİRİLECEKSE önce §7.18 güncellenir. Metin ile davranış
 * ayrışırsa yanlış olan metindir ve yanlış beyan, beyan etmemekten kötüdür.
 */

export const metadata: Metadata = {
  title: "Gizlilik Bildirimi — Futbol Quiz",
  description:
    "Bu sitenin hangi verileri işlediği, nereye gittiği ve ne kadar saklandığı.",
};

/** Metnin son gözden geçirildiği tarih — §7.18 ölçümüyle aynı gün. */
const LAST_REVIEWED = "11 Ağustos 2026";

export default async function PrivacyPage() {
  const { CONTACT_EMAIL } = serverEnv();
  const dataGeneratedAt = await datasets.getGeneratedAt();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Gizlilik Bildirimi
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Bu sitede hesap yok, çerez yok, reklam yok ve ziyaretçi izleyen hiçbir
          araç yok. Aşağıdaki metin genel bir şablon değil; sitenin gerçekten ne
          yaptığının dökümü.
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
        <h2 className="text-xl font-semibold">Üçüncü taraflar</h2>
        <p className="max-w-prose">
          <strong>Wikimedia.</strong> Kulüp armaları Wikimedia Commons
          sunucularından doğrudan tarayıcınıza iner. Bu, tarayıcınızın Wikimedia
          ile kurduğu bir bağlantıdır; dolayısıyla Wikimedia IP adresinizi ve
          tarayıcı bilginizi görür. Hangi sayfada olduğunuzu görmez — sitenin
          yönlendirme politikası yalnızca alan adını paylaşır.
        </p>
        <p className="max-w-prose">
          <strong>Barındırma sağlayıcısı.</strong> Site bir bulut sağlayıcısında
          çalışır ve her internet isteği gibi bu istekler de sağlayıcının
          altyapısından geçer. Sağlayıcı kendi sunucu kayıtlarını kendi
          politikasına göre tutar.
        </p>
        <p className="max-w-prose text-sm text-muted">
          Bunların dışında hiçbir üçüncü tarafa veri aktarılmaz. Sitede reklam
          ağı, analitik aracı, sosyal medya düğmesi ve gömülü içerik yoktur.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Olmayanlar</h2>
        <ul className="flex max-w-prose list-disc flex-col gap-1 ps-5">
          <li>Çerez kullanılmaz — hiçbir türü.</li>
          <li>Üyelik, giriş veya kullanıcı hesabı yoktur.</li>
          <li>Ad, e-posta, telefon gibi kişisel bilgi hiç istenmez.</li>
          <li>Analitik, ısı haritası veya oturum kaydı aracı yoktur.</li>
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
          Pratikte bu sitede size ait saklanan bir kayıt yoktur: ilerlemeniz
          yalnızca kendi tarayıcınızdadır ve tarayıcı ayarlarından
          silebilirsiniz. IP adresiniz kalıcı olarak saklanmadığı için silinecek
          bir kayıt da oluşmaz.
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
    </main>
  );
}
