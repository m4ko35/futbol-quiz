"use client";

import { Fragment, useCallback, useState } from "react";
import type { GridCriterionRefDto } from "@/application/use-cases/custom-grid";
import { GRID_SIZE, GRID_SIZES, type GridSize } from "@/domain/services/grid";
import { CriterionPicker } from "./criterion-picker";
import { DataLabel } from "./data-label";
import { CriterionIcon, MatrixIcon } from "./grid-icons";
import { Button } from "./ui/button";

/**
 * "Sen kur" — ızgarayı kullanıcı kurar (PROJECT.md §9.1, BR-25).
 *
 * SIRA ÜRETİM ALGORİTMASININ SIRASIDIR (`generate.ts`): önce sütunlar, sonra
 * satırlar. Sütunlar birbiriyle hiç kesişmez (bir hücre her zaman satır ×
 * sütundur), dolayısıyla sütun seçimi süzgeçsizdir; satır adayları ise seçilen
 * BÜTÜN SÜTUNLARLA oynanabilir olanlarla sınırlıdır.
 *
 * NEDEN SÜZGEÇ ZORUNLU, ölçüldü (§9.1): serbest seçimde rastgele altı kulübün
 * yalnızca %0,1'i dokuz hücresi de dolu bir ızgara veriyor. Süzgeçsiz bir
 * kurucu, kullanıcının denemelerinin neredeyse tamamını reddederdi.
 *
 * BOYUT SEÇİLEBİLİR (BR-27): 2×2 … 5×5. Boyut büyüdükçe süzgecin koşul sayısı
 * artıyor, yani aday havuzu daralıyor — ölçülen bedel §9.1'de.
 *
 * SÜTUN DEĞİŞİRSE SATIRLAR SİLİNİR. Satırların geçerliliği sütunlara BAĞLI:
 * bir sütun değiştiğinde eski satırlar oynanamaz hâle gelebilir. Sessizce
 * bırakmak, seçicinin gösterdiğinden başka bir ızgara kurmak olurdu.
 *
 * GÖRÜNÜM: KURUCU KURDUĞU IZGARAYI GÖSTERİR (§9.1). Eskiden iki düz yuva
 * listesiydi; şimdi günün ızgarasıyla aynı MATRİS iskeleti — üst satır sütun
 * yuvaları, sol sütun satır yuvaları, iç hücreler ise cevapların geleceği yeri
 * gösteren soluk yer tutucular. Kullanıcı ne kurduğunu bir bakışta görüyor ve
 * kurunca aynı düzene oynamaya geçiyor. İç hücreler `aria-hidden` ve tıklanamaz:
 * bu ekran ızgarayı KURAR, oynatmaz.
 */

export interface BuiltGrid {
  readonly rows: readonly GridCriterionRefDto[];
  readonly columns: readonly GridCriterionRefDto[];
}

export interface GridBuilderProps {
  /** Sütun adayları — kulüp araması, süzgeçsiz. */
  searchColumns(
    term: string,
    signal: AbortSignal,
  ): Promise<GridCriterionRefDto[]>;
  /** Satır adayları — seçilmiş sütunlara göre süzülür (BR-25). */
  searchRows(
    term: string,
    against: readonly GridCriterionRefDto[],
    signal: AbortSignal,
  ): Promise<GridCriterionRefDto[]>;
  onBuilt(grid: BuiltGrid): void;
}

type Slot = { readonly axis: "column" | "row"; readonly index: number };

