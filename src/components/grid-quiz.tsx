"use client";

import { useCallback, useState } from "react";
import type { ClubDto } from "@/application/dto/club-dto";
import type { PlayerDto } from "@/application/dto/player-dto";
import type { GridCriterionRefDto } from "@/application/use-cases/custom-grid";
import type {
  DailyGridDto,
  RevealedCellDto,
} from "@/application/use-cases/daily-grid";
import type { CellRef } from "@/domain/services/grid";
import { formatTurkishIsoDate } from "@/lib/format-date";
import { readErrorMessage } from "@/lib/http/error-message";
import { GridBuilder, type BuiltGrid } from "./grid-builder";
import { GridGame } from "./grid-game";

/**
 * `GridGame`'i gerçek API uçlarına bağlayan ince katman.
 *
 * NEDEN AYRI: `GridGame` oyunun kurallarını ve durumunu tutar; nereden veri
 * geldiğini bilmez. Bu ayrım testlerde ödüyor — oyunun davranışı sahte iki
 * fonksiyonla, ağ olmadan sınanabiliyor. Sayfa da sunucu bileşeni olarak
 * kalabiliyor: sunucu bileşeni istemciye fonksiyon geçiremez, bu sarmalayıcı
 * o sınırı taşıyor.
 *
 * İKİ GİRİŞ (§9.1): günün ızgarası her zaman açıktır; altındaki "Sen kur"
 * bölümü kullanıcının kendi ızgarasını kurmasına izin verir. İkisi AYNI oyun
 * bileşenini kullanır — kurallar tek yerde kalsın diye.
 *
 * İKİ AYRI CEVAP UCU. Günün ızgarasında sunucu ölçütleri tohumdan yeniden
 * üretir ve istemciden geleni dinlemez (BR-11/BR-12); kullanıcı ızgarasında
 * ölçütler gövdede taşınır (BR-26). Fark uçların sözleşmesinde duruyor, tek
 * bir ucun içinde bir alanın varlığında değil.
 */

export interface GridQuizProps {
  readonly grid: DailyGridDto;
  /**
   * Sütun seçicisinin ARAMA YAPILMADAN gösterdiği ilk liste (§9.1).
   *
   * NEDEN GEREKLİ: kulüp araması alfabetiktir ve süzgeçsiz ilk sayfa "08
   * Homburg", "1. FC Heidenheim" gibi tanınmayan kulüplerle açılıyordu.
   * Tanınırlık ÖLÇÜLEBİLİR bir veri değil (§9.1'de ölçüldü: oyuncu sayısı
   * kulübün yaşını ölçüyor, ünlülüğünü değil), bu yüzden ilk liste ürün
   * sahibinin seçtiği küratörlü havuzdur. Havuz bir SINIR değil: kullanıcı
   * yazdığı anda 906 seçilebilir kulübün tamamı aranır.
   */
  readonly curatedClubs: readonly ClubDto[];
}

/** Kulüp kaydı → ızgara ölçütü. Etiket KISA ad: başlık hücresine sığmalı. */
function toColumnRef(club: ClubDto): GridCriterionRefDto {
  return { kind: "club", id: club.id, label: club.shortName };
}

