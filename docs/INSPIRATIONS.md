# Unmanned, Lock-Access Gyms: Competitive Inspiration

> Research compiled 2026-07-18. Scope was deliberately restricted to gyms that
> match our concept: **no reception, no on-site staff, entry via a smart lock or
> code** (PIN keypad, app-generated code, phone-tap/Bluetooth, or QR), where the
> member **books online, pays online, and lets themselves in**. Staffed boutique
> chains and pure software vendors were excluded. Each entry was verified from
> the operator's own website; every factual claim links its source.
>
> A structured, browsable version of this list also lives in the administration
> under **Inspirace** (`/admin/inspirations`), backed by
> `src/lib/data/inspirations.ts`.

> Status 2026-07-22: this is a dated research snapshot, not confirmed client
> content. Do not copy competitor claims into the public site. The implemented
> product currently uses the date-first monthly calendar, exact slot ranges,
> transparent one-off pricing and the book, pay, code, enter explanation.

This document surveys real, operating gyms and fitness studios worldwide that run
on the same core concept as ours.

**What's common across the category:** almost all are "private pod / private box"
businesses where you rent the _whole space to yourself_ for a time window
(typically 30–60 min); nearly all are **contract-free, pay-per-session or
credit-based** rather than classic monthly memberships; most run their whole
customer experience through a **native mobile app** rather than a web form; and
access is overwhelmingly **app-tap or PIN**, delivered only for your booked
window. First-visit discounts (often 50% or 20%) and "no contracts / only pay
when you train" are the two most repeated marketing hooks.

