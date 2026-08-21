import { CLUB_CLASSES, WD } from "../../leagues";

/**
 * SPARQL sorguları.
 *
 * Sorgular NEDEN dar tutuluyor? Geliştirme sırasında kulüp döneminden oyuncu
 * meta verisine kadar her şeyi tek sorguda isteyen bir deneme Wikidata'dan
 * `502 Bad Gateway` aldı. Endpoint ortak kaynaktır ve 60 sn'lik bir sorgu
 * bütçesi vardır; bu yüzden iş üç ayrı geçişe bölündü:
 *
 *   1. kulüpler (lig başına)
 *   2. dönemler (kulüp başına)
 *   3. oyuncu meta verisi (toplu, QID grupları hâlinde)
 *
 * Değer eklerken `?x` değişkenini OPTIONAL içine almak neredeyse her zaman
 * doğrudur: Wikidata'da alanların çoğu bazı kayıtlarda eksiktir ve zorunlu
 * kılmak sessizce satır kaybettirir.
 */

/** QID'i sorguya gömmeden önce biçimini doğrular (enjeksiyon koruması). */
function assertQid(id: string): string {
  if (!/^Q\d+$/.test(id)) {
    throw new Error(`Geçersiz Wikidata QID: ${JSON.stringify(id)}`);
  }
  return id;
}

/**
 * Kulüp sayılan sınıfları SPARQL `VALUES` bloğuna çevirir.
 *
 * Bu kısıt olmadan sorgu oyuncuları da döndürür (`P118` insanlarda da
 * kullanılıyor); tek sınıfa daraltıldığında ise Barcelona gibi farklı
 * sınıflandırılmış kulüpler düşer. Gerekçe: `leagues.ts` → `CLUB_CLASSES`.
 */
const CLUB_CLASS_VALUES = CLUB_CLASSES.map((id) => `wd:${assertQid(id)}`).join(
  " ",
);

/**
 * ŞEMSİYE sınıfları — ikiz ayrımının dayanağı (`clubDuplicates`).
 *
 * Bu iki sınıf "birden çok şubesi olan kurum" demek; bir kulübün futbol
 * şubesi bunları taşımaz. İkiz ayrımı bu ASİMETRİYE dayanır.
 *
 * ÖNCEKİ KURAL "iki taraf da `Q476028` (futbol kulübü) ise ele" diyordu ve
 * ÖLÇÜLEREK yanlış bulundu: Wikidata çok şubeli kulüpleri düzenli olarak İKİ
 * sınıfla birden etiketliyor.
 *
 *   Q329607 IFK Norrköping      → Q847017 + Q476028
 *   Q297906 Örgryte IS          → Q847017 + Q476028
 *   Q33748  Hannover 96 (şemsiye) → Q847017 + Q476028
 *
 * Şube de doğal olarak `Q476028` taşıdığı için koşul GERÇEK ikizlerde de
 * sağlanıyor ve kural onları kendi elinde tuttuğu hâlde eliyordu — Örgryte
 * ile IFK Norrköping böyle kaçtı. Kusur Wikidata'da değil, sorgudaydı.
 *
 * Yeni kural 992 kulübün tamamında ölçüldü: iki gerçek ikiz kazanılıyor,
 * kaybedilen yedi çiftin hepsi evren dışı bir ebeveyne bağlı ve
 * `mergeDuplicateClubs` onları zaten atıyordu. §5.3'ün dört gerileme çifti
 * (Fenerbahçe, Hannover 96, Bursaspor birleşiyor; Roubaix ayrı kalıyor)
 * yeniden koşuldu ve dördü de doğru davranıyor.
 */
const UMBRELLA_CLASS_VALUES = ["Q847017", "Q13580678"]
  .map((id) => `wd:${assertQid(id)}`)
  .join(" ");

/** Kulüp meta verisi — iki kulüp sorgusunda da aynı. */
const CLUB_FIELDS = `
  OPTIONAL { ?club wdt:P571 ?inception }
  OPTIONAL { ?club wdt:P154 ?logo }
  OPTIONAL { ?club wdt:P17/wdt:P297 ?countryCode }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }`;

