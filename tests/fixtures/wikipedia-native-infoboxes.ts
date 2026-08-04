/**
 * Ana dil bilgi kutuları — birim testi fikstürleri (§4.3 Aşama 2, §8.1).
 *
 * METİNLER OLDUĞU GİBİ alındı. Örnekler rastgele değil: her biri kendi
 * dilinin ZOR durumunu taşısın diye seçildi (kiralık işareti, dolu altyapı
 * alanı, bağlantılı yıllar).
 *
 * Kaynak: MediaWiki `action=query&prop=revisions` — 4 Ağustos 2026.
 * Lisans: CC BY-SA (§4.3).
 */

/**
 * it.wikipedia.org — Lorenzo Marronaro
 *
 * İtalyanca `{{Sportivo}}` → `Squadre` alanı → `{{Carriera sportivo}}`.
 * Üç zorluğu birden taşıyor:
 *   · kariyer satırı KONUMSAL üçlü (`|yıl|kulüp|maç (gol)`), alan adı yok
 *   · kulüp adı düz METİN, bağlantı değil
 *   · kiralık `→` ile işaretli (ölçüldü: 24 kez `→`, 9 kez `prestito`)
 */
export const IT_INFOBOX = `{{Sportivo
|Nome = Lorenzo Marronaro
|Immagine = Lorenzo Marronaro.jpg
|Didascalia = Marronaro alla Lazio
|Sesso = M
|CodiceNazione = {{ITA}}
|Disciplina = Calcio
|Squadra = 
|Ruolo = [[Procuratore sportivo]] <small>(ex [[attaccante]])</small>
|TermineCarriera = 1994
|SquadreGiovanili =
{{Carriera sportivo
|sport = calcio |pos = G
 |19??-19?? |Lazio |
}}
|Squadre =
{{Carriera sportivo
|sport = calcio |pos = G
 |1980-1981 |Lazio |12 (0)
 |1981-1982 |→ Forlì |25 (7)
 |1982-1984 |Monza |66 (18)
 |1984-1990 |Bologna |191 (46)
 |1990-1993 |Udinese |71 (9)
 |1993-1994 |Empoli |8 (1)
}}
|Aggiornato = 
}}`;

/**
 * de.wikipedia.org — Willi Minich
 *
 * Almanca `{{Infobox Fußballspieler}}` → `vereine_tabelle` alanı →
 * tekrarlı `{{Team-Station}}`.
 *
 * BR-2'NİN ASIL SINAVI: bu kutuda `jugendvereine_tabelle` (altyapı) da dolu.
 * Kutunun tamamında `{{Team-Station}}` aramak altyapı dönemlerini kariyer
 * sanardı; ölçüldü, 89 makalenin 51'inde bu alan var.
 */
export const DE_INFOBOX = `{{Infobox Fußballspieler
| kurzname =Willi Minich
| bildname = 
| bildunterschrift = 
| langname =Wilhelm Minich
| geburtstag =[[27. Februar]] [[1934]] 
| geburtsort =[[Oberhausen]]
| geburtsland =[[Deutsches Reich]]
| sterbedatum =[[25. April]] [[2023]]
| sterbeort =
| sterbeland =
| größe =
| position =Abwehr
| jugendvereine_tabelle =
{{Team-Station|1943–1952|[[BV Osterfeld]]}}
| vereine_tabelle =
{{Team-Station|1952–1954|[[BV Osterfeld]]|}}
{{Team-Station|1954–1957|[[1. FC Köln]]|44 (1)}}
{{Team-Station|1957–1959|[[Borussia Mönchengladbach]]|}}
{{Team-Station|1959–1961|[[Rot-Weiß Oberhausen]]|}}
{{Team-Station|1961–1978|RSV Glückauf Klosterhardt|}}
| nationalmannschaft_tabelle =
| trainer_tabelle =
{{Team-Station||SuS Klosterhardt}}
{{Team-Station||[[SV Adler Osterfeld]]}}
{{Team-Station||SC 1920 Oberhausen}}
{{Team-Station||[[BV Osterfeld]] (Jugend)}}
| lgupdate =
| nmupdate =
}}`;

/**
 * fr.wikipedia.org — Philippe Avenet
 *
 * Fransızca `{{Infobox Footballeur}}` → `parcours senior`/`parcours pro`
 * → `{{trois colonnes}}`.
 *
 * Yıllar bağlantı olarak yazılıyor (`[[1984 en football|1984]]`), hizalama
 * `{{0}}` şablonlarıyla yapılıyor ve toplam satırı `'''Total'''` diye
 * işaretleniyor — üçü de ayrıştırıcının atlaması gereken gürültü.
 */
