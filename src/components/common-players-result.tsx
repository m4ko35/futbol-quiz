import type {
  CommonPlayerDto,
  CommonPlayersResultDto,
  SpellDto,
} from "@/application/dto/common-players-dto";
import type { DegeneratePair } from "@/domain/services/club-pair-quality";
import { countryName } from "@/lib/country-name";
import { positionName } from "@/lib/position-name";
import { ClubMark } from "./club-mark";

/**
 * Ortak oyuncu listesi — PROJECT.md §6.2 yanıtının görünümü.
 *
 * Sunum bileşeni: iş mantığı içermez, veri getirmez. Aldığı DTO'yu gösterir.
 * ESLint bu klasörden `@/infrastructure` importunu zaten engelliyor (§2.1).
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

function SpellBadges({ spells }: { spells: readonly SpellDto[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {spells.map((spell, index) => (
        <li
          key={index}
          /*
            SOL KENAR ÇİZGİSİ DÖNEMİN TÜRÜNÜ TAŞIR. Rozet artık bir "etiket"
            değil, defterdeki bir kayıt: soldaki kalın kenar mürekkep izi gibi
            duruyor ve üç durumu birbirinden ayırıyor — normal, kiralık, kanıtsız.
            Renk hiçbirinde TEK gösterge değil; kiralıkta "kiralık" sözcüğü,
            kanıtsızda "kaynakta ayrıntı yok" metni ve kesik çizgi de var
            (WCAG 1.4.1).
          */
          className={
            "inline-flex items-baseline gap-2 rounded-sm border border-l-2 px-2 py-1 text-xs whitespace-nowrap " +
            (!spell.hasEvidence
              ? // BR-8: kanıtsız dönem `note` rolünde. `muted` DEĞİL: ikisi de
                // gri görünüyordu ve kanıtsız dönem sıradan ikincil metinden
                // ayırt edilemiyordu. `note` kaynağın sustuğu yeri işaretler.
                "border-dashed border-note bg-note-soft text-note italic"
              : spell.isLoan
                ? "border-line border-l-warn bg-warn-soft"
                : "border-line border-l-line-strong bg-surface-2")
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
            <span className="text-[0.625rem] font-extrabold tracking-wide text-warn uppercase">
              kiralık
            </span>
          )}

          {spell.appearances !== null && (
            <span className="tabular-nums text-muted">
              {spell.appearances} maç
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Listede kanıtsız dönem var mı? Varsa açıklama gösterilir (BR-8). */
function hasUnevidencedSpell(players: readonly CommonPlayerDto[]): boolean {
  return players.some((player) =>
    [...player.spellsAtA, ...player.spellsAtB].some(
      (spell) => !spell.hasEvidence,
    ),
  );
}

function PlayerRow({
  player,
  clubAName,
  clubBName,
}: {
  player: CommonPlayerDto;
  clubAName: string;
  clubBName: string;
}) {
  return (
    <li className="grid border-b border-line transition-colors last:border-b-0 hover:bg-surface-2 sm:grid-cols-[1.05fr_1fr_1fr]">
      <div className="min-w-0 px-4 py-3 sm:border-r sm:border-line">
        <p className="font-bold tracking-tight">{player.name}</p>
        {/*
          İKİ ALAN DA ÇEVRİLİR. `position` veritabanında dilden bağımsız
          anahtar tutar (BR-40), `nationality` ise ISO kodu — ikisi de ham
          hâliyle kullanıcıya hiçbir şey söylemez. Uyruk burada ham KOD olarak
          basılıyordu ve oyuncu seçicisi aynı değeri çeviriyordu; iki ekran
          aynı oyuncuyu iki farklı biçimde gösteriyordu.
        */}
        <p className="text-xs text-muted">
          {[
            positionName(player.position),
            player.nationality === null
              ? null
              : countryName(player.nationality),
          ]
            .filter((value) => value !== null)
            .join(" · ") || "bilgi yok"}
        </p>
      </div>

      <ClubCell club={clubAName} spells={player.spellsAtA} bordered />
      <ClubCell club={clubBName} spells={player.spellsAtB} />
    </li>
  );
}

/**
 * Bir kulübün hücresi.
 *
 * KULÜP ADI GENİŞ EKRANDA GİZLENİR AMA SİLİNMEZ — `sm:sr-only`, `sm:hidden`
 * DEĞİL. Ad, geniş ekranda defterin sabit başlığında bir kez yazılı; her
 * satırda tekrarlanması 55 oyunculuk bir sonuçta aynı iki adı 110 kez basmak
 * demekti. Ama `display:none` yardımcı teknolojiden de gizler ve o kullanıcı
 * "1993 – 2002, 240 maç" satırını hangi kulübe ait olduğunu bilmeden okurdu:
 * ızgara başlığı ile hücre arasında programatik bir bağ yok. `sr-only` ikisini
 * birden çözüyor — gözden kalkıyor, ekran okuyucuda kalıyor.
 */
function ClubCell({
  club,
  spells,
  bordered = false,
}: {
  club: string;
  spells: readonly SpellDto[];
  bordered?: boolean;
}) {
  return (
    <div
      className={"px-4 py-3 " + (bordered ? "sm:border-r sm:border-line" : "")}
    >
      <p className="mb-1.5 text-[0.625rem] font-extrabold tracking-[0.11em] text-muted uppercase sm:sr-only sm:mb-0">
        {club}
      </p>
      <SpellBadges spells={spells} />
    </div>
  );
}

/**
 * Defterin sabit sütun başlığı.
 *
 * DAR EKRANDA YOK (`hidden sm:grid`): üç sütun 390 px'e sığmıyor ve satırlar
 * zaten alt alta yığılıyor. Orada kulüp adı her hücrenin kendi etiketinde
 * duruyor — yani bilgi iki düzende de var, yalnızca yeri değişiyor.
 */
function LedgerHead({
  clubA,
  clubB,
}: {
  clubA: CommonPlayersResultDto["clubA"];
  clubB: CommonPlayersResultDto["clubB"];
}) {
  return (
    <div
      aria-hidden="true"
      className="hidden border-b-2 border-foreground bg-surface-2 sm:grid sm:grid-cols-[1.05fr_1fr_1fr]"
    >
      <div className="border-r border-line px-4 py-2 text-[0.6875rem] font-extrabold tracking-[0.1em] text-muted uppercase">
        Oyuncu
      </div>
      {[clubA, clubB].map((club, index) => (
        <div
          key={club.id}
          className={
            "flex items-center gap-2 px-4 py-2 text-sm font-extrabold " +
            (index === 0 ? "border-r border-line" : "")
          }
        >
          <ClubMark club={club} size={22} />
          <span className="truncate">{club.shortName}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * BR-36 — dejenere çift uyarısı.
 *
 * KİMLİK İDDİA ETMEZ. Kuralın tetiklendiği yedi çiftin ikisi (Condal /
 * Barcelona, Kharkiv / Metalist 1925) gerçekten ayrı kulüptür; "aynı kulüp"
 * demek orada düpedüz yanlış olurdu. Metin ölçülen olguyu söyler, olası
 * açıklamaları da olasılık olarak bırakır — kullanıcı ham sayıları görüp
 * kendisi karar verebilsin.
 *
 * Listenin ÜSTÜNDE durur: uyarı listeyi çerçeveliyor, dipnotu değil.
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

  if (count === 0) {
    return (
      <section
        aria-labelledby="sonuc-basligi"
        className="rounded-xl border border-line bg-surface p-8 text-center shadow-card"
      >
        <h2 id="sonuc-basligi" className="text-lg font-semibold">
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
    <section aria-labelledby="sonuc-basligi" className="flex flex-col gap-4">
      {/*
        ERİŞİLEBİLİR AD AÇIKÇA VERİLİYOR — iki ayrı sebeple.

        1. "∩" karakterini seslendiriciler tutarsız okur: kimi "kesişim" der,
           kimi tamamen atlar. Sözcük ("ve") her okuyucuda aynı şeyi söyler.
        2. Ad, iç içe elemanların metninden TÜRETİLSEYDİ aradaki boşluk CSS'e
           bağlı kalırdı: `display` bilgisi olmayan bir ortamda ölçüldüğünde
           "GalatasarayveArsenal1 ortak oyuncu" çıkıyor. Görsel `gap` ada
           yansımıyor.

        Ad ile görünen metin ANLAMCA aynı; yalnızca simge yerine sözcük ve
        ayırıcılar netleştirilmiş durumda.
      */}
      <h2
        id="sonuc-basligi"
        aria-label={`${clubA.shortName} ve ${clubB.shortName}, ${String(count)} ortak oyuncu`}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold"
      >
        <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 shadow-card">
          <ClubMark club={clubA} size={24} />
          {clubA.shortName}
        </span>
        <span className="text-muted">∩</span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 shadow-card">
          <ClubMark club={clubB} size={24} />
          {clubB.shortName}
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-fg">
          {count} ortak oyuncu
        </span>
      </h2>

      {/*
        DOĞRULUK DEĞİL VARLIK DENETİMİ. Yanıt istemciye `as` ile geçiyor
        (fetch sınırında Zod yok), yani tipin "null olabilir" demesi alanın
        GELDİĞİNİ garanti etmiyor. Eksik alan `!== null` denetiminden geçip
        bileşeni çökertirdi — ölçüldü, sahte yanıt kullanan bileşen testi
        patladı. Eksik ölçüm uyarısızlığa düşer; sayfayı düşürmez.
      */}
      {degenerate ? <DegenerateNote pair={degenerate} /> : null}

      {/*
        DEFTER. Sonuç bir arama çıktısı gibi değil, bir kayıt dökümü gibi
        okunmalı: sabit sütun başlığı, cetvelli satırlar, dönem hücreleri.
        Başlık `ul`'un DIŞINDA duruyor — `ul` yalnızca `li` barındırabilir ve
        bir başlık satırı bir liste öğesi değildir.
      */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <LedgerHead clubA={clubA} clubB={clubB} />
        <ul>
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              clubAName={clubA.shortName}
              clubBName={clubB.shortName}
            />
          ))}
        </ul>
      </div>

      {hasUnevidencedSpell(players) && (
        // BR-8 — §1.4. Kanıtsız kayıtlar ELENMİYOR çünkü eleme, uydurma
        // kayıtlarla birlikte doğru olanları da siliyor (ölçüldü). Elenmiyorsa
        // da söylenmesi gerekir: kullanıcı hangi satıra ne kadar
        // güvenebileceğini bilmelidir.
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