/**
 * Kulüp evreni üç ayrı sorgudan toplanır. Sorgular ADAY üretir; hangisinin
 * gerçek kulüp olduğuna burada karar VERİLMEZ — kararı `extract.ts` ölçülen
 * dönem sayısına bakarak verir. Gerekçe `clubsFromSeasonParents` altında.
 *
 * Tür kısıtı üçünde de ZORUNLUDUR ama tek sınıfa daraltılamaz:
 *   - kısıtsız sorgu oyuncuları da döndürür (9091 sonucun 6066'sı insandı),
 *   - yalnızca `Q476028` istendiğinde Barcelona listeden düşer.
 */

/**
 * 1. kaynak: `P118` (lig) bağı — **tüm ifadeler**, yalnızca kestirme değil.
 *
 * `wdt:` KESTİRMESİ KÜME DÜŞEN KULÜBÜ KAYBETTİRİYORDU. Kestirme yalnızca
 * *tercih edilen* rütbedeki değeri döner; bir kulüp küme düşünce editörler
 * yeni ligi tercih edilen yapıyor, eski lig ifadesi *normal* rütbeye iniyor
 * ve kulüp evrenden sessizce çıkıyor. Adana Demirspor'da tam olarak bu
 * olmuştu:
 *
 *   P118 = Süper Lig   rütbe: normal      2021 → 2025
 *   P118 = 1. Lig      rütbe: TERCİH      2025 → …
 *
 * Kulüp veri kümesinde hiç yoktu; 262 dönemi, kadrosundaki oyuncular ve
 * onların diğer kulüplerdeki kayıtları da beraberinde eksikti.
 *
 * İKİNCİ YOL BU BOŞLUĞU KAPATAMIYOR ve sebebi ölçüldü: Süper Lig'in 69 sezon
 * kaydının yalnızca **3'ünde** `P1923` katılımcı listesi var. Karşılaştırma —
 * Bundesliga 63/63, La Liga 95/98, Ligue 1 88/95. Yani sezon yolu Türkiye
 * için fiilen çalışmıyor; `P118` tek gerçek kaynak.
 *
 * DEPRECATED RÜTBE DIŞARIDA. Wikidata üç rütbe kullanıyor ve *deprecated*
 * "yanlış olduğu bilinen" demektir — okumak veri kümesine bilerek yanlış
 * kayıt almak olurdu. Ölçüldü: altı ligde 5 böyle ifade var.
 *
 * ÖLÇÜLEN KAZANÇ: evrene 12 kulüp giriyor, **10'u Süper Lig** (Adana
 * Demirspor, Altay, Eskişehirspor, Giresunspor, İstanbulspor, Hatayspor,
 * Pendikspor, Ümraniyespor, Erzurumspor, Bodrum FK) ve toplam ~1.374 dönem
 * taşıyorlar. Kalan 2'si Hamburger SV ile FC Augsburg'un "birinci erkek
 * takımı" varlıkları; ikisinin de **0 dönemi** var, o yüzden yüklemedeki boş
 * kulüp temizliği onları zaten atıyor — kulüp ikizleşmesi oluşmuyor.
 */
export function clubsByLeagueLink(leagueQid: string): string {
  return `
SELECT DISTINCT ?club ?clubLabel ?inception ?logo ?countryCode WHERE {
  VALUES ?clubClass { ${CLUB_CLASS_VALUES} }
  ?club p:${WD.PROP_LEAGUE} ?leagueStatement ;
        wdt:P31/wdt:P279* ?clubClass .
  ?leagueStatement ps:${WD.PROP_LEAGUE} wd:${assertQid(leagueQid)} ;
                   wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
${CLUB_FIELDS}
}`.trim();
}

/**
 * 2. kaynak: ligin sezonlarına katılmış takımlar (`P1923`), çözümlemesiz.
 *
 * NEDEN GEREKLİ: `P118` tek başına eksik. Wolfsburg, St. Pauli ve Heidenheim
 * o yolla hiç gelmiyordu; buna karşılık feshedilmiş selef kulüpleri getiriyor.
 */
