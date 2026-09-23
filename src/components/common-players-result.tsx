"use client";

import { useMemo, useState } from "react";
import type {
  CommonPlayerDto,
  CommonPlayersResultDto,
  SpellDto,
} from "@/application/dto/common-players-dto";
import type { ClubDto } from "@/application/dto/club-dto";
import type { DegeneratePair } from "@/domain/services/club-pair-quality";
import { countryName } from "@/lib/country-name";
import { positionName } from "@/lib/position-name";
import { ClubMark } from "./club-mark";
import { DataLabel } from "./data-label";

/**
 * Ortak oyuncu sonucu — PROJECT.md §6.2 yanıtının görünümü (arayüz yenileme).
 *
 * DEFTER DEĞİL, DOSYA: sonuç artık sıkışık bir tablo değil, her oyuncunun bir
 * KART olduğu editorial bir döküm. Üstte gerçek sayılarla bir özet bandı, sonra
 * döneme/ada sıralanabilen kartlar. Bu bir SUNUM değişikliğidir; hangi veri
 * geldiği (DTO) ve nasıl geldiği (use-case/API) AYNI.
 *
 * İSTEMCİ BİLEŞENİ: sıralama durumu (döneme/ada) burada yaşıyor. Veri getirmez,
 * iş kuralı barındırmaz; ESLint bu klasörden `@/infrastructure` importunu zaten
 * engelliyor (§2.1).
 *
 * VERİ DÜRÜSTLÜĞÜ (§5.2): tasarımın veride KARŞILIĞI OLMAYAN alanları
 * (fotoğraf, forma numarası, ince mevki, kupa/başarı satırı, şiirsel başlık)
 * arayüze KONMADI. Sıra numarası forma numarasının yerine gerçek sıradır; başlık
 * iki kulübün gerçek adıdır; özet sayıları DTO'dan hesaplanır.
 */

export interface CommonPlayersResultProps {
  readonly result: CommonPlayersResultDto;
}

/**
 * Dönem aralığını okunur biçime çevirir; bilinmeyeni UYDURMAZ (§2.7).
 *
 * "hâlâ kadroda" ifadesi bilinçli olarak YOK. Wikidata'da bitiş tarihinin
 * olmaması "hâlâ kulüpte" değil "bitişi girilmemiş" demek — ölçüldü, Bayern'in
 * "güncel kadrosunda" 1899 başlangıçlı kayıtlar çıkıyor. Bilinmeyen bitiş
 * "?" olarak gösterilir; yanlış bir kesinlik vermektense bilinmediğini
 * söylemek doğrudur.
 */
export function formatSpell(spell: SpellDto): string {
  const { startYear, endYear } = spell;

  if (startYear === null && endYear === null) {
    return "tarih bilinmiyor";
  }
  if (startYear === null) {
    return `? – ${String(endYear)}`;
  }
  if (endYear === null) {
    return `${String(startYear)} – ?`;
  }
  if (endYear === startYear) {
    return String(startYear);
  }
  return `${String(startYear)} – ${String(endYear)}`;
}

function allSpells(player: CommonPlayerDto): readonly SpellDto[] {
  return [...player.spellsAtA, ...player.spellsAtB];
}

/** Sıralama için oyuncunun bilinen en erken yılı; bilinmiyorsa sona atılır. */
function earliestYear(player: CommonPlayerDto): number {
  let min = Infinity;
  for (const spell of allSpells(player)) {
    if (spell.startYear !== null) min = Math.min(min, spell.startYear);
  }
  return min;
}

type SortMode = "donem" | "ad";

