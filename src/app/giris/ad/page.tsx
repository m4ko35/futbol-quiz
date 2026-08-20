import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DisplayNameForm } from "@/components/display-name-form";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";
import { accountsEnv } from "@/infrastructure/config/env";
import { datasets } from "@/infrastructure/db/repositories";
import { currentUser } from "@/lib/auth/current-user";
import { PENDING_COOKIE, readPendingValue } from "@/lib/auth/session";

/**
 * Ad seçme adımı — PROJECT.md §11.10, BR-46.
 *
 * BU SAYFA GOOGLE'DAN DÖNEN AMA HESABI OLMAYAN kullanıcı içindir. Google'ın
 * verdiği gerçek adı kullanmıyoruz: insanların gerçek isimlerini istemeden
 * herkese açık bir listeye yazmak olurdu.
 */

export const metadata: Metadata = {
  title: "Ad seç — Futbol Quiz",
  robots: { index: false, follow: false },
};

export default async function ChooseNamePage() {
  const env = accountsEnv();
  if (env === null) notFound();

  // Zaten hesabı olan buraya düşmemeli — düşerse ikinci hesap açmaya çalışır
  // ve kısıt onu reddeder; yani kullanıcı anlamsız bir hatayla karşılaşır.
  const user = await currentUser();
  if (user !== null) redirect("/istatistik");

  /**
   * BEKLEME ÇEREZİ OLMADAN BU SAYFA AÇILMAZ. Sayfanın kendisi bir sır
   * taşımıyor ama adresi bilen birine boş bir form göstermek, "hesap
   * açabilirim" yanılgısı yaratır: kayıt ucu zaten reddedecektir.
   */
  const store = await cookies();
  const pending = await readPendingValue(
    env.authSecret,
    store.get(PENDING_COOKIE)?.value,
    new Date(),
  );

  if (pending === null) redirect("/giris?hata=akis");

  const dataGeneratedAt = await datasets.getGeneratedAt();

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Bir ad seç
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Lider tablosunda bu adla görüneceksin. Google&apos;daki adını
          kullanmıyoruz — burada ne yazarsan o görünür.
        </p>
      </header>

      <DisplayNameForm />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
