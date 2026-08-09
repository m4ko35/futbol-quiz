"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ClubDto } from "@/application/dto/club-dto";
import type { LeagueSummary } from "@/application/ports/club-repository";
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
 *
 * İKİ KADEMELİ GÖZAT (BR-37, §7.14). Ad yazarak arama yalnızca kulübün adını
 * BİLEN kullanıcı için çalışır; "Hollanda'da hangi takımlar var" sorusunun
 * arama kutusunda karşılığı yok. Bu yüzden kutu boşken lig listesi görünür,
 * bir lig seçilince o ligin kulüpleri gelir.
 *
 * İKİ KADEME TEK LİSTEDİR. Lig satırları da kulüp satırları da aynı
 * `role="listbox"` içinde `role="option"` olarak durur; ok tuşları,
 * `aria-activedescendant` ve Enter tek kod yolundan geçer. İki ayrı gezinme
 * modeli yazmak, ikisinin ayrışması demekti.
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
  /**
   * Gözatılabilir ligler — BR-37. Boş verilirse seçici tek kademeli çalışır
   * (bugünkü davranış), yani özellik veri olmadan kendini kapatır.
   */
  readonly leagues?: readonly LeagueSummary[];
  /** Arama fonksiyonu; testlerde sahte bir uygulama verilir. */
  search(
    term: string,
    leagueWikidataId: string | null,
    signal: AbortSignal,
  ): Promise<ClubDto[]>;
}

/**
 * Listede bir satır: ya bir lig ya bir kulüp.
 *
 * AYRIK BİRLEŞİM, iki ayrı dizi DEĞİL: gezinme indeksi tek bir liste üzerinde
 * çalışmalı, yoksa "kaçıncı satırdayım" sorusunun iki farklı cevabı olur.
 */
type Row =
  | { readonly kind: "league"; readonly league: LeagueSummary }
  | { readonly kind: "club"; readonly club: ClubDto };

/** Tuş vuruşu başına istek atmamak için bekleme süresi. */
const DEBOUNCE_MS = 200;

