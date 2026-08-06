import type {
  CommonPlayerDto,
  CommonPlayersResultDto,
  SpellDto,
} from "@/application/dto/common-players-dto";
import { ClubCrest } from "./club-crest";

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
          className={
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs whitespace-nowrap " +
            (spell.hasEvidence
              ? "border border-line bg-background font-medium tabular-nums"
              : // BR-8: kanıtsız dönem GÖRSEL OLARAK da ayrılır. Kesik çizgi
                // tek başına yeterli değildir (renk/biçim tek gösterge
                // olamaz — WCAG 1.4.1); asıl bilgi metnin kendisindedir.
                "border border-dashed border-line-strong text-muted")
          }
        >
          {spell.hasEvidence ? (
            <span>{formatSpell(spell)}</span>
          ) : (
            <span>kaynakta ayrıntı yok</span>
          )}

          {spell.isLoan && (
            // BR-3: kiralık dönemler sayılır ama açıkça işaretlenir. Renk
            // yalnızca destekleyici; "kiralık" sözcüğü rozette yazılı.
            <span className="rounded bg-warn-soft px-1.5 py-0.5 font-semibold text-warn">
              kiralık
            </span>
          )}

          {spell.appearances !== null && (
            <span className="text-muted">{spell.appearances} maç</span>
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
    <li className="grid gap-3 border-b border-line px-4 py-4 transition-colors last:border-b-0 hover:bg-background sm:grid-cols-[minmax(0,14rem)_1fr] sm:px-5">
      <div className="min-w-0">
        <p className="font-semibold">{player.name}</p>
        <p className="text-sm text-muted">
          {[player.position, player.nationality]
            .filter((value) => value !== null)
            .join(" · ") || "bilgi yok"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            {clubAName}
          </p>
          <SpellBadges spells={player.spellsAtA} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            {clubBName}
          </p>
          <SpellBadges spells={player.spellsAtB} />
        </div>
      </div>
    </li>
  );
}

export function CommonPlayersResult({ result }: CommonPlayersResultProps) {
  const { clubA, clubB, count, players } = result;

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
          Veri kümesi on iki Avrupa liginin tarihsel kadrolarını kapsar; bu
          kulüpler dışındaki kariyerler yer almaz.
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
          <ClubCrest club={clubA} size={24} />
          {clubA.shortName}
        </span>
        <span className="text-muted">∩</span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 shadow-card">
          <ClubCrest club={clubB} size={24} />
          {clubB.shortName}
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-fg">
          {count} ortak oyuncu
        </span>
      </h2>

      <ul className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            clubAName={clubA.shortName}
            clubBName={clubB.shortName}
          />
        ))}
      </ul>

      {hasUnevidencedSpell(players) && (
        // BR-8 — §1.4. Kanıtsız kayıtlar ELENMİYOR çünkü eleme, uydurma
        // kayıtlarla birlikte doğru olanları da siliyor (ölçüldü). Elenmiyorsa
        // da söylenmesi gerekir: kullanıcı hangi satıra ne kadar
        // güvenebileceğini bilmelidir.
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          <span className="mr-1.5 inline-block rounded-md border border-dashed border-line-strong px-1.5 py-0.5 text-xs">
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