export function clubsFromSeasons(leagueQid: string): string {
  return `
SELECT DISTINCT ?club ?clubLabel ?inception ?logo ?countryCode WHERE {
  VALUES ?clubClass { ${CLUB_CLASS_VALUES} }
  ?season wdt:${WD.PROP_SEASON_OF_LEAGUE} wd:${assertQid(leagueQid)} ;
          wdt:${WD.PROP_PARTICIPANT} ?club .
  ?club wdt:P31/wdt:P279* ?clubClass .
${CLUB_FIELDS}
}`.trim();
}

/**
 * 3. kaynak: sezon katılımcılarının `P831` (üst kulüp) ebeveynleri.
 *
 * NEDEN GEREKLİ: `P1923` bazen sezona özgü bir takım varlığı döndürür
 * (`Q97905916` = "FC Augsburg 2025-26"); oyuncuların `P54` bağları ise ana
 * kulüp varlığına (`Q15755`) gider. Bu dal olmadan Augsburg veritabanına
 * sıfır dönem kaydıyla giriyordu.
 *
 * NEDEN AYRI BİR DAL, ÇÖZÜMLEME DEĞİL: `P831`'in yönü Wikidata'da tutarsız
 * ve hangi ucun "gerçek" kulüp olduğu türden okunamıyor. Ölçüm:
 *
 *   Q97905916 (sezon takımı)  --P831--> Q15755     (gerçek kulüp, 326 oyuncu)
 *   Q7156     (FC Barcelona)  --P831--> Q3091261   (kabuk,          22 oyuncu)
 *   Q43710    (Antalyaspor)   --P831--> Q12808521  (ana spor kulübü, 7 oyuncu)
 *
 * İlk satır çözümlemeyi gerektirir, diğer ikisi çözümlemeden zarar görür —
 * `?club` yerine ebeveyni koyan her kural bu üç kulüpten ikisini bozar.
 * Bu yüzden ebeveyn, tohumun YERİNE geçmez; yanına ek aday olarak eklenir.
 * Seçimi `MIN_SPELLS_FOR_SELECTABLE` eşiği ve boş kulüp temizliği yapar:
 * kararı tahmin değil, kulüp başına ölçülen dönem sayısı verir.
 */
export function clubsFromSeasonParents(leagueQid: string): string {
  return `
SELECT DISTINCT ?club ?clubLabel ?inception ?logo ?countryCode WHERE {
  VALUES ?clubClass { ${CLUB_CLASS_VALUES} }
  ?season wdt:${WD.PROP_SEASON_OF_LEAGUE} wd:${assertQid(leagueQid)} ;
          wdt:${WD.PROP_PARTICIPANT} ?seasonTeam .
  ?seasonTeam wdt:${WD.PROP_PARENT_CLUB} ?club .
  ?club wdt:P31/wdt:P279* ?clubClass .
${CLUB_FIELDS}
}`.trim();
}

/**
 * Bir kulüpteki tüm oyuncu dönemleri (tarihsel — yalnızca güncel kadro değil).
 *
 * `?st` ifade (statement) URI'sidir; sonda gelen kimlik Spell için doğal
 * anahtar olarak kullanılır ve ETL'i idempotent yapar.
 *
 * NEDEN `pq:` DEĞİL `pqv:` — HASSASİYET (BR-6). Wikidata tarihleri çoğunlukla
 * YIL hassasiyetinde tutuyor (`+2025-00-00`, `precision: 9`); WDQS bunu
 * `2025-01-01` diye normalleştirdiği için `pq:` ile gelen değer gerçek bir
 * Ocak tarihinden AYIRT EDİLEMİYOR. Sonuç ölçüldü: Ocak, sezon kuralı gereği
 * bir önceki sezona yazılıyordu ve 2025 yazı transferi 2024 sezonu olarak
 * kaydediliyordu.
 *
 * Ölçüm (Arsenal, Galatasaray, Real Madrid, Liverpool — 3.454 başlangıç):
 *   yıl (9)  3.235  %93,7   ← hepsi bir sezon kayıyordu
 *   ay  (10)    78   %2,3
 *   gün (11)   140   %4,1
 *
 * `pqv:` değer düğümü `wikibase:timePrecision` taşır; kayma böyle kapanır.
 * Maliyeti ölçüldü: aynı kulüpte 0,94 sn → 1,3 sn (sıcak).
 */
