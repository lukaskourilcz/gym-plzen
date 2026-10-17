# Převod původních prázdných rezervací na blokace

Operace v `scripts/ops/` jsou výslovná údržba na žádost vlastníka. Nespouštějí
se z migrací, nasazení, seedů ani veřejného požadavku. Vyžadují transakci a
explicitní seznam ověřených UUID v `gym.legacy_conversion_ids`.

První fáze pod zámky rezervací a rozvrhu znovu ověří prázdný administrátorský
kontakt bez účtu, objednávky, ceny, plateb, dokladů, voucherů, doprovodu,
skutečných vstupů a zákaznických zpráv. Zachová soukromý audit v neměnné kopii
dávky, bez PINu či jeho šifrované podoby. Potvrzený čas atomicky nahradí blokací
a zastaví původní pipeline. Dříve zrušený čas neblokuje. Historii odeslaných
interních upozornění zachová. Nevolá storno službu ani odesílání zpráv.

Rezervace se živým kódem zůstane propojená s oprávněním, dokud normální
watchdog nepotvrdí odebrání v Nuki. Při nedostupném zámku se vazba nesmí
odstranit. Druhá fáze znovu ověří nezměněný záznam, chybějící finanční vazby,
náhradní blokaci a ukončené kódy. Teprve potom původní rezervaci odstraní;
záznamy kódů a pipeline odstraní jejich existující cizí klíče. Audit dávky
a aktivita zůstanou. Opakování obou fází nevytváří další blokace.

Před a po produkční operaci se porovnávají kontrolní otisky skutečných
zákaznických rezervací, kódů a zpráv. Při změně auditovaného záznamu operace
odmítne celou transakci. Zkoušky se provádějí pouze nad izolovanou databází
a náhradou Nuki, včetně offline zámku a neúplného převodu.
