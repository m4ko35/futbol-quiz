import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { RoomLobby } from "@/components/room-lobby";
import { SiteFooter } from "@/components/site-footer";
import { accountsEnabled } from "@/infrastructure/config/env";
import { datasets } from "@/infrastructure/db/repositories";
import { currentUser } from "@/lib/auth/current-user";

/**
 * Oda lobisi — PROJECT.md §12.
 *
 * GİRİŞ ŞART ve bu odanın tanımından geliyor (BR-54): sonuç ekranı iki tarafın
 * ADINI gösteriyor, misafirin adı yok. `/hesap` ile aynı kalıp: özellik
 * kapalıysa 404, açık ama giriş yoksa `/giris`.
 */

export const metadata: Metadata = {
  title: "Oda — Futbol Quiz",
  description: "Arkadaşına bir oda kodu gönder, aynı futbolcuya karşı yarışın.",
  // Kişiye özel bir denetim ekranı; arama sonuçlarında işi yok.
  robots: { index: false, follow: false },
};

export default async function RoomLobbyPage() {
  if (!accountsEnabled()) notFound();

  const user = await currentUser();
  if (user === null) redirect("/giris");

  const dataGeneratedAt = await datasets.getGeneratedAt();

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Oda
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Bir arkadaşınla aynı futbolcuya karşı yarış.{" "}
          <strong className="text-foreground">{user.displayName}</strong> adıyla
          oynuyorsun.
        </p>
      </header>

      <RoomLobby />

      {/*
        KURALLAR ÖNCEDEN YAZILI. Süre sınırı ve sonucun saklanmaması, oyun
        bittikten sonra öğrenilirse ikisi de sürpriz olur — biri "neden kapandı",
        öteki "kazandığım nerede" diye. İkisi de tasarım kararı, arıza değil.
      */}
      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
        <p className="font-semibold text-foreground">Odalar nasıl işler</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Futbolcuyu oyun seçer; ikinize aynı anda açılır.</li>
          <li>
            Altı istatistiğin toplam puanı yüksek olan kazanır; eşitlik
            beraberliktir.
          </li>
          <li>
            Rakibinin puanı, ikiniz de bitirene kadar gizlidir — yalnızca kaç
            istatistik cevapladığını görürsün.
          </li>
          <li>
            Oda kısa ömürlüdür: kimse katılmazsa 30 dakikada, tur bitmezse 60
            dakikada kapanır.
          </li>
          <li>
            Sonuç <strong>hiçbir yerde saklanmaz</strong> — lider tablosuna
            girmez. Onun için{" "}
            <Link
              href="/istatistik"
              className="font-semibold text-accent underline underline-offset-2"
            >
              günün turu
            </Link>{" "}
            var.
          </li>
        </ul>
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