export function spellsAtClub(clubQid: string): string {
  return `
SELECT ?st ?player ?start ?startPrecision ?end ?endPrecision ?apps ?goals ?acq WHERE {
  ?player p:${WD.PROP_MEMBER_OF_TEAM} ?st .
  ?st ps:${WD.PROP_MEMBER_OF_TEAM} wd:${assertQid(clubQid)} .
  OPTIONAL {
    ?st pqv:${WD.PROP_START_TIME} ?startNode .
    ?startNode wikibase:timeValue ?start ; wikibase:timePrecision ?startPrecision .
  }
  OPTIONAL {
    ?st pqv:${WD.PROP_END_TIME} ?endNode .
    ?endNode wikibase:timeValue ?end ; wikibase:timePrecision ?endPrecision .
  }
  OPTIONAL { ?st pq:${WD.PROP_MATCHES_PLAYED}  ?apps }
  OPTIONAL { ?st pq:${WD.PROP_GOALS}           ?goals }
  OPTIONAL { ?st pq:${WD.PROP_ACQUISITION}     ?acq }
}`.trim();
}

/**
 * Oyuncu meta verisi — toplu.
 *
 * Etiket servisi pahalıdır, bu yüzden dönem sorgusundan ayrıldı ve QID'ler
 * gruplar hâlinde sorulur (bkz. `PLAYER_BATCH_SIZE`).
 *
 * OYUNCU BAŞINA BİRDEN ÇOK SATIR DÖNER ve bu normaldir: `P27` (vatandaşlık)
 * ile `P413` (mevki) çok değerlidir. Çağıran taraf satırları KİMLİĞE GÖRE
 * TOPLAMAK zorundadır — `playersFrom()` bunu yapar. Uzun süre yapmıyordu ve
 * sonuç ölçüldü (§5.3.1): Messi'nin üç vatandaşlığından sonuncusu kazanıp
 * onu İspanyol yapıyordu.
 *
 * `birthCountryCode` BR-38'in üçüncü kademesi: millî takımı olmayan çift
 * vatandaşlıklıda doğum ülkesi belirleyici. Tek başına yeterli değil —
 * Thiago Motta'yı Brezilyalı yapardı — o yüzden millî takımdan SONRA gelir.
 */
export function playerDetails(playerQids: readonly string[]): string {
  const values = playerQids.map((id) => `wd:${assertQid(id)}`).join(" ");

  return `
SELECT ?player ?playerLabel ?dob ?positionLabel ?countryCode ?birthCountryCode ?gender WHERE {
  VALUES ?player { ${values} }
  OPTIONAL { ?player wdt:P569 ?dob }
  OPTIONAL { ?player wdt:P413 ?position }
  OPTIONAL { ?player wdt:P27/wdt:P297 ?countryCode }
  OPTIONAL { ?player wdt:P19/wdt:P17/wdt:P297 ?birthCountryCode }
  OPTIONAL { ?player wdt:P21 ?gender }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }
}`.trim();
}

/**
 * Erkek A millî futbol takımlarının tamamı — PROJECT.md §9.2.
 *
 * ETL'de **BİR KEZ** çalışır ve sonucu bellekte tutulur. Ölçüm: 350 takım,
 * 924 ms.
 *
 * NEDEN AYRI BİR SORGU (ölçüldü, 22 kat fark). Millî maç sayısını sorarken
 * takım sınıfını sorgunun içinde denetlemek — `?team wdt:P31 wd:Q135408445` —
 * motoru her `P54` ifadesinin takımını aramaya zorluyor:
 *
 *   sınıf süzgeci      yığın  40 → 17.851 ms/yığın → tam çekim ~9,5 SAAT
 *   VALUES üyeliği     yığın  40 →  3.092 ms/yığın → URL sınırına takılıyor
 *   süzmesiz + JS      yığın 250 →    809 ms/yığın → tam çekim ~5 DAKİKA
 *
 * Liste bir kez alınıp süzme bellekte yapılıyor. İki yöntemin aynı sonucu
 * verdiği sekiz oyuncuda birebir doğrulandı (8/8).
 *
 * ÜLKE KODU DA ALINIYOR — BR-38'in birinci kademesi. `P1532` (spor için ülke)
 * seyrektir; ölçüldü, dört takımın yalnızca birinde vardı. `P17` (ülke)
 * çalışıyor ve İngiltere millî takımını `GB`'ye eşliyor — bu, kulüp ve oyuncu
 * kodlamasıyla tutarlı. Sıra: önce `P1532`, sonra `P17`.
 */
