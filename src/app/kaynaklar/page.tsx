import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { datasets, repositories } from "@/infrastructure/db/repositories";

/**
 * Arma kaynakları ve lisansları — PROJECT.md §7.3, BR-34.
 *
 * NEDEN AYRI BİR SAYFA. Armaların bir kısmı CC BY / CC BY-SA lisanslı ve bu
 * lisanslar yazarın, lisans adının ve dosya sayfasının anılmasını ŞART koşuyor.
 * Bunu her armanın yanına basmak arayüzü okunmaz hâle getirirdi; toplu bir
 * künye sayfası, lisansların "ortama uygun biçimde" atıf beklentisini karşılar
 * ve altbilgiden her sayfaya bağlanır.
 *
 * LİSTE VERİDEN GELİYOR, elle yazılmıyor. Elle tutulan bir künye, veri
 * tazelendiğinde sessizce yanlışa dönerdi — ve yanlış atıf, atıf yapmamakla
 * aynı kapıya çıkar.
 */

export const metadata: Metadata = {
  title: "Arma Kaynakları ve Lisanslar — Futbol Quiz",
  description:
    "Sitede gösterilen kulüp armalarının kaynakları, lisansları ve yazarları.",
};

export default async function CreditsPage() {
  const [credits, dataGeneratedAt] = await Promise.all([
    repositories.clubs.listCrestCredits(),
    datasets.getGeneratedAt(),
  ]);

  const needingAuthor = credits.filter((one) => one.author !== null).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Arma Kaynakları ve Lisanslar
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Sitedeki kulüp armaları Wikimedia Commons&apos;tan alınmıştır ve hepsi
          özgür lisanslıdır. Aşağıda her armanın lisansı, varsa yazarı ve özgün
          dosya sayfası listelenmiştir.
        </p>
        <p className="max-w-prose text-sm text-muted">
          Yalnızca özgür lisanslı dosyalar kullanılır; kulüplerin güncel resmî
          logolarının çoğu Vikipedi&apos;de <em>adil kullanım</em> gerekçesiyle
          duruyor ve yeniden kullanılamadığı için burada yer almaz. Bu yüzden
          bazı kulüplerin arması eksiktir.
        </p>
        <p className="text-sm text-muted">
          Armalar ilgili kulüplerin <strong>tescilli markalarıdır</strong> ve
          burada yalnızca kulübü tanıtmak için kullanılır; bu site hiçbir
          kulüple bağlantılı değildir.
        </p>
      </header>

      {credits.length === 0 ? (
        <p className="text-muted">Henüz künyesi kayıtlı arma yok.</p>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">
            {credits.length} arma · {needingAuthor} tanesinde yazar anılıyor
          </h2>

          {/*
            Geniş tablo KENDİ İÇİNDE kaydırılır; sayfanın gövdesi yatay
            kaymamalı (§7.12).
          */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Kulüp
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Lisans
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Yazar
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Dosya
                  </th>
                </tr>
              </thead>
              <tbody>
                {credits.map((credit) => (
                  <tr key={credit.filePage} className="border-b border-line">
                    <td className="py-2 pr-4 font-medium">{credit.clubName}</td>
                    <td className="py-2 pr-4 text-muted">{credit.license}</td>
                    <td className="py-2 pr-4 text-muted">
                      {credit.author ?? "—"}
                    </td>
                    <td className="py-2">
                      <a
                        href={credit.filePage}
                        rel="noreferrer noopener"
                        target="_blank"
                        className="text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Commons
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/*
        BAYRAK KÜNYESİ (BR-39). `flag-icons` MIT lisanslı ve MIT, telif
        bildiriminin korunmasını ŞART koşar. Liste veriden gelmiyor çünkü
        bayraklar depoya sabit olarak alındı — künye de sabit.
      */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Ülke bayrakları</h2>
        <p className="max-w-prose text-sm text-muted">
          Lig listesindeki bayraklar{" "}
          <a
            href="https://github.com/lipis/flag-icons"
            rel="noreferrer noopener"
            target="_blank"
            className="text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            flag-icons
          </a>{" "}
          projesinden alınmıştır (MIT lisansı, © 2013 Panayiotis Lipiridis).
          Lisans metni{" "}
          <a
            href="/flags/LICENSE.txt"
            className="text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            /flags/LICENSE.txt
          </a>{" "}
          adresinde bayraklarla birlikte taşınır.
        </p>
      </section>

      <p>
        <Link
          href="/"
          className="text-sm font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Başa dön
        </Link>
      </p>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
