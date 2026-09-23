# NAVI — stav bodů z WhatsAppu, 23. 9. 2026

## Opravy v této změně

- Běžné i hromadné storno ukládá zákaznický e-mail ve stejné databázové transakci jako zrušení rezervace. Watchdog znovu zkouší čekající/neúspěšné zprávy po 5 minutách. Stabilní klíč Resend chrání opakování v jeho idempotentním okně; doručení do schránky nelze zaměňovat za přijetí poskytovatelem.
- Běžné storno také uvolní čerpání voucheru a upozorní na zaplacenou rezervaci vyžadující kontrolu refundace. Žádné peníze se automaticky nevracejí.
- GA4 `purchase` má transaction_id rezervace, skutečnou cenu v korunách, měnu a položku. Spouští se jen na potvrzené placené rezervaci a po analytickém souhlasu, včetně souhlasu uděleného až na potvrzovací stránce. Bezplatný vstup není nákup. Meta Purchase/Schedule zůstává zachováno.
- Nuki dostupnost se kontroluje každých 5 minut v existujícím watchdogu; po 15 minutách bez ověřeného spojení vzniká upozornění. Online návrat upozornění uzavře. Stav Cloud API není fyzický test dveří.
- Google dostává `data-nosnippet` u termínů a patičky. Výsledek vyhledávání se může změnit až po opětovném procházení; text vybírá Google.
- Zernio ukládá ID konverzace a porovnává přijatou zprávu se skutečným stavem doručení přes read-only API (bez nového veřejného webhooku). Opakování běží nezávisle na úspěchu e-mailu, maximálně třikrát a pouze u jednoznačně odmítnuté zprávy. Nejasné odeslání se neopakuje. Chyba platební způsobilosti 131042 vyžaduje obsluhu. Do databáze ani chyb se neukládá tělo WhatsApp zprávy/PIN. Stále platí testovací allowlist e-mail + telefon.

## Ověřené externí překážky

- WhatsApp test v Zernio: **Failed — Business eligibility payment issue**. Připojený účet a schválené české šablony samy nestačí. Meta má uloženou kartu, takže tvrzení „chybí karta“ by nebylo podložené. Nutné vyřešit billing eligibility v Meta/Zernio, poté doložit delivered/read na vlastním testu. Rozšíření na zákazníky až poté a s jejich volbou kanálu.
- GA4 web správně používá `G-8FN17RXP1T` dle zadání. Přihlášený kouril.lukas@gmail.com má pouze `www.navigym.cz`, property 552900796 / `G-KQ07Q68YB7`. Tyto dvě služby nezaměňovat. Je nutný přístup do původní služby Navi Private Gym pro Realtime/nákupy/atribuci.
- Google Business: Navi Private Gym, Křížkova 424/23, je Verified a přihlášený Lukáš profil spravuje. E-mail Google Business Profile z 22. 9. 2026 10:43 potvrzuje účet „NAVI Private Gym“ jako vlastníka; samostatný e-mail v 10:29 potvrzuje Lukáše jako správce. Adresa účtu skrytá za názvem NAVI nebyla v potvrzení uvedena. Oprávnění nebyla měněna.
- Finální reklama: není potvrzená konkrétní dokončená verze ani příjemce/plátce. Nic nebylo publikováno ani navýšeno čerpání.
- UTM: připravený formát pro pole URL parameters finální reklamy: `utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}`. Není potvrzené uložení do konkrétní reklamy ani následná GA4 atribuce.
- Refundace Kláře musí být doložená v Comgate; stav cancelled v rezervaci ji neprokazuje.

## Již nasazená obnova PINů

Příprava 24 hodin před termínem, odeslání 1 hodinu před ním, trvalý šifrovaný úkol a ověřování Nuki už jsou nasazené (PR #66). Produkce při kontrole obsahovala 9 budoucích potvrzených rezervací a **0 blokací čekajících na odebrání**. Tři dříve hlášená odebrání byla úspěšně dokončena. Zůstává historické upozornění na selhání vytvoření kódu u již minulého testu 22. 9.; nebylo vydáváno za úspěšné ani ručně zameteno.

## Ověření

Automatické testy používají oddělenou místní databázi a makety poskytovatelů. Neprovádějí skutečné platby ani zásahy do zámku. Živý test fyzického otevření po odpojení/připojení Wi-Fi zůstává na místě ve fitku.

## Živé ověření po nasazení

PR #67 je sloučený. Produkční nasazení `dpl_6w2oPdHfrkR3qMrGeGwUbvHJpBRN`, commit `3e992d5`, je READY a připojené na www.navigym.cz. HTML má nové vyloučení snippetů. Testy: 200 jednotkových a 42 integračních, následně 5 cílených; lint, typecheck, format, build a audit bez zranitelností prošly.

Vlastní ruční testovací rezervace `610e2130-f8e1-440a-b139-3fe7ffc03d27`, 3. 10. 2026 05:00–06:15, kontakt kouril.lukas@gmail.com, byla vytvořena bez platby a zrušena. Záznam reservation_cancellation je jednou, stav sent, odesláno 23. 9. 12:06:10 UTC. Gmail v Inboxu potvrzuje skutečný příjem zprávy „Zrušení rezervace | NAVI Private Gym“ ve 14:06. Testovací termín už není blokovaný.

Watchdog v produkci zaznamenal Nuki online 23. 9. 2026 12:06:11 UTC. Počet access_revocation_pending je 0. Dnešních pět potvrzených budoucích rezervací čeká správně na přípravu 24 hodin před termínem (nejbližší návštěva 1. 10.); nebyly nuceně generovány předčasně.
