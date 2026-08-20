import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccountActions } from "@/components/account-actions";
import { SiteFooter } from "@/components/site-footer";
import { accountsEnabled } from "@/infrastructure/config/env";
import { datasets } from "@/infrastructure/db/repositories";
import { currentUser } from "@/lib/auth/current-user";

/**
 * Hesap sayfası — PROJECT.md §11.10, BR-48.
 *
 * SAYFA KISA ve öyle kalmalı: burada yapılacak üç şey var — adını görmek,
 * çıkmak, silmek. Ayar biriktiren bir hesap ekranı, saklamadığımız veriyi
 * saklıyormuş izlenimi verirdi.
 */

export const metadata: Metadata = {
  title: "Hesabım — Futbol Quiz",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  if (!accountsEnabled()) notFound();

  const user = await currentUser();
  if (user === null) redirect("/giris");

  const dataGeneratedAt = await datasets.getGeneratedAt();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Hesabım
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Lider tablosunda <strong>{user.displayName}</strong> adıyla
          görünüyorsun.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-2 text-sm text-muted">
          <p className="font-semibold text-foreground">Bu hesapta tutulanlar</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Görünen adın: {user.displayName}</li>
            <li>
              Google hesabının kimlik numarasının <strong>şifreli özeti</strong>
            </li>
            <li>Tamamladığın günlük turların puanları</li>
          </ul>
          <p>
            E-posta adresin <strong>saklanmıyor</strong> — Google&apos;dan hiç
            istenmiyor. Ayrıntı için{" "}
            <Link href="/gizlilik" className="underline underline-offset-2">
              gizlilik bildirimi
            </Link>
            .
          </p>
        </div>

        <AccountActions />
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
