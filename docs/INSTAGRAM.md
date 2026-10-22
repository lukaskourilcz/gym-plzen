# Instagram @navi_plzen

Veřejný pás používá oficiální Instagram API s Instagram Login, pouze oprávnění `instagram_business_basic`. Účet musí být profesionální Business nebo Creator. Facebook Page není nutná. Heslo se zadává pouze na Instagramu, nikdy v administraci webu.

## Příprava před prvním propojením

1. V Meta for Developers vytvořit aplikaci s Instagram Login. Přidat profesionální účet @navi_plzen jako testera pro vývoj; pro běžný provoz dokončit požadované ověření/oprávnění a přepnout aplikaci do Live podle podmínek Meta.
2. Přesná povolená OAuth redirect URI: `https://www.navigym.cz/api/admin/instagram/callback` (musí odpovídat kanonickému `NEXT_PUBLIC_APP_URL`). Nastavit privacy-policy URL webu. Deauthorization i data-deletion callback: `https://www.navigym.cz/api/instagram/deauthorize`.
3. Správce nasazení přidá server-only `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (nových 32 náhodných bajtů jako 64 hex znaků). Klíč je vlastní, nesdílí se s klíčem vstupních kódů. Do `NEXT_PUBLIC_*` nepatří žádné tajné hodnoty. Nikdy nenastavovat `INSTAGRAM_TEST_BASE_URL` v nasazení.
4. Aplikovat pouze migraci `drizzle/20261022190000_instagram_feed.sql`. Vytváří dvě prázdné soukromé tabulky. Nevkládá příspěvky, propojení, nastavení ani testovací obsah. Nemění zákaznické tabulky.
5. V **Obsah webu → Instagram** kliknout **Připojit Instagram** a schválit čtení účtu @navi_plzen. První synchronizace proběhne po návratu. Jiný účet se odmítne. Otestovat připojení nejdříve v odděleném prostředí s vlastními přístupovými údaji.
6. Vercel samostatný cron `/api/cron/sync-instagram` každých 30 minut používá stávající `CRON_SECRET`. Když není propojení připravené, nezavolá Meta. Nenapojuje se na pipeline rezervací, kódů ani zpráv.

Dokud nejsou údaje připravené a účet propojený, zobrazuje web pouze upravitelný odkaz na profil. Celý pás lze vypnout. Přímé propojení skutečného účtu a udělení Live oprávnění je externí krok; lokální testy jej nenahrazují.

## Správa klientem

Tužkami se upravuje nadpis, tlačítko profilu, text bez dostupných příspěvků a mobilní „Zobrazit další“. Správce může pás vypnout, obnovit příspěvky, skrýt jednotlivý příspěvek nebo odpojit účet. Skrytí přežije další synchronizaci. Titulky a fotografie příspěvků pocházejí z Instagramu; mění se tam.

Nejvýše 12 nejnovějších viditelných příspěvků z posledních 30 načtených příspěvků. Počítač: 6 × 2; mobil: první 4 a rozbalení. Reels ukazují pouze statický náhled s ikonou. Pořadí konce homepage: výzva k rezervaci → Instagram → citát a newsletter → mapa → patička. Odkaz `#kontakt` zůstává funkční.

## Soukromí a selhání

- Token je autentizovaně šifrovaný AES-256-GCM a navázaný na účet. Tabulky mají RLS a odebrané přístupy pro anon/authenticated. Veřejné DTO nemá token ani zdrojové CDN URL.
- Prohlížeč načítá jen náhledy z vlastního webu, žádný Meta iframe, skript ani automatické video. Až kliknutí otevře Instagram. Náhledy jsou líně načítané WebP 480 × 480.
- Proxy přijímá pouze číselné ID dostupného a neskrytého příspěvku, kontroluje platné propojení, allowlist HTTPS Meta CDN, MIME, limit 6 MB a 20 milionů pixelů; zakazuje přesměrování a SVG.
- Výpadek poskytovatele zachová poslední úspěšná data nejvýše 24 hodin. Vypršení nebo odebrání přístupu skryje příspěvky a nabídne odkaz na profil. Chyba této volitelné sekce nezablokuje homepage ani rezervaci.
- Synchronizace má atomický pronájem. Pozdní odpověď po odpojení nebo novém propojení nemůže znovu vložit odstraněné příspěvky. Podepsané Meta callbacky nemohou odstranit novější propojení starou událostí.
- Odpojení smaže pouze propojení a vlastní kopie příspěvků z databáze. Zneplatní serverovou cache. Již načtený obrázek může zůstat v soukromé cache návštěvníkova prohlížeče nejvýše 5 minut.
- Obnovu tokenu systém provádí nejdříve po 24 hodinách a před vypršením. Po skutečném odvolání oprávnění je nutné propojení obnovit v administraci.

## Ověření

Lokální integrační a browser testy používají loopback Postgres s názvem `_test` a výhradně náhrady Instagramu, e-mailu, plateb a přihlášení. Síťová pojistka odmítá externí poskytovatele. Scénáře ověřují šifrování, OAuth, chyby poskytovatele, obnovení tokenu, náhledy, mobil, přístupnost, viditelnost a odpojení. Porovnávají zákaznické tabulky před a po změnách. Žádné fixture se nedostává do migrace ani produkčního kódu.

Oficiální rozhraní: https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login
