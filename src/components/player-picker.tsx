"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import { MIN_PLAYER_TERM_LENGTH } from "@/application/use-cases/search-players";
import { countryName } from "@/lib/country-name";
import { positionName } from "@/lib/position-name";

/**
 * Oyuncu seçici — ızgarada bir hücreye cevap vermek için (BR-12).
 *
 * NEDEN `ClubPicker`'DAN AYRI BİR BİLEŞEN. İkisi de "combobox with listbox"
 * desenini kullanıyor ama davranışları farklı: kulüp seçici bir SEÇİMİ tutar
 * ve gösterir ("Değiştir" düğmesi), oyuncu seçici ise seçimi üst bileşene
 * verip kapanır — kendi durumu yoktur. Ayrıca oyuncu araması en az iki karakter
 * ister ve hazır bir başlangıç listesi yoktur (76.358 kayıt).
 *
 * İkisini tek bir genel bileşende birleştirmek, her iki tarafın da ihtiyaç
 * duymadığı seçenekleri taşıyan bir arayüz üretirdi. Ortak olan şey desen,
 * kod değil.
 *
 * ODAK KURALI `ClubPicker` ile aynı: odak metin kutusunda kalır, listede
 * gezinme `aria-activedescendant` ile bildirilir.
 */

export interface PlayerPickerProps {
  /** Ekran okuyucuya ve göze hangi hücre için seçim yapıldığını söyler. */
  readonly label: string;
  onSelect(player: PlayerDto): void;
  onCancel(): void;
  /** BR-10 — bu ızgarada zaten kullanılmış oyuncular listede gösterilmez. */
  readonly usedPlayerIds: ReadonlySet<string>;
  /** Arama fonksiyonu; testlerde sahte bir uygulama verilir. */
  search(term: string, signal: AbortSignal): Promise<PlayerDto[]>;
}

/** Tuş vuruşu başına istek atmamak için bekleme süresi. */
const DEBOUNCE_MS = 200;

