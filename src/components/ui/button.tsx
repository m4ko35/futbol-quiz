import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Paylaşılan birincil düğme — tasarım tokenları (globals.css) üzerine.
 *
 * NEDEN VAR. Aynı `bg-accent … text-accent-fg …` sınıf dizisi bileşenlere
 * onlarca kez elle kopyalanmıştı; küçük bir görsel karar (yükseliş, basılma,
 * parlama, yükleniyor) her kopyada ayrı ayrı yaşıyordu. Tek bir yerden gelen
 * düğme hem tekrarı bitirir hem de o hissi TEK yerde toplar.
 *
 * NEDEN framer-motion / lucide / shadcn YOK. Aynı etki saf CSS geçişleriyle
 * üretiliyor: `hover:-translate-y-0.5` yükseltir, `active:translate-y-0`
 * bastırır, accent renkli gölge parıldar. Böylece yeni bir çalışma-zamanı
 * bağımlılığı, ek paket ağırlığı ve CSP yüzeyi eklenmez. Hareket yalnızca
 * `motion-safe` altında tanımlıdır; azaltılmış-hareket isteğinde düğme sabit
 * durur ama gölge/renk geçişleri korunur.
 *
 * NEDEN "use client" YOK. Bu dosya kanca (hook) kullanmaz. Direktif
 * konulsaydı, sunucu bileşeni olan `room-entry-bar` `buttonClasses`'ı
 * çağıramazdı; direktifsiz bırakılınca hem sunucu (yalnızca sınıf üretimi) hem
 * istemci (etkileşimli `<Button>`) tarafı aynı görünümü paylaşır.
 */

export type ButtonVariant = "solid" | "outline" | "danger";
export type ButtonSize = "md" | "lg" | "hero";

/**
 * Boyut, dolgu/tipografiyi TAŞIR. Temel sınıflarda dolgu YOKTUR: çağıran
 * `className` yalnızca çakışmayan yerleşim sınıfları (`w-full`, `self-start`,
 * `whitespace-nowrap`) eklesin diye — projede `tailwind-merge` yok, bu yüzden
 * `px-5` ile `px-7`'yi yan yana koymak kaynak sırasına bağlı sessiz bir
 * çakışma olurdu.
 */
const SIZE: Record<ButtonSize, string> = {
  md: "px-4 py-3 text-sm font-semibold",
  lg: "px-5 py-3 text-sm font-semibold",
  hero: "px-7 py-3.5 text-base font-bold",
};

export interface ButtonVariants {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Accent renkli, hover'da güçlenen gölge — nötr kart gölgesinin yerine. */
  readonly glow?: boolean;
}

/** Falsy parçaları eleyip birleştirir — çakışma çözümü yok, sıra çağıranındır. */
function cn(
  ...parts: ReadonlyArray<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Görsel sınıfları üretir. `<button>` OLMAYANLAR da (ör. `<Link>`) kullansın
 * diye ayrı: `:disabled` mantığı yalnızca `<Button>` içinde, burada değil.
 */
export function buttonClasses(
  { variant = "solid", size = "lg", glow = false }: ButtonVariants = {},
  className?: string,
): string {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-lg",
    SIZE[size],
    "transition-[box-shadow,opacity,background-color,border-color,color,transform] duration-150",
    "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    variant === "solid" && "bg-accent text-accent-fg hover:opacity-95",
    // Yıkıcı eylem (hesap silme gibi). `text-accent-fg` = accent üstündeki
    // beyaz; `--wrong` için ayrı bir ön-plan tokenı yok, kırmızı üstünde de
    // doğru okunur ve eski elle yazılmış düğmeyle birebir aynı.
    variant === "danger" && "bg-wrong text-accent-fg hover:opacity-95",
    variant === "outline" &&
      "border border-line-strong bg-surface text-foreground hover:border-accent hover:bg-accent-soft",
    glow
      ? "shadow-lg shadow-accent/30 hover:shadow-accent/50"
      : "shadow-card hover:shadow-pop",
    className,
  );
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
  readonly children: ReactNode;
  /** Yükleniyor: spinner gösterir, düğmeyi devre dışı bırakır, `aria-busy` verir. */
  readonly loading?: boolean;
}

export function Button({
  variant = "solid",
  size = "lg",
  glow = false,
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled === true || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        buttonClasses({ variant, size, glow }, className),
        // `pointer-events-none` devre dışıyken hover'ı kestiği için yükseliş de durur.
        "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Metnin rengini alan minik spinner — lucide yerine, currentColor ile. */
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z"
      />
    </svg>
  );
}