export function mensNationalTeams(): string {
  return `
SELECT ?team ?sportCountryCode ?adminCountryCode WHERE {
  ?team wdt:P31 wd:${assertQid(WD.CLASS_MENS_NATIONAL_TEAM)} .
  OPTIONAL { ?team wdt:P1532/wdt:P297 ?sportCountryCode }
  OPTIONAL { ?team wdt:P17/wdt:P297 ?adminCountryCode }
}`.trim();
}

/**
 * Oyuncu istatistikleri — toplu (§9.2).
 *
 * `playerDetails`'ten AYRI tutuldu: o sorgu oyuncu başına tek satır döndürür,
 * bu ise millî takım ifadesi başına bir satır. İkisini birleştirmek hem
 * kartezyen çarpım üretir hem de `VALUES` bloğunu iki kez yazdırıp URL'i
 * `HTTP 414`'e taşırır (ölçüldü).
 *
 * Takım süzgeci burada YOK; çağıran taraf `mensNationalTeams()` listesiyle
 * süzer. Gerekçe o fonksiyonun başında.
 *
 * `?caps` ifade başına gelir ve **toplanmaz** — BR-14 gereği en büyüğü alınır.
 *
 * `?goals` AYNI İFADEDEN gelir ve `OPTIONAL`'dır. İkisini tek sorguda almak
 * bir tercih değil, tek seçenek: gol niteliği maç niteliğinin yanında durur,
 * ayrı sorgu ikinci bir tam tarama demek olurdu. Ölçüldü (15 Ağustos 2026,
 * 6.464 oyunculuk tanınırlık havuzu): maç sayısı olan 3.580 oyuncunun
 * 3.573'ünde gol de var — **%99,8**. Kolay havuzda 1.368/1.369.
 *
 * `OPTIONAL` ZORUNLU. Kaldırmak, golü olmayan o 7 oyuncunun maç sayısını da
 * düşürürdü; yani kapsamı olan bir alanı, kapsamı olmayan bir alan uğruna
 * sessizce kaybederdik.
 */
export function playerStats(playerQids: readonly string[]): string {
  const values = playerQids.map((id) => `wd:${assertQid(id)}`).join(" ");

  return `
SELECT ?player ?team ?caps ?goals WHERE {
  VALUES ?player { ${values} }
  ?player p:${WD.PROP_MEMBER_OF_TEAM} ?st .
  ?st ps:${WD.PROP_MEMBER_OF_TEAM} ?team ; pq:${WD.PROP_MATCHES_PLAYED} ?caps .
  OPTIONAL { ?st pq:${WD.PROP_GOALS} ?goals }
}`.trim();
}

/**
 * Oyuncunun fiziksel ölçüleri — toplu (§9.2).
 *
 * Ölçülen kapsam: boy %69, kilo %49. İkisi de `OPTIONAL`; zorunlu kılmak
 * ölçüsü olmayan oyuncuyu sessizce düşürürdü.
 *
 * Yığın 250'de 1.441 ms; 500'de `HTTP 414` (URL çok uzun).
 */
export function playerPhysical(playerQids: readonly string[]): string {
  const values = playerQids.map((id) => `wd:${assertQid(id)}`).join(" ");

  return `
SELECT ?player ?height ?mass WHERE {
  VALUES ?player { ${values} }
  OPTIONAL { ?player wdt:${WD.PROP_HEIGHT} ?height }
  OPTIONAL { ?player wdt:${WD.PROP_MASS} ?mass }
}`.trim();
}

