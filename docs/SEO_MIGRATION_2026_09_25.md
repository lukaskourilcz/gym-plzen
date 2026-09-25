# NAVI — přechod domén a místní SEO, 25. 9. 2026

## Opravené směrování

Ve Vercelu nastaveny domény `namastegym.cz`, `www.namastegym.cz`,
`namastegymplzen.cz` a `www.namastegymplzen.cz` na trvalé přesměrování 308
přímo na `www.navigym.cz`. Nová holá doména už stejně přesměrovávala na www.
HTTP nejprve přechází na HTTPS. Ověřeno 16 HTTP požadavky: kořen a `/vybaveni`
s UTM parametrem, čtyři staré hosty, HTTP i HTTPS; cesta i query zachovány.
Změna je v nastavení projektu Vercel, nikoli v aplikačních routách.
Staré domény a certifikáty zachovat alespoň rok; neodpojovat je při migraci.

## Google Search Console

Nová doménová služba `navigym.cz` je dostupná účtu vlastníka.
Sitemap `https://www.navigym.cz/sitemap.xml` odeslána 25. 9., stav **Success**,
9 objevených URL. Přehled indexace aktualizovaný k 21. 9. ukazuje 7 indexovaných
URL a 17 nezařazených (13 noindex, 3 přesměrování, 1 procházená nezařazená).
Prvních deset noindex příkladů jsou kroky rezervace `/rezervace/udaje?start=…`,
nikoli chybně blokovaná homepage.

Stará doména nemá dostupné DNS přihlášení. URL-prefix vlastnictví se proto
ověřuje HTML značkou `GOOGLE_SITE_VERIFICATION`, nastavenou pro Vercel Production.
Google doporučuje pro weby přesměrované na jinou doménu právě HTML značku;
ověřovací soubor by přes cizí doménu nefungoval. Značku ponechat i po migraci.
Oznámení změny adresy je nutné dokončit až po ověření starých URL služeb.

## Firemní profil a místní SEO

Profil existuje v Google i Mapách. Kategorie Fitness místnost, adresa
Křížkova 424/23, 301 00 Plzeň 1, telefon 731 737 355 a každodenní hodiny
05:00–23:45 odpovídají podkladům. Název NAVI Private Gym se nemění.
Datum otevření upřesněno z října na **1. října 2026** podle `LAUNCH_2026_10.md`;
Google ho již přijal. Firma není předčasně označena jako otevřená.

Webový odkaz přijat jako HTTPS s UTM:
`https://www.navigym.cz/?utm_source=google&utm_medium=organic&utm_campaign=google_business_profile`.
Popis rozšířen o ověřenou lokalitu, soukromé rezervace 75 minut, kapacitu
5 osob včetně dětí, vybavení a postup online rezervace; Google změnu následně přijal.

Web: popisek a titulek homepage upřesňují soukromé fitness v Plzni na Roudné.
HealthClub strukturovaná data doplněna o stabilní identifikátor, telefon,
e-mail, aktuální sociální profily, mapu a ověřené souřadnice vstupu. Kontakty
se berou ze stejného zdroje jako viditelná patička. Žádné smyšlené recenze,
rating, ceny ani fotografie se nepřidávají.

Lepší pořadí na obecné dotazy není okamžitá konfigurace. Po otevření dodat
skutečné fotografie a získávat dobrovolné recenze skutečných návštěvníků,
bez odměn a bez výběru jen spokojených zákazníků. Neposílány žádné žádosti
zákazníkům. Konkrétní pořadí ani termín změny výsledků nelze zaručit.

## Zdroje

- https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- https://support.google.com/webmasters/answer/9008080
- https://support.google.com/webmasters/answer/9370220
- https://support.google.com/business/answer/7091

## Přímé rezervace a recenze

Do GBP přidán a uložen rezervační odkaz
`https://www.navigym.cz/rezervace?utm_source=google&utm_medium=organic&utm_campaign=google_business_profile&utm_content=booking`.
Existující služba „Soukromé fitness“ doplněna o popis 75minutové rezervace
celého prostoru, kapacity, lokality a online nákupu. Po uložení je popis
zobrazený v přehledu služeb.

Odkaz pro dobrovolné hodnocení skutečných návštěvníků:
https://g.page/r/CdV6mZXnfs1QEBM/review
Nikomu nebyl rozeslán. Doporučené reálné fotky: vstup z ulice s označením,
celkový pohled na prostor, silová/kardio zóna, dětský koutek a zázemí.

## Ověření vydání

PR #71, produkční commit `21bd2d2`, 205 unit testů, lint, typecheck, formát,
audit (0 zranitelností), produkční build s lokální testovací DB. V HTML
build artefaktu ověřen titulek, značka Google a JSON-LD včetně shody veřejných
kontaktů. První lokální build selhal na výchozí DB roli `unconfigured`;
po explicitním použití existující izolované testovací DB prošel.

Živá produkce `dpl_9rcK3zAwkzQe2Gu2dH5dAPu3te1a` READY. HTTP kontrola
nové homepage potvrzuje skutečnou Google značku a nové SEO/JSON-LD údaje.
`https://www.namastegym.cz/` ověřeno metodou HTML tag; Change of Address
prošlo validací i s 308 a bylo potvrzeno na `navigym.cz`, stav „This site is
currently moving“, datum zahájení 25 September 2026. Další varianty se doplňují.
Homepage v URL Inspection „URL is on Google“; požadavek na nové procházení
po změně přijat („Indexing requested“). Jediná procházená nezařazená URL
z přehledu je `/obchodni-podminky`, nikoli hlavní stránka.

Varianta `https://namastegym.cz/` je rovněž ověřená HTML značkou. Google
Change of Address ale opakovaně vrací „Couldn’t fetch the page“, i po změně
jejího přesměrování na klasické 301. HTTP kontrola vrací správně 301 a po
následování 200 na nové doméně, včetně cesty a query. Ověření vlastnictví v
migrační validaci prošlo. Nejde o dokončené oznámení této varianty; je nutné
později zopakovat, není důvod měnit funkční DNS nebo vypínat zabezpečení.
Ostatní tři staré hosty zůstávají 308.
