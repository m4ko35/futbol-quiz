/**
 * Gerçek Vikipedi bilgi kutuları — birim testi fikstürleri (§8.1).
 *
 * METİNLER OLDUĞU GİBİ, elle sadeleştirilmeden alındı. Sadeleştirilmiş bir
 * fikstür yalnızca ayrıştırıcının kendi varsayımlarını doğrular; gerçek
 * wikitext ise editörlerin gerçekte yazdığı dağınıklığı taşır — testin
 * değeri de oradan gelir.
 *
 * Kaynak: MediaWiki `action=query&prop=revisions` — 3 Ağustos 2026.
 * Lisans: CC BY-SA (§4.3).
 */

/**
 * tr.wikipedia.org — Abdülkerim Bardakçı
 *
 * Ayrıştırıcının HER zor durumunu tek kutuda taşıyor:
 *   · kiralık işareti hem ok (`→`) hem not (`(kiralık)`) olarak
 *   · açık uçlu aralık (`kulüpyıl8 = 2022-`) — ASCII tire, en tire değil
 *   · bağlantı hedefinde rakam (`[[1922 Konyaspor|Anadolu Selçukspor]]`)
 *   · okunmaması gereken `altyapıkulübü` ve `millitakım` alanları
 *   · gövdesinde `|` taşıyan iç şablonlar (`{{doğum tarihi ve yaşı|…}}`)
 */
export const BARDAKCI_INFOBOX = `{{Futbolcu bilgi kutusu
| ad = Abdülkerim Bardakcı
| resim = Abdülkerim Bardakçı - beIN-Sports-Reklam (2021) (cropped).png
| resimboyutu = 200pik
| altyazı = Bardakcı, 2021'de [[Konyaspor]] formasıyla.
| doğumtarihi = {{doğum tarihi ve yaşı|1994|9|7}}
| doğumyeri = [[Meram]], [[Konya]], [[Türkiye]]
| boyu = {{boy|m=1.85}} 
| pozisyon = [[Defans#Stoper|Stoper]]
| bulunduğukulüp = [[Galatasaray (futbol takımı)|Galatasaray]]
| numarası = 42
| altyapıyıl1 = 2007-2009
| altyapıkulübü1 = [[Fenerspor|Zonguldakspor]]
| altyapıyıl2 = 2009-2011
| altyapıkulübü2 = [[Konyaspor]]
| kulüpyıl1 = 2011-2022
| kulüp1 = [[Konyaspor]]
| maç1 = 104
| gol1 = 8
| kulüpyıl2 = 2014
| kulüp2 = → [[1922 Konyaspor|Anadolu Selçukspor]] (kiralık)
| maç2 = 6
| gol2 = 1
| kulüpyıl3 = 2014-2015
| kulüp3 = → [[Adana Demirspor]] (kiralık)
| maç3 = 33
| gol3 = 3
| kulüpyıl4 = 2017-2018
| kulüp4 = → [[Samsunspor (futbol takımı)|Samsunspor]] (kiralık)
| maç4 = 32
| gol4 = 1
| kulüpyıl5 = 2018
| kulüp5 = → [[Giresunspor]] (kiralık)
| maç5 = 13
| gol5 = 0
| kulüpyıl6 = 2018-2019
| kulüp6 = → [[Denizlispor]] (kiralık)
| maç6 = 32
| gol6 = 2
| kulüpyıl7 = 2019-2020
| kulüp7 = → [[Altay (futbol takımı)|Altay]] (kiralık)
| maç7 = 31
| gol7 = 3
| kulüpyıl8 = 2022-
| kulüp8 = [[Galatasaray (futbol takımı)|Galatasaray]]
| maç8 = 119
| gol8 = 10
| milliyıl1 = 2012
| millitakım1 = {{fbu|18|TUR|name=Türkiye U-18}}
| millimaç1 = 6
| milligol1 = 0
| milliyıl2 = 2011-2013
| millitakım2 = {{fbu|19|TUR|name=Türkiye U-19}}
| millimaç2 = 12
| milligol2 = 2
| milliyıl3 = 2012-2013
| millitakım3 = {{fbu|20|TUR|name=Türkiye U-20}}
| millimaç3 = 6
| milligol3 = 2
| milliyıl4 = 2013-2015
| millitakım4 = {{fbu|21|TUR|name=Türkiye U-21}}
| millimaç4 = 2
| milligol4 = 0
| milliyıl5= 2023-
| millitakım5= {{fb|TUR}}
| millimaç5= 30
| milligol5= 2
| güncelleme = {{Başlangıç tarihi|2026|6|26}}
}}`;