export function ClubPicker({
  label,
  selected,
  onSelect,
  excludeId,
  initialOptions = [],
  leagues = [],
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
  const [league, setLeague] = useState<LeagueSummary | null>(null);

  /**
   * Lig listesi ne zaman gösterilir: KUTU BOŞ ve lig seçilmemişken.
   *
   * Kullanıcı yazmaya başlayınca liste kendiliğinden bütün kulüplarda arama
   * sonucuna döner — yani bugünkü davranış hiç kaybolmuyor, yalnızca boş
   * kutunun daha önce boşa harcanan hâli değerlendiriliyor.
   */
  const showLeagues =
    league === null && term.trim() === "" && leagues.length > 0;

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Lig listesi gösterilirken kulüp isteği atmak boşuna: sonuç ekrana
    // çıkmayacak. İstek kademe değişince kendiliğinden tetiklenir.
    if (showLeagues) return;

    // Her arama kendi denetleyicisiyle iptal edilir. Aksi hâlde yavaş kalan
    // eski bir yanıt, yeni yanıttan SONRA gelip listeyi geriye alabilir.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsLoading(true);
      setFailed(false);

      search(term, league?.wikidataId ?? null, controller.signal)
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
  }, [term, isOpen, league, showLeagues, search]);

  const clubs = options.filter((club) => club.id !== excludeId);

  const rows: readonly Row[] = showLeagues
    ? leagues.map((l) => ({ kind: "league" as const, league: l }))
    : clubs.map((c) => ({ kind: "club" as const, club: c }));

  /**
   * Liste KESİLDİ Mİ? — BR-37.
   *
   * Sessiz kesme bir kusurdur: kullanıcı ligin tamamını gördüğünü sanar ve
   * aradığı kulübü "veri kümesinde yok" diye okur. Ölçüldü — Serie A'da 83,
   * Bundesliga'da 59 seçilebilir kulüp var, üst sınır ise 50.
   *
   * Yalnızca kutu BOŞKEN gösterilir: kullanıcı yazdığında liste zaten
   * daralıyor ve "83 kulüpten 3'ü" cümlesi yanıltıcı olurdu.
   */
  const truncated =
    league !== null && term.trim() === "" && options.length < league.clubCount;

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
    rows.length === 0
      ? -1
      : Math.min(Math.max(activeIndex, 0), rows.length - 1);

  function choose(club: ClubDto): void {
    onSelect(club);
    setTerm("");
    setIsOpen(false);
    setActiveIndex(-1);
    setLeague(null);
  }

  /** Kademe 2'ye gir. Liste KAPANMAZ — gezinme sürüyor, seçim bitmedi. */
  function enterLeague(next: LeagueSummary): void {
    setLeague(next);
    setTerm("");
    setActiveIndex(0);
  }

  /** Kademe 1'e dön. */
  function leaveLeague(): void {
    setLeague(null);
    setTerm("");
    setActiveIndex(0);
  }

  /**
   * Aramadan tümüyle vazgeç — §7.14.
   *
   * DIŞARI TIKLAMADAN FARKLI: yanlışlıkla dışarı tıklayan kullanıcı yazdığını
   * kaybetmemeli, "Vazgeç" diyen kullanıcı ise açıkça baştan başlamak istiyor.
   * İkisine aynı davranışı vermek, birinde veri kaybı öteki tarafta yarım
   * kalmış bir durum üretirdi.
   */
  function cancel(): void {
    setIsOpen(false);
    setTerm("");
    setLeague(null);
    setActiveIndex(-1);
  }

  /** Satır ne olursa olsun tek giriş noktası: Enter, tıklama, dokunma. */
  function activate(row: Row): void {
    if (row.kind === "league") enterLeague(row.league);
    else choose(row.club);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    /**
     * ESCAPE İKİ ANLAM TAŞIR ve sırası önemlidir: kademe 2'de GERİ, kademe
     * 1'de KAPAT. Tek tuşla doğrudan kapanmak, ligin içine girmiş kullanıcıyı
     * tek yanlış tuşta en başa atardı; kademeli geri alma, gezinmenin tersine
     * çevrilebilir olmasıdır (§7.14).
     */
    if (event.key === "Escape") {
      if (league !== null) {
        leaveLeague();
        return;
      }
      cancel();
      return;
    }

    // Boş kutuda geri silmek de kademe 1'e döner: kullanıcı ligin adını
    // silerek çıkmayı dener ve silinecek bir şey kalmadığında bunu bekler.
    if (event.key === "Backspace" && term === "" && league !== null) {
      event.preventDefault();
      leaveLeague();
      return;
    }

    if (event.key === "Enter") {
      const active = rows[highlighted];
      if (isOpen && active !== undefined) {
        // Form gönderimini engelle: Enter burada "seç" ya da "lige gir" demek.
        event.preventDefault();
        activate(active);
      }
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    if (!isOpen) {
      setIsOpen(true);
      return;
    }
    if (rows.length === 0) return;

    const last = rows.length - 1;
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
            /**
             * TIKLAMA DA AÇAR, yalnızca odaklanma değil.
             *
             * Testle bulundu: `Escape` ya da "Vazgeç" listeyi kapatırken odak
             * kutuda KALIYOR. Açma yalnızca `onFocus`'a bağlı olsaydı,
             * kullanıcı aynı kutuya tekrar tıkladığında hiçbir şey olmazdı —
             * odak zaten oradaydı, yeni bir `focus` olayı doğmuyor.
             */
            onClick={() => {
              setIsOpen(true);
            }}
            /**
             * DIŞARI TIKLAMA LİSTEYİ KAPATIR — §7.14.
             *
             * Kullanılırken bulunan kusur: liste yalnızca Escape ile ya da
             * seçim yapılarak kapanıyordu, dışarı tıklamak işe yaramıyordu ve
             * arayüz kilitlenmiş gibi görünüyordu.
             *
             * Liste İÇİNDEKİ tıklamalar burayı tetiklemez: hem seçenekler hem
             * düğmeler `mousedown`'da `preventDefault` uyguluyor, yani odak
             * kutudan hiç çıkmıyor. Yazılan metin KORUNUR (bkz. `cancel`).
             */
            onBlur={() => {
              setIsOpen(false);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
          />

          {isOpen && (
            <div
              className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop"
              // Kaydırma çubuğuna ya da boşluğa tıklamak listeyi KAPATMAMALI:
              // kullanıcı orada bir şeyi kapatmayı değil, gezinmeyi amaçlıyor.
              // Odak kutudan çıkmadığı sürece `onBlur` de tetiklenmez.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
            >
              {/*
                KADEME 2 BAŞLIĞI. Kullanıcı hangi ligin içinde olduğunu
                görmeli; "geri" için de tıklanabilir bir hedef gerekiyor.
                `tabIndex={-1}` ve `onMouseDown`: odak kuralı gereği düğme
                odağı arama kutusundan ALMAZ (§7.14).
              */}
              {league !== null && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-accent-soft"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    leaveLeague();
                  }}
                >
                  <span aria-hidden="true" className="text-muted">
                    ‹
                  </span>
                  <span className="truncate">{league.name}</span>
                  <span className="ml-auto text-xs font-normal text-muted">
                    tüm ligler
                  </span>
                </button>
              )}

              {/*
                DURUM METNİ LİSTENİN DIŞINDA.
                `role="listbox"` yalnızca `option` çocuğu barındırabilir
                (WAI-ARIA "required owned elements"). "Sonuç yok" bir seçenek
                değildir; listenin içine konduğunda `aria-required-children`
                ihlali oluşur ve ekran okuyucu boş listede gezinmeye çalışır.
              */}
              {rows.length === 0 && (
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
                aria-label={
                  showLeagues
                    ? `${label}: lig listesi`
                    : league === null
                      ? `${label} sonuçları`
                      : `${label}: ${league.name} kulüpleri`
                }
              >
                {rows.map((row, index) => (
                  <li
                    key={
                      row.kind === "league"
                        ? row.league.wikidataId
                        : row.club.id
                    }
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
                      activate(row);
                    }}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                  >
                    {row.kind === "league" ? (
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{row.league.name}</span>
                        <span className="text-muted">{row.league.country}</span>
                        <span className="ml-auto tabular-nums text-muted">
                          {row.league.clubCount}
                        </span>
                        <span aria-hidden="true" className="text-muted">
                          ›
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ClubMark club={row.club} />
                        <span className="font-medium">
                          {row.club.shortName}
                        </span>
                        {row.club.country !== null && (
                          <span className="text-muted">{row.club.country}</span>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {/*
                KESME SESSİZ OLAMAZ (BR-37). Üst sınır bir kaynak koruması,
                bu satır bir dürüstlük koşulu — ikisi çelişmiyor. Söylenmezse
                kullanıcı ligin tamamını gördüğünü sanar ve aradığı kulübü
                "veri kümesinde yok" diye okur.
              */}
              {truncated && league !== null && (
                <p className="border-t border-line px-3 py-2 text-xs text-muted">
                  {league.clubCount} kulüpten {options.length} tanesi
                  gösteriliyor — daraltmak için yazın.
                </p>
              )}

              {/*
                VAZGEÇ — §7.14. Dokunmatik cihazda `Escape` tuşu yok ve
                dışarı tıklamak her zaman kolay değil; görünür bir çıkış
                gerekiyor. `tabIndex={-1}`: odak kutudan çıkarsa `blur`
                tetiklenir ve düğme kendi tıklamasından ÖNCE listeyi kapatırdı.
              */}
              <div className="border-t border-line pt-1">
                <button
                  type="button"
                  tabIndex={-1}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted hover:bg-accent-soft hover:text-foreground"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    cancel();
                  }}
                >
                  Vazgeç
                </button>
              </div>
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

      {/*
        Ekran okuyucuya durum bildirimi. `polite`: kullanıcının yazmasını
        kesmeden, uygun bir anda okunur.

        KADEME DE DUYURULUR (§7.14). Liste kulüplerden liglere döndüğünde
        görsel olarak apaçık ama ekran okuyucu için SESSİZ bir olaydır;
        yalnızca sayı okunsaydı kullanıcı neyin arasında gezindiğini bilemezdi.
      */}
      <span aria-live="polite" className="sr-only">
        {!isOpen || isLoading
          ? ""
          : showLeagues
            ? `${String(rows.length)} lig listeleniyor`
            : league === null
              ? `${String(rows.length)} kulüp bulundu`
              : `${league.name}: ${String(rows.length)} kulüp`}
      </span>
    </div>
  );
}
