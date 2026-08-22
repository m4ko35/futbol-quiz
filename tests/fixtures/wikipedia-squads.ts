/**
 * Gerçek Vikipedi kadro şablonları — birim testi fikstürleri (§8.1, §4.3
 * Aşama 3).
 *
 * METİNLER OLDUĞU GİBİ alındı, yalnızca her blok ilk altı oyuncuya kırpıldı.
 * Sadeleştirilmiş bir fikstür ayrıştırıcının kendi varsayımlarını doğrular;
 * gerçek wikitext editörlerin gerçekte yazdığı dağınıklığı taşır.
 *
 * Kaynak: MediaWiki `action=query&prop=revisions` — 23 Ağustos 2026.
 * Lisans: CC BY-SA (§4.3).
 */

/**
 * en.wikipedia.org — Manchester United F.C.
 *
 * Üç blok, üçü de ayrı bir şeyi sınıyor:
 *   · birinci takım — `===First-team squad===`
 *   · kiralıktakiler — şablon adı BÜYÜK HARFLE (`{{Fs player}}`), `no=` boş ve
 *     `other=` alanı İKİNCİ bir bağlantı taşıyor (`at [[Trabzonspor]] until…`)
 *   · altyapı — dışlanması gereken `Under-21s and Academy` başlığı
 */
export const MANCHESTER_UNITED_SQUAD = `===First-team squad===
{{fs start}}
{{fs player|no=1|nat=BEL|pos=GK|name=[[Senne Lammens]]}}
{{fs player|no=2|nat=POR|pos=DF|name=[[Diogo Dalot]]}}
{{fs player|no=3|nat=MAR|pos=DF|name=[[Noussair Mazraoui]]}}
{{fs player|no=4|nat=NED|pos=DF|name=[[Matthijs de Ligt]]}}
{{fs player|no=5|nat=ENG|pos=DF|name=[[Harry Maguire]]}}
{{fs player|no=6|nat=ARG|pos=DF|name=[[Lisandro Martínez]]}}
{{fs end}}


===Out on loan===

{{fs start}}
{{Fs player|no=24|nat=CMR|pos=GK|name=[[André Onana]]|other=at [[Trabzonspor]] until 30 June 2027}}
{{fs player|no=|nat=TUR|pos=GK|name=[[Altay Bayındır]]|other=at [[Celta Vigo]] until 30 June 2027}}
{{fs end}}


===Under-21s and Academy===
{{fs start}}
{{fs player|no=32|nat=DEN|pos=FW|name=[[Chido Obi]]}}
{{fs player|no=36|nat=ENG|pos=FW|name=[[Ethan Wheatley]]}}
{{fs player|no=44|nat=ENG|pos=MF|name=[[Dan Gore]]}}
{{fs player|no=70|nat=ENG|pos=FW|name=[[Bendito Mantato]]}}
{{fs end}}`;

/**
 * en.wikipedia.org — Deportivo de A Coruña
 *
 * BORU İŞARETLİ BAĞLANTI: `[[Diego Gómez (footballer, born 2004)|Diego Gómez]]`.
 * Ölçüm betiği tam burada kırıldı ve 1.503 oyuncuyu "makalesi yok" saydı (§4.3
 * Aşama 3). Fikstürün var oluş sebebi bu tek satır.
 */
export const DEPORTIVO_SQUAD = `===First-team squad===
{{fs start}}
{{Fs player|no=1|nat=ESP|pos=GK|name=[[Germán Parreño]]}}
{{Fs player|no=2|nat=ESP|pos=DF|name=[[Adrià Altimira]]}}
{{Fs player|no=3|nat=ESP|pos=DF|name=[[Arnau Comas]]}}
{{Fs player|no=4|nat=BEL|pos=DF|name=[[Lucas Noubi]]}}
{{Fs player|no=5|nat=ESP|pos=DF|name=[[Dani Barcia]]}}
{{Fs player|no=6|nat=ENG|pos=MF|name=[[Charlie Patino]]}}
{{fs end}}


===Reserve team===
{{fs start}}
{{Fs player|no=33|nat=ESP|pos=FW|name=[[Kevin Sánchez]]}}
{{fs end}}


===Out on loan===

{{fs start}}
{{Fs player|no=|nat=ESP|pos=MF|name=[[Diego Gómez (footballer, born 2004)|Diego Gómez]]|other=at [[SD Huesca|Huesca]] until 30 June 2027}}
{{fs end}}`;

