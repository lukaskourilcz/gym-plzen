# NAVI — ověřený stav 24. 9. 2026

| Bod                        | Ověřený stav                                                                                                                                                                     | Řešení / další krok                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WhatsApp / Meta fakturace  | Uživatel sám uložil a verifikoval údaje. Výchozí karta je připojená. Číslo Connected, kvalita High, firma Verified, limit 250/24 h; Zernio tento limit označuje Sending limited. | Test ve 22:06 přijat s HTTP 200 a ID zprávy, ale pouze Sent. Uživatel zprávu neobdržel. Zatím nelze potvrdit opravu.                                   |
| Nová rezervace s voucherem | 1. 10. 2026 10:00–11:15, účet vlastníka, 0 Kč, potvrzená.                                                                                                                        | Kód plánovaný 30. 9. 10:00, doručení 1. 10. 09:00. Dnešní ruční Zernio test použil existující vlastní test 2. 10. 05:00, ne kód nové rezervace.        |
| Kalendář                   | Počáteční čtyři dny a horizont 180 dní zachovány. Nově po prvním posunu průběžně přednačítá další čtyři dny.                                                                     | Uchovává nejvýše 11 dní: první čtyři, dva před a čtyři za vybraným dnem. Na pomalé síti může zákazník stále dohnat probíhající načítání.               |
| Google Business            | Veřejně vidět NAVI Private Gym i uložený popis firmy.                                                                                                                            | Uzavřeno; výsledkový úryvek webu je odlišná plocha, jeho přegenerování řídí Google.                                                                    |
| GA4                        | Přístupná pouze www.navigym.cz / G-KQ07Q68YB7, bez dat. Web používá G-8FN17RXP1T.                                                                                                | Zpřístupnit správnou službu, následně v Realtime/DebugView ověřit page_view a placený purchase se souhlasem. Nepřepisovat ID bez rozhodnutí o migraci. |
| UTM v reklamách            | Portfolio NAVI ve Správci reklam nenabízí reklamní účet. Přístupný osobní účet obsahuje reklamy Rapového deníku.                                                                 | Zpřístupnit správný účet a aplikovat níže uvedené parametry na konkrétní reklamy. Cizí kampaně nebyly změněny.                                         |
| Desátý vstup zdarma        | Prošel integrační test reálné lokální DB, také voucher 100 % a potvrzení rezervace; celkem 44 testů bez chyby.                                                                   | Živé uživatelské rozhraní nové rezervace ukázalo šestou návštěvu, čtyři do odměny. Nevytvářeny další umělé produkční nákupy.                           |
| Fyzický zámek a keypad     | Kontrola cloudu nenahrazuje fyzické otevření.                                                                                                                                    | Domluvit obsluhu u zámku, vyzkoušet platný PIN, neplatnost před/po okně, výpadek Wi-Fi a revokaci po stornu.                                           |
| Staré testovací rezervace  | Zůstávají vlastní aktivní testy 1. 10. 05:00, 07:30, 08:45 a 2. 10. 05:00, nově 1. 10. 10:00.                                                                                    | Vybrat jeden pro fyzický test, ostatní stornovat, nemažou se účetní záznamy. Refundace placených testů je samostatný krok.                             |

## Připravené UTM

Pro Meta reklamy použít URL parameters:

```text
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}
```

Pro odkaz na web z Google Business:

```text
https://www.navigym.cz/?utm_source=google&utm_medium=organic&utm_campaign=business_profile
```

Pro bio Instagramu:

```text
https://www.navigym.cz/?utm_source=instagram&utm_medium=organic_social&utm_campaign=profile
```

## Podklady pro podporu Zernio (neodesláno)

Dne 24. 9. 2026 ve 20:06:16 UTC byla do testovací konverzace odeslána schválená utility šablona `navi_rezervace_vstup_cs`. API vrátilo 200 a message ID. Po aktualizaci schránky je stav pouze Sent; příjemce potvrdil, že zprávu neobdržel. Předchozí pokus skončil Business eligibility payment issue. Mezitím vlastník opravil a ověřil fakturační údaje v Meta. WhatsApp číslo je Connected, kvalita High, business verification Verified. Prosíme o kontrolu konečného Meta delivery status/error a doručovacích webhooků pro tento pokus. Přesné message ID lze vzít z Logs podle uvedeného času. PIN ani obsah vstupní zprávy neposílat do podpory.

## Ověření kalendáře

205 unit, 44 integračních testů, lint, typy, produkční build a audit bez chyby (0 zranitelností). Chrome: přechody 2.–7. října s připravenou dostupností, klávesnice/focus; šířky 320, 390, 667, 768, 1024, 1280, 1440 a 1728 bez horizontálního přetečení a s 44px šipkami. Vizuálně zkontrolován mobilní kalendář. Plné potvrzení 200% zoomu a reduced motion zatím chybí. Změna nevytváří nový vizuální vzor.
