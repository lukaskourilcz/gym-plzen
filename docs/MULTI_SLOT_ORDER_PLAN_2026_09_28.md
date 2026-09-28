# Nákup více termínů v jedné objednávce — plán (28. 9. 2026)

Podnět od provozovatelek (WhatsApp 27.–28. 9.): „lze si zakoupit víc slotů
najednou?“ Dnes se každý termín kupuje a platí zvlášť. Cíl: zákazník vybere
několik termínů, zaplatí jednou a dostane jedno potvrzení; přitom zůstane
zachováno vše, co dnes funguje po jednotlivých rezervacích (PIN pro každý
termín, změna termínu, zrušení, věrnostní 10. vstup zdarma, vouchery, doklady).

Tento dokument je zadání pro implementaci. Jednotlivé kroky mají GitHub issue
(viz seznam na konci); pořadí kroků je závazné, každý krok se slučuje zvlášť.

## 1. Rozhodnutí (výchozí hodnoty, dokud provozovatelky neřeknou jinak)

| Otázka                                      | Rozhodnutí                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Co je jednotka nákupu                       | Nová entita **objednávka** (`booking_order`). Rezervace zůstává jednotkou termínu: PIN, pipeline, ICS, změna termínu i storno zůstávají per rezervace.                                                                                                                                      |
| Kolik termínů najednou                      | Nejvýše **10** v jedné objednávce (konstanta `MAX_SLOTS_PER_ORDER`).                                                                                                                                                                                                                        |
| Cena                                        | Součet cen jednotlivých termínů podle platného ceníku v čase každého termínu (jako dnes). Žádná množstevní sleva v této fázi.                                                                                                                                                               |
| 10. vstup zdarma                            | Termíny objednávky se seřadí podle začátku a přičtou k dosavadnímu počtu započtených vstupů člena. Každý, který připadne na násobek 10, je zdarma (i dva v jedné objednávce, např. 10. a 20.). Reward číslo zůstává per rezervace (`reservation.loyalty_reward`), unikátní index se nemění. |
| Voucher                                     | Jeden voucher **na objednávku**, sleva se počítá z celkové ceny. Sleva se rozpočítá do `reservation.price_cents` poměrně, zbytek zaokrouhlení jde na poslední termín, aby součet seděl s platbou. Jedno uplatnění voucheru = jedna objednávka.                                              |
| Platba                                      | Jedna platba Comgate na celou objednávku. Webhook potvrdí všechny rezervace objednávky v jedné transakci. Částečné potvrzení neexistuje.                                                                                                                                                    |
| Doklad                                      | Jeden doklad na objednávku s položkou za každý termín.                                                                                                                                                                                                                                      |
| Potvrzovací e-mail                          | Jeden e-mail „Potvrzení objednávky“ se seznamem termínů a jednou přílohou `.ics` s více událostmi. E-mail s PINem zůstává per termín (hodinu před začátkem).                                                                                                                                |
| Konflikt při placení                        | Pokud se některý termín mezitím obsadí, objednávka se nezaloží a zákazník vidí, který termín je pryč, a může ho odebrat. Nikdy nevzniká „poloviční“ objednávka.                                                                                                                             |
| Rezervace jednoho termínu                   | Zůstává stejně rychlá: vybrat termín → Pokračovat. Objednávka s jedním termínem je běžný případ, ne výjimka.                                                                                                                                                                                |
| Ruční rezervace v administraci              | Beze změny (jeden termín, `order_id` prázdné).                                                                                                                                                                                                                                              |
| Storno jednoho termínu z placené objednávky | Provozovatel ruší per rezervace jako dnes; upozornění na refundaci uvádí částku daného termínu (`price_cents`).                                                                                                                                                                             |

## 2. Uživatelská cesta (nejjednodušší varianta)

1. **Kalendář `/rezervace`**: klik na termín ho **vybere** (chip se zaškrtnutím),
   nenaviguje. Výběr se drží v URL (`start=<ISO>` opakovaně), takže přežije
   reload, sdílení i přepnutí dne či měsíce. Dole se objeví lepicí lišta:
   „Vybráno 3 termíny · 687 Kč · Pokračovat“. Klik na vybraný termín ho odebere.
   Při 1 termínu se lišta chová stejně („1 termín · 229 Kč · Pokračovat“).
2. **Údaje `/rezervace/udaje`**: nahoře seznam vybraných termínů (den, čas,
   cena nebo „zdarma – věrnostní vstup“), u každého „Odebrat“, pod nimi odkaz
   „Přidat další termín“ (zpět do kalendáře se zachovaným výběrem). Jeden
   formulář kontaktů, jeden voucher, jeden souhlas, jedno tlačítko
   „Zaplatit 687 Kč“ (nebo „Dokončit“ při nulové ceně).
