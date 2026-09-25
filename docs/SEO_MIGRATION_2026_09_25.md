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
5 osob včetně dětí, vybavení a postup online rezervace; po uložení čekal na kontrolu Googlu.

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
