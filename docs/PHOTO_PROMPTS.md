# Zadání pro generování ilustračních fotografií

Podklady pro dvanáct obrazových míst na webu. Každé má vlastní zadání
(prompt) pro ChatGPT / DALL·E, doporučený poměr stran a místo, kam se
výsledek nahrává: **administrace → Nastavení a branding**.

> **Než je nahrajete:** dokud je v Nastavení zapnuté „Ilustrační fotografie“,
> zobrazí web u každého snímku štítek **Ilustrační foto**. Nechte ho zapnutý,
> dokud nedodáte vlastní snímky studia : návštěvník tak nikdy není uveden
> v omyl, že se dívá na skutečné prostory.

## Společná část zadání

Vložte tenhle odstavec **na začátek každého promptu**. Drží celou sadu
v jednotném vzhledu, aby dvanáct obrázků působilo jako jedna galerie
a ne jako sesbíraná stocková směs.

```
Photorealistic interior photograph of a small, private, single-occupancy
gym studio. Editorial fitness photography, shot on a full-frame camera with
a 35mm lens at f/2.8, natural window light with soft shadows, calm and
uncluttered composition, plenty of negative space.

Colour grade: deep forest green (#004534) and near-black ink green (#003527)
as the dominant tones, warm brushed-gold accents (#ddb255), warm taupe
(#7c6650) leather and wood, off-white walls. Muted, warm, low-contrast
grade. No neon, no teal-orange look, no HDR.

The room is empty of people. No text, no logos, no signage, no brand marks,
no watermarks. Nothing that looks like a large commercial chain gym: this is
one quiet private room, not a fitness centre floor.
```

Pak připojte konkrétní zadání níže.

---

## 1. Hlavní fotka v záhlaví (hero)

- **Kam:** Nastavení → Fotka v záhlaví (`branding.hero_image_url`)
- **Poměr:** 16:9 na šířku, ideálně 2560 × 1440 px
- **Pozor:** přes fotku jde tmavý zelený závoj a bílý nadpis. Nechte proto
  **střed a levou polovinu klidné** : žádný důležitý detail, kam padne text.

```
Wide establishing shot of the whole private gym room seen from the doorway.
Late afternoon light falling across a rubber floor. A rack, a bench and a
few kettlebells arranged along the far wall, deliberately sparse. The left
half and centre of the frame stay visually quiet and slightly darker so
white headline text can sit over them. Deep green wall as the backdrop.
```

## 2. Fotka za sekcemi „Jak to funguje“ a „Ceník“

- **Kam:** Nastavení → Fotka za sekcemi (`branding.sections_image_url`)
- **Poměr:** 16:9 na šířku, 2560 × 1440 px
- **Pozor:** slouží jen jako tichá textura pod obsahem. Čím méně detailů,
  tím lépe.

```
Very soft, almost abstract detail of the gym interior: out-of-focus green
wall, a hint of a wooden bench edge and one brushed-gold fixture catching
the light. Shallow depth of field, most of the frame gently blurred. Reads
as a calm background texture rather than a subject.
```

## 3.–6. Galerie „Podívejte se dovnitř“

Čtyři dlaždice. První je velká na výšku, další tři menší.

### 3. Hlavní dlaždice — „Interiér NAVI Private Gym“

- **Kam:** Nastavení → Galerie 1 (`branding.gallery_1_url`)
- **Poměr:** 4:5 na výšku, 1600 × 2000 px

```
Vertical portrait-orientation view into the studio: a squat rack against a
deep green wall, warm wood bench in the foreground, soft daylight from a
window on the left. The most inviting single image of the room.
```

### 4. „Další pohled na prostor“

- **Kam:** Nastavení → Galerie 2 (`branding.gallery_2_url`)
- **Poměr:** 4:3 na šířku, 1600 × 1200 px

```
The same room from the opposite corner: mirrored wall, a rowing machine and
a neatly coiled battle rope, warm taupe mat on the floor.
```

### 5. „Detail tréninkové zóny“

- **Kam:** Nastavení → Galerie 3 (`branding.gallery_3_url`)
- **Poměr:** 4:3 na šířku, 1600 × 1200 px

```
Close detail: a row of dumbbells on a wooden rack, brushed-gold end caps
catching the light, shallow depth of field, green wall softly blurred
behind.
```

### 6. „Zázemí a vstup“

- **Kam:** Nastavení → Galerie 4 (`branding.gallery_4_url`)
- **Poměr:** 4:3 na šířku, 1600 × 1200 px

```
The entrance area: a simple dark door with a small keypad beside it, a bench
and a coat hook, warm light from above. Calm and welcoming. The keypad has
no digits or text visible on it.
```

---

## 7.–12. Šest zón na stránce Vybavení

Všechny stejného formátu, ať dlaždice sedí k sobě.

- **Poměr:** 4:3 na šířku, 1600 × 1200 px
- **Kam:** Nastavení → Zóna 1–6 (`branding.zone_1_url` … `zone_6_url`)

### 7. Zóna 1 — Silová zóna

```
A power rack with a loaded barbell and a flat bench, rubber platform
underneath, deep green wall behind. Serious but uncrowded.
```

### 8. Zóna 2 — Kardio zóna

```
A single treadmill and an air bike side by side facing a window, daylight
falling across them, plenty of empty floor around them.
```

### 9. Zóna 3 — Strečink zóna

```
A soft taupe mat unrolled on the floor with a foam roller, a yoga block and
a resistance band placed neatly beside it, low warm light, mirrored wall
partly visible.
```

### 10. Zóna 4 — Zázemí pro děti

```
A small, tidy children's corner in warm neutral tones: a low wooden play
table, a soft rug, a few simple wooden toys in a basket, a window with
green planting visible outside. Bright, safe and calm. No children in the
frame, no cartoon characters, no printed branding on the toys.
```

### 11. Zóna 5 — Vybavená lednice

```
A glass-fronted drinks fridge in a small alcove, stocked with plain
unlabelled bottles and cans, warm light spilling from inside, wooden shelf
above it. All packaging is blank: no brand names, no labels, no text.
```

### 12. Zóna 6 — Zázemí pro vás

```
A small private bathroom and relax corner: a walk-in shower with dark tiling,
folded white towels on a wooden shelf, a simple stool, one unlabelled amber
cosmetics bottle. Spa-like, warm and clean. The bottle carries no label or
text.
```

---

## Po vygenerování

1. **Zkontrolujte, že v obrázku není žádný text ani logo.** Generátory je
   rády doplní; snímek s vymyšleným nápisem na zeď nepatří na web.
2. Zmenšete na uvedený rozměr a uložte jako JPEG (kvalita ~82) nebo WebP.
   Cílem je do ~400 kB na snímek, u hero do ~600 kB.
3. Nahrajte v administraci → **Nastavení a branding** do odpovídajícího pole.
4. Alternativní popis (alt) se u hero zadává zvlášť; u ostatních se bere
   z textů webu, takže se o něj nemusíte starat.
5. Štítek „Ilustrační foto“ nechte zapnutý, dokud nedodáte vlastní snímky
   studia.
