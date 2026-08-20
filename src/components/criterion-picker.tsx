"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GridCriterionRefDto } from "@/application/use-cases/custom-grid";

/**
 * Ölçüt seçici — "Sen kur" ızgarasında bir eksene kulüp ya da ülke koymak için
 * (PROJECT.md §9.1, BR-25).
 *
 * NEDEN `PlayerPicker`'DAN AYRI. Desen aynı (combobox + listbox), davranış
 * değil: burada arama en az karakter İSTEMEZ çünkü liste zaten süzülmüş ve
 * küçüktür — kullanıcı hiçbir şey yazmadan da seçebilmeli. Ayrıca seçenekler
 * iki TÜR taşıyor (kulüp / uyruk) ve tür görünür olmak zorunda: "Monaco"
 * ülkeyi mi kulübü mü söylüyor, etiketten anlaşılmaz.
 *
 * ODAK KURALI diğer seçicilerle aynı: odak metin kutusunda kalır, listede
 * gezinme `aria-activedescendant` ile bildirilir.
 */

export interface CriterionPickerProps {
  /** Ekran okuyucuya ve göze hangi yuva için seçim yapıldığını söyler. */
  readonly label: string;
  /** Kutuya ilk odaklanıldığında istek atılmadan gösterilecek liste. */
  readonly initialOptions?: readonly GridCriterionRefDto[];
  /**
   * Liste boş kaldığında gösterilecek YÖNLENDİRME.
   *
   * "Sonuç yok" demek yetmiyor: satır seçicisinde liste, seçilmiş sütunlar
   * yüzünden boş kalabilir ve kullanıcının ne yapması gerektiğini bilmesinin
   * başka yolu yoktur.
   */
  readonly emptyHint?: string;
  onSelect(criterion: GridCriterionRefDto): void;
  onCancel(): void;
  /** Arama fonksiyonu; testlerde sahte bir uygulama verilir. */
  search(term: string, signal: AbortSignal): Promise<GridCriterionRefDto[]>;
}

/** Tuş vuruşu başına istek atmamak için bekleme süresi. */
const DEBOUNCE_MS = 200;

export function CriterionPicker({
  label,
  initialOptions = [],
  emptyHint,
  onSelect,
  onCancel,
  search,
}: CriterionPickerProps) {
  const inputId = useId();
  const listboxId = useId();

  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<GridCriterionRefDto[]>([
    ...initialOptions,
  ]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Her arama kendi denetleyicisiyle iptal edilir; yavaş kalan eski bir yanıt
    // yeni yanıttan sonra gelip listeyi geriye alamasın.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsLoading(true);
      setFailed(false);

      search(term.trim(), controller.signal)
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

  // Vurgulanan seçenek saklanan indeksten TÜRETİLİR; liste daraldığında
  // indeksin aralık dışında kalması yapısal olarak imkânsız hâle gelir.
  const highlighted =
    options.length === 0
      ? -1
      : Math.min(Math.max(activeIndex, 0), options.length - 1);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === "Enter") {
      const active = options[highlighted];
      if (active !== undefined) {
        event.preventDefault();
        onSelect(active);
      }
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (options.length === 0) return;

    const last = options.length - 1;
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
    <div className="flex flex-col gap-2 rounded-xl border border-accent bg-surface p-4 shadow-pop">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold">
          {label}
        </label>
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-3 text-sm font-medium text-muted underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
        aria-expanded
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        placeholder="Arayın ya da listeden seçin…"
        className="w-full rounded-lg border border-line-strong bg-background px-3 py-2.5 text-base transition-colors outline-none placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent"
        onChange={(event) => {
          setTerm(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      {/* Durum metni listenin DIŞINDA: `role="listbox"` yalnızca `option`
          çocuğu barındırabilir (WAI-ARIA required owned elements). */}
      {options.length === 0 && (
        <p className="px-3 py-2 text-sm text-muted">
          {isLoading
            ? "Aranıyor…"
            : failed
              ? "Arama başarısız oldu."
              : (emptyHint ?? "Uygun ölçüt yok.")}
        </p>
      )}

      <ul
        id={listboxId}
        role="listbox"
        aria-label={label}
        className="max-h-64 overflow-auto rounded-md"
      >
        {options.map((option, index) => (
          <li
            key={`${option.kind}:${option.id}`}
            id={`${listboxId}-${String(index)}`}
            role="option"
            aria-selected={index === highlighted}
            className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-3 text-sm ${
              index === highlighted ? "bg-accent-soft" : ""
            }`}
            // `onMouseDown`, `onClick` değil: `onClick` girdi alanının blur
            // olayından sonra gelir.
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(option);
            }}
            onMouseEnter={() => {
              setActiveIndex(index);
            }}
          >
            <span className="font-medium">{option.label}</span>
            <span className="shrink-0 text-[0.7rem] font-medium tracking-wide text-muted uppercase">
              {option.kind === "club" ? "kulüp" : "uyruk"}
            </span>
          </li>
        ))}
      </ul>

      <span aria-live="polite" className="sr-only">
        {isLoading ? "" : `${String(options.length)} ölçüt bulundu`}
      </span>
    </div>
  );
}
