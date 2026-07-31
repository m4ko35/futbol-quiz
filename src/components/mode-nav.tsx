import Link from "next/link";

/**
 * Oyun modları arasında gezinme — PROJECT.md §9.
 *
 * NEDEN `nav` VE `aria-current`. İki bağlantıdan hangisinde olduğumuz görsel
 * olarak vurgulanıyor; `aria-current="page"` aynı bilgiyi ekran okuyucuya
 * verir. Vurgunun yalnızca kalınlık/renk ile yapılması, o kullanıcıya hiçbir
 * şey söylemezdi (§7.10).
 *
 * `Link`, `a` değil: aynı uygulama içindeki gezinmede Next istemci tarafı
 * yönlendirmeyi kullanır ve sayfa baştan yüklenmez.
 */

export type ModeId = "common-players" | "grid" | "stat-match";

const MODES: readonly {
  readonly id: ModeId;
  readonly href: string;
  readonly title: string;
}[] = [
  { id: "common-players", href: "/", title: "Ortak Oyuncu" },
  { id: "grid", href: "/izgara", title: "3×3 Izgara" },
  { id: "stat-match", href: "/istatistik", title: "İstatistik" },
];

export interface ModeNavProps {
  readonly current: ModeId;
}

export function ModeNav({ current }: ModeNavProps) {
  return (
    <nav aria-label="Oyun modları" className="flex flex-wrap gap-2">
      {MODES.map((mode) => {
        const isCurrent = mode.id === current;
        return (
          <Link
            key={mode.id}
            href={mode.href}
            aria-current={isCurrent ? "page" : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:ring-current/60 focus:outline-none ${
              isCurrent
                ? "border-current/60 bg-current/10 font-semibold"
                : "border-current/25 opacity-80 hover:opacity-100"
            }`}
          >
            {mode.title}
          </Link>
        );
      })}
    </nav>
  );
}
