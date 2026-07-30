import type {
  CommonPlayerDto,
  CommonPlayersResultDto,
  SpellDto,
} from "@/application/dto/common-players-dto";

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
          className="inline-flex items-center gap-1.5 rounded border border-current/20 px-2 py-0.5 text-xs whitespace-nowrap"
        >
          <span>{formatSpell(spell)}</span>

          {spell.isLoan && (
            // BR-3: kiralık dönemler sayılır ama açıkça işaretlenir.
            <span className="rounded bg-current/10 px-1 font-medium">
              kiralık
            </span>
          )}

          {spell.appearances !== null && (
            <span className="opacity-60">{spell.appearances} maç</span>
          )}
        </li>
      ))}
    </ul>
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
    <li className="grid gap-3 border-b border-current/10 py-4 last:border-b-0 sm:grid-cols-[minmax(0,14rem)_1fr]">
      <div className="min-w-0">
        <p className="font-medium">{player.name}</p>
        <p className="text-sm opacity-60">
          {[player.position, player.nationality]
            .filter((value) => value !== null)
            .join(" · ") || "bilgi yok"}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium tracking-wide uppercase opacity-60">
            {clubAName}
          </p>
          <SpellBadges spells={player.spellsAtA} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium tracking-wide uppercase opacity-60">
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
        className="rounded-lg border border-current/15 p-6 text-center"
      >
        <h2 id="sonuc-basligi" className="font-medium">
          {clubA.shortName} ve {clubB.shortName}
        </h2>
        <p className="mt-2 text-sm opacity-70">
          Bu iki kulüpte de forma giymiş bir oyuncu bulunamadı.
        </p>
        <p className="mt-1 text-xs opacity-50">
          Veri kümesi altı Avrupa liginin tarihsel kadrolarını kapsar; bu
          kulüpler dışındaki kariyerler yer almaz.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="sonuc-basligi" className="flex flex-col gap-4">
      <h2 id="sonuc-basligi" className="text-lg font-medium">
        {clubA.shortName} ∩ {clubB.shortName}
        <span className="ml-2 text-sm font-normal opacity-60">
          {count} ortak oyuncu
        </span>
      </h2>

      <ul className="rounded-lg border border-current/15 px-4">
        {players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            clubAName={clubA.shortName}
            clubBName={clubB.shortName}
          />
        ))}
      </ul>
    </section>
  );
}
