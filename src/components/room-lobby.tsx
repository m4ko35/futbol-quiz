"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useState, useSyncExternalStore } from "react";
import {
  isRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "@/domain/value-objects/room-code";
import {
  clearInvite,
  readInvite,
  readInviteOnServer,
  subscribeToInvite,
} from "@/lib/room-invite";
import { useCreateRoom } from "./use-create-room";
import { useJoinRoom } from "./use-join-room";
import { Button } from "./ui/button";
import { WhichMoreRoomSetup } from "./which-more-room-setup";

/**
 * Oda lobisi — PROJECT.md §12.
 *
 * İKİ GİRİŞ, EŞİT AĞIRLIK. Kuran ve katılan aynı sayıda kişi: her odada biri
 * kuruyor, biri katılıyor. Bu yüzden "Oda kur" birincil, "Koda katıl" ikincil
 * bir eylem DEĞİL — ikisi de aynı kartta, aynı ölçüde duruyor.
 */

export interface RoomLobbyProps {
  /**
   * Açılışta seçili oda modu — §12.8. Solo sayfadaki odaya çağrı şeridi
   * (`RoomEntryBar`) lobiye modu önseçili getirir (`/oda?mod=hangisi-daha`),
   * böylece Hangisi Daha kurmaya gelen kullanıcı İstatistik'e ayarlı bir
   * formla karşılaşmaz. Sorgu parametresi sunucuda (`/oda`) Zod'la doğrulanıp
   * buraya PROP olarak geliyor; bileşen `useSearchParams`'a bağlı değil (Suspense
   * sınırı gerekmez) ve varsayılan geriye dönük İstatistik.
   */
  readonly initialMode?: "istatistik" | "hangisi-daha";
}

export function RoomLobby({ initialMode = "istatistik" }: RoomLobbyProps) {
  const router = useRouter();
  const create = useCreateRoom();

  /** Kurulacak oda modu — §12.8, BR-67. Varsayılan İstatistik (geriye dönük). */
  const [mode, setMode] = useState<"istatistik" | "hangisi-daha">(initialMode);

  const goToRoom = useCallback(
    (code: string) => {
      // Davet kullanıldı; lobiye dönüldüğünde ikinci kez teklif edilmesin.
      clearInvite();
      router.push(`/oda/${code}`);
    },
    [router],
  );

  const { join, isJoining, failure: joinFailure } = useJoinRoom(goToRoom);

  /**
   * BEKLEYEN DAVET — `room-invite.ts`.
   *
   * Bağlantıyla gelip giriş yapan kullanıcı buraya düşüyor ve kodu artık
   * ekranda göremiyor; alan onun için hazır dolduruluyor. KENDİLİĞİNDEN
   * KATILMIYOR: koltuğa oturmak her zaman açık bir düğmeye basmayı gerektirir
   * (BR-54).
   */
  const invite = useSyncExternalStore(
    subscribeToInvite,
    readInvite,
    readInviteOnServer,
  );

  /**
   * `null` = kullanıcı HENÜZ YAZMADI, boş dize = yazıp sildi.
   *
   * Ayrım davetin ne zaman gösterileceğini belirliyor: alanı temizleyen
   * kullanıcıya daveti geri yazmak, silme eylemini geri almak olurdu. Aynı
   * ayrım efekt ihtiyacını da ortadan kaldırıyor — davet bir BAŞLANGIÇ DEĞERİ
   * değil, yazılmamışlığın karşılığı.
   */
  const [typed, setTyped] = useState<string | null>(null);
  const inputId = useId();
  const noteId = useId();

  const invited = typed === null && invite !== null;

  /**
   * KOD YAZILDIĞI GİBİ DEĞİL, AYIKLANDIĞI GİBİ GÖSTERİLİYOR. Kullanıcı
   * "bkj-7tz" yazınca alanda "BKJ7TZ" görüyor: gönderilecek şey ile ekranda
   * duran şey aynı olsun diye. Ayıklama kuralı alan katmanından geliyor
   * (`normalizeRoomCode`), burada ikinci kez yazılmıyor.
   */
  const code = normalizeRoomCode(typed ?? invite ?? "");
  const complete = code.length >= ROOM_CODE_LENGTH;
  const valid = isRoomCode(code);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
      {/* Oda kur */}
      <section className="flex flex-1 flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-xl font-bold tracking-tight">Oda kur</h2>

        {/*
          MOD SEÇİMİ — §12.8, BR-67. Artık gerçekten iki oda oyunu var
          (İstatistik ve Hangisi Daha), yani Stitch'in bir zamanlar reddedilen
          mod seçimi (§12.7) dürüst hâle geldi. Varsayılan İstatistik: hem eski
          davranış, hem tek tıkla kurulan basit yol.
        */}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Oyun modu"
        >
          {(
            [
              ["istatistik", "İstatistik"],
              ["hangisi-daha", "Hangisi Daha"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => {
                setMode(key);
              }}
              className={
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
                (mode === key
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-line-strong bg-surface text-foreground hover:bg-accent-soft")
              }
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "istatistik" ? (
          <>
            <p className="flex-1 text-sm text-muted">
              Sana bir kod verilir. Kodu arkadaşına söylersin, o katılınca{" "}
              <strong className="font-semibold text-foreground">
                ikinize aynı futbolcu
              </strong>{" "}
              açılır.
            </p>

            <Button
              size="md"
              loading={create.isCreating}
              className="w-fit"
              onClick={() => {
                create.create();
              }}
            >
              {create.isCreating ? "Oda kuruluyor…" : "Oda kur"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Kodu arkadaşına söylersin, o katılınca{" "}
              <strong className="font-semibold text-foreground">
                ikinize aynı düellolar
              </strong>{" "}
              açılır.
            </p>

            <WhichMoreRoomSetup
              onCreate={(body) => {
                create.create(body);
              }}
              isCreating={create.isCreating}
            />
          </>
        )}

        {create.failure !== null && (
          <p
            role="alert"
            className="rounded-xl border border-wrong bg-wrong-soft px-4 py-3 text-sm text-wrong"
          >
            {create.failure}
          </p>
        )}
      </section>

      {/* Koda katıl */}
      <section className="flex flex-1 flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-xl font-bold tracking-tight">Koda katıl</h2>

        {invited && (
          <p className="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm">
            Davet edildiğin odanın kodu hazır. Katılmak için{" "}
            <strong className="font-semibold">Katıl</strong>&apos;a bas.
          </p>
        )}

        <form
          className="flex flex-1 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !isJoining) join(code);
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            {/* ETİKET GÖRÜNÜR, yer tutucu değil: yer tutucu yazmaya başlanınca
                kaybolur ve alanın ne istediği unutulur (§7.10). */}
            <label
              htmlFor={inputId}
              className="text-xs font-semibold tracking-wide text-muted uppercase"
            >
              Arkadaşının verdiği kod
            </label>

            <input
              id={inputId}
              value={code}
              onChange={(event) => {
                setTyped(event.target.value);
              }}
              // Ayıklama tire ve boşluğu attığı için alan biraz daha uzun:
              // "BKJ-7TZ" yapıştıran kullanıcı son harfini kaybetmemeli.
              maxLength={12}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={complete && !valid}
              aria-describedby={noteId}
              placeholder="BKJ7TZ"
              className="w-full rounded-lg border border-line-strong bg-background px-4 py-3 font-mono text-lg tracking-[0.2em] uppercase placeholder:tracking-normal placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />

            <p id={noteId} className="min-h-8 text-xs text-muted">
              {complete && !valid
                ? "Bu kod geçerli değil. Oda kodlarında sesli harf ve birbirine karışan işaretler (0/O, 1/I/L) bulunmaz."
                : `${String(ROOM_CODE_LENGTH)} işaret.`}
            </p>
          </div>

          <Button
            type="submit"
            size="md"
            loading={isJoining}
            disabled={!valid}
            className="w-fit"
          >
            {isJoining ? "Katılınıyor…" : "Katıl"}
          </Button>
        </form>

        {joinFailure !== null && (
          <p
            role="alert"
            className="rounded-xl border border-wrong bg-wrong-soft px-4 py-3 text-sm text-wrong"
          >
            {joinFailure}
          </p>
        )}
      </section>
    </div>
  );
}
