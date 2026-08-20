import { ValidationError } from "@/domain/errors/domain-error";
import {
  answeredCount,
  judgeSubmission,
  roundPoints,
  type RoundAnswer,
} from "@/domain/services/daily-round";
import {
  isMember,
  isTargetVisible,
  judgeJoin,
  roomDeadline,
  roomOutcome,
  roomStatus,
  ROOM_JOIN_WINDOW_MS,
  ROOM_PLAY_WINDOW_MS,
  type RoomJoinRejection,
  type RoomStatus,
} from "@/domain/services/room";
import type { StatKey } from "@/domain/services/stat-match";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import { roomCodeFromBytes } from "@/domain/value-objects/room-code";
import type { PlayerRepository } from "../ports/player-repository";
import type { RandomSource } from "../ports/random-source";
import type { RoomsRepository, StoredRoom } from "../ports/rooms-repository";
import type { StatMatchRepository } from "../ports/stat-match-repository";
import { withPlayerNames, type ScoredAnswerDto } from "./answer-names";
import {
  checkStatAnswer,
  toStatMatchRound,
  type StatMatchRoundDto,
} from "./daily-stat-match";

/**
 * Oda ile arkadaşa karşı oynama — PROJECT.md §12, BR-54…BR-63.
 *
 * OYUN YENİDEN TANIMLANMIYOR. Cevap kuralları (`judgeSubmission`) ve puanlama
 * (`checkStatAnswer`) §9.2/§11'den olduğu gibi geliyor; buradaki tek yeni şey
 * İKİ turun aynı hedefe karşı yan yana koşması.
 */

export interface RoomDeps {
  readonly rooms: RoomsRepository;
  readonly statMatch: StatMatchRepository;
  readonly random: RandomSource;
  /**
   * Oyuncu adlarını çözmek için — §12.3.
   *
   * SONRADAN EKLENDİ ve gerekçesi arayüzü yazarken çıktı: `RoomDto` yalnızca
   * "kaç istatistik cevaplandı" sayısını taşıyordu, cevapların KENDİSİNİ
   * değil. Sayfayı yenileyen oyuncu boş bir tahta görüyordu — oysa sunucu o
   * istatistikleri kapalı sayıyor. Aynı kusur §11'de de yaşanmıştı
   * (`stored-round.ts`); orada olduğu gibi burada da adlar gömülü futbol
   * veritabanından okunuyor, hesap veritabanına kopyalanmıyor.
   */
  readonly players: PlayerRepository;
}

/** Kendi tarafım — cevaplarım ve puanım her zaman görünür. */
export interface RoomSideDto {
  readonly displayName: string;
  readonly answered: number;
  /**
   * BR-63 — RAKİBİN puanı tur biterken gizlidir, benimki değil.
   *
   * `null` yalnızca rakip tarafında ve yalnızca oda bitmeden görülür.
   */
  readonly points: number | null;
  /**
   * Cevapların kendisi — `points` ile AYNI KAPIDAN geçer (BR-63).
   *
   * Kendi tarafımda her zaman dolu: ekran yenilendiğinde tahtanın hangi
   * istatistiklerinin kapalı olduğunu buradan çiziyor. Rakip tarafında oda
   * bitene kadar `null`, bitince dolu — ve dolması sonuç ekranının kendisi:
   * iki tarafın aynı hedefe kimi yazdığını YAN YANA görmek, odanın tek
   * kalıcı olmayan ödülü (BR-60: sonuç hiçbir yerde birikmez).
   *
   * Puan sızdırmaz, çünkü ikisi aynı `revealPoints` kapısında: cevap
   * göründüğü an puan da görünüyor.
   */
  readonly answers: readonly ScoredAnswerDto[] | null;
}

export type RoomOutcomeKind =
  "devam" | "yarim" | "beraberlik" | "kazandin" | "kaybettin";

export interface RoomDto {
  readonly code: string;
  readonly status: RoomStatus;
  /** Odanın sönme anı — arayüz geri sayımı buradan çizer (BR-60). */
  readonly expiresAt: string;
  /** BR-57 — ikinci oyuncu katılana kadar `null`. */
  readonly target: StatMatchRoundDto | null;
  readonly me: RoomSideDto;
  /** Henüz kimse katılmadıysa `null`. */
  readonly opponent: RoomSideDto | null;
  readonly outcome: RoomOutcomeKind;
}