/**
 * Lig kimliklerinin gerçekten beklenen ligler olduğunu denetler.
 *
 * Bu sorgu `Q170323 = Nintendo DS` hatasını yakalayan denetimin kalıcı
 * hâlidir; QID listesi her değiştiğinde çalıştırılır.
 */
export function verifyLeagues(leagueQids: readonly string[]): string {
  const values = leagueQids.map((id) => `wd:${assertQid(id)}`).join(" ");

  return `
SELECT ?league ?leagueLabel (COUNT(DISTINCT ?club) AS ?clubCount) WHERE {
  VALUES ?league { ${values} }
  VALUES ?clubClass { ${CLUB_CLASS_VALUES} }
  ?club wdt:${WD.PROP_LEAGUE} ?league ;
        wdt:P31/wdt:P279* ?clubClass .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?league ?leagueLabel`.trim();
}

/**
 * Aynı futbol geçmişini paylaşan kulüp İKİZLERİ — PROJECT.md §5.3.
 *
 * Wikidata bazen bir kulübü iki varlığa bölüyor: şemsiye spor kulübü
 * (`Fenerbahçe SK`, çok takımlı) ve onun futbol takımı (`Fenerbahçe`).
 * Oyuncuların `P54` ifadeleri ikisine de dağılıyor ve veri kümesinde kulüp
 * ikiye bölünüyor.
 *
 * AYRIM BURADA YAPILIR ÇÜNKÜ AYNI BAĞ İKİ FARKLI ŞEYİ GÖSTERİYOR. `P361`
 * (parçası) ve `P831` (ana kulüp) hem ikizleri hem SELEF/HALEF kulüpleri
 * bağlıyor — `RC Roubaix`, 1945'te `CO Roubaix-Tourcoing`'i oluşturan
 * birleşmeye girmiş ve o bağ da `P361`. İkisi AYRI kulüptür; birleştirmek
 * iki gerçek kulübün geçmişini karıştırırdı.
 *
 * Ayrımı SINIF verir, eşik değil — ama sorulacak soru "iki taraf da futbol
 * kulübü mü" DEĞİL, **şemsiye sınıfı asimetrik mi**: ebeveyn `Q847017` /
 * `Q13580678` taşıyor, kulüp taşımıyorsa bağ bir şemsiye/şube ayrımıdır.
 * İki taraf da düz futbol kulübüyse bağ bir birleşme kaydıdır ve döndürülmez.
 * Önceki kuralın neden yanlış olduğu `UMBRELLA_CLASS_VALUES` üzerinde.
 *
 * ÖLÇÜLDÜ, §5.3'ÜN DÖRT GERİLEME ÇİFTİNDE: Fenerbahçe, Hannover 96 ve
 * Bursaspor birleşiyor, Roubaix ayrı kalıyor. Ortak oyuncu oranı bağımsız
 * olarak aynı şeyi söylüyor — ikizlerde aynı oyuncu iki tarafta birden
 * görünüyor (Fenerbahçe %84), selef/halefte görünmüyor (%8).
 *
 * `P527` (parçaları) BİLEREK YOK: ölçüldü, evren içindeki 9 bağının hepsi
 * zaten `P361`/`P831` ile de geliyor — eklemek yalnızca yinelenen kenar
 * üretirdi.
 */
export function clubDuplicates(qids: readonly string[]): string {
  const values = qids.map((id) => `wd:${assertQid(id)}`).join(" ");

  return `
SELECT DISTINCT ?club ?parent WHERE {
  VALUES ?club { ${values} }
  ?club (wdt:${WD.PROP_PART_OF}|wdt:${WD.PROP_PARENT_CLUB}) ?parent .
  FILTER(?club != ?parent)
  ?parent wdt:P31 ?parentClass .
  VALUES ?parentClass { ${UMBRELLA_CLASS_VALUES} }
  FILTER NOT EXISTS {
    ?club wdt:P31 ?clubClass .
    VALUES ?clubClass { ${UMBRELLA_CLASS_VALUES} }
  }
}`.trim();
}

