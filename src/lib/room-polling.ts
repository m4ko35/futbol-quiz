import type { RoomDto } from "@/application/use-cases/rooms";
import { STAT_KEYS } from "@/domain/services/stat-match";

/**
 * Yoklama siyaseti — PROJECT.md §12.1.
 *
 * NEDEN AYRI MODÜL. Buradaki üç işlev saf ve kararlar taşıyor: ne sıklıkta
 * soralım, ne zaman duralım, gelen yanıt yeni mi. `room-board.tsx` içinde
 * kalsalardı ancak bir tarayıcı ortamı kurup zamanlayıcı ilerleterek
 * sınanabilirlerdi; oysa asıl sınanacak şey aritmetik.
 *
 * GERÇEK ZAMAN YOK, YOKLAMA VAR (§12.1). İstatistik modu sıra tabanlı değil:
 * iki oyuncu aynı hedefe karşı birbirinden bağımsız oynuyor. Canlı paylaşılan
 * tek olgu "rakibim bitirdi mi" ve bir soruluk bu bilgi için WebSocket kurmak
 * Hobby planında zaten mümkün değildi. Yoklama §7.4'ün sabit adres listesini
 * de büyütmüyor: istek kendi sunucumuza gidiyor.
 */

/**
 * YOKLAMA HIZI DURUMA GÖRE DEĞİŞİR — tek bir aralık üç ayrı bekleyişe birden
 * yanlış gelirdi.
 *
 * `lobi`: kurucu ekrana bakıp arkadaşını bekliyor. Katılma anı ekranın TEK
 * olayı; geç haber vermek beklemeyi uzatır.
 *
 * `oynuyorum`: kullanıcı zaten meşgul ve her cevap gönderimi odanın güncel
 * hâlini ZATEN geri getiriyor. Yoklama burada yalnızca "rakip nerede" sayacını
 * tazeliyor, yani seyrek olabilir.
 *
 * `rakibi-bekliyorum`: altı istatistik bitti, ekranda yapacak bir şey kalmadı
 * ve beklenen tek şey sonucun açılması. Lobi kadar hızlı.
 */
export type PollPhase = "lobi" | "oynuyorum" | "rakibi-bekliyorum";

const POLL_BASE_MS: Readonly<Record<PollPhase, number>> = {
  lobi: 3_000,
  oynuyorum: 12_000,
  "rakibi-bekliyorum": 3_000,
};

/**
 * Değişiklik gelmedikçe aralık büyür.
 *
 * NEDEN. Katılma penceresi otuz dakika (BR-60) ve sabit üç saniye, tek bir
 * lobide altı yüz istek demek. Hız sınırı dakikada 60 ve İSTEMCİ ANAHTARI
 * IP'dir (§7.8) — aynı evden oynayan iki arkadaş o bütçeyi PAYLAŞIYOR. Büyüme
 * ilk saniyelerin hızını koruyor, uzun beklemenin bedelini düşürüyor:
 * 3; 4,5; 6,75; 10,1; 15; 15… Yaklaşık kırk saniyede tavana çıkıyor.
 */
export const POLL_MAX_MS = 15_000;
const POLL_GROWTH = 1.5;

/** Hangi düzen geçerli; `null` ise oda bitmiştir ve yoklama DURUR. */
export function pollPhase(room: RoomDto): PollPhase | null {
  /**
   * BİTMİŞ VE SÖNMÜŞ ODA HİÇ YOKLANMAZ. Durum artık değişemez — `bitti`
   * geri dönmez, `suresi-doldu` da öyle (`roomStatus`, §12.3). Sormaya devam
   * etmek, hiçbir zaman gelmeyecek bir haberi beklemek olurdu.
   */
  if (room.status === "bitti" || room.status === "suresi-doldu") return null;
  if (room.status === "bekliyor") return "lobi";

  return room.me.answered >= STAT_KEYS.length
    ? "rakibi-bekliyorum"
    : "oynuyorum";
}

export function pollDelay(phase: PollPhase, quiet: number): number {
  return Math.min(
    POLL_MAX_MS,
    Math.round(POLL_BASE_MS[phase] * POLL_GROWTH ** quiet),
  );
}

/**
 * Yanıtın "yeni" olup olmadığı — yoklamanın cevabı yalnızca bu üç sayıda
 * görünür.
 *
 * TÜM GÖVDE KARŞILAŞTIRILAMAZ: `expiresAt` her yanıtta yeniden üretiliyor ve
 * hedefin kendisi katılma anında bir kez beliriyor. Gövdeyi kıyaslamak her
 * seferinde "değişti" derdi, büyüme hiç devreye girmez ve yavaşlatma
 * yazılmamış sayılırdı.
 */
export function pollSignature(room: RoomDto): string {
  return [room.status, room.me.answered, room.opponent?.answered ?? -1].join(
    "|",
  );
}