/**
 * Kod üretimi kaç kez denenir.
 *
 * 25⁶ olasılıkta çakışma zaten nadir; beş deneme, aynı anda milyonlarca açık
 * oda olmadıkça tükenmez. Sonsuz döngü YOK: veritabanı gerçekten doluysa ya da
 * kısıt beklenmedik bir sebeple sürekli patlıyorsa, sessizce dönmeye devam
 * etmek yerine hata vermek doğrusu.
 */
const CODE_ATTEMPTS = 5;

/**
 * Her denemede istenen bayt.
 *
 * Altı işaret gerekiyor ama `roomCodeFromBytes` yanlılık elemesi yaptığı için
 * bazı baytları atıyor (256'da 6, yani ~%2,3). On altı bayt, altı işaretin
 * çıkmama ihtimalini pratikte sıfırlıyor; çıkmazsa zaten `null` dönüp bir
 * sonraki denemeye geçiliyor.
 */
const CODE_BYTES = 16;

async function sideFor(
  displayName: string,
  round: { readonly answers: readonly RoundAnswer[] },
  reveal: boolean,
  deps: RoomDeps,
): Promise<RoomSideDto> {
  /**
   * SAYI HER ZAMAN GÖRÜNÜR, CEVAPLAR DEĞİL. "Rakibim kaçta kaç" bilgisi
   * yoklamanın var olma sebebi (§12.1) ve hiçbir puan sızdırmıyor; cevapların
   * kendisi ise hem puanı hem de kullanılmış isimleri açık ederdi.
   */
  return {
    displayName,
    answered: answeredCount(round),
    points: reveal ? roundPoints(round) : null,
    answers: reveal ? await withPlayerNames(round.answers, deps.players) : null,
  };
}

function outcomeFor(
  room: StoredRoom,
  userId: string,
  now: Date,
): RoomOutcomeKind {
  const outcome = roomOutcome(room.state, now);

  switch (outcome.kind) {
    case "devam":
    case "yarim":
    case "beraberlik":
      return outcome.kind;
    case "galip":
      return outcome.winnerId === userId ? "kazandin" : "kaybettin";
  }
}

/**
 * Odanın kullanıcıya görünen hâli.
 *
 * BR-57 VE BR-63 BURADA UYGULANIYOR ve tek yerde olması kasıtlı: dört uç da
 * aynı DTO'yu döndürüyor, yani "hedefi ne zaman göster" ve "rakibin puanını ne
 * zaman aç" sorularının dört ayrı cevabı olamaz.
 */
async function present(
  room: StoredRoom,
  userId: string,
  now: Date,
  deps: RoomDeps,
): Promise<RoomDto> {
  const status = roomStatus(room.state, now);
  const finished = status === "bitti";

  const me = room.state.players.find((player) => player.userId === userId);
  if (me === undefined) {
    throw new ValidationError("Bu odanın üyesi değilsin.");
  }
  const other = room.state.players.find((player) => player.userId !== userId);

  /**
   * HEDEF YALNIZCA GÖRÜNÜRSE OKUNUYOR — BR-57. Erken okunup DTO'da `null`
   * bırakılsaydı kural bir "unutma" hatasına açık kalırdı; hiç okumamak onu
   * yapısal hâle getiriyor. Bedeli de yok: lobide bekleyen yoklamalar veri
   * tabanına ikinci bir soru sormuyor.
   */
  const target = isTargetVisible(room.state)
    ? await resolveTarget(room.targetPlayerId, deps)
    : null;

  return {
    code: room.code,
    status,
    expiresAt: roomDeadline(room.state).toISOString(),
    target,
    me: await sideFor(me.displayName, me.round, true, deps),
    opponent:
      other === undefined
        ? null
        : await sideFor(other.displayName, other.round, finished, deps),
    outcome: outcomeFor(room, userId, now),
  };
}

