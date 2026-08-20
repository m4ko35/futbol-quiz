import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { peekRoom } from "@/application/use-cases/rooms";
import { PageShell } from "@/components/page-shell";
import { RoomBoard } from "@/components/room-board";
import { RoomInvite } from "@/components/room-invite";
import { RoomJoin } from "@/components/room-join";
import { SiteFooter } from "@/components/site-footer";
import {
  isRoomCode,
  normalizeRoomCode,
} from "@/domain/value-objects/room-code";
import { accountsEnabled } from "@/infrastructure/config/env";
import { datasets } from "@/infrastructure/db/repositories";
import { roomPageContext } from "@/lib/http/room-request";

/**
 * Bir odanın sayfası — PROJECT.md §12.
 *
 * DÖRT EKRAN, TEK ADRES. Aynı adres kullanıcının odayla ilişkisine göre farklı
 * şeyler gösteriyor: üye isen tahta, değilsen katılma çağrısı, oda dolu ya da
 * kapalıysa gerekçe, kod hiç yoksa 404. Kararı `peekRoom` veriyor; sayfa
 * yalnızca çiziyor.
 *
 * ODA SUNUCUDA OKUNUYOR, istemcide değil — `/istatistik`'in saklanan turu için
 * verilen kararın aynısı (§11): istemciye bırakılsaydı ekran önce boş çizilir,
 * kod ve rakip "atlayarak" gelirdi.
 */

export const metadata: Metadata = {
  title: "Oda — Futbol Quiz",
  /**
   * ODA ADRESİ İNDEKSLENMEZ ve bu bir tercih değil: kod paylaşılan bir SIRDIR
   * (BR-55). Arama sonuçlarında görünen bir oda adresi, kodu herkese açık
   * etmek olurdu.
   */
  robots: { index: false, follow: false },
};

interface PageProps {
  readonly params: Promise<{ readonly kod: string }>;
}

export default async function RoomPage({ params }: PageProps) {
  if (!accountsEnabled()) notFound();

  const { kod } = await params;
  const code = normalizeRoomCode(kod);

  // Kod biçimi tutmuyorsa veritabanına hiç sorulmuyor: bu adres yok.
  if (!isRoomCode(code)) notFound();

  /**
   * TEK KANONİK ADRES. "bkj7tz" ve "BKJ-7TZ" aynı odayı gösteriyor; ayıklanmış
   * hâle yönlendirilmeseydi ekranda büyük harfli kod dururken adres çubuğunda
   * başka bir şey yazardı ve kullanıcı hangisini paylaşacağını bilemezdi.
   */
  if (code !== kod) redirect(`/oda/${code}`);

  const dataGeneratedAt = await datasets.getGeneratedAt();

  /**
   * GİRİŞ YOKSA YÖNLENDİRİLMİYOR, DAVET GÖSTERİLİYOR. `/oda` lobisi girişe
   * yönlendiriyor çünkü orada gösterilecek bir şey yok; burada var — kullanıcı
   * neye davet edildiğini görmeden hesap açmak zorunda kalmamalı (§11.1).
   */
  const context = await roomPageContext();
  if (context === null) {
    return (
      <PageShell>
        <RoomInvite code={code} />
        <SiteFooter dataGeneratedAt={dataGeneratedAt} />
      </PageShell>
    );
  }

  const entry = await peekRoom(
    { now: new Date(), userId: context.userId, code },
    context.deps,
  );

  if (entry.kind === "yok") notFound();

  return (
    <PageShell>
      {entry.kind === "uye" && <RoomBoard initialRoom={entry.room} />}
      {entry.kind === "katilabilir" && <RoomJoin code={code} />}
      {entry.kind === "kapali" && (
        <RoomClosed code={code} reason={entry.reason} />
      )}

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}

/**
 * Girilemeyen oda.
 *
 * İKİ GEREKÇE AYRI TUTULUYOR ve ayrımı korumak §12.4'ün kuralı: "dolu" ile
 * "kapandı" farklı şeyler ve kullanıcının bundan sonra yapacağı da farklı —
 * dolu bir odaya arkadaşını arayıp yeni kod istemek, kapanmışa yeni oda kurmak
 * düşüyor.
 */
function RoomClosed({
  code,
  reason,
}: {
  readonly code: string;
  readonly reason: "oda-dolu" | "oda-kapali";
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {reason === "oda-dolu" ? "Bu oda dolu" : "Bu oda kapandı"}
        </h1>
        <p className="max-w-prose text-lg text-muted">
          {reason === "oda-dolu" ? (
            <>
              <span className="font-mono tracking-[0.15em]">{code}</span>{" "}
              odasına başka biri katılmış. Odalar iki kişiliktir.
            </>
          ) : (
            <>
              <span className="font-mono tracking-[0.15em]">{code}</span>{" "}
              odasının süresi doldu ya da turu çoktan başladı.
            </>
          )}
        </p>
      </header>

      <Link
        href="/oda"
        className="w-fit rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Kendi odanı kur
      </Link>
    </div>
  );
}
