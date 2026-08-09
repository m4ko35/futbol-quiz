"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ClubDto } from "@/application/dto/club-dto";
import { ClubMark } from "./club-mark";

/**
 * Kulüp seçici — WAI-ARIA "combobox with listbox popup" deseni.
 *
 * NEDEN hazır bir bileşen kütüphanesi değil: bu desenin erişilebilirliği
 * birkaç ayrıntıya bağlı (`aria-activedescendant`, odak yönetimi, Escape
 * davranışı) ve bunlar test edilebilir olmalı. Kütüphane eklemek hem bağımlılık
 * yüzeyini büyütür hem de bu ayrıntıları görünmez kılardı.
 *
 * ODAK KURALI: klavye odağı HER ZAMAN metin kutusunda kalır; listede gezinme
 * `aria-activedescendant` ile bildirilir. Odağı seçeneklere taşımak ekran
 * okuyucuda yazılan metnin kaybolmasına yol açar.
 */

export interface ClubPickerProps {
  readonly label: string;
  readonly selected: ClubDto | null;
  onSelect(club: ClubDto | null): void;
  /** Diğer seçicide seçili kulüp — listede gösterilmez (BR-4). */
  readonly excludeId?: string | undefined;
  /**
   * Sunucuda hazırlanmış ilk liste.
   *
   * Kutuya ilk odaklanıldığında boş bir liste ve "Aranıyor…" görmek gereksiz
   * bir bekleme yaratıyordu; sayfa zaten sunucuda render edildiği için bu
   * veri elimizde hazır.
   */
  readonly initialOptions?: readonly ClubDto[];
  /** Arama fonksiyonu; testlerde sahte bir uygulama verilir. */
  search(term: string, signal: AbortSignal): Promise<ClubDto[]>;
}

/** Tuş vuruşu başına istek atmamak için bekleme süresi. */
const DEBOUNCE_MS = 200;