async function resolveTarget(
  targetPlayerId: string,
  deps: RoomDeps,
): Promise<StatMatchRoundDto> {
  const target = await deps.statMatch.findChosenTarget(
    targetPlayerId as PlayerId,
  );

  /**
   * Hedef veri kümesinden kaybolmuş olabilir: oda kurulduktan sonra bir
   * dağıtım veri kümesini yenilerse kimlik öksüz kalır (`RoundAnswer.playerId`
   * ile aynı kabul edilmiş sonuç). Sessizce başka bir oyuncuya kaydırmak
   * oyunu ortasından değiştirmek olurdu.
   */
  if (target === null) {
    throw new ValidationError(
      "Bu odanın hedef oyuncusu artık okunamıyor. Yeni bir oda kurun.",
    );
  }

  return toStatMatchRound(target);
}

/**
 * BR-56 — hedefi SUNUCU seçer, rastgele.
 *
 * Havuz günlük turunkiyle AYNI (`findDailyCandidates`): altı istatistiği dolu
 * ve tanınırlık eşiğini geçmiş oyuncular. Ayrı bir havuz kurulsaydı odada
 * kimsenin tanımadığı bir isim çıkabilirdi ve oyunun sorusu ("kimi
 * biliyorsun") anlamını yitirirdi.
 */
async function pickTarget(deps: RoomDeps): Promise<string> {
  const candidates = await deps.statMatch.findDailyCandidates();
  if (candidates.length === 0) {
    throw new ValidationError("Şu anda oda kurulamıyor: aday havuzu boş.");
  }

  /**
   * DÖRT BAYTLIK SEÇİM. Tek bayt 256'ya kadar sayar ve havuz ~2.500 kişi;
   * tek baytla ilk 256 aday dışındaki kimse hiç seçilemezdi.
   */
  const bytes = deps.random.bytes(4);
  const draw =
    ((bytes[0] ?? 0) << 24) |
    ((bytes[1] ?? 0) << 16) |
    ((bytes[2] ?? 0) << 8) |
    (bytes[3] ?? 0);

  /**
   * MODULO YANLILIĞI BURADA GÖRMEZDEN GELİNİYOR — ve bu, kodun tersi bir
   * karar olduğu için gerekçesi yazılıyor. 2³² havuz boyuna tam bölünmüyor,
   * yani bazı adaylar milyonda bir mertebesinde daha sık çıkıyor. Oda kodunda
   * aynı yanlılık ELENDİ çünkü kod bir SIRDIR ve yanlı bir sır tahmin edilmesi
   * kolaylaşır. Hedef oyuncu sır değil: hangi futbolcunun çıktığı herkese
   * açıkça gösteriliyor ve binde birlik bir eğilimin oyuna etkisi yok.
   */
  const index = Math.abs(draw) % candidates.length;
  const chosen = candidates[index];
  if (chosen === undefined) {
    throw new ValidationError("Şu anda oda kurulamıyor: aday seçilemedi.");
  }

  return chosen.id;
}

export interface CreateRoomInput {
  readonly now: Date;
  readonly userId: string;
}

export async function createRoom(
  input: CreateRoomInput,
  deps: RoomDeps,
): Promise<RoomDto> {
  /**
   * ÖNCE TEMİZLİK — BR-60. Kullanıcının kendi eski odaları siliniyor: yeni oda
   * kuran biri eskisini bırakmıştır ve bırakılmış oda, arkadaşına yanlış kodu
   * söylemiş olma ihtimalini uzatır. KATILDIĞI odalara dokunulmuyor; onlar
   * başkasının.
   *
   * Sönmüş odalar da burada süpürülüyor. Ayrı bir zamanlanmış iş kurmak yeni
   * bir altyapı parçası demekti; oda kurulumu zaten seyrek bir işlem ve tek
   * bir DELETE ekliyor.
   */
  await deps.rooms.deleteHostedRooms(input.userId);
  await deps.rooms.deleteExpiredRooms({
    unjoinedBefore: new Date(input.now.getTime() - ROOM_JOIN_WINDOW_MS),
    unfinishedBefore: new Date(input.now.getTime() - ROOM_PLAY_WINDOW_MS),
  });

  const targetPlayerId = await pickTarget(deps);

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = roomCodeFromBytes(deps.random.bytes(CODE_BYTES));
    if (code === null) continue;

    const result = await deps.rooms.createRoom({
      hostId: input.userId,
      code,
      targetPlayerId,
    });

    if (result.kind === "kuruldu") {
      return present(result.room, input.userId, input.now, deps);
    }
  }

  throw new ValidationError("Oda kodu üretilemedi. Lütfen tekrar deneyin.");
}