function SpellBadges({ spells }: { spells: readonly SpellDto[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {spells.map((spell, index) => (
        <li
          key={index}
          /*
            SOL KENAR ÇİZGİSİ DÖNEMİN TÜRÜNÜ TAŞIR. Rozet bir "etiket" değil,
            defterdeki bir kayıt: soldaki kalın kenar mürekkep izi gibi duruyor
            ve üç durumu birbirinden ayırıyor — normal, kiralık, kanıtsız. Renk
            hiçbirinde TEK gösterge değil; kiralıkta "kiralık" sözcüğü, kanıtsızda
            "kaynakta ayrıntı yok" metni ve kesik çizgi de var (WCAG 1.4.1).
          */
          className={
            "inline-flex items-baseline gap-2 rounded-sm border border-l-2 px-2 py-1 text-xs whitespace-nowrap " +
            (!spell.hasEvidence
              ? "border-dashed border-note bg-note-soft text-note italic"
              : spell.isLoan
                ? "border-line border-l-warn bg-warn-soft"
                : "border-line border-l-line-strong bg-surface")
          }
        >
          {spell.hasEvidence ? (
            <span
              className={
                "font-bold tabular-nums " + (spell.isLoan ? "text-warn" : "")
              }
            >
              {formatSpell(spell)}
            </span>
          ) : (
            <span>kaynakta ayrıntı yok</span>
          )}

          {spell.isLoan && (
            // BR-3: kiralık dönemler sayılır ama açıkça işaretlenir.
            <span className="text-[0.65rem] font-extrabold tracking-[0.13em] text-warn uppercase">
              kiralık
            </span>
          )}

          {spell.appearances !== null && (
            <span className="tabular-nums text-muted">
              {spell.appearances} maç
            </span>
          )}

          {/* GOL DE GÖSTERİLİR (arayüz yenileme). `null` "bilinmiyor" demek
              (§2.7) ve gizlenir; "0 gol" ancak veri gerçekten 0 derse yazılır. */}
          {spell.goals !== null && (
            <span className="tabular-nums text-muted">{spell.goals} gol</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Listede kanıtsız dönem var mı? Varsa açıklama gösterilir (BR-8). */
function hasUnevidencedSpell(players: readonly CommonPlayerDto[]): boolean {
  return players.some((player) =>
    allSpells(player).some((spell) => !spell.hasEvidence),
  );
}

/**
 * Bir kulüpteki dönem(ler) kartı — arma + kısa ad + dönem rozetleri.
 *
 * KULÜP ADI HER KARTTA YAZILI. Dar ekranda kartlar alt alta gelince "240 maç"
 * satırının hangi kulübe ait olduğu ancak buradan okunur; geniş ekranda da
 * sabit bir başlık yerine her kartın kendi künyesi duruyor.
 */
function ClubSpellCard({
  club,
  spells,
}: {
  readonly club: ClubDto;
  readonly spells: readonly SpellDto[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <ClubMark club={club} size={20} />
        <span className="truncate font-display text-sm font-bold tracking-tight">
          {club.shortName}
        </span>
      </div>
      <SpellBadges spells={spells} />
    </div>
  );
}

function PlayerCard({
  player,
  rank,
  clubA,
  clubB,
  index,
}: {
  readonly player: CommonPlayerDto;
  readonly rank: number;
  readonly clubA: ClubDto;
  readonly clubB: ClubDto;
  /** Kademeli animasyon gecikmesi için görünürdeki sıra. */
  readonly index: number;
}) {
  /*
    İKİ ALAN DA ÇEVRİLİR. `position` veritabanında dilden bağımsız anahtar tutar
    (BR-40), `nationality` ise ISO kodu — ikisi de ham hâliyle kullanıcıya bir
    şey söylemez. Mevki KABA'dır (§5.2): "Orta Saha" gösterilir, "Ofansif Orta
    Saha" gibi ince etiketler UYDURULMAZ.
  */
  const meta =
    [
      positionName(player.position),
      player.nationality === null ? null : countryName(player.nationality),
    ]
      .filter((value) => value !== null)
      .join(" · ") || "bilgi yok";

  return (
    <li
      className="animate-card-in rounded-xl border border-line bg-surface p-4 shadow-card"
      // Kademeli açılış — geç kartlar sayfayı bekletmesin diye gecikme
      // sınırlanıyor. CSP-güvenli (style-src-attr, proxy.ts).
      style={{ animationDelay: `${String(Math.min(index, 10) * 35)}ms` }}
    >
      <div className="flex items-start gap-3">
        {/* SIRA NUMARASI forma numarasının GERÇEK karşılığı (§5.2): tasarım
            forma no gösteriyordu, veride yok; bu sonuçtaki sıradır. */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-display text-sm font-bold tabular-nums text-muted">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-bold tracking-tight">
            {player.name}
          </p>
          <p className="mt-0.5 text-xs text-muted">{meta}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ClubSpellCard club={clubA} spells={player.spellsAtA} />
        <ClubSpellCard club={clubB} spells={player.spellsAtB} />
      </div>
    </li>
  );
}

function SortToggle({
  sort,
  onSort,
}: {
  readonly sort: SortMode;
  onSort(sort: SortMode): void;
}) {
  const OPTIONS: readonly { readonly key: SortMode; readonly label: string }[] =
    [
      { key: "donem", label: "Döneme göre" },
      { key: "ad", label: "Ada göre" },
    ];

  return (
    <div
      role="group"
      aria-label="Sıralama"
      className="inline-flex rounded-lg border border-line bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.key === sort;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onSort(option.key);
            }}
            className={
              "rounded-md px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (active
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-foreground")
            }
          >
            <DataLabel>{option.label}</DataLabel>
          </button>
        );
      })}
    </div>
  );
}

/**
 * BR-36 — dejenere çift uyarısı.
 *
 * KİMLİK İDDİA ETMEZ. Kuralın tetiklendiği yedi çiftin ikisi (Condal /
 * Barcelona, Kharkiv / Metalist 1925) gerçekten ayrı kulüptür; "aynı kulüp"
 * demek orada düpedüz yanlış olurdu. Metin ölçülen olguyu söyler, olası
 * açıklamaları da olasılık olarak bırakır. Listenin ÜSTÜNDE durur: uyarı
 * listeyi çerçeveliyor, dipnotu değil.
 */
function DegenerateNote({ pair }: { pair: DegeneratePair }) {
  return (
    <aside className="rounded-xl border border-line-strong bg-warn-soft p-4 text-sm">
      <p className="font-semibold text-warn">
        Bu iki kulüp kadrolarının neredeyse tamamını paylaşıyor.
      </p>
      <p className="mt-1 text-muted">
        {pair.smallerClubName} adına kayıtlı{" "}
        <span className="tabular-nums">{pair.smallerClubPlayers}</span>{" "}
        oyuncunun <span className="tabular-nums">{pair.sharedPlayers}</span>
        &apos;i bu listede. İki kayıt aynı kulübün Wikidata&apos;da ikiye
        bölünmüş hâli olabileceği gibi, biri diğerinin yedek takımı ya da selefi
        de olabilir. Liste değiştirilmedi.
      </p>
    </aside>
  );
}

export function CommonPlayersResult({ result }: CommonPlayersResultProps) {
  const { clubA, clubB, count, players, degenerate } = result;

  const [sort, setSort] = useState<SortMode>("donem");

  const sorted = useMemo(() => {
    const arr = [...players];
    if (sort === "ad") {
      arr.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    } else {
      arr.sort(
        (a, b) =>
          earliestYear(a) - earliestYear(b) ||
          a.name.localeCompare(b.name, "tr"),
      );
    }
    return arr;
  }, [players, sort]);

  if (count === 0) {
    return (
      <section
        aria-labelledby="sonuc-basligi"
        className="rounded-xl border border-line bg-surface p-8 text-center shadow-card"
      >
        <h2 id="sonuc-basligi" className="font-display text-xl font-bold">
          {clubA.shortName} ve {clubB.shortName}
        </h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
          Bu iki kulüpte de forma giymiş bir oyuncu bulunamadı.
        </p>
        <p className="mx-auto mt-1 max-w-prose text-sm text-muted">
          Veri kümesi yirmi dört ligin tarihsel kadrolarını kapsar; bu kulüpler
          dışındaki kariyerler yer almaz.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="sonuc-basligi" className="flex flex-col gap-5">
      {/*
        ÖZET BANDI — tasarımın "köprü" bandının DÜRÜST hâli. Şiirsel başlık ve
        stok fotoğraf yok; başlık iki kulübün gerçek adı. Kümülatif gol / dönem
        gibi TOPLAM sayılar kaldırıldı: tüm ortak oyuncuların iki kulüpteki
        gollerini toplamak anlamlı bir ölçü değildi. `aria-label` "∩" yerine
        "ve" taşır: seslendiriciler bu simgeyi tutarsız okur (kimi "kesişim"
        der, kimi atlar).
      */}
      <header className="flex flex-col gap-3 rounded-2xl border border-line-strong bg-surface p-5 shadow-card sm:p-6">
        <DataLabel className="text-accent">Ortak kayıt</DataLabel>
        <h2
          id="sonuc-basligi"
          aria-label={`${clubA.shortName} ve ${clubB.shortName}, ${String(count)} ortak oyuncu`}
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <span className="inline-flex items-center gap-2 font-display text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
            <ClubMark club={clubA} size={28} />
            {clubA.shortName}
          </span>
          <span aria-hidden="true" className="text-2xl text-accent sm:text-3xl">
            ∩
          </span>
          <span className="inline-flex items-center gap-2 font-display text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
            <ClubMark club={clubB} size={28} />
            {clubB.shortName}
          </span>
        </h2>
        <p className="text-sm text-muted">{count} ortak oyuncu bulundu.</p>
      </header>

      {/*
        DEĞİL DOĞRULUK, VARLIK DENETİMİ. Yanıt istemciye `as` ile geçiyor (fetch
        sınırında Zod yok); eksik alan `!== null`'dan geçip bileşeni çökertirdi.
        Eksik ölçüm uyarısızlığa düşer, sayfayı düşürmez.
      */}
      {degenerate ? <DegenerateNote pair={degenerate} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataLabel as="h3" size="md" className="text-muted">
          Ortak futbolcular
        </DataLabel>
        <SortToggle sort={sort} onSort={setSort} />
      </div>

      <ul className="flex flex-col gap-3">
        {sorted.map((player, index) => (
          <PlayerCard
            key={player.id}
            player={player}
            rank={index + 1}
            index={index}
            clubA={clubA}
            clubB={clubB}
          />
        ))}
      </ul>

      {hasUnevidencedSpell(players) && (
        // BR-8 — §1.4. Kanıtsız kayıtlar ELENMİYOR çünkü eleme, uydurma
        // kayıtlarla birlikte doğru olanları da siliyor (ölçüldü). Elenmiyorsa
        // da söylenmesi gerekir: kullanıcı hangi satıra ne kadar güvenebileceğini
        // bilmelidir.
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-note">
          <span className="mr-1.5 inline-block rounded-md border border-dashed border-line-strong bg-note-soft px-1.5 py-0.5 text-xs">
            kaynakta ayrıntı yok
          </span>
          işaretli kayıtlarda transfer yılı ve maç bilgisi bulunmuyor. Bu
          dönemler listeden çıkarılmadı — kaynaktaki eksiklik, kaydın yanlış
          olduğu anlamına gelmiyor — ama doğrulukları teyit edilemiyor.
        </p>
      )}
    </section>
  );
}