export function GridQuiz({ grid, curatedClubs }: GridQuizProps) {
  const [custom, setCustom] = useState<BuiltGrid | null>(null);

  const searchPlayers = useCallback(
    async (term: string, signal: AbortSignal): Promise<PlayerDto[]> => {
      const response = await fetch(
        `/api/players?q=${encodeURIComponent(term)}`,
        { signal },
      );
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: PlayerDto[] };
      return body.data;
    },
    [],
  );

  const checkAnswer = useCallback(
    async (cell: CellRef, playerId: string): Promise<boolean> => {
      const response = await fetch("/api/grid/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cell, playerId }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: { correct: boolean } };
      return body.data.correct;
    },
    [],
  );

  /**
   * PES ET → CEVAPLARI GÖR — günün ızgarası (BR-66).
   *
   * Yalnızca boş hücrelerin KOORDİNATLARI gider; sunucu ızgarayı yeniden üretip
   * her koordinatı kendi ölçütüne çevirir (BR-11/BR-12, cevap ucuyla aynı). Yanıt
   * `index`'i istekteki hücre sırasına eşler.
   */
  const reveal = useCallback(
    async (cells: CellRef[], used: string[]): Promise<RevealedCellDto[]> => {
      const response = await fetch("/api/grid/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells, used }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: RevealedCellDto[] };
      return body.data;
    },
    [],
  );

  /**
   * PES ET → CEVAPLARI GÖR — kullanıcı ızgarası (BR-66, BR-26).
   *
   * Koordinat GÖNDERİLMEZ (custom-answer ile aynı); her hücrenin iki ölçütü
   * gövdede taşınır. Sıra korunur, yani yanıttaki `index` yine istemcinin
   * gönderdiği hücre sırasıdır.
   */
  const revealCustom = useCallback(
    async (cells: CellRef[], used: string[]): Promise<RevealedCellDto[]> => {
      if (custom === null) throw new Error("Izgara kurulmadı.");

      const pairs = cells.map((cell) => {
        const row = custom.rows[cell.row];
        const column = custom.columns[cell.column];
        if (row === undefined || column === undefined) {
          throw new Error("Geçersiz hücre.");
        }
        return {
          row: { kind: row.kind, id: row.id },
          column: { kind: column.kind, id: column.id },
        };
      });

      const response = await fetch("/api/grid/custom-reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells: pairs, used }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: RevealedCellDto[] };
      return body.data;
    },
    [custom],
  );

  /** Sütun adayları: kulüp araması, süzgeçsiz (§9.1). */
  const searchColumns = useCallback(
    async (
      term: string,
      signal: AbortSignal,
    ): Promise<GridCriterionRefDto[]> => {
      // Aramasız ilk liste sunucudan hazır geliyor; hem tanınır kulüplerle
      // açılıyor hem de bir gidiş-dönüş ödenmiyor.
      if (term.length === 0) return curatedClubs.map(toColumnRef);

      const response = await fetch(`/api/clubs?q=${encodeURIComponent(term)}`, {
        signal,
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: ClubDto[] };
      return body.data.map(toColumnRef);
    },
    [curatedClubs],
  );

  /** Satır adayları: seçilmiş sütunlarla BR-9 bandında kesişenler (BR-25). */
  const searchRows = useCallback(
    async (
      term: string,
      against: readonly GridCriterionRefDto[],
      signal: AbortSignal,
    ): Promise<GridCriterionRefDto[]> => {
      const params = new URLSearchParams();
      for (const one of against) params.append("with", `${one.kind}:${one.id}`);
      if (term.length > 0) params.set("q", term);

      const response = await fetch(`/api/grid/criteria?${params.toString()}`, {
        signal,
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: GridCriterionRefDto[] };
      return body.data;
    },
    [],
  );

  /**
   * Kullanıcı ızgarasında cevap: hücrenin KOORDİNATI değil, o hücrenin İKİ
   * ÖLÇÜTÜ gönderilir. Sunucu ızgaranın yerleşimini bilmiyor (BR-26).
   */
  const checkCustomAnswer = useCallback(
    async (cell: CellRef, playerId: string): Promise<boolean> => {
      if (custom === null) throw new Error("Izgara kurulmadı.");

      const row = custom.rows[cell.row];
      const column = custom.columns[cell.column];
      if (row === undefined || column === undefined) {
        throw new Error("Geçersiz hücre.");
      }

      const response = await fetch("/api/grid/custom-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row: { kind: row.kind, id: row.id },
          column: { kind: column.kind, id: column.id },
          playerId,
        }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: { correct: boolean } };
      return body.data.correct;
    },
    [custom],
  );

  return (
    <div className="flex flex-col gap-10">
      {/*
        KÜNYE GÜNLÜK IZGARANIN İÇİNDE (§7.15): tabeladaki sayaçlar oyunun
        durumundan geliyor. "Sen kur" turu `header` ALMAZ — sayfada ikinci bir
        `h1` olamaz ve o tur kendi satır içi sayacını korur.
      */}
      <GridGame
        grid={grid}
        date={grid.date}
        header={{
          // Yalnızca TARİH. "Mod 2 · Matris" kaldırıldı: modun adı gezinme
          // şeridinde ve hemen altındaki `h1`'de zaten yazılı. Tarih ise
          // sayfada başka hiçbir yerde yok ve gerçekten gerekli — kaydedilmiş
          // oyun başka güne aitse atılıyor (BR-11).
          eyebrow: formatTurkishIsoDate(grid.date),
          title: "Günün Izgarası",
          // HIZLI ÇAPALAR — "Sen kur" ve "Nasıl oynanır" bölümlerine iner
          // (Stitch künyesindeki iki kısayolun karşılığı). Bölümler sayfada
          // zaten var; bu yalnızca uzun sayfada onlara atlama kolaylığı.
          actions: <GridHeaderLinks />,
        }}
        checkAnswer={checkAnswer}
        searchPlayers={searchPlayers}
        reveal={reveal}
      />

      <section
        id="sen-kur"
        className="flex scroll-mt-24 flex-col gap-4 border-t border-line pt-8"
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight">Sen kur</h2>
          <p className="mt-1.5 text-sm text-muted">
            Kendi ızgaranızı kurun: önce üç sütun, sonra üç satır. Liste
            yalnızca{" "}
            <strong className="font-semibold text-foreground">
              oynanabilir
            </strong>{" "}
            ölçütleri gösterir, yani kurduğunuz ızgaranın dokuz hücresinin de
            cevabı vardır. Bu ızgara kaydedilmez.
          </p>
        </div>

        {custom === null ? (
          <GridBuilder
            searchColumns={searchColumns}
            searchRows={searchRows}
            onBuilt={setCustom}
          />
        ) : (
          <GridGame
            grid={custom}
            checkAnswer={checkCustomAnswer}
            searchPlayers={searchPlayers}
            reveal={revealCustom}
            onRestart={() => {
              setCustom(null);
            }}
          />
        )}
      </section>
    </div>
  );
}

/** Künye kısayol linki — condensed pill (Lider Tablosu linkiyle aynı idyom). */
const HEADER_LINK_CLASS =
  "font-display inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-2 text-sm font-semibold tracking-wide text-muted uppercase transition-colors hover:border-line-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Künye kısayolları — "Sen kur" ve "Nasıl oynanır" bölümlerine iner.
 *
 * Bölümler uzun sayfada zaten var; bu çapa linkleri Stitch künyesindeki iki
 * kısayolun karşılığı, yeni bir yüzey/kural değil — yalnızca gezinme kolaylığı.
 * İkonlar satır içi SVG (§7.12: harici font/glif değil; CSP `font-src 'self'`).
 */
function GridHeaderLinks() {
  return (
    <nav
      aria-label="Izgara kısayolları"
      className="flex flex-wrap items-center gap-2"
    >
      <a href="#sen-kur" className={HEADER_LINK_CLASS}>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>Sen kur</span>
      </a>
      <a href="#nasil-oynanir" className={HEADER_LINK_CLASS}>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.3" />
          <path d="M12 17h.01" />
        </svg>
        <span>Nasıl oynanır?</span>
      </a>
    </nav>
  );
}
