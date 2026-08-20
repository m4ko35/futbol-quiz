import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";
import { accountsEnabled } from "@/infrastructure/config/env";
import { datasets } from "@/infrastructure/db/repositories";
import { currentUser } from "@/lib/auth/current-user";

/**
 * Giriş ekranı — PROJECT.md §11.10.
 *
 * SAYFA NE İSTEDİĞİMİZİ SÖYLER, ne istemediğimizi de. Kullanıcı "Google ile
 * gir" düğmesine basmadan önce hangi verinin bize geçtiğini görür; bunu
 * sonradan gizlilik metnine saklamak, kararı bilgisiz aldırmak olurdu.
 */

export const metadata: Metadata = {
  title: "Giriş — Futbol Quiz",
  description:
    "Günlük bulmacayı çözüp lider tablosunda yer almak için Google ile giriş yapın.",
  // Giriş ekranının arama sonuçlarında işi yok.
  robots: { index: false, follow: false },
};

/**
 * Geri dönüşün gönderebileceği hata kodları ve karşılıkları.
 *
 * KODLAR AYRINTI SIZDIRMAZ (§6.3): kullanıcıya ne yapacağını söyler, sistemin
 * içini değil. "Jeton doğrulanamadı" ile "issuer yanlış" arasındaki fark
 * kullanıcı için yok; ikisi de "tekrar dene" demek.
 */
const ERRORS: Readonly<Record<string, string>> = {
  akis: "Giriş isteği eşleşmedi. Bu genelde sekme çok uzun açık kaldığında olur — tekrar deneyin.",
  iptal: "Google'da izin verilmedi, giriş tamamlanmadı.",
  google: "Google ile bağlantı kurulamadı. Birazdan tekrar deneyin.",
  jeton: "Giriş doğrulanamadı. Lütfen tekrar deneyin.",
  yapilandirma: "Giriş şu anda kullanılamıyor.",
};

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  // Hesap özelliği kapalıysa sayfa YOKTUR. Kapalı bir özelliğe ait boş bir
  // ekran göstermek, kullanıcıya çalışmayan bir kapı sunmaktır.
  if (!accountsEnabled()) notFound();

  const user = await currentUser();
  if (user !== null) redirect("/istatistik");

  const params = await searchParams;
  const code = typeof params.hata === "string" ? params.hata : undefined;
  const error = code === undefined ? undefined : ERRORS[code];

  const dataGeneratedAt = await datasets.getGeneratedAt();

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Giriş
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Günlük bulmacayı çözüp lider tablosunda yer almak için hesap
          gerekiyor. Oyunun geri kalanı hesapsız da oynanır.
        </p>
      </header>

      {error !== undefined && (
        <p
          // Hata dinamik olarak değil sayfa yüklenirken geliyor; `alert` rolü
          // ekran okuyucunun onu başlıktan önce okumasını sağlar.
          role="alert"
          className="rounded-xl border border-line-strong bg-warn-soft px-4 py-3 text-sm"
        >
          {error}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card">
        <a
          href="/api/auth/google"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Google ile gir
        </a>

        <div className="flex max-w-prose flex-col gap-2 text-sm text-muted">
          <p className="font-semibold text-foreground">Ne saklıyoruz</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              Google hesabınızın kimlik numarasının{" "}
              <strong>şifreli özeti</strong> — numaranın kendisi değil.
            </li>
            <li>
              Kendi seçtiğiniz <strong>görünen ad</strong> ve günlük
              puanlarınız.
            </li>
          </ul>

          <p className="font-semibold text-foreground">Ne saklamıyoruz</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              <strong>E-posta adresiniz.</strong> Google&apos;dan yalnızca
              kimlik bilgisi istiyoruz; adresiniz bize hiç gönderilmiyor.
            </li>
            <li>
              Adınız, fotoğrafınız ve Google hesabınızdaki diğer hiçbir bilgi.
            </li>
          </ul>

          <p>
            Görünen adınız <strong>lider tablosunda herkese görünür</strong>.
            Gerçek adınızı yazmak zorunda değilsiniz.
          </p>
        </div>
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