/**
 * Halefiyet bağları — PROJECT.md §5.3, 2. aşama ölçümü.
 *
 * `clubDuplicates`'ten AYRI BİR SORU soruyor ve karıştırılmamalı. Orada
 * aranan şey aynı ANIN iki kaydı (şemsiye kulüp ↔ futbol şubesi); burada
 * aranan şey aynı kulübün ARDIŞIK kayıtları — iflas edip yeniden kurulan,
 * ad değiştiren, birleşen kulüpler.
 *
 * Dört özellik birden okunuyor çünkü Wikidata hangisini kullanacağı
 * konusunda tutarlı değil: `P1365`/`P1366` (yerine geçer / yerini alır)
 * kurumsal ardıllık, `P155`/`P156` (önce gelen / sonra gelen) daha genel
 * bir sıralama. Kulüplerde ikisi de görülüyor.
 *
 * SINIF KISITI YOK, bilerek. `clubDuplicates` şemsiye asimetrisine dayanır;
 * burada iki taraf da düz futbol kulübüdür ve ayrım sınıfla yapılamaz.
 * Süzgeç çağıranda: yalnızca EVRENDE olan uçlar sayılır.
 *
 * BU SORGU KARAR VERMEZ. Yeniden kuruluş ile BİRLEŞMEYİ ayırt edemez —
 * ikisi de aynı bağı taşır. Ayrım zincirin şeklinden okunur (tek selef mi,
 * çok selef mi) ve son sözü insan söyler.
 */
export function clubLineage(qids: readonly string[]): string {
  const values = qids.map((id) => `wd:${assertQid(id)}`).join(" ");

  return `
SELECT DISTINCT ?club ?other ?prop WHERE {
  VALUES ?club { ${values} }
  VALUES ?prop { wdt:P1365 wdt:P1366 wdt:P155 wdt:P156 }
  ?club ?prop ?other .
  FILTER(?club != ?other)
}`.trim();
}

/** Bir sorguda sorulacak azami oyuncu sayısı — zaman aşımını önler. */
export const PLAYER_BATCH_SIZE = 250;

/**
 * Varlıkların Vikipedi makale adresleri — PROJECT.md §4.3.
 *
 * NEDEN SPARQL, MEDIAWIKI API'Sİ DEĞİL (ölçüldü, 5 kat fark). Aynı bilgi
 * `wbgetentities` ile de alınabiliyor ama o uç bir istekte en çok 50 kimlik
 * kabul ediyor; SPARQL 250'yi tek sorguda dönüyor. 76 bin oyuncuda fark
 * 1.520 istek yerine 304 sorgu — Vikipedi katmanının en pahalı adımlarından
 * biri böylece Wikidata geçişinin yanına iliştirilmiş oluyor.
 *
 * Hem oyuncular hem KULÜPLER için kullanılır: kulüp makale adları, bilgi
 * kutusundaki bağlantıları evrendeki kulüplerle eşleştirmenin anahtarı.
 *
 * DİLLER ÇAĞIRANDAN GELİR ve bu bir maliyet kararıdır (§4.3, Aşama 2). Her
 * dil ayrı bir `OPTIONAL` birleştirmesi; beş dili her oyuncu için sormak
 * sorguyu ana geçişte gereksiz yere ağırlaştırır. Ana diller yalnızca
 * tr/en makalesi OLMAYAN oyuncular için, ayrı bir turda sorulur.
 */
export function wikipediaArticles(
  qids: readonly string[],
  sites: readonly string[],
): string {
  const values = qids.map((id) => `wd:${assertQid(id)}`).join(" ");
  // Dil kodu sorgu metnine giriyor; SPARQL enjeksiyonuna karşı biçim
  // denetlenir (§2.3 — sınırda doğrulama, iç katmanda güven).
  const safe = sites.map((site) => {
    if (!/^[a-z]{2,3}$/u.test(site)) {
      throw new Error(`Geçersiz viki dil kodu: ${site}`);
    }
    return site;
  });

  const select = safe.map((site) => `?${site}Article`).join(" ");
  const optionals = safe
    .map(
      (site) =>
        `  OPTIONAL { ?${site}Article schema:about ?item ; schema:isPartOf <https://${site}.wikipedia.org/> }`,
    )
    .join("\n");

  return `
SELECT ?item ${select} WHERE {
  VALUES ?item { ${values} }
${optionals}
}`.trim();
}
