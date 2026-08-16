import { cookies } from "next/headers";
import { PENDING_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * `POST /api/auth/cikis` — oturumu kapatır (§11.10).
 *
 * POST, GET DEĞİL. Bir GET ucu olsaydı sayfaya gömülen bir `<img>` etiketi
 * kullanıcıyı habersiz çıkış yaptırırdı. Zararı sınırlı ama gereksiz.
 *
 * Bekleme çerezi de siliniyor: ad seçme adımında yarıda bırakan biri "çıkış"
 * dediğinde geride yarım bir akış kalmamalı.
 */
export async function POST(): Promise<Response> {
  const store = await cookies();

  store.delete(SESSION_COOKIE);
  store.delete(PENDING_COOKIE);

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
}