export function GridBuilder({
  searchColumns,
  searchRows,
  onBuilt,
}: GridBuilderProps) {
  // Varsayılan boyut günlük ızgarayla aynı: kullanıcı bildiği oyunla
  // başlasın, farklı bir boyut istemek onun kararı olsun.
  const [size, setSize] = useState<GridSize>(GRID_SIZE);
  const [columns, setColumns] = useState<GridCriterionRefDto[]>([]);
  const [rows, setRows] = useState<GridCriterionRefDto[]>([]);
  const [open, setOpen] = useState<Slot | null>(null);

  const columnsReady = columns.length === size;
  const rowsReady = rows.length === size;

  const searchForRow = useCallback(
    (term: string, signal: AbortSignal) => searchRows(term, columns, signal),
    [searchRows, columns],
  );

  function choose(criterion: GridCriterionRefDto): void {
    if (open === null) return;

    if (open.axis === "column") {
      const next = [...columns];
      next[open.index] = criterion;
      setColumns(next);
      // Satırların geçerliliği sütunlara bağlıydı; dayanak değişti.
      setRows([]);
    } else {
      const next = [...rows];
      next[open.index] = criterion;
      setRows(next);
    }
    setOpen(null);
  }

  function clearColumn(index: number): void {
    setColumns(columns.filter((_, i) => i !== index));
    setRows([]);
  }

  function clearRow(index: number): void {
    setRows(rows.filter((_, i) => i !== index));
  }

  const chosenKeys = new Set(
    [...columns, ...rows].map((one) => `${one.kind}:${one.id}`),
  );

  // DİNAMİK YÖNERGE: hangi eksen sırada. Ekran okuyucuya da bildirilir; adım
  // ilerledikçe metin değişmesi yalnızca görsel bir olay olmamalı.
  const hint = !columnsReady
    ? `${String(size - columns.length)} sütun (kulüp) seçin — üstteki yuvalar.`
    : !rowsReady
      ? `${String(size - rows.length)} satır (kulüp veya ülke) seçin — soldaki yuvalar.`
      : "Izgaranız hazır — aşağıdan kurun.";

  return (
    <div className="flex flex-col gap-4">
      {/*
        BOYUT — segment denetimi (§7.12), tema seçicisiyle aynı idyom. Boyut
        değişince SEÇİMLER SIFIRLANIR: küçülen ızgarada fazla ölçütler sessizce
        düşerdi, büyüyende satırların geçerliliği yeni sütunlara bağlı olurdu.
      */}
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Izgara boyutu</legend>
        <DataLabel className="text-muted">Boyut</DataLabel>
        <span className="flex items-center gap-0.5 rounded-lg border border-line bg-background p-0.5">
          {GRID_SIZES.map((option) => (
            <label
              key={option}
              className={`font-display cursor-pointer rounded-md px-3 py-2 text-sm font-semibold tabular-nums transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                option === size
                  ? "bg-accent text-accent-fg shadow-card"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="grid-size"
                className="sr-only"
                value={option}
                checked={option === size}
                onChange={() => {
                  setSize(option);
                  setColumns([]);
                  setRows([]);
                  setOpen(null);
                }}
              />
              {option}×{option}
            </label>
          ))}
        </span>
      </fieldset>

      {/* MATRİS İSKELETİ — kurulan ızgarayı gösterir (§9.1). */}
      <div className="rounded-2xl border border-line bg-surface p-3 shadow-card sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <p className="text-sm text-muted" aria-live="polite">
            {hint}
          </p>
          <div
            aria-hidden="true"
            className="flex items-center gap-3 text-xs text-muted"
          >
            <span className="inline-flex items-center gap-1.5">
              <CriterionIcon kind="club" className="h-3.5 w-3.5" />
              sütun · kulüp
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CriterionIcon kind="nationality" className="h-3.5 w-3.5" />
              satır · kulüp/ülke
            </span>
          </div>
        </div>

        {/*
          CSS ızgara — GERÇEK bir `<table>` DEĞİL: burada tablosal veri yok,
          bir FORM var (ölçüt seçimi). Tabloya çevirmek "düzen tablosu" olurdu
          ve erişilebilirlik denetimini boşuna zorlardı. Yuvalar düğme, iç
          hücreler `aria-hidden` yer tutucu; yön bilgisi her yuvanın adında.
        */}
        <div
          role="group"
          aria-label="Izgara ölçütleri"
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${String(size + 1)}, minmax(0, 1fr))`,
          }}
        >
          {/* Köşe — ızgara kimliği (günün ızgarasıyla aynı). */}
          <div
            aria-hidden="true"
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl bg-background px-1 py-2 text-center"
          >
            <MatrixIcon className="h-4 w-4 text-muted" />
            <span className="font-display text-sm leading-none font-bold tracking-tight tabular-nums">
              {size}×{size}
            </span>
          </div>

          {/* Sütun başlık yuvaları (üst satır). */}
          {Array.from({ length: size }, (_, index) => (
            <BuilderSlot
              key={`col-${String(index)}`}
              axis="column"
              index={index}
              value={columns[index]}
              isOpen={open?.axis === "column" && open.index === index}
              disabled={index > columns.length}
              onOpen={setOpen}
              onClear={clearColumn}
            />
          ))}

          {/* Satırlar: sol yuva + iç yer tutucular. */}
          {Array.from({ length: size }, (_, rowIndex) => (
            <Fragment key={`row-${String(rowIndex)}`}>
              <BuilderSlot
                axis="row"
                index={rowIndex}
                value={rows[rowIndex]}
                isOpen={open?.axis === "row" && open.index === rowIndex}
                disabled={!columnsReady || rowIndex > rows.length}
                onOpen={setOpen}
                onClear={clearRow}
              />
              {Array.from({ length: size }, (_, colIndex) => (
                <div
                  key={`cell-${String(rowIndex)}-${String(colIndex)}`}
                  aria-hidden="true"
                  className="flex min-h-[4.5rem] items-center justify-center rounded-lg border border-dashed border-line bg-background/50"
                >
                  {/* Cevabın geleceği yer — soluk nokta (glif değil, öğe). */}
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong opacity-40" />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      {open !== null && (
        <CriterionPicker
          label={
            open.axis === "column"
              ? `${String(open.index + 1)}. sütun için kulüp seçin`
              : `${String(open.index + 1)}. satır için ölçüt seçin`
          }
          /*
           * BOŞ LİSTE SATIRDA BİR ÇIKMAZ, sütunda değil. Satır adayları
           * seçilmiş sütunlara bağlı; hiç aday kalmadıysa kullanıcının
           * yapabileceği tek şey bir sütunu değiştirmektir ve bunu
           * söylemezsek arama kutusunda boşuna dener.
           */
          emptyHint={
            open.axis === "row"
              ? "Bu sütunlarla oynanabilir ölçüt kalmadı. Yukarıdan bir sütunu kaldırıp başka bir kulüp seçin, ya da daha küçük bir boyut seçin."
              : undefined
          }
          search={
            open.axis === "column"
              ? (term, signal) =>
                  searchColumns(term, signal).then((list) =>
                    list.filter(
                      (one) => !chosenKeys.has(`${one.kind}:${one.id}`),
                    ),
                  )
              : (term, signal) =>
                  searchForRow(term, signal).then((list) =>
                    list.filter(
                      (one) => !chosenKeys.has(`${one.kind}:${one.id}`),
                    ),
                  )
          }
          onSelect={choose}
          onCancel={() => {
            setOpen(null);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="md"
          disabled={!columnsReady || !rowsReady}
          onClick={() => {
            onBuilt({ rows, columns });
          }}
        >
          Izgarayı kur
        </Button>
        {columnsReady && !rowsReady && (
          <p className="text-sm text-muted">
            {String(size - rows.length)} satır daha seçin.
          </p>
        )}
      </div>
    </div>
  );
}

interface BuilderSlotProps {
  readonly axis: "column" | "row";
  readonly index: number;
  readonly value: GridCriterionRefDto | undefined;
  readonly isOpen: boolean;
  readonly disabled: boolean;
  onOpen(slot: Slot): void;
  onClear(index: number): void;
}

/**
 * Matristeki bir başlık yuvası.
 *
 * DOLU YUVA BİR DÜĞME DEĞİL, bir etiket + küçük "kaldır" düğmesidir: dolu
 * yuvaya tıklamak "değiştir" mi "kaldır" mı belirsizdi ve belirsiz bir düğme,
 * yanlışlıkla silinen bir seçim demek. Dolu yuva günün ızgarasının başlık
 * hücresiyle aynı dili konuşur (ikon + condensed ad + tür etiketi).
 */
function BuilderSlot({
  axis,
  index,
  value,
  isOpen,
  disabled,
  onOpen,
  onClear,
}: BuilderSlotProps) {
  const axisWord = axis === "column" ? "sütun" : "satır";

  if (value === undefined) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        className="group flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line-strong bg-background px-1 py-2 text-center transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:bg-background"
        onClick={() => {
          onOpen({ axis, index });
        }}
      >
        {/* Yön + sıra ekran okuyucuya; görünen metin kısa kalsın. */}
        <span className="sr-only">
          {index + 1}. {axisWord}:{" "}
        </span>
        <span
          aria-hidden="true"
          className="text-xl leading-none font-light text-muted transition-colors group-hover:text-accent"
        >
          +
        </span>
        <span className="font-display text-[0.7rem] leading-tight font-semibold tracking-wide text-muted uppercase transition-colors group-hover:text-accent">
          {axis === "column" ? "Kulüp seç" : "Ölçüt seç"}
        </span>
      </button>
    );
  }

  return (
    <div className="relative flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl bg-background px-1 py-2 text-center">
      <CriterionIcon kind={value.kind} className="h-3.5 w-3.5 text-muted" />
      <span className="font-display text-sm leading-tight font-bold tracking-tight text-balance">
        {value.label}
      </span>
      <DataLabel className="text-muted">
        {value.kind === "club" ? "kulüp" : "uyruk"}
      </DataLabel>
      <button
        type="button"
        aria-label={`Kaldır — ${value.label}`}
        className="absolute top-1 right-1 rounded p-1 text-muted transition-colors hover:text-wrong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        onClick={() => {
          onClear(index);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
