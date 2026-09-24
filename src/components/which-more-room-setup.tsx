"use client";

import { useState } from "react";
import { STAT_KEYS, type StatKey } from "@/domain/services/stat-match";
import type { Direction, Level } from "@/domain/services/which-more";
import {
  FIXED_N_OPTIONS,
  type FixedN,
  type WhichMoreSubmode,
} from "@/domain/services/which-more-room";
import { Button } from "./ui/button";
import type { WhichMoreCreateBody } from "./use-create-room";
import { levelFor, questionFor } from "./which-more-quiz";

/**
 * Hangisi Daha odası kurulum formu — PROJECT.md §12.8.
 *
 * Solo kurulum ekranının (§9.3) alanlarını taşır artı ALT-MOD: Ani ölüm mü,
 * sabit sayıda düello mu (BR-69). Tohum yok — sunucu üretir (BR-68). Seçenek
 * etiketleri solo modun tablolarından (`questionFor`/`levelFor`) geliyor;
 * ikinci bir doğruluk kaynağı yok (§6.5).
 */

export interface WhichMoreRoomSetupProps {
  onCreate(body: WhichMoreCreateBody): void;
  readonly isCreating: boolean;
}

const SUBMODES: readonly {
  readonly key: WhichMoreSubmode;
  readonly name: string;
  readonly detail: string;
}[] = [
  {
    key: "ani-olum",
    name: "Ani ölüm",
    detail: "Tek yanlış koşuyu bitirir; uzun seri kazanır.",
  },
  {
    key: "sabit-n",
    name: "Sabit düello",
    detail: "Eleme yok; belirli sayıda düello, çok doğru kazanır.",
  },
];

function Chip({
  selected,
  onClick,
  children,
}: {
  readonly selected: boolean;
  onClick(): void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
        (selected
          ? "border-accent bg-accent text-accent-fg"
          : "border-line-strong bg-surface text-foreground hover:bg-accent-soft")
      }
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function WhichMoreRoomSetup({
  onCreate,
  isCreating,
}: WhichMoreRoomSetupProps) {
  const [submode, setSubmode] = useState<WhichMoreSubmode>("ani-olum");
  const [n, setN] = useState<FixedN>(10);
  const [statKey, setStatKey] = useState<StatKey>("appearances");
  const [level, setLevel] = useState<Level>("easy");
  const [direction, setDirection] = useState<Direction>("more");

  const question = questionFor(statKey);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Yarışma biçimi">
        {SUBMODES.map((one) => (
          <Chip
            key={one.key}
            selected={submode === one.key}
            onClick={() => {
              setSubmode(one.key);
            }}
          >
            {one.name}
          </Chip>
        ))}
      </Field>
      <p className="-mt-2 text-xs text-muted">
        {SUBMODES.find((one) => one.key === submode)?.detail}
      </p>

      {submode === "sabit-n" && (
        <Field label="Düello sayısı">
          {FIXED_N_OPTIONS.map((option) => (
            <Chip
              key={option}
              selected={n === option}
              onClick={() => {
                setN(option);
              }}
            >
              {String(option)}
            </Chip>
          ))}
        </Field>
      )}

      <Field label="Metrik">
        {STAT_KEYS.map((key) => (
          <Chip
            key={key}
            selected={statKey === key}
            onClick={() => {
              setStatKey(key);
            }}
          >
            {questionFor(key).name}
          </Chip>
        ))}
      </Field>

      <Field label="Havuz">
        {(["easy", "hard"] as const).map((key) => (
          <Chip
            key={key}
            selected={level === key}
            onClick={() => {
              setLevel(key);
            }}
          >
            {levelFor(key).name}
          </Chip>
        ))}
      </Field>

      <Field label="Yön">
        {(["more", "less"] as const).map((key) => (
          <Chip
            key={key}
            selected={direction === key}
            onClick={() => {
              setDirection(key);
            }}
          >
            {key === "more" ? question.moreShort : question.lessShort}
          </Chip>
        ))}
      </Field>

      <Button
        size="md"
        loading={isCreating}
        className="w-fit"
        onClick={() => {
          onCreate({
            mode: "hangisi-daha",
            submode,
            statKey,
            level,
            direction,
            ...(submode === "sabit-n" ? { n } : {}),
          });
        }}
      >
        {isCreating ? "Oda kuruluyor…" : "Oda kur"}
      </Button>
    </div>
  );
}
