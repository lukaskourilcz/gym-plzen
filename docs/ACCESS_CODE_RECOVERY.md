# Trvalé úlohy vstupních kódů

Příprava začíná 24 skutečných hodin před rezervací. E-mail odchází nejdříve hodinu předem; pozdní rezervace se zpracuje ihned. Platba se potvrzuje nezávisle. PIN platí od začátku rezervace do konce plus nastavená doba na sprchu.

## Stav a odolnost

`access_code` je trvalý úkol: ID rezervace, neměnné ID zařízení, platnost, hash, AES-256-GCM ciphertext a stav `prepared` / `submitted` / `ready`. Náhodný nonce a AAD svazují ciphertext s ID úlohy, rezervace a zařízení. Klíč `ACCESS_CODE_ENCRYPTION_KEY` je 32 náhodných bytů jako 64 hex znaků, pouze serverová proměnná mimo databázi. Nezaměňovat ani nerotovat bez přešifrování existujících úloh. PIN ani odpovědi Nuki se nelogují.

Před vytvořením se ověřuje stav zařízení a seznam oprávnění. Offline zařízení ponechá úkol prepared. Před PUT se uloží submitted. Přijetí PUT neznamená úspěch; kód musí být dohledán, synchronizovaný, zapnutý a mít přesný PIN i platnost. Nuki příkaz se neopakuje po timeoutu nebo 5xx. Výslovné odmítnutí validace/autorizace/limitu dovolí pozdější opakování stejného PINu; selhané oprávnění v Nuki se nejprve ověřeně odstraní.

**Neřešitelná nejistota:** jestli proces skončí mezi uložením submitted a PUT, nebo se ztratí odpověď a oprávnění není vidět, nelze pouze z chybějící položky odvodit, že žádná operace neběží. Systém dál ověřuje a upozorní obsluhu, ale nesmí vymýšlet druhý PIN. Starší záznamy bez ciphertextu lze obnovit pouze z prokazatelně odpovídajícího oprávnění Nuki. Žádné historické upozornění se automaticky neoznačuje za vyřešené bez ověření.

Ověřený kód se mezi přípravou a e-mailem zachová. Pozdější výpadek Wi-Fi nebrání odeslání již ověřeného uloženého PINu. Změny/reset zařízení mimo aplikaci nejsou automaticky detekovány; po resetu je nutná provozní kontrola. Šifrovaný PIN je po potvrzeném odebrání smazán.

Watchdog každou minutu vybírá nejbližší rezervace. Po pěti neúspěších upozorní, ale dál opakuje s odstupem nejvýše 20 minut, v posledních 15 minutách před termínem každou minutu. Selhaný přípravný krok blokuje doručovací krok. Stejnou rezervaci souběžně zpracovává jen jeden worker díky databázovému advisory locku.

## Storno

Databázový trigger atomicky označí zrušený termín jako blokovaný, pokud existuje neodebraný kód. Rozšířená exclusion constraint brání nové rezervaci do tohoto termínu, i kdyby kontrola dostupnosti selhala. Watchdog obnoví odebrání také po pádu procesu mezi stornem a voláním API. Příkaz DELETE se považuje za dokončený teprve po ověření online zařízení a nepřítomnosti oprávnění. Do té doby je v administraci varování a termín zůstává blokovaný. Nejasné staré oprávnění vyžaduje ověření; nestačí zavřít alert.

Při změně termínu se případný již připravený PIN odebere před uvolněním původního okna. Neúspěšné odebrání změnu zastaví a rezervace zůstane na původním termínu. Opakování následně obnoví přístup k stále potvrzenému termínu.

## Nasazení a rollback

1. Ověřit projekt a nulové konflikty historických blokací. Migrace při konfliktu musí celá skončit rollbackem; nerušit zákaznické rezervace.
2. Uložit samostatný klíč do serverového prostředí Vercel Production. Žádné veřejné proměnné, Git ani logy.
3. Aplikovat migraci v jedné transakci před aplikací. Zachovává všechna původní data a doplňuje chybějící pipeline potvrzených rezervací. Posuny času retry převádí z dosavadního UTC timestamp na timestamptz.
4. Nasadit aplikaci, ověřit cron, administraci a časy budoucích rezervací. Nevytvářet reálné zákaznické PINy před jejich 24hodinovým oknem.
5. Fyzické otevření a zákaznické doručení otestovat na vyhrazeném termínu.

Při rollbacku nesmazat klíč ani sloupce. Starší aplikace neumí nové úlohy a blokace správně zobrazovat; preferovat opravu vpřed, případně dočasně vypnout nové rezervace a kódy provozním přepínačem s dohledem obsluhy.

Testy používají výhradně samostatný lokální Postgres a náhrady Nuki/Resend/Comgate. Tyto testy se nikdy nepouštějí proti produkční databázi.