/**
 * en.wikipedia.org — Galatasaray S.K. (football)
 *
 * İki şey için: `other=` alanı BOŞ bırakılmış (ayraç var, değer yok) ve altyapı
 * bloğundaki oyuncuların hiçbirinde bağlantı YOK — düz metin ad. Bağlantısız
 * satır keşifte kullanılamaz ve bu bir kayıp değil, tanım gereğidir.
 */
export const GALATASARAY_SQUAD = `===Current squad===
{{fs start}}
{{Fs player|no=1|nat=TUR|pos=GK|name=[[Uğurcan Çakır]]|other=}}
{{Fs player|no=3|nat=TUR|pos=DF|name=[[Metehan Baltacı]]|other=}}
{{Fs player|no=4|nat=SEN|pos=DF|name=[[Ismail Jakobs]]|other=}}
{{Fs player|no=5|nat=TUR|pos=MF|name=[[Eyüp Aydın]]|other=}}
{{Fs player|no=6|nat=COL|pos=DF|name=[[Davinson Sánchez]]|other=}}
{{Fs player|no=7|nat=HUN|pos=DF|name=[[Roland Sallai]]}}
{{fs end}}


===Academy players with first team shirt numbers===

{{fs start}}
{{Fs player|no=51|nat=TUR|pos=FW|name=Arda Tagay|other=}}
{{Fs player|no=52|nat=TUR|pos=GK|name=Cem Eroğlu|other=}}
{{Fs player|no=56|nat=TUR|pos=DF|name=Yusuf Sivaslıoğlu|other=}}
{{Fs player|no=57|nat=TUR|pos=MF|name=Oğulcan Yançel|other=}}
{{Fs player|no=63|nat=TUR|pos=MF|name=Mustafa Duru|other=}}
{{Fs player|no=64|nat=TUR|pos=DF|name=Dağhan Kahraman|other=}}
{{fs end}}


===Other players under contract===

{{fs start}}
{{Fs player|no=47|nat=TUR|pos=MF|name=Siraçhan Nas|other=}}
{{Fs player|no=|nat=TUR|pos=DF|name=Kadir Subaşı|other=}}
{{fs end}}


===Out on loan===

{{fs start}}
{{Fs player|no=|nat=TUR|pos=DF|name=Ali Yeşilyurt|other=<small>at {{flagicon|TUR}} [[Elazığspor]] until 30 June 2027</small>}}
{{Fs player|no=|nat=COL|pos=DF|name=[[Carlos Cuesta (footballer)|Carlos Cuesta]]|other=<small>at {{flagicon|BRA}} [[CR Vasco da Gama|Vasco]] until 31 December 2026</small>}}
{{Fs player|no=|nat=POL|pos=DF|name=[[Przemysław Frankowski]]|other=<small>at {{flagicon|FRA}} [[FC Rennes|Rennes]] until 30 June 2027</small>}}
{{Fs player|no=|nat=TUR|pos=MF|name=Berat Yılmaz|other=<small>at {{flagicon|TUR}} [[Ümraniyespor]] until 30 June 2027</small>}}
{{Fs player|no=|nat=TUR|pos=MF|name=[[Ege Araç]]|other=<small>at {{flagicon|TUR}} [[:tr: Adana 01 FK|Adana 01]] until 30 June 2027</small>}}
{{Fs player|no=|nat=TUR|pos=MF|name=Efe Çördek|other=<small>at {{flagicon|TUR}} [[:tr: 12 Bingölspor|12 Bingölspor]] until 30 June 2027</small>}}
{{fs end}}`;
