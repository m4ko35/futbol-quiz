import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { Account } from "@/application/ports/accounts-repository";
import { accountsEnv } from "@/infrastructure/config/env";
import { accountsRepository } from "@/infrastructure/db/repositories";
import { readSessionValue, SESSION_COOKIE } from "./session";

/**
 * İsteği yapan kullanıcı — PROJECT.md §11.10.
 *
 * ÇEREZ TEK BAŞINA YETERLİ DEĞİL: kimlik çerezden okunuyor ama kullanıcı
 * VERİTABANINDAN doğrulanıyor. Silinmiş bir hesabın çerezi bu yüzden işe
 * yaramaz (BR-48) — çerezin ömrü dolmamış olsa bile kayıt yoksa oturum yok.
 *
 * Kullanıcı zaten her istekte okunmak zorunda (ad, tur, puan); bu yüzden
 * doğrulama fazladan bir sorgu getirmiyor.
 *
 * İKİ GİRİŞ, TEK ÇEKİRDEK ve ayrım bir ölçümden doğdu. `next/headers`'ın
 * `cookies()` işlevi YALNIZCA istek bağlamı içinde çalışır; route handler'ı
 * doğrudan çağıran sözleşme testleri o bağlamı kurmaz ve çağrı
 * "`cookies` was called outside a request scope" ile patlar.
 *
 * Hatayı yutmak YANLIŞ olurdu: gerçek bir yapılandırma hatası da sessizce
 * "giriş yapılmamış" diye okunurdu. Doğrusu çerezi, elde varsa isteğin
 * KENDİSİNDEN okumak — sayfalar `currentUser()`, uçlar
 * `currentUserFromRequest()` kullanır.
 */

async function resolve(value: string | undefined): Promise<Account | null> {
  const env = accountsEnv();
  if (env === null) return null;

  const repository = accountsRepository();
  if (repository === null) return null;

  const userId = await readSessionValue(env.authSecret, value, new Date());
  if (userId === null) return null;

  return repository.findById(userId);
}

/** Sunucu bileşenleri ve sayfalar için — istek bağlamı gerektirir. */
export async function currentUser(): Promise<Account | null> {
  const store = await cookies();
  return resolve(store.get(SESSION_COOKIE)?.value);
}

/** Route handler'lar için — çerezi isteğin kendisinden okur. */
export function currentUserFromRequest(
  request: NextRequest,
): Promise<Account | null> {
  return resolve(request.cookies.get(SESSION_COOKIE)?.value);
}