3. **Platba**: Comgate, jedna transakce.
4. **Hotovo `/rezervace/hotovo`**: seznam všech termínů, jedno „Přidat do
   kalendáře“ (ICS s více událostmi), věrnostní věta pro členy.
5. **Účet**: „Historie objednávek“ seskupená po objednávkách (termíny uvnitř),
   doklad per objednávka. Nadcházející tréninky beze změny (per termín).

Copy je česky, ceny „za celý prostor“ zůstávají u každého termínu.

## 3. Datový model

- Nová tabulka `booking_order`: `id`, `user_id` (nullable), `status`
  (`pending|confirmed|cancelled`), `total_cents`, `currency`,
  `contact_name|email|phone`, `confirmation_token_hash`, `voucher_id` (nullable),
  `rules_accepted_at`, `terms_accepted_at`, `created_by_admin_id`,
  `cancelled_at`, `cancel_reason`, `created_at`, `updated_at`.
- `reservation.order_id` (nullable FK, `ON DELETE SET NULL`) + index.
  Stávající rezervace zůstávají bez objednávky; kód musí umět obojí.
- `payment.order_id` (nullable) + částečný unikátní index „jedna aktivní
  Comgate platba na objednávku“ vedle stávajícího per rezervace.
- `invoice.order_id` (nullable) + unikátní index per objednávka; stávající
  `invoice_reservation_uidx` zůstává pro staré doklady.
- `voucher_redemption.order_id` (nullable) + unikátní index per objednávka;
  per rezervace zůstává pro staré řádky.
- Exkluzivní constraint `reservation_no_overlap` se nemění: vložení všech
  rezervací objednávky v jedné transakci buď projde celé, nebo selže (23P01).
- Migrace: `drizzle/2026MMDDHHMMSS_booking_orders.sql`, aditivní, aplikuje se
  na produkci před sloučením kódu (zapsat do NEEDED.md jako dnes).

## 4. Služby

- Nová `services/orders.ts`: `startOrder({userId, slots[], details, voucherCode, hold})`
  (nahrazuje `booking.startBooking` pro veřejnou cestu; `startBooking` zůstane
  jako tenký obal pro jeden termín, aby staré testy a admin cesta žily),
  `confirmOrder(orderId)` (transakce: všechny rezervace `confirmed`, `initPipeline`
  pro každou, `redeemForOrder`), `cancelOrder`, `releaseExpiredOrders`,
  `getOrderConfirmation`.
- `loyalty.allocateRewards(userId, startsAt[])` — čistá funkce + zámek profilu.
- `vouchers.claimForOrder / redeemForOrder / releaseForOrder`.
- `payments.startOrderPayment` (částka = `total_cents`), webhook mapuje platbu
  přes `order_id` **nebo** `reservation_id` (staré platby).
- `fulfillment.fulfillReservation` volá se pro každou rezervaci objednávky;
  potvrzovací e-mail se posílá jednou per objednávka (nový `kind`
  `order_confirmation`, dedupe `order-confirmation/<orderId>`), starý
  `reservation_confirmation` zůstává pro rezervace bez objednávky.
- Hold cookie `navi_hold` nese `orderId.token` místo `reservationId.token`;
  starý formát se ještě čte (jen po dobu 35 min od nasazení).

## 5. Kroky implementace (každý = jedno issue, sloučit v tomto pořadí)

1. Datový model a migrace `booking_order` (+ sloupce `order_id`) — #77.
2. Služby objednávky, věrnost přes více termínů, voucher na objednávku,
   integrační testy — #78.
3. Comgate platba za objednávku, webhook, reconcile, doklad per objednávka — #79.
4. Veřejné UI: výběr více termínů v kalendáři, lišta, stránka údajů, hotovo,
   ICS s více událostmi, GA4/Meta purchase s `quantity` — #80.
5. E-maily a upozornění provozovatele pro objednávku — #81.
6. Účet a administrace: historie objednávek, označení „součást objednávky“ — #82.
7. Texty: VOP (4.x, 8.x), FAQ, design-system (chip výběru, lepicí lišta) — #83.

Epic: #76. Související chyby zjištěné při přípravě testu kliky: #84, #85, #86.

## 6. Co se **nemění**

PIN per termín (příprava −24 h, e-mail −1 h), watchdog, změna termínu (jedna
per rezervace, 24 h předem), ruční rezervace v administraci, ceník a cenová
období, RLS/realtime `availability_signal`.

## 7. Otázky pro provozovatelky (nezdržují start prací)

- Má mít větší objednávka slevu? (Dnes: ne.)
- Má voucher platit na celou objednávku, nebo jen na jeden termín? (Dnes: celá.)
- Maximální počet termínů v objednávce 10 — vyhovuje?