export interface RoomByCodeInput {
  readonly now: Date;
  readonly userId: string;
  readonly code: string;
}

/** Odayı koddan okur; üyelik denetimi yapmaz (çağıranlar ayrı ayrı yapar). */
async function requireRoom(
  input: RoomByCodeInput,
  deps: RoomDeps,
): Promise<StoredRoom> {
  const room = await deps.rooms.findByCode(input.code);

  /**
   * "ODA YOK" İLE "ODA SÖNDÜ" AYRI ŞEYLER ve ayrı kalmalı: kodu yanlış yazan
   * kişiye "süresi doldu" demek onu kodun doğru olduğuna inandırır, doğru
   * kodu yazana "böyle bir oda yok" demek de aynı hatayı ters yönde yapar.
   * Sönmüş oda buradan GEÇER; kararı `roomStatus` veriyor.
   */
  if (room === null) {
    throw new ValidationError("Böyle bir oda yok. Kodu kontrol edin.");
  }

  return room;
}

export async function joinRoom(
  input: RoomByCodeInput,
  deps: RoomDeps,
): Promise<RoomDto> {
  const room = await requireRoom(input, deps);
  const verdict = judgeJoin(room.state, input.userId, input.now);

  switch (verdict.kind) {
    case "zaten-uye":
      // BR-54 — sayfayı yenileyen ya da isteği tekrarlayan kullanıcı hata
      // görmemeli; odanın kendisi doğru cevaptır.
      return present(room, input.userId, input.now, deps);

    case "ret":
      throw new ValidationError(
        verdict.reason === "oda-dolu"
          ? "Bu oda dolu."
          : "Bu oda artık açık değil.",
      );

    case "katil": {
      const result = await deps.rooms.joinRoom({
        roomId: room.id,
        userId: input.userId,
        startedAt: input.now,
      });

      /**
       * YARIŞI KAYBETTİK: ikinci koltuğu eşzamanlı başka bir istek kaptı.
       * `judgeJoin` "katıl" demişti çünkü karar önce okuyup sonra yazıyor;
       * kısıt burada durdurdu (BR-54).
       */
      if (result.kind === "dolu") throw new ValidationError("Bu oda dolu.");

      return present(result.room, input.userId, input.now, deps);
    }
  }
}

/**
 * Sayfanın odaya BAKIŞI — dört sonuç, tek istisna değil.
 *
 * NEDEN `getRoom`'DAN AYRI. `getRoom` bir uçtur ve uç için doğru davranış
 * istisnadır: üye olmayan `400` alır, olmayan oda `400` alır, bitti. Sayfa
 * ise dört ayrı EKRAN çizmek zorunda — odaya gir, odaya katıl, oda dolu, oda
 * yok — ve bunları ayırt etmenin tek yolu istisna mesajlarını karşılaştırmak
 * olurdu. Mesaj dizisiyle dallanan bir arayüz, metin düzeltilir düzeltilmez
 * sessizce yanlış ekranı çizer.
 *
 * KATILMA KARARI DA BURADA VERİLİYOR ve sebebi kullanıcı tarafında: dolu bir
 * odanın bağlantısına tıklayan kişiye çalışmayacak bir "Katıl" düğmesi
 * göstermek, tıklattıktan sonra hayal kırıklığı yaratmak demek. `judgeJoin`
 * cevabı zaten biliyor.
 */
export type RoomEntry =
  | { readonly kind: "uye"; readonly room: RoomDto }
  | { readonly kind: "katilabilir" }
  | { readonly kind: "kapali"; readonly reason: RoomJoinRejection }
  | { readonly kind: "yok" };

export async function peekRoom(
  input: RoomByCodeInput,
  deps: RoomDeps,
): Promise<RoomEntry> {
  const room = await deps.rooms.findByCode(input.code);

  /**
   * BURADA "YOK" İLE "SÖNDÜ" AYRIMI YAPILMIYOR ve `requireRoom`'daki ayrımla
   * çelişmiyor: sönmüş oda hâlâ bulunuyor, `judgeJoin` onu `oda-kapali` diye
   * reddediyor. `yok` yalnızca gerçekten var olmayan kod.
   */
  if (room === null) return { kind: "yok" };

  if (isMember(room.state, input.userId)) {
    return {
      kind: "uye",
      room: await present(room, input.userId, input.now, deps),
    };
  }

  const verdict = judgeJoin(room.state, input.userId, input.now);

  /**
   * `zaten-uye` BURAYA GELEMEZ — üyelik hemen yukarıda elendi. Yine de
   * `katilabilir`'e katlanıyor: `judgeJoin`'in üç dalını ikiye indirmek için
   * bir istisna atmak, imkânsız bir durumu çalışma zamanı hatasına çevirirdi.
   */
  return verdict.kind === "ret"
    ? { kind: "kapali", reason: verdict.reason }
    : { kind: "katilabilir" };
}

