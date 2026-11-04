# Instagram @navi_plzen

Veřejný pás používá oficiální Instagram API. Účet musí být profesionální Business nebo Creator. Aplikace umí tři způsoby připojení; vybírá se proměnnými prostředí:

- **Facebook Login s uživatelským tokenem** (`INSTAGRAM_FACEBOOK_USER_LOGIN=true`): správce se přihlásí svým účtem Facebook s rolí v aplikaci Meta a udělí pouze `instagram_basic`. Aplikace vymění kód za dlouhodobý token (60 dní), ověří v `debug_token`, že granulární rozsah míří na účet `17841427246422536`, a přečte `@navi_plzen` přímo podle ID. Při synchronizaci se token do 14 dní před vypršením znovu vymění; vypršení přístupu k datům (90 dní od posledního přihlášení) hlídá `expires_at` a administrace nabídne nové propojení. Tento režim je nasazený na navigym.cz, protože systémový token Unified Login v portfoliu NAVI nevidí žádný přiřazený účet (prázdné `/me/assigned_instagram_accounts`, přímé čtení vrací chybu 100) i když aplikace i účet patří do téhož portfolia. Dokumentace Meta pro Facebook Login for Business předpokládá, že portfolio aplikace je oddělené od portfolia klienta.
- **Unified Login** (`INSTAGRAM_UNIFIED_CONFIG_ID`): systémový token z konfigurace Facebook Login for Business s oprávněním `instagram_basic`.
- **Instagram Login** (`instagram_business_basic`): pouze pro dříve vytvořené aplikace; Meta ho novým aplikacím nenabízí.

## Příprava před prvním propojením

1. Novou aplikaci Meta připojte k firemnímu portfoliu NAVI Gym. Vytvořte konfiguraci Facebook Login for Business pro účet Instagram se systémovým tokenem a čtením `instagram_basic`. Zkontrolujte skutečný rozsah před udělením přístupu. Šablona Meta může zahrnovat zprávy, publikování a reklamu. Aplikace přijme pouze `instagram_basic` a případné výchozí `public_profile`. Připojení s širšími oprávněními odmítne. Pro živý provoz dokončete případné požadavky Meta. [Oficiální postup](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started)
2. Přesná povolená OAuth redirect URI: `https://www.navigym.cz/api/admin/instagram/callback` (musí odpovídat kanonickému `NEXT_PUBLIC_APP_URL`). Nastavit privacy-policy URL webu. Deauthorization i data-deletion callback: `https://www.navigym.cz/api/instagram/deauthorize`.
3. Správce nasazení přidá server-only `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (nových 32 náhodných bajtů jako 64 hex znaků). Pro Facebook Login s uživatelským tokenem nastaví `INSTAGRAM_FACEBOOK_USER_LOGIN=true` (má přednost). Pro Unified Login použije ID a tajný klíč aplikace Meta a přidá `INSTAGRAM_UNIFIED_CONFIG_ID` z konfigurace. Bez obou zůstává aktivní starší Instagram Login s údaji Instagram App. Klíč šifrování Instagramu se nesdílí s klíčem vstupních kódů. `INSTAGRAM_TEST_BASE_URL` patří výhradně do místních testů.
4. Aplikovat pouze migraci `drizzle/20261022190000_instagram_feed.sql`. Vytváří dvě prázdné soukromé tabulky. Nevkládá příspěvky, propojení, nastavení ani testovací obsah. Nemění zákaznické tabulky.
5. V **Obsah webu → Instagram** kliknout **Připojit Instagram** a schválit čtení účtu @navi_plzen. První synchronizace proběhne po návratu. Jiný účet se odmítne. Otestovat připojení nejdříve v odděleném prostředí s vlastními přístupovými údaji.
6. Vercel samostatný cron `/api/cron/sync-instagram` každých 30 minut používá stávající `CRON_SECRET`. Když není propojení připravené, nezavolá Meta. Nenapojuje se na pipeline rezervací, kódů ani zpráv.

Dokud nejsou údaje připravené a účet propojený, zobrazuje web pouze upravitelný odkaz na profil. Celý pás lze vypnout. Přímé propojení skutečného účtu a udělení Live oprávnění je externí krok; lokální testy jej nenahrazují.

Unified Login i Facebook Login používají `graph.facebook.com` a při připojení kontrolují aplikaci, rozsah tokenu a sdílený účet. Systémový token se ukládá zašifrovaný jako verze `v2`, uživatelský token jako verze `v3` navázaná na ID aplikace; každá verze má vlastní odvozený klíč. Při vypršení nebo odebrání přístupu vyžaduje nové propojení. Úprava využívá existující databázové tabulky.

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
- Obnovu tokenu systém provádí nejdříve po 24 hodinách a před vypršením (Instagram Login přes `refresh_access_token`, Facebook Login přes `fb_exchange_token` s novým ověřením účtu). Systémový token Unified Login se neobnovuje. Po skutečném odvolání oprávnění je nutné propojení obnovit v administraci.

## Ověření

Lokální integrační a browser testy používají loopback Postgres s názvem `_test` a výhradně náhrady Instagramu, e-mailu, plateb a přihlášení. Síťová pojistka odmítá externí poskytovatele. Scénáře ověřují šifrování, OAuth, chyby poskytovatele, obnovení tokenu, náhledy, mobil, přístupnost, viditelnost a odpojení. Porovnávají zákaznické tabulky před a po změnách. Žádné fixture se nedostává do migrace ani produkčního kódu.

Oficiální rozhraní: https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login
