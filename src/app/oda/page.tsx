import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DataLabel } from "@/components/data-label";
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
  title: "Oda — Futbol Challenge",
  description: "Arkadaşına bir oda kodu gönder, aynı futbolcuya karşı yarışın.",
  // Kişiye özel bir denetim ekranı; arama sonuçlarında işi yok.
  robots: { index: false, follow: false },
};

/**
 * "Nasıl oynanır" kartları — hepsi GERÇEK kural (§12.2 + BR-58/60).
 *
 * Stitch sayfanın altındaki madde listesini üç kart çiziyordu ama içeriği
 * (mod seçimi, hız çarpanı, WebRTC P2P) uydurmaydı (§5.2 + §12.1). Gerçek
 * kurallar kondu. Üçüncü kart bir bağlantı taşıdığı için `body` bir ReactNode.
 */
const HOW_TO_RULES: readonly {
  readonly title: string;
  readonly body: ReactNode;
}[] = [
  {
    title: "Eş Zamanlı, Aynı Futbolcu",
    body: "Futbolcuyu oyun seçer; ikinize aynı anda açılır. Altı istatistiği de siz cevaplarsınız — kimse haksız bir avantaj almaz.",
  },
  {
    title: "Yüksek Toplam Kazanır",
    body: "Altı istatistiğin toplam puanı yüksek olan kazanır; eşitlik beraberliktir. Rakibinin puanı ikiniz de bitirene kadar gizli — yalnızca kaç istatistik cevapladığını görürsün.",
  },
  {
    title: "Kısa Ömürlü, Saklanmaz",
    body: (
      <>
        Oda kimse katılmazsa 30 dakikada, tur bitmezse 60 dakikada kapanır.
        Sonuç hiçbir yerde saklanmaz, lider tablosuna girmez — onun için{" "}
        <Link
          href="/istatistik"
          className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          günün turu
        </Link>{" "}
        var.
      </>
    ),
  },
];

export default async function RoomLobbyPage() {
  if (!accountsEnabled()) notFound();

  const user = await currentUser();
  if (user === null) redirect("/giris");

  const dataGeneratedAt = await datasets.getGeneratedAt();

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <DataLabel as="p" className="text-accent">
          İki kişilik karşılaşma odası
        </DataLabel>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Oda
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Bir arkadaşınla aynı futbolcuya karşı yarış.{" "}
          <strong className="text-foreground">{user.displayName}</strong> adıyla
          oynuyorsun.
        </p>
        {/* "Nasıl oynanır?" çapası — Stitch'in başlık düğmesinin karşılığı;
            sayfanın altındaki gerçek-kural kartlarına iner. */}
        <a
          href="#nasil-oynanir"
          className="font-display inline-flex w-fit items-center gap-1.5 text-sm font-semibold tracking-wide text-accent uppercase underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.3" />
            <path d="M12 17h.01" />
          </svg>
          <span>Nasıl oynanır?</span>
        </a>
      </header>

      <RoomLobby />

      {/*
        KURALLAR ÖNCEDEN YAZILI. Süre sınırı ve sonucun saklanmaması, oyun
        bittikten sonra öğrenilirse ikisi de sürpriz olur — biri "neden kapandı",
        öteki "kazandığım nerede" diye. İkisi de tasarım kararı, arıza değil.
        Stitch'in üç kartlı düzeni (§12.7), ama GERÇEK kurallarla (§12.2);
        Stitch'in mod seçimi / hız çarpanı / WebRTC içeriği modele aykırıydı
        (§5.2). Numara rozeti süsleme (aria-hidden): kurallar sıralı adımlar
        değil, üç eş kural — `ul`, `ol` değil.
      */}
      <section
        id="nasil-oynanir"
        className="flex scroll-mt-24 flex-col gap-5 border-t border-line pt-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="text-lg font-semibold">Oda nasıl oynanır?</h2>
          <DataLabel className="text-muted">Oda kuralları</DataLabel>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {HOW_TO_RULES.map((rule, index) => (
            <li
              key={rule.title}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4"
            >
              <span
                aria-hidden="true"
                className="font-display flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-sm font-bold tabular-nums text-accent"
              >
                {index + 1}
              </span>
              <h3 className="font-display text-base font-bold tracking-tight">
                {rule.title}
              </h3>
              <p className="text-sm text-muted">{rule.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