/**
 * en.wikipedia.org — Ryan Bertrand
 *
 * İngilizce şema, 12 kulüp dönemi ve 9 kiralık. Ayrıca `totalcaps`/
 * `totalgoals` toplam satırlarını taşıyor: numarasız oldukları için kariyer
 * satırı sayılmamaları gerekir.
 */
export const BERTRAND_INFOBOX = `{{Infobox football biography
| name = Ryan Bertrand
| image = RyanBertrandvsLeicesterCity (cropped).jpg
| caption = Bertrand playing for [[Chelsea F.C.|Chelsea]] in 2012
| full_name = Ryan Dominic Bertrand<ref>{{cite web |url=https://www.uefa.com/MultimediaFiles/Download/DisciplinaryChart/uefaorg/UEFACompDisCases/02/38/33/47/2383347_DOWNLOAD.pdf |title=15th UEFA European Championship: Booking List before Round of 16 |publisher=UEFA |page=8 |date=23 June 2016 |access-date=17 June 2021}}</ref>
| birth_date = {{birth date and age|1989|8|5|df=y}}<ref>{{cite web |url=https://www.espn.co.uk/football/player/_/id/91489/ryan-bertrand |title=Ryan Bertrand: Overview |publisher=ESPN |access-date=17 June 2021}}</ref>
| birth_place = [[Southwark]], England
| height = {{convert|1.79|m|order=flip}}<ref>{{cite web |url=https://www.premierleague.com/players/2886/Ryan-Bertrand/overview |title=Ryan Bertrand: Overview |publisher=Premier League |access-date=17 June 2021}}</ref>
| position = [[Left-back]]
| currentclub =
| clubnumber = 
| youthyears1 = 1998–2005
| youthclubs1 = [[Gillingham F.C.|Gillingham]]
| youthyears2 = 2005–2006
| youthclubs2 = [[Chelsea F.C. Reserves and Academy|Chelsea]]
| years1 = 2006–2015
| clubs1 = [[Chelsea F.C.|Chelsea]]
| caps1 = 28
| goals1 = 0
| years2 = 2006
| clubs2 = → [[AFC Bournemouth]] (loan)
| caps2 = 4
| goals2 = 0
| years3 = 2007
| clubs3 = → [[AFC Bournemouth]] (loan)
| caps3 = 1
| goals3 = 0
| years4 = 2007–2008
| clubs4 = → [[Oldham Athletic A.F.C.|Oldham Athletic]] (loan)
| caps4 = 21
| goals4 = 0
| years5 = 2008
| clubs5 = → [[Norwich City F.C.|Norwich City]] (loan)
| caps5 = 18
| goals5 = 0
| years6 = 2008–2009
| clubs6 = → [[Norwich City F.C.|Norwich City]] (loan)
| caps6 = 38
| goals6 = 0
| years7 = 2009–2010
| clubs7 = → [[Reading F.C.|Reading]] (loan)
| caps7 = 44
| goals7 = 1
| years8 = 2010–2011
| clubs8 = → [[Nottingham Forest F.C.|Nottingham Forest]] (loan)
| caps8 = 19
| goals8 = 0
| years9 = 2014
| clubs9 = → [[Aston Villa F.C.|Aston Villa]] (loan)
| caps9 = 16
| goals9 = 0
| years10 = 2014–2015
| clubs10 = → [[Southampton F.C.|Southampton]] (loan)
| caps10 = 22
| goals10 = 2
| years11 = 2015–2021
| clubs11 = [[Southampton F.C.|Southampton]]
| caps11 = 192
| goals11 = 5
| years12 = 2021–2023
| clubs12 = [[Leicester City F.C.|Leicester City]]
| caps12 = 4
| goals12 = 0
| totalcaps = 407
| totalgoals = 8
| nationalyears1 = 2006
| nationalteam1 = [[England national under-17 football team|England U17]]
| nationalcaps1 = 3
| nationalgoals1 = 0
| nationalyears2 = 2006
| nationalteam2 = [[England national under-18 football team|England U18]]
| nationalcaps2 = 1
| nationalgoals2 = 0
| nationalyears3 = 2006–2008
| nationalteam3 = [[England national under-19 football team|England U19]]
| nationalcaps3 = 10
| nationalgoals3 = 0
| nationalyears4 = 2009
| nationalteam4 = [[England national under-20 football team|England U20]]
| nationalcaps4 = 1
| nationalgoals4 = 0
| nationalyears5 = 2008–2011
| nationalteam5 = [[England national under-21 football team|England U21]]
| nationalcaps5 = 16
| nationalgoals5 = 0
| nationalyears6 = 2012
| nationalteam6 = [[Great Britain men's Olympic football team|Great Britain Olympic]]
| nationalcaps6 = 4
| nationalgoals6 = 0
| nationalyears7 = 2012–2017
| nationalteam7 = [[England national football team|England]]
| nationalcaps7 = 19
| nationalgoals7 = 1
}}`;

