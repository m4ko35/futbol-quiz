"use client";

import { useCallback, useState } from "react";
import type { GridCriterionRefDto } from "@/application/use-cases/custom-grid";
import { GRID_SIZE } from "@/domain/services/grid";
import { CriterionPicker } from "./criterion-picker";

/**
 * "Sen kur" — ızgarayı kullanıcı kurar (PROJECT.md §9.1, BR-25).
 *
 * SIRA ÜRETİM ALGORİTMASININ SIRASIDIR (`generate.ts`): önce üç sütun, sonra
 * üç satır. Sütunlar birbiriyle hiç kesişmez (bir hücre her zaman satır ×
 * sütundur), dolayısıyla sütun seçimi süzgeçsizdir; satır adayları ise seçilen
 * ÜÇ SÜTUNLA da oynanabilir olanlarla sınırlıdır.
 *
 * NEDEN SÜZGEÇ ZORUNLU, ölçüldü (§9.1): serbest seçimde rastgele altı kulübün
 * yalnızca %0,1'i dokuz hücresi de dolu bir ızgara veriyor. Süzgeçsiz bir
 * kurucu, kullanıcının denemelerinin neredeyse tamamını reddederdi.
 *
 * SÜTUN DEĞİŞİRSE SATIRLAR SİLİNİR. Satırların geçerliliği sütunlara BAĞLI:
 * bir sütun değiştiğinde eski satırlar oynanamaz hâle gelebilir. Sessizce
 * bırakmak, seçicinin gösterdiğinden başka bir ızgara kurmak olurdu.
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
  const [columns, setColumns] = useState<GridCriterionRefDto[]>([]);
  const [rows, setRows] = useState<GridCriterionRefDto[]>([]);
  const [open, setOpen] = useState<Slot | null>(null);

  const columnsReady = columns.length === GRID_SIZE;

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

  const chosenKeys = new Set(
    [...columns, ...rows].map((one) => `${one.kind}:${one.id}`),
  );

  return (
    <div className="flex flex-col gap-4">
      <Axis
        title="Sütunlar (kulüp)"
        hint="Üç kulüp seçin. Sütunlar birbiriyle kesişmediği için burada sınır yok."
        chosen={columns}
        axis="column"
        disabled={false}
        open={open}
        onOpen={setOpen}
        onClear={(index) => {
          setColumns(columns.filter((_, i) => i !== index));
          setRows([]);
        }}
      />

      <Axis
        title="Satırlar (kulüp veya ülke)"
        hint={
          columnsReady
            ? "Yalnızca üç sütunun hepsiyle oynanabilir ölçütler listelenir."
            : "Önce üç sütun seçin."
        }
        chosen={rows}
        axis="row"
        disabled={!columnsReady}
        open={open}
        onOpen={setOpen}
        onClear={(index) => {
          setRows(rows.filter((_, i) => i !== index));
        }}
      />

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
              ? "Bu üç sütunla oynanabilir ölçüt kalmadı. Yukarıdan bir sütunu kaldırıp başka bir kulüp seçin."
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
        <button
          type="button"
          disabled={!columnsReady || rows.length !== GRID_SIZE}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            onBuilt({ rows, columns });
          }}
        >
          Izgarayı kur
        </button>
        {columnsReady && rows.length !== GRID_SIZE && (
          <p className="text-sm text-muted">
            {String(GRID_SIZE - rows.length)} satır daha seçin.
          </p>
        )}
      </div>
    </div>
  );
}

interface AxisProps {
  readonly title: string;
  readonly hint: string;
  readonly chosen: readonly GridCriterionRefDto[];
  readonly axis: "column" | "row";
  readonly disabled: boolean;
  readonly open: Slot | null;
  onOpen(slot: Slot): void;
  onClear(index: number): void;
}

/**
 * Bir eksenin üç yuvası.
 *
 * DOLU YUVA BİR DÜĞME DEĞİL, bir metin + "kaldır" düğmesidir: dolu yuvaya
 * tıklamak "değiştir" mi "kaldır" mı belirsizdi ve belirsiz bir düğme,
 * yanlışlıkla silinen bir seçim demek.
 */
function Axis({
  title,
  hint,
  chosen,
  axis,
  disabled,
  open,
  onOpen,
  onClear,
}: AxisProps) {
  const slots = Array.from({ length: GRID_SIZE }, (_, index) => index);

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {slots.map((index) => {
          const value = chosen[index];
          const isOpen = open?.axis === axis && open.index === index;

          return (
            <li key={index}>
              {value === undefined ? (
                <button
                  type="button"
                  disabled={disabled || index > chosen.length}
                  aria-expanded={isOpen}
                  className="w-full rounded-xl border-2 border-dashed border-line-strong bg-background px-3 py-3 text-sm transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:bg-background"
                  onClick={() => {
                    onOpen({ axis, index });
                  }}
                >
                  {axis === "column" ? "Kulüp seç" : "Ölçüt seç"}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-background px-3 py-2 text-sm">
                  <span className="flex flex-col">
                    <span className="font-medium">{value.label}</span>
                    <span className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">
                      {value.kind === "club" ? "kulüp" : "uyruk"}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-muted underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => {
                      onClear(index);
                    }}
                  >
                    Kaldır
                    <span className="sr-only"> — {value.label}</span>
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
