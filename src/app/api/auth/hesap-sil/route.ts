import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { accountsRepository } from "@/infrastructure/db/repositories";
import { currentUserFromRequest } from "@/lib/auth/current-user";
import { PENDING_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * `POST /api/auth/hesap-sil` — hesabı ve bütün skorları siler (BR-48).
 *
 * GERİ ALINAMAZ ve öyle olması gerekiyor: "sil ama bir süre sakla" demek,
 * kullanıcıya sildiğini söyleyip saklamaktır.
 *
 * TURLAR VE CEVAPLAR BİRLİKTE GİDER. Şemadaki `onDelete: Cascade` bunu
 * veritabanı düzeyinde yapıyor ve gerçek veritabanında sınandı (§11.3);
 * uygulama ayrıca silmiyor, çünkü iki yerde yapılan bir iş bir gün bir yerde
 * unutulur.
 *
 * KİMLİKSİZLEŞTİRME SEÇİLMEDİ. BR-48 iki seçenek tanıyordu (birlikte silmek
 * ya da kimliksizleştirmek). Silmek seçildi: kimliksizleştirilmiş bir skor
 * lider tablosunda adsız bir satır olarak kalırdı ve kullanıcı "hesabımı
 * sildim ama hâlâ oradayım" derdi. Hangisi olduğu silmeden ÖNCE söyleniyor.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const user = await currentUserFromRequest(request);

  // Oturum yoksa silinecek bir şey de yok. `401` yerine `204`: sonuç
  // kullanıcı açısından aynı ve durum bildirmek gereksiz.
  if (user === null) {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const repository = accountsRepository();
  if (repository !== null) await repository.deleteAccount(user.id);

  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(PENDING_COOKIE);

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
}