export function PlayerPicker({
  label,
  onSelect,
  onCancel,
  usedPlayerIds,
  search,
}: PlayerPickerProps) {
  const inputId = useId();
  const listboxId = useId();

  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<PlayerDto[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Panel açıldığında odak arama kutusuna gider. Aksi hâlde klavye kullanıcısı
  // hücreye bastıktan sonra odağı elle buraya taşımak zorunda kalırdı.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = term.trim();
    // Kısa metinde HİÇBİR ŞEY YAPILMAZ — durum sıfırlanmaz da. Sıfırlama
    // efekt gövdesinde `setState` demekti ve basamaklı render üretirdi;
    // gösterilen liste zaten aşağıda `isTermTooShort` ile boşaltılıyor.
    if (trimmed.length < MIN_PLAYER_TERM_LENGTH) return;

    // Her arama kendi denetleyicisiyle iptal edilir; yavaş kalan eski bir yanıt
    // yeni yanıttan sonra gelip listeyi geriye alamasın.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsLoading(true);
      setFailed(false);

      search(trimmed, controller.signal)
        .then((results) => {
          setOptions(results);
          setActiveIndex(0);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setOptions([]);
          setFailed(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, search]);

  const isTermTooShort = term.trim().length < MIN_PLAYER_TERM_LENGTH;

  // Metin kısaldığında eski sonuçlar GÖSTERİLMEZ. Durum sıfırlamak yerine
  // burada türetiliyor: sıfırlama efekt içinde `setState` gerektirirdi.
  const visible = isTermTooShort
    ? []
    : options.filter((player) => !usedPlayerIds.has(player.id));

  // Vurgulanan seçenek saklanan indeksten TÜRETİLİR; liste daraldığında
  // indeksin aralık dışında kalması yapısal olarak imkânsız hâle gelir.
  const highlighted =
    visible.length === 0
      ? -1
      : Math.min(Math.max(activeIndex, 0), visible.length - 1);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === "Enter") {
      const active = visible[highlighted];
      if (active !== undefined) {
        event.preventDefault();
        onSelect(active);
      }
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (visible.length === 0) return;

    const last = visible.length - 1;
    if (event.key === "Home") setActiveIndex(0);
    else if (event.key === "End") setActiveIndex(last);
    else if (event.key === "ArrowDown") {
      setActiveIndex(highlighted >= last ? 0 : highlighted + 1);
    } else {
      setActiveIndex(highlighted <= 0 ? last : highlighted - 1);
    }
  }

  const activeOptionId =
    highlighted >= 0 ? `${listboxId}-${String(highlighted)}` : undefined;

  return (
    // Seçici paneli VURGU KENARLIĞI taşır: sayfada o an eylem bekleyen tek
    // yer burasıdır ve nötr bir kutu bunu söylemiyordu.
    <div className="flex flex-col gap-2 rounded-xl border border-accent bg-surface p-4 shadow-pop">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold">
          {label}
        </label>
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-muted underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onCancel}
        >
          Vazgeç
        </button>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="text"
        value={term}
        role="combobox"
        // Liste her zaman açık: panelin kendisi zaten geçici olarak açılıyor,
        // içinde ikinci bir açılma durumu tutmak kullanıcıya iki adım çıkarırdı.
        aria-expanded
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        placeholder="Oyuncu arayın…"
        // Kenarlık ve odak göstergesi WCAG 1.4.11 (3:1) ölçümüne göre (§7.12).
        className="w-full rounded-lg border border-line-strong bg-background px-3 py-2.5 text-base transition-colors outline-none placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent"
        onChange={(event) => {
          setTerm(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      {/*
        DURUM METNİ LİSTENİN DIŞINDA.
        `role="listbox"` yalnızca `option` çocuğu barındırabilir (WAI-ARIA
        "required owned elements"). "Sonuç yok" bir seçenek değildir; listenin
        içine konduğunda axe bunu `aria-required-children` ihlali olarak
        işaretliyor ve ekran okuyucu boş listede gezinmeye çalışıyor.
      */}
      {visible.length === 0 && (
        <p className="px-3 py-2 text-sm text-muted">
          {isTermTooShort
            ? `Aramak için en az ${String(MIN_PLAYER_TERM_LENGTH)} karakter yazın.`
            : isLoading
              ? "Aranıyor…"
              : failed
                ? "Arama başarısız oldu."
                : "Sonuç yok."}
        </p>
      )}

      <ul
        id={listboxId}
        role="listbox"
        aria-label={label}
        className="max-h-64 overflow-auto rounded-md"
      >
        {visible.map((player, index) => (
          <li
            key={player.id}
            id={`${listboxId}-${String(index)}`}
            role="option"
            aria-selected={index === highlighted}
            className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${
              index === highlighted ? "bg-accent-soft" : ""
            }`}
            // `onMouseDown`, `onClick` değil: `onClick` girdi alanının blur
            // olayından sonra gelir.
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(player);
            }}
            onMouseEnter={() => {
              setActiveIndex(index);
            }}
          >
            <span className="font-medium">{player.name}</span>
            {/* Uyruk ham KOD olarak gösterilmez; "IT" bir Türkçe arayüzde
                kullanıcıya hiçbir şey söylemez (§1.2). */}
            {(player.nationality !== null || player.position !== null) && (
              <span className="ml-2 text-muted">
                {[
                  player.nationality === null
                    ? null
                    : countryName(player.nationality),
                  // Mevki de ham anahtar tutar (BR-40); "goalkeeper" bir
                  // Türkçe arayüzde uyruk koduyla aynı sınıfta bir kusurdur.
                  positionName(player.position),
                ]
                  .filter((part) => part !== null)
                  .join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Ekran okuyucuya durum bildirimi; kullanıcının yazmasını kesmez. */}
      <span aria-live="polite" className="sr-only">
        {!isLoading && !isTermTooShort
          ? `${String(visible.length)} oyuncu bulundu`
          : ""}
      </span>
    </div>
  );
}