export async function getRoom(
  input: RoomByCodeInput,
  deps: RoomDeps,
): Promise<RoomDto> {
  const room = await requireRoom(input, deps);

  /**
   * ÜYE OLMAYAN ODAYI OKUYAMAZ. Kodu tahmin eden biri en azından hedefi ve
   * rakiplerin adlarını görebilirdi; oysa kod, odaya girmek için paylaşılıyor,
   * seyretmek için değil.
   */
  if (!isMember(room.state, input.userId)) {
    throw new ValidationError("Bu odanın üyesi değilsin.");
  }

  return present(room, input.userId, input.now, deps);
}

export interface SubmitRoomAnswerInput extends RoomByCodeInput {
  readonly statKey: StatKey;
  readonly playerId: PlayerId;
}

export interface SubmitRoomAnswerDto {
  readonly value: number;
  readonly score: number;
  readonly room: RoomDto;
}

export async function submitRoomAnswer(
  input: SubmitRoomAnswerInput,
  deps: RoomDeps,
): Promise<SubmitRoomAnswerDto> {
  const room = await requireRoom(input, deps);

  const me = room.state.players.find(
    (player) => player.userId === input.userId,
  );
  if (me === undefined) {
    throw new ValidationError("Bu odanın üyesi değilsin.");
  }

  const status = roomStatus(room.state, input.now);
  if (status !== "oynaniyor") {
    throw new ValidationError(
      status === "bekliyor"
        ? "Tur henüz başlamadı: arkadaşın odaya katılmalı."
        : "Bu turun süresi doldu.",
    );
  }

  const verdict = judgeSubmission({
    state: me.round,
    statKey: input.statKey,
    playerId: input.playerId,
    targetId: room.targetPlayerId,
  });

  if (verdict.kind === "tekrar") {
    // BR-58 — saklanan cevap dönüyor, yeniden puanlanmıyor.
    return {
      value: verdict.answer.value,
      score: verdict.answer.score,
      room: await present(room, input.userId, input.now, deps),
    };
  }

  if (verdict.kind === "ret") {
    throw new ValidationError(
      verdict.reason === "oyuncu-kullanildi"
        ? "Bu oyuncuyu bu turda zaten kullandın; her istatistik için farklı bir isim gerekiyor."
        : "Hedef oyuncu cevap olarak seçilemez.",
    );
  }

  // Puanlama §9.2'nin yolundan geçiyor: hedef SUNUCUDA yeniden çözülüyor ve
  // BR-16 (verisi olmayan oyuncu) orada reddediliyor.
  const scored = await checkStatAnswer(
    {
      now: input.now,
      statKey: input.statKey,
      playerId: input.playerId,
      targetId: room.targetPlayerId as PlayerId,
    },
    deps,
  );

  const saved = await deps.rooms.saveAnswer({
    roomId: room.id,
    userId: input.userId,
    answer: {
      statKey: input.statKey,
      playerId: input.playerId,
      value: scored.value,
      score: scored.score,
    },
  });

  /**
   * YARIŞI KAYBETTİK: eşzamanlı ikinci istek önce yazmış. BR-58 gereği
   * SAKLANAN cevap dönüyor — kendi hesapladığımız puan değil.
   */
  if (saved.kind === "zaten-var") {
    const stored = saved.room.state.players
      .find((player) => player.userId === input.userId)
      ?.round.answers.find((answer) => answer.statKey === input.statKey);

    if (stored !== undefined) {
      return {
        value: stored.value,
        score: stored.score,
        room: await present(saved.room, input.userId, input.now, deps),
      };
    }
  }

  return {
    value: scored.value,
    score: scored.score,
    room: await present(saved.room, input.userId, input.now, deps),
  };
}