Verification note: each gym below was confirmed from its own website (or, where
the site is a JS app that didn't render, from corroborating sources) to be
genuinely unmanned + lock/code access. The two mild caveats (Gymshare is a
marketplace; The Yard has partial staffed hours) are flagged explicitly.

---

## SOLO60: London, UK

**URL:** https://www.solo60.com/

- **Access method:** Unmanned. You book and pay in the app, then "enter with a PIN" via a smart lock; "the entire space is yours for the duration of your booking." Runs on the Gymflow platform (their member app is `com.gymflow.solofit.members`), which handles the access control. Booking window opens up to 14 days ahead; not explicitly advertised as 24/7. (Source: https://www.solo60.com/)
- **Booking & occupancy:** Single-occupancy, book by the hour: a private gym or treatment room entirely to yourself; one guest allowed at no extra cost. 14 London sites (Waterloo/South Bank, Fitzrovia, Moorgate, Shoreditch, Fleet Street, Kings Cross, Tower Bridge, Spitalfields, etc.). (Source: https://www.solo60.com/)
- **Payment model:** Credit-based hybrid: pay-as-you-go credits from ~£2 with **dynamic (surge) pricing** by day/time; discounted credit packs (50–450 credits at ~£1.42) with 1–3 month validity; fixed monthly membership "coming soon." 24h cancellation. In-app card payment. (Source: https://www.solo60.com/)
- **Notable features:** Native app, availability calendar 2 weeks out, dynamic pricing, gift cards, a 20%-off-first-session email capture, and a "Priority Pass" perks add-on teased as coming soon.
- **Frontend & forms:** App-first. Web homepage is **minimalist, dark, large white type over lifestyle photography**, with app-download CTAs as the primary action and an email-capture bar dangling the 20% first-session discount. Actual booking/signup lives in the app: register account → pick location → pick time slot → customize session → pay → receive PIN. (Source: https://www.solo60.com/)
- **Ideas to borrow:** (1) **Dynamic/surge pricing on credits** by day and time to flatten demand and monetize peak slots. (2) The 20%-off email capture on the marketing site as a lightweight top-of-funnel before forcing an app download.

---

## The Gym Pod: Singapore (origin), with US (Chicago) & SE-Asia locations

**URL:** https://thegympod.com/

- **Access method:** Fully unmanned. "Use the App to unlock the door and start your workout": no keys or access cards. "Pods open daily, with many available 24/7." (Source: https://thegympod.com/)
- **Booking & occupancy:** Both **fully-private single-occupancy pods** ("The Gym Pod") and semi-private/"hybrid" strength spaces ("Unleashed"). Sessions are 30 minutes; you can chain consecutive slots for a longer workout. Locations across Singapore, USA (Chicago), Indonesia and Vietnam; AU app-store presence. (Sources: https://thegympod.com/, https://thegympod.com/the-gym-pod/)
- **Payment model:** Pay-per-use, no contracts: "only pay when you train." Also sells Starter/Power/Premium subscription packs. **50% off your first booking.** In-app card payment. (Source: https://thegympod.com/the-gym-pod/)
- **Notable features:** In-app instant booking and rescheduling; in-pod environment controls (lighting, music); community/referral testimonials; multi-country pod directory in one app.
- **Frontend & forms:** App-only funnel, three steps: download app + create free account → select & reserve pod → unlock via app. Visual identity is **yellow/gold-on-black, modern and photo-led**, emphasizing clean, well-lit container-style pods. (Source: https://thegympod.com/)
- **Ideas to borrow:** (1) **30-minute base slot with "add consecutive slots"** as the atomic booking unit: cheaper entry price point and finer inventory granularity than a fixed hour. (2) In-pod environment controls (lights/music) surfaced as a product feature, not just an amenity.

---

## Solospace Gym: Brno, Czech Republic

**URL:** https://solospacegym.cz/en

- **Access method:** Unmanned, 24/7 self check-in. **PIN pad at the entrance**; your code appears in the "Bookings" section of the booking portal **24 hours before** your session. (Source: https://solospacegym.cz/en)
- **Booking & occupancy:** **Whole gym to yourself** per slot: "the entire gym is reserved exclusively for each booking," no shared equipment. Book by the hour online via a calendar. (Source: https://solospacegym.cz/en)
- **Payment model:** Per-session hourly from 160 Kč/hr with **dynamic pricing by day/time**; subscription **credit bundles** (monthly validity) up to ~25% cheaper; automatic **multi-slot discounts** (5% for 5+ slots, 10% for 10+). Card payment at booking. (Source: https://solospacegym.cz/en)
- **Notable features:** Online availability calendar, credit packs, bulk-booking discounts, and lifestyle amenities (showers, smart TV with Bluetooth speakers). Nearly identical concept to ours (single independent studio, whole-gym-to-yourself, PIN, book-and-pay-online): the closest direct analogue in this list, and Czech.
- **Frontend & forms:** Web-based booking is a client-side JS app (a SPA calendar widget): select slot on an online calendar → pay by card → retrieve PIN from Bookings. Site style is **clean and minimalist, blue-and-white, equipment-photo heavy.** (Source: https://solospacegym.cz/en)
- **Ideas to borrow:** (1) **Release the door PIN 24h before the slot** inside the booking record: reduces support load and creates a reason to open the app/portal again the day before. (2) **Automatic bulk-booking discounts** (book 5+ / 10+ slots → step discounts) to nudge larger single-transaction commitments without a membership.

---

## The Gym Pods: Manhattan, Kansas, USA

**URL:** https://www.thegympods.com/

- **Access method:** Unmanned; booking and entry via an app ("an app where you can use the calendar to make a reservation"). "Available 24/7 in Manhattan, KS." "No one else can access the space during your reservation." (Source: https://www.thegympods.com/)
- **Booking & occupancy:** **Single-occupancy private gym**, bookable in **30-minute increments up to 2 hours per day**. Onboarding starts with a free 30-minute trial session. (Sources: https://www.thegympods.com/, https://www.thegympods.com/questions)
- **Payment model:** App-based **credit system** plus membership plans (pricing gated behind sign-up). Complimentary 30-min trial as the acquisition hook. (Source: https://www.thegympods.com/membership-1)
- **Notable features:** In-app availability calendar, credit balance, free trial, single premium room kitted with Peloton Bike+, racks, Smith machine, cable, leg press, free weights.
- **Frontend & forms:** Distinctive **gated onboarding**: instead of instant self-serve, step 1 is a **website "request access" form** → step 2 you receive an email with access instructions → step 3 book in the app → step 4 pick a membership. Visual style is **minimalist and typography-forward**, emphasizing focus/simplicity. (Sources: https://www.thegympods.com/, https://www.thegympods.com/join)
- **Ideas to borrow:** (1) **Free 30-minute trial slot** as the top-of-funnel offer: extremely low friction for a solo gym. (2) A **daily cap (max 2h/day)** on a single member's bookings to keep inventory fair when one room serves the whole customer base.

---

## Gymshare: USA (marketplace)

**URL:** https://www.gymshare.co/

- **Access method:** Unmanned by design and by rule. "All gyms have a form of keyless entry… so that the Gymer never has to interact with the gym owner." "You let yourself in, you let yourself out, without ever interacting with the home gym owner." Specific lock tech varies by host; motion-activated security cameras are required of hosts. (Sources: https://www.gymshare.co/, https://www.gymshare.co/faqs)
- **Booking & occupancy:** Marketplace (Airbnb-for-home-gyms): reserve a **private home gym (or pool, pickleball court) entirely to yourself** for your window. Caveat: it's a two-sided platform, not a single operator, but every listing enforces the unmanned + keyless model, which is why it's included. (Source: https://www.gymshare.co/)
- **Payment model:** Membership to reserve any listed gym, plus per-reservation; **no contracts, cancel anytime, "no hidden fees."** iOS + Android apps. (Sources: https://www.gymshare.co/, App Store listing)
- **Notable features:** Native app dashboard, host equipment-status/availability, community discovery ("find gyms in your community"), host onboarding flow with mandatory keyless-entry + camera requirements.
- **Frontend & forms:** App-driven, "free and fast" signup emphasized; homepage is **minimalist with a teal/blue palette and professional space photography.** Two distinct funnels: "Gymer" (find & book) and "Home Gym Owner" (list your space). (Source: https://www.gymshare.co/)
- **Ideas to borrow:** (1) **Mandating keyless entry + a security camera as a platform rule**, framed as a trust/safety feature ("never interact with anyone"). (2) The **privacy-as-the-product** positioning ("no crowds, no waiting, no strangers"): the same emotional pitch works for a single-occupancy studio.

---

## The Yard: San Francisco & Mill Valley, California, USA

**URL:** https://goyard.fit/

- **Access method:** Keyless self-entry via the **Kisi** app: "download the Kisi app, enter your Yard/Mindbody email to receive a sign-in link, and hold your phone up to the reader at the front door." _Caveat:_ unlike the pure pod operators, The Yard keeps some staffed hours and runs classes/PT, so it's a **hybrid** rather than fully unmanned: included because the daily access mechanism is genuinely lock/app-based and reservation-gated. (Sources: https://goyard.fit/faqs-private-gym/, https://classpass.com/studios/the-yard-san-francisco)
- **Booking & occupancy:** Reserve your own **private/semi-private training pod (rack, bench, dumbbells) for 60 minutes**, plus shared turf/outdoor space. Reservation always required, even for drop-ins. (Source: https://goyard.fit/)
- **Payment model:** $265/month unlimited bookings, or **drop-in passes ~$40–42** (peak/off-peak). Booking/payment through the app and Mindbody. (Sources: https://goyard.fit/, ClassPass/Mindbody listings)
- **Notable features:** App booking, Mindbody + Kisi + ClassPass/Wellhub integrations, peak vs off-peak drop-in pricing, "barbershop model" pod reservations.
- **Frontend & forms:** Runs on **Mindbody** for accounts/booking and **Kisi** for the door: a good example of stitching an off-the-shelf booking stack to an off-the-shelf access-control stack rather than building both. Passwordless "email → magic sign-in link" for door access. (Source: https://goyard.fit/faqs-private-gym/)
- **Ideas to borrow:** (1) **Passwordless email magic-link** as the door-access identity (low friction, no card to lose). (2) **Peak vs off-peak drop-in pricing** as a simple demand-shaping lever if credits feel too complex.

---

## My Fit Pod: UK (Berkhamsted, Aylesbury, Milton Keynes, Basingstoke, Oxford, Kingston, Crewe)

**URL:** https://myfitpod.co.uk/

- **Access method:** Unmanned, **24-hour** concept. Access via the app's phone-scanner: "hold your phone up to the scanner at your arrival time and the doors will open automatically," or use the "access" tab in your app profile. (Source: https://myfitpod.co.uk/)
- **Booking & occupancy:** Fully **private pod, total privacy**, booked via app. Multi-town **franchise** roll-out: relevant if we ever license the concept. (Sources: https://myfitpod.co.uk/, https://myfitpod.co.uk/pages/private-gym-franchise)
- **Payment model:** **Pay-as-you-go or credit bundles**; monthly subscription credit bundles give per-visit savings and let you book multiple sessions in advance. (Source: https://myfitpod.co.uk/)
- **Notable features:** Native app as the "one-stop shop," phone-tap door access with a dedicated access tab, credit bundles, "Blue Light" (emergency-services) discount promotion, franchise program, premium kit (Peloton bikes & treadmills). (Sources: https://myfitpod.co.uk/, https://myfitpod.co.uk/pages/myfitpodbluelight)
- **Frontend & forms:** App-first (download → book → tap to enter). Marketing site is a **Shopify-style storefront** ("pages/…"): the same platform serves promo landing pages (first-timers, Blue Light discount, per-location pages). Style is **luxury/premium, clean.** (Source: https://myfitpod.co.uk/)
- **Ideas to borrow:** (1) A dedicated **"Access" tab** in the app so entry is one predictable place, decoupled from the booking flow (helps when the auto-scan fails). (2) **Targeted discount landing pages** (e.g., Blue Light / NHS) as cheap segmented acquisition.

---

## FlexWerk Fitness: Carmel, Indiana, USA (+ expanding)

**URL:** https://flexwerkfitness.com/

- **Access method:** Unmanned. "Access control utilizing **digital keys** ensures safety and friction-free space reservation management." Four-tap reservation in the FlexWerk app. Open 5am–9pm (staffless, not marketed as 24/7). (Sources: https://flexwerkfitness.com/, https://flexwerkfitness.com/our-spaces/)
- **Booking & occupancy:** **Private "FlexSpace" reserved by the hour, exclusive to you** (standard fits 1–2; "FlexSpace Plus" fits 3–5 with racks, cable systems, TV, mirrors). Explicitly "removes memberships, contracts, awkward tours, and sales presentations." (Source: https://flexwerkfitness.com/our-spaces/)
- **Payment model:** **Pure pay-as-you-use, reservations from $18/hour, no membership, no contract.** (Source: https://flexwerkfitness.com/get-results/)
- **Notable features:** Own-branded app (built on Optix/Sharedesk coworking-style booking infrastructure: Play Store package `sharedesk.net.optixapp.fithauz`), per-space environment controls (music, lighting, temperature), a separate "FitPro" portal for trainers to bring clients, content-creation angle (record in your private studio). (Sources: app/Play store listings, https://fitpro.flexwerkfitness.com/)
- **Frontend & forms:** App-first "four-tap" reservation; positions the _absence_ of a signup/sales funnel as the feature ("no awkward tours, no sales presentations"). Site style is **sleek, modern, tech-forward.** Notably built on **coworking (desk-booking) software** rather than gym software: a smart reuse since the model _is_ hot-desking for gyms. (Source: https://clubsolutionsmagazine.com/2024/01/flexwerk-the-new-frontier-of-fitness-entrepreneurship/)
- **Ideas to borrow:** (1) **Flat, transparent hourly price ($18/hr) with zero membership** as the headline: the simplest possible pricing story. (2) A **separate trainer/"FitPro" account type** so professionals can book your space to run their own clients: a B2B revenue layer on top of B2C solo bookings. (3) Consider **coworking/desk-booking software** as a booking backend; the inventory model is identical to a bookable room.

---

## Common patterns & takeaways

### Features that show up repeatedly

- **Native mobile app as the whole product.** SOLO60, The Gym Pod, The Gym Pods (KS), Gymshare, My Fit Pod, and FlexWerk are all app-first; the website exists mainly to sell the download. Web-only booking (Solospace) is the exception, not the norm.
- **Pay-per-session / credits, not contracts.** Every single operator leads with "no contract / only pay when you train." Credit bundles with monthly validity (SOLO60, Solospace, My Fit Pod, The Gym Pods) are the standard way to get subscription-like commitment without a membership contract.
- **First-visit discount as the acquisition hook.** 50% off first booking (The Gym Pod), 20% off first session (SOLO60), free 30-min trial (The Gym Pods). Universal.
- **Whole-space-to-yourself + short slots.** 30-minute base units (The Gym Pod, The Gym Pods) or 60-minute (The Yard, FlexWerk), always with the promise "no one else can access during your reservation."
- **Demand shaping via price.** Dynamic/surge pricing by day-and-time (SOLO60, Solospace) and peak/off-peak drop-ins (The Yard); bulk-booking discounts (Solospace).

### Common form / onboarding patterns

- The "form" is usually **app onboarding, not a web form**: create a free account (email/phone) → browse a **calendar/slot picker** → pay by card in-app → receive/enable access. Registration is minimal (no long profile).
- **Passwordless / magic-link** identity appears where access control is bolted on (The Yard via Kisi email link).
- **Gated vs. instant** onboarding both exist: most are instant self-serve; The Gym Pods (KS) deliberately gates behind a "request access" web form + emailed instructions (useful when a single room needs vetting/scarcity).
- Marketing sites are **minimalist, dark or premium-clean, photo-led**, with an email-capture discount bar and app-store buttons as the primary CTA.

### Common access tech

- **PIN keypad** with a code released shortly before the slot (SOLO60, Solospace: 24h prior). Cheapest, no app dependency at the door. **This is exactly our Nuki keypad model.**
- **App-tap / Bluetooth / phone-to-reader** unlock (The Gym Pod, My Fit Pod, FlexWerk "digital keys," The Yard via **Kisi**).
- Repeated build-vs-buy insight: several stitch **off-the-shelf platforms**: SOLO60 on **Gymflow**, The Yard on **Mindbody + Kisi**, FlexWerk on **Optix** coworking software: rather than building booking + access from scratch. We are building bespoke, which gives us the flexibility they trade away.

### Prioritized ideas worth copying (for our single-occupancy, lock-access, book-and-pay-online gym)

1. **Lead with contract-free, flat, transparent per-session pricing** (à la FlexWerk's "$18/hr, no membership"): matches our 290 Kč one-time entry exactly; it's the clearest story and what this whole category competes on.
2. **Sell credit bundles / prepaid packs** as the loyalty mechanism instead of a real membership: complements our "every 10th entry free" loyalty counter (SOLO60, Solospace, My Fit Pod).
3. **A strong first-visit offer**: free 30-min trial or 50% off first booking: as the single top-of-funnel CTA.
4. **Release the door PIN into the booking record ~24h before the slot** (Solospace): cuts support and re-engages the user; we already time-box Nuki codes, so surfacing the code earlier in the member's account is a small change.
5. **Dynamic pricing + automatic bulk-booking discounts** to fill off-peak inventory and reward multi-slot commitment (SOLO60, Solospace).
6. **A dedicated "Access" screen** separate from booking (My Fit Pod), plus a fallback method (PIN _and_ the emergency service code), so a member is never locked out if one channel fails: we already send the code over multiple channels.
7. **A daily booking cap** (e.g., max 2h/day/member, The Gym Pods) to keep our single-room gym's inventory fair.
8. **A separate trainer/"pro" account type** (FlexWerk FitPro, SOLO60, The Yard) so PTs and physios can rent the space to run their own clients: an easy B2B revenue layer.
9. **Privacy-as-the-product messaging** ("no crowds, no waiting, no strangers, the whole space is yours"): the emotional core that this entire category, and our concept, sells on.

---

Candidates investigated and dropped for failing the strict unmanned + lock-only
test: **GYMPODS London** (explicitly staffed/supervised), generic rental
marketplaces (Peerspace, Giggster), and access-control _software_ vendors (Kisi,
Gymflow, GymMaster, Wodify), which enable the model but are not themselves
unmanned gyms.

---

# Round 2: more examples (design focus)

A second sweep for additional unmanned/lock-access gyms plus design-forward
fitness sites worth copying visually. The structured versions are in the admin
under **Inspirace** (`src/lib/data/inspirations.ts`).

## More unmanned / lock-access gyms

- **Elysium Gyms: London, UK**: https://elysiumgyms.com/: private boutique
  micro-gyms, hourly, app-unlock. Homepage: hero → five-icon "why us" row →
  space carousel → app CTAs. _Borrow:_ the six-step "how it works" strip; the
  five-icon differentiator row above the fold.
- **EVO Fitness: CH/DE/AT/Nordics**: https://evofitness.ch/en/: staff-free
  premium chain via "Credlock", ~5am–midnight. _Borrow:_ side-by-side pricing
  tiers (committed vs no-commitment); floating dismissible promo banner over a
  calm hero.
- **NEXT DOOR (Just Fit): Cologne/Düsseldorf, DE**: https://www.nextdoorgyms.de/en
  : fully digital, staffless, app/transponder access. _Borrow:_ make the
  staff-free nature the literal hero headline; an FAQ accordion that pre-empts
  "how do I get in?".
- **Barerooms: Wirral, UK**: https://barerooms.com/: unmanned app-access
  private rooms, slots staggered on the hour/half-hour so occupants never
  overlap (mirrors our model). _Borrow:_ state the staggered-slot mechanic in
  the picker copy; tiers as "X private sessions/week".

## Design-forward benchmarks (staffed, for visual ideas)

- **Barry's**: https://www.barrys.com/: dark, high-contrast, one hot accent +
  warm photography; "Book your first class" as the single dominant CTA, ≤3 steps.
- **Gymbox**: https://gymbox.com/: nightclub aesthetic, live countdown on a
  bold offer, UGC "Spotted in the Box" gallery.
- **Third Space**: https://www.thirdspace.london/: restrained luxury,
  light/dark-aware branding, short "enquire → choose option" modal instead of a
  long form.
- **Alchemy 365: Denver, USA**: https://alchemy365.com/: single bold accent
  (blue) over black/white (avoids the all-dark cliché); concrete cheap trial in
  the hero ("3 for $30").
- **1Rebel**: https://www.1rebel.com/: consistent brand web↔app; intent-first
  "I want to train: ___" filter before the calendar; visual spot/slot selection.

## Design takeaways applied to our site

- Lead with the self-access concept as the headline (done: hero + "jak to funguje").
- Explicit book → pay → code → unlock strip (done: 3-step section).
- Keep book-to-confirm ≤3 steps; sell single-occupancy ("celý gym jen pro vás").
- Dark hero + one bold accent (lime) + room for real photos; light/dark-aware tokens.
- Conversion levers to add later: a launch promo banner/countdown, a first-visit
  offer, and a UGC/gallery once real photos arrive.