/**
 * en.wikipedia.org — Attilio Fresia
 *
 * İki ayrı gerçeği kanıtlıyor:
 *   · `Infobox soccer biography` — farklı şablon adı, aynı alan adları
 *   · alanlar AYNI SATIRA sıkıştırılmış; satır bazlı ayrıştırma burada çöker
 *   · `caps = ?` — "bilinmiyor" demek, sıfır demek değil (§2.7)
 */
export const FRESIA_INFOBOX = `{{Infobox soccer biography
|name           = Attilio Fresia
|image          = 
|caption        = 
|fullname       = Attilio Fresia
|height         = 
|position       = [[Midfielder]]
|birth_date     = {{birth date|1891|3|5|df=yes}}
|birth_place    = [[Turin]], Italy
|death_date     = {{death date and age|1923|4|14|1891|3|5|df=yes}}
|death_place    = [[Modena]], Italy
|clubs1         = [[Piemonte F.C.|Piemonte]] | years1 = 1907–1908 | caps1 = ? | goals1 = ?
|clubs2         = [[Torino F.C.|Torino]] | years2 = 1908–1909 | caps2 = 5 | goals2 = 0
|clubs3         = [[Piemonte F.C.|Piemonte]] | years3 = 1909–1910 | caps3 = ? | goals3 = ?
|clubs4         = [[Torino F.C.|Torino]] | years4 = 1910–1911 | caps4 = 1 | goals4 = 0
|clubs5         = [[Piemonte F.C.|Piemonte]] | years5 = 1911–1912 | caps5 = ? | goals5 = ?
|clubs6         = Andrea Doria | years6 = 1912–1913 | caps6 = ? | goals6 = ?
|clubs7         = [[Genoa C.F.C.|Geona]] | years7 = 1913 | caps7 = 10 | goals7 = 0
|clubs8         = [[Reading F.C.|Reading]] | years8 = 1913–1914 | caps8 = ? | goals8 = ?
|clubs9         = [[Modena F.C.|Modena]] | years9 = 1914–1918 | caps9 = 0 | goals9 = 0
|clubs10        = [[A.S. Livorno Calcio|Livorno]] | years10 = 1919–1920 | caps10 = 8 | goals10 = 1
|clubs11        = [[Modena F.C.|Modena]] | years11 = 1920 | caps11 = ? | goals11 = ?
|nationalteam1  = [[Italy national football team|Italy]] |nationalyears1 = 1913 |nationalcaps1 = 1 |nationalgoals1 = 0
|managerclubs1  = [[A.S. Livorno Calcio|Livorno]] |manageryears1 = 1919–1920
|managerclubs2  = [[Sociedade Esportiva Palmeiras|Palestra Itália]] |manageryears2 = 1920–1921
|managerclubs3  = [[Modena F.C.|Modena]] |manageryears3 = 1922–1923
}}`;
