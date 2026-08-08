import Link from "next/link";

/**
 * Oyun modları arasında gezinme — PROJECT.md §9.
 *
 * NEDEN `nav` VE `aria-current`. Hangi moda olduğumuz görsel olarak
 * vurgulanıyor; `aria-current="page"` aynı bilgiyi ekran okuyucuya verir.
 * Vurgunun yalnızca dolgu/renk ile yapılması, o kullanıcıya hiçbir şey
 * söylemezdi (§7.10).
 *
 * `Link`, `a` değil: aynı uygulama içindeki gezinmede Next istemci tarafı
 * yönlendirmeyi kullanır ve sayfa baştan yüklenmez.
 *
 * GÖRÜNÜM: segment denetimi (§7.12). Modlar tek bir kapsayıcının içinde durur
 * ve aralarından biri doludur. Ayrı ayrı duran kutular, modların birbirinin
 * ALTERNATİFİ olduğunu göstermiyordu — birbirinden bağımsız bağlantılar gibi
 * duruyorlardı.
 *
 * Liste dört mod taşıyor ve dar ekranda sarılıyor (`flex-wrap`); beşinci mod
 * eklenirse görünüm yeniden ölçülmeli.
 */

export type ModeId = "common-players" | "grid" | "stat-match" | "which-more";

const MODES: readonly {
  readonly id: ModeId;
  readonly href: string;
  readonly title: string;
}[] = [
  { id: "common-players", href: "/", title: "Ortak Oyuncu" },
  { id: "grid", href: "/izgara", title: "3×3 Izgara" },
  { id: "stat-match", href: "/istatistik", title: "İstatistik" },
  { id: "which-more", href: "/hangisi-daha", title: "Hangisi Daha" },
];

export interface ModeNavProps {
  /**
   * Bulunulan mod; bilinen bir moda ait olmayan sayfalarda (404) `null`.
   * O durumda hiçbir segment dolu görünmez — rastgele birini seçili
   * göstermek kullanıcıya yanlış yer bildirmek olurdu.
   */
  readonly current: ModeId | null;
}

export function ModeNav({ current }: ModeNavProps) {
  return (
    <nav
      aria-label="Oyun modları"
      className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-background p-1"
    >
      {MODES.map((mode) => {
        const isCurrent = mode.id === current;
        return (
          <Link
            key={mode.id}
            href={mode.href}
            aria-current={isCurrent ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isCurrent
                ? "bg-accent font-semibold text-accent-fg shadow-card"
                : "font-medium text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {mode.title}
          </Link>
        );
      })}
    </nav>
  );
}