export const FR_INFOBOX = `{{Infobox Footballeur
 | nom                 = Philippe Avenet
 | image               = 
 | taille image        = 
 | légende             = 
 | club actuel         = 
 | numéro en club      = 
 | nom de naissance    = 
 | période pro         = [[1984 en football|1984]]-[[1999 en football|1999]]
 | date de naissance   = {{date|16|avril|1967|en football|âge=oui}}
 | lieu de naissance   = [[Vitry-sur-Seine]] ([[France]])
 | nationalité         = {{FRA-d}} [[France|Française]]
 | date de décès       = 
 | lieu de décès       = 
 | taille              = {{Taille|m=1.80}}
 | position            = Milieu
 | pied                = 
 | parcours junior     = 
 | parcours amateur    = 
 | parcours pro        = {{trois colonnes
    |[[1984 en football|1984]]-[[1990 en football|1990]]|{{FRA-d}} [[Racing Club de France football Colombes 92|Racing Paris]]|{{0}}72 {{0}}(9)
    |[[1988 en football|1988]]-[[1989 en football|1989]]|{{prêt}} {{FRA-d}} [[Racing Club de Lens|RC Lens]]|{{0}}17 {{0}}(1)
    |[[1990 en football|1990]]-[[1993 en football|1993]]|{{FRA-d}} [[SM Caen]]|{{0}}60 {{0}}(1)
    |[[1993 en football|1993]]-[[1995 en football|1995]]|{{FRA-d}} [[La Berrichonne de Châteauroux|LB Châteauroux]]|{{0}}51 {{0}}(1)
    |[[1995 en football|1995]]-[[1997 en football|1997]]|{{FRA-d}} [[Association Sportive Nancy-Lorraine|AS Nancy-Lorraine]]|{{0}}77 {{0}}(1)
    |[[1997 en football|1997]]-[[1998 en football|1998]]|{{FRA-d}} [[La Berrichonne de Châteauroux|LB Châteauroux]]|{{0}}{{0}}4 {{0}}(0)
    |[[1998 en football|1998]]-[[1999 en football|1999]]|{{FRA-d}} [[Union sportive Boulogne Côte d'Opale|US Boulogne]]|{{0}}{{0}}- {{0}}(-)
    |'''[[1984 en football|1984]]-[[1999 en football|1999]]'''|'''Total''' |'''279 (13)'''
    }}
 | sélection nationale = {{trois colonnes
                         |[[1988 en football|1988]]|{{FRA-d}} [[Équipe de France militaire de football masculin|France militaire]] |
                      | [[1987 en football|1987]]-[[1988 en football|1988]] | {{FRA-d}} [[Équipe de France espoirs de football|France Espoirs]] | {{0}}- {{0}}(-)
                                    }}
 | carrière entraîneur = 
 | date de mise à jour = 17 février 2013
}}`;

/**
 * fr.wikipedia.org — Marcel Parmeggiani
 *
 * İKİNCİ FRANSIZCA BİÇİM. `FR_INFOBOX` en yaygın hâli gösteriyor; bu makale
 * ayrıştırıcının iki kez ölçülerek düzeltilen noktalarını taşıyor:
 *
 *   · KAP ADI ALAN ADIYLA AYNI DEĞİL: alan `parcours senior`, kap
 *     `{{parcours pro}}`. Yalnızca `{{trois colonnes}}` aramak 29 makalenin
 *     9'unu sessizce okunamaz bırakıyordu.
 *   · KULÜP BAĞLANTISI SARMALANMIŞ: `{{nobr|{{FRA-d}} [[FC Sochaux]]}}`.
 *     Şablonlar atılırken sargı açılmazsa bağlantı da gidiyor ve satır
 *     kulüpsüz kalıyor (korpusta 22 kez).
 *
 * Ayrıca `{{parcours junior}}` ve `{{parcours national}}` kapları da dolu —
 * BR-2 ikinci kez sınanıyor.
 */
export const FR_WRAPPED_INFOBOX = `{{Infobox Footballeur
| nom                 = Marcel Parmeggiani
| image               = 
| taille image        = 
| légende             = 
| nom de naissance    = 
| date de naissance   = {{date de naissance|25|02|1915|en football}}
| lieu de naissance   = [[Seloncourt]] ([[France]])
| nationalité         = {{FRA-d}} [[France|Français]]
| date de décès       = {{date de décès|19|07|1991|25|02|1915|en football}}
| lieu de décès       = [[Besançon]] ([[France]])
| position            = [[Attaquant (football)|Attaquant]]
| parcours junior     = {{parcours junior
	| |
	}}
| parcours senior     = {{parcours pro
        |[[1937 en football|1937]]-[[1938 en football|1938]]|{{FRA-d}} [[Football Club de Mulhouse|FC Mulhouse]] | 
	|[[1942 en football|1942]]-[[1943 en football|1943]]|{{nobr|{{FRA-d}} [[Football Club Sochaux-Montbéliard|FC Sochaux-Montbéliard]]}}|
	|[[1943 en football|1943]]-[[1944 en football|1944]]|{{FRA-d}} [[Équipe fédérale Nancy-Lorraine|ÉF Nancy-Lorraine]]|
	|[[1944 en football|1944]]-[[1947 en football|1947]]|{{FRA-d}} [[Football Club Sochaux-Montbéliard|FC Sochaux-Montbéliard]]|
	|[[1948 en football|1948]]|{{FRA-d}} [[Union sportive du Mans|US Le Mans]]|
	|[[1948 en football|1948]]-[[1949 en football|1949]]|{{FRA-d}} [[Le Havre Athletic Club (football)|Le Havre AC]]| {{0}}11 {{0}}(3)
	}}
| sélection nationale = {{parcours national
	| | | 
	}}
| date de mise à jour = 
}}
`;
