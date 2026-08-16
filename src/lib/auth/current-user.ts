import { cookies } from "next/headers";
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
 */
export async function currentUser(): Promise<Account | null> {
  const env = accountsEnv();
  if (env === null) return null;

  const repository = accountsRepository();
  if (repository === null) return null;

  const store = await cookies();
  const userId = await readSessionValue(
    env.authSecret,
    store.get(SESSION_COOKIE)?.value,
    new Date(),
  );

  if (userId === null) return null;

  return repository.findById(userId);
}
