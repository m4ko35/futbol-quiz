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
  /** Dar ekranda görünen kısa ad; erişilebilir ad `title` KALIR. */
  readonly short: string;
}[] = [
  { id: "common-players", href: "/", title: "Ortak Oyuncu", short: "Ortak" },
  { id: "grid", href: "/izgara", title: "3×3 Izgara", short: "Izgara" },
  {
    id: "stat-match",
    href: "/istatistik",
    title: "İstatistik",
    short: "İstatistik",
  },
  {
    id: "which-more",
    href: "/hangisi-daha",
    title: "Hangisi Daha",
    short: "Hangisi",
  },
];

export interface ModeNavProps {
  /**
   * Bulunulan mod; bilinen bir moda ait olmayan sayfalarda (404) `null`.
   * O durumda hiçbir segment dolu görünmez — rastgele birini seçili
   * göstermek kullanıcıya yanlış yer bildirmek olurdu.
   */
  readonly current: ModeId | null;
  /** Başlıktaki yerleşim sınıfları; şeridin kendi görünümü buraya girmez. */
  readonly className?: string;
}

export function ModeNav({ current, className }: ModeNavProps) {
  return (
    <nav
      aria-label="Oyun modları"
      className={
        "flex flex-wrap items-center gap-1 rounded-full border border-line bg-background p-1 " +
        (className ?? "")
      }
    >
      {MODES.map((mode) => {
        const isCurrent = mode.id === current;
        return (
          <Link
            key={mode.id}
            href={mode.href}
            aria-current={isCurrent ? "page" : undefined}
            /*
              ERİŞİLEBİLİR AD HER GENİŞLİKTE AYNI. Görünen metin dar ekranda
              kısalıyor ama `aria-label` tam adı taşıyor: ekran okuyucu
              kullanıcısı için gezinme, tarayıcı penceresinin genişliğine göre
              değişmemeli. WCAG 2.5.3 de sağlanıyor — tam ad, görünen kısa adı
              İÇERİYOR ("Ortak" ⊂ "Ortak Oyuncu").
            */
            aria-label={mode.title}
            className={`rounded-full px-2.5 py-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-3 ${
              isCurrent
                ? "bg-accent font-semibold text-accent-fg shadow-card"
                : "font-medium text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {/*
              Dört tam etiket 390 px'e sığmıyor ve şerit iki satıra sarıyordu:
              yuvarlak bir kapsayıcının içinde sarılmış segmentler, segment
              denetimi olmaktan çıkıp bağlantı yığınına dönüyor.
            */}
            <span className="sm:hidden">{mode.short}</span>
            <span className="hidden sm:inline">{mode.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