export function ClubPicker({
  label,
  selected,
  onSelect,
  excludeId,
  initialOptions = [],
  search,
}: ClubPickerProps) {
  const inputId = useId();
  const listboxId = useId();

  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<ClubDto[]>([...initialOptions]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Her arama kendi denetleyicisiyle iptal edilir. Aksi hâlde yavaş kalan
    // eski bir yanıt, yeni yanıttan SONRA gelip listeyi geriye alabilir.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsLoading(true);
      setFailed(false);

      search(term, controller.signal)
        .then((results) => {
          setOptions(results);
          // Yeni sonuç geldiğinde vurgu başa döner. Boş liste durumu
          // `highlighted` içinde kırpılarak ele alınıyor.
          setActiveIndex(0);
        })
        .catch((error: unknown) => {
          // İptal bir hata değil, beklenen akış.
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setOptions([]);
          setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, isOpen, search]);

  const visible = options.filter((club) => club.id !== excludeId);

  /**
   * Gerçekte vurgulanan seçenek — saklanan indeksten TÜRETİLİR.
   *
   * İki kusuru birden kapatıyor, ikisini de testler yakaladı:
   *
   *  1. Liste hazır seçeneklerle açıldığında saklanan indeks hâlâ -1'di;
   *     hiçbir şey vurgulanmıyor ve Enter hiçbir şey yapmıyordu. Kullanıcı
   *     dolu bir liste görüp Enter'a basıyor, hiçbir şey olmuyordu.
   *  2. Kullanıcı listede aşağı inip sonra yazmaya devam edince liste
   *     daralıyor ve indeks aralığın dışında kalıyordu.
   *
   * Kırpma yerine ayrı bir `setActiveIndex` çağrısı eklemek, her iki durumu da
   * ayrı ayrı hatırlamayı gerektirirdi; türetme bunu yapısal olarak imkânsız
   * kılıyor.
   */
  const highlighted =
    visible.length === 0
      ? -1
      : Math.min(Math.max(activeIndex, 0), visible.length - 1);

  function choose(club: ClubDto): void {
    onSelect(club);
    setTerm("");
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "Enter") {
      const active = visible[highlighted];
      if (isOpen && active !== undefined) {
        // Form gönderimini engelle: Enter burada "seç" demek.
        event.preventDefault();
        choose(active);
      }
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    if (!isOpen) {
      setIsOpen(true);
      return;
    }
    if (visible.length === 0) return;

    const last = visible.length - 1;
    if (event.key === "Home") setActiveIndex(0);
    else if (event.key === "End") setActiveIndex(last);
    else if (event.key === "ArrowDown") {
      // Sona gelince başa sar: uzun listelerde yukarı çıkmak yerine
      // aşağı devam etmek daha az tuş vuruşu demek.
      setActiveIndex(highlighted >= last ? 0 : highlighted + 1);
    } else {
      setActiveIndex(highlighted <= 0 ? last : highlighted - 1);
    }
  }

  const activeOptionId =
    isOpen && highlighted >= 0
      ? `${listboxId}-${String(highlighted)}`
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-xs font-semibold tracking-wide text-muted uppercase"
      >
        {label}
      </label>

      {selected === null ? (
        <div className="relative">
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={term}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            placeholder="Kulüp arayın…"
            // Kenarlık ve odak göstergesi ÖLÇÜLEREK seçildi (WCAG 1.4.11:
            // arayüz bileşeni sınırı ve odak göstergesi için 3:1). `line-strong`
            // 3,91:1 (açık) / 3,71:1 (koyu); odak konturu `accent` 5,02:1 /
            // 10,02:1 — §7.12 tablosu.
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-base transition-colors outline-none placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent"
            onChange={(event) => {
              setTerm(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />

          {isOpen && (
            <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop">
              {/*
                DURUM METNİ LİSTENİN DIŞINDA.
                `role="listbox"` yalnızca `option` çocuğu barındırabilir
                (WAI-ARIA "required owned elements"). "Sonuç yok" bir seçenek
                değildir; listenin içine konduğunda `aria-required-children`
                ihlali oluşur ve ekran okuyucu boş listede gezinmeye çalışır.
              */}
              {visible.length === 0 && (
                <p className="px-3 py-2.5 text-sm text-muted">
                  {isLoading
                    ? "Aranıyor…"
                    : failed
                      ? "Arama başarısız oldu."
                      : "Sonuç yok."}
                </p>
              )}

              <ul
                id={listboxId}
                role="listbox"
                aria-label={`${label} sonuçları`}
              >
                {visible.map((club, index) => (
                  <li
                    key={club.id}
                    id={`${listboxId}-${String(index)}`}
                    role="option"
                    aria-selected={index === highlighted}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${
                      index === highlighted ? "bg-accent-soft" : ""
                    }`}
                    // `onMouseDown`, `onClick` değil: `onClick` girdi alanının
                    // blur olayından sonra gelir ve o sırada liste kapanmış olur.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(club);
                    }}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <ClubMark club={club} />
                      <span className="font-medium">{club.shortName}</span>
                      {club.country !== null && (
                        <span className="text-muted">{club.country}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        // Seçili kulüp DOLU görünür: arama kutusuyla aynı çerçeveyi taşısaydı
        // kullanıcı seçimin tamamlandığını görsel olarak ayırt edemezdi.
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <ClubMark club={selected} size={28} />
            <span className="truncate font-semibold">{selected.shortName}</span>
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-accent underline underline-offset-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => {
              onSelect(null);
              // Seçim kaldırıldığında odak arama kutusuna dönmeli; aksi hâlde
              // klavye kullanıcısı sayfanın başına savrulur.
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            Değiştir
          </button>
        </div>
      )}

      {/* Ekran okuyucuya durum bildirimi. `polite`: kullanıcının yazmasını
          kesmeden, uygun bir anda okunur. */}
      <span aria-live="polite" className="sr-only">
        {isOpen && !isLoading ? `${String(visible.length)} kulüp bulundu` : ""}
      </span>
    </div>
  );
}
