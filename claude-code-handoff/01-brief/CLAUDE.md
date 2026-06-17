# Chinese Textbook Series — Project Rules

Shared rules for all books in this series (Band 1 Foundation, and any future bands).
These were established while polishing **Band 1 - Foundation**. Apply them to every
book for consistency. Some rules are content-specific (noted as such) and only apply
when a book uses that feature.

---

## 1. Pinyin & ruby — the single most important consistency rule

**Always use ONE `<ruby>` element per Chinese character.** Never put multiple
character+annotation pairs inside one ruby.

```html
<!-- ✅ CORRECT — one ruby per character, pinyin sits centered on top of each -->
<ruby>启<rt>qǐ</rt></ruby><ruby>蒙<rt>méng</rt></ruby>

<!-- ❌ WRONG — Chrome mis-centers the annotations and drifts them to the right -->
<ruby>启<rt>qǐ</rt>蒙<rt>méng</rt></ruby>
```

This applies **everywhere** pinyin appears — cover title, headings, body, banners,
word lists. The single-ruby-per-character pattern is the only one that aligns pinyin
correctly over its character across the whole book.

- Pinyin is rendered **on top** (`ruby-position: over`), never to the side and never
  both. Do **not** also print a romanized form next to ruby text — that creates a
  duplicate (e.g. a heading reading "听说作业" with ruby on top must NOT also carry
  "tīngshuō zuòyè ·" in its side label; keep the English only).
- Size `rt` **relative to the base** with `em` (e.g. `font-size: .17em`) so it scales
  with the character. Avoid fixed `rt` sizes that break when reused at a different
  base size.
- **Content-specific:** "pinyin on every character" is a Band 1 / beginner rule. Higher
  bands may drop pinyin on known characters. But *when pinyin is shown, the style above
  must be identical* — one ruby per char, on top, em-sized.

### Pinyin on colored/dark banners
`rt` inherits the global (dark) text color by default and goes invisible on dark
banners. Any pinyin sitting on a colored background must set `rt { color: inherit }`
(inherit the banner's light text color), e.g.:

```css
.track__head .t ruby rt { color: inherit; opacity: .9; }
```

---

## 2. No vertical / stacked characters in word lists

Multi-character words in word rows (认一认 Recognise, Must-know, etc.) must read
**horizontally**. The bug: using `display: inline-flex; flex-direction: column` stacks
each character vertically (名 on top of 字) and lets the last item wrap to a new line.

```css
/* ✅ words stay horizontal on one line */
.rword, .mw { display: inline-block; white-space: nowrap; }

/* ❌ never do this for a word made of multiple characters */
.rword { display: inline-flex; flex-direction: column; }
```

Lay rows out with flex + `gap` (e.g. `gap: 8px 20px; justify-content: flex-start`),
not `justify-content: space-between` (which spreads items and encourages odd wrapping).

---

## 3. Voice & wording — student-facing, never teacher-facing

All lesson text speaks **to the student**. Remove teacher/designer language.

- ❌ Design jargon: "all instructions in two languages", "oral-first, light writing",
  "radical study", "structured drills". Students don't need to be told how the book
  was designed.
- ❌ Commands / imperative slogans as labels: 多说少写, 多写多说, "选一组，每天做一点".
- ✅ Friendly how-to: "read it out loud", "say it first, then write", "which homework
  do you do?", "do your homework — a little bit each day".
- Keep instructions in **Chinese (with pinyin) + a short English gloss**. The gloss is
  a `<span class="gloss">` after the Chinese.

---

## 4. The two study streams — canonical names

The book has two parallel streams for different students. Their canonical names
(current, after several iterations) are:

| Stream | Chinese | Pinyin | English |
|---|---|---|---|
| Listening & speaking | **听说作业** | tīngshuō zuòyè | Listening & speaking homework |
| Reading & writing | **读写作业** | dúxiě zuòyè | Reading & writing homework |

- Earlier rejected names (do NOT reuse): 多说少写 / 多写多说 (sound like commands),
  口语组 / 读写组 (the "组/group" framing was dropped).
- Task-table column headers follow suit: **听说任务 · Listen & speak** /
  读写-style tasks.
- The streaming + optional take-home work is a deliberate design feature for different
  students. **Explain it to the student in plain words** (which homework they do, that
  Further Study / take-home is optional and just for home) — never describe it as a
  pedagogical mechanism.
- **Never imply the teacher assigns or streams homework inside the book.** Streaming
  happens naturally and flexibly in teaching, not on the page. On the Dear Student page
  and the Conventions list, **only present the two options** — do NOT write "your
  teacher will tell you which homework to do", "just do the homework marked for you",
  or similar. Canonical phrasings now in Band 1 (reuse verbatim in every book):
  - Dear Student lead: 这本书有两种作业：**听说作业** 和 **读写作业**。… / "This book
    has two kinds of homework: Listening &amp; Speaking, and Reading &amp; Writing. The
    Further Study part at the end of each unit is for Reading &amp; Writing homework.
    Let's begin!"
  - Conventions item: "你的作业 — which homework do you do? **There are two kinds:**
    听说作业 (…) and 读写作业 (…)." (note **and**, not "or"; no teacher, no "marked for
    you").
- **Conventions list — every item carries a Chinese heading.** Each `<li>` in `.convs`
  opens with a per-character-ruby Chinese phrase + an em-dash English gloss (e.g.
  先说后写 — say it first, then write). Don't leave an item English-only.

---

## 5. Take-home / Further Study

- Framed as **optional** and for the student: "do your homework — a little bit each
  day (Day 1–5)", "no one at home needs to know Chinese".
- The **拓展 Further Study** part at the end of each unit is for the **读写作业**
  (Reading & writing) students. Label it as such in student-facing words.
- Keep the intro wording identical across all units.

---

## 6. CSS delivery & cache-busting

The books load shared styles from `assets/textbook.css`. Browsers aggressively cache
it, so edits can appear not to take effect.

- When you change `assets/textbook.css`, **bump the version query string** on the link:
  `<link rel="stylesheet" href="assets/textbook.css?v=YYYYMMDD">`.
- Critical layout/alignment fixes (pinyin alignment, no-stacking, banner pinyin color)
  are also **inlined in a `<style id="__pinyin-fixes">` block in `<head>`** so they
  apply even if the external sheet is stale. The external CSS remains the source of
  truth — keep the two in sync.

---

## 7. Files, versions & exports

- Main editable file: `Band 1 - Foundation.html` (+ `assets/textbook.css`).
- **Standalone export:** `Band 1 - Foundation (standalone).html` — a single offline
  file built with the inliner. Requires a `<template id="__bundler_thumbnail">` with a
  simple SVG splash in the source. Regenerate it after meaningful changes.
- A `-print.html` variant exists for PDF/print; it is a separate export and must be
  regenerated separately — it does NOT auto-update when the main file changes.
- **Do not keep history/backup copies** of the HTML in the project (no
  "pre-X backup.html" files). Use them transiently if needed, but clean them up — the
  current version is the only one we keep.

---

## 8. General

- Type sizes: headings/body should stay legible; this is a children's textbook —
  generous sizes, clear rhythm.
- Use the series fonts and color variables already defined in `textbook.css`; don't
  invent new colors.
- Label slides/screens/units so comments anchor correctly (units already use
  `data-screen-label` / `id="u1"…"u8"`).

---

## 9. Cover — consistent across all four books

Every band's cover must follow the **same pattern** (Band 1 is the reference). All
three Chinese elements carry pinyin, using the one-ruby-per-character rule (§1):

- **Book name** (`.cover__title`): per-character ruby, e.g.
  `<ruby>初<rt>chū</rt></ruby><ruby>级<rt>jí</rt></ruby>`. Never a bare
  `<span class="band-cn">…</span>` without pinyin.
- **Pigment / colour name** (`.cover__pigment`): the glyph, then a
  `<span class="py">…</span>` with the pinyin, then the romanized `.name`, e.g.
  `<span class="glyph">青</span><span class="py">qīng</span><span class="name">Celadon</span>`.
- **School name** (`.cover__school small`): per-character ruby on 凯西中文学校
  (Kǎi · xī · Zhōng · wén · xué · xiào).

Canonical values per band — title / pigment glyph · pinyin · English:

| Band | Title | Pinyin | Pigment | Pinyin | Colour |
|---|---|---|---|---|---|
| 1 | 启蒙 | qǐ méng | 朱 | zhū | Cinnabar |
| 2 | 初级 | chū jí | 青 | qīng | Celadon |
| 3 | 中级 | zhōng jí | 靛 | diàn | Indigo |
| 4 | 高级 | gāo jí | 黛 | dài | Aubergine |

The supporting CSS (`.cover__title ruby`, `.cover__pigment .py`) already lives in
`textbook.css` and the inline `__pinyin-fixes` block — no CSS change is needed to add
pinyin, only the ruby/`.py` markup in each cover.

---

## 10. Print pagination — keep a heading with its text (no orphaned headers)

**Problem (recurring across all books):** in print/PDF a part heading
(`.lblock__head`, the section band `.partband` incl. 拓展, or a `.sec-title`) lands at
the bottom of one page while its text starts on the next, often with a big blank gap
between. Valid as a web page; wrong for a textbook.

**Solution (in `assets/textbook.css`, inside the `@media print` block) — already done
for Band 1, promote verbatim to every book:**

```css
@media print{
  /* Lesson blocks may FLOW across a page break, so a tall section continues on the
     next page instead of jumping down wholesale and leaving a blank. */
  .lblock{ break-inside:auto; }
  .lblock__body{ break-before:avoid; }
  /* A heading is never the last thing on a page — glue it to the content that
     follows (its own body, or the first block after a section band). */
  .lblock__head, .partband, .sec-title, .lblock__title, .theme, .toc-title,
  h2, h3{ break-after:avoid; break-inside:avoid; }
  /* Atomic pieces still never split: charcards, dialogue turns, tables, recite
     boxes, single exercises, etc. (keep the existing list) plus: */
  .exercises li, .ex-match, .ex-find, .ex-numbers, .convs li, .twopaths__card{ break-inside:avoid; }
  p, li{ orphans:2; widows:2; }
}
```

Key ideas, in order of importance:
1. **`break-after:avoid` on every heading element** is what actually fixes the orphan —
   it forbids a page break *immediately after* a heading, so the heading is pushed to
   the next page together with its first line of content.
2. **Remove `.lblock` from the `break-inside:avoid` list** (set it to `auto`). Keeping a
   whole part atomic was the cause of the *big blank gaps*: a tall part that didn't fit
   jumped down entirely. Letting it flow keeps pages full; only the small atomic pieces
   inside stay unbroken.
3. **Keep the atomic list** (`.charcard`, `.scriptturn`, `.recite`, tables, `.exercises
   li`, …) so individual items never split mid-row.

This is a **minor-compromise** approach: the worst case is a small gap (height of a
heading + first atom) before a part that moves to the next page — acceptable, and far
better than a stranded header. Mirror the same rules into each book's inline
`<style id="__pinyin-fixes">` `@media print` block (cache robustness, §6) and bump the
`textbook.css?v=` string.

Per-character exercise tidy-ups that ride along with this (also in `textbook.css`):
`.ex-line` (instruction on its own line under an exercise heading) and `.ex-numbers`
(the 1./2./3. answer slots now `flex:1 1 0` so they stretch evenly across the box).

---

## 11. Character Status Policy (governs all four books)

Goal: no student ever meets unreadable Hanzi, without forcing closed-vocabulary texts.
Every Hanzi has exactly one status. Status is invisible to students — it lives only in
each book's Character Ledger and decides where pinyin appears.

Statuses:
- W (Write): fully taught — stroke order, components, student writes it. Small core.
- R (Recognize): taught for meaning + sound + reading; student need NOT write it.
- S (Supported): appears only for natural/cultural language; not expected to be known
  alone — must carry pinyin or a gloss every single time it appears.

Function-word backbone: a fixed set of unavoidable high-frequency characters
(个 的 是 有 不 我 你 他 在 …) is introduced as W or R in the EARLIEST units of every
band, independent of unit theme, and recycled throughout. Never left as S.

Support Rule (the one hard check):
- A character may appear with NO pinyin only if it is W or R for this band.
- Any S character — or any character past this repo's pinyin-withdrawal threshold that
  is not yet W/R — must carry a pinyin lifeline at that spot, even if surrounding text
  is pinyin-free.
- Illegal state = a character that is neither W/R nor supported. The sweep eliminates
  only this.

例句 in character boxes: use only the headword + existing W/R characters + S-with-pinyin.
Where the box already shows pinyin (per repo pinyin policy), this is auto-satisfied. The
real risk zone is running reading text and exercises where pinyin is withdrawn.

Streams: status = the Stream S (Cultural) FLOOR — write the W core, recognize the R set.
Stream L (Academic) PROMOTES upward (more R→W, S→R) for a heavier load that exceeds the
VCAA baseline. Record Stream L promotions in the Ledger.

Density guard: keep S sparse — per unit, S should be a clear minority of distinct Hanzi
(rough cap ~15–20%), and no single sentence may be carried mostly by S characters.

Character Ledger (per book, back matter — replaces any external registry): a table of
every distinct Hanzi in the book with character, status (W/R/S), unit of first use, and
stroke count for W characters. It is the source of truth for the Support Rule; update it
whenever text changes.

Unit self-check ("done" gate): list every distinct Hanzi in the unit, confirm each has a
valid Ledger status for the band, confirm in-text support matches status. Flag anything
unresolved rather than guessing.

Global registry (design-time source of truth): `assets/character-library.json` holds the
full cross-band character library — every distinct Hanzi per band with status (W/R/S),
first unit of use, stroke count + pinyin + meaning + radical for W, and a `support` tag
for each S (poem-pinyin / proper-noun / footnote / radical-gloss / culture-gloss). It also
carries the function-word backbone and per-unit S-density. Each book's printed back-matter
Ledger is generated from / kept in sync with this JSON — edit the JSON when text changes,
then regenerate the affected book's Ledger and re-run the unit self-check. Mark a band
`audited:true` only once its sweep is complete (currently: B3 audited; B1/B2/B4 pending).

---

## 12. New-character cell = colored stroke-order diagram (all four books)

The 学写字 character cards (`.charcard`) no longer show a static Songti glyph in the
grid. Each `.charcard__cell` now holds a **pre-rendered inline SVG stroke-order
diagram**: every stroke in its own colour (rainbow sweep, stroke 1 → N) with a small
order number, colour-matched to its stroke, sitting on the tianzige grid. This single
graphic doubles as the "new character" display **and** the stroke-order reference.

- **Data source — makemeahanzi** (`github.com/skishore/makemeahanzi`), the same SVG
  stroke-path + median data the `zitu-cards` repo uses. Combined per-character data
  lives in **`assets/data/stroke-data.json`**:
  `{ "口": { "s": [<svg path d>…], "m": [[[x,y]…]…] }, … }` — strokes are in
  makemeahanzi's 1024 **Y-up** space, so the SVG wraps them in
  `<g transform="translate(0,900) scale(1,-1)">`. To add characters, import their
  per-char file from `chanind/hanzi-writer-data` (`data/<char>.json`, identical data),
  merge into `stroke-data.json` (the sandbox blocks non-ASCII paths — rename to
  codepoint hex first, then read).
- **Generator — `assets/stroke-cell.js`** is the source of truth for the rendering
  (`StrokeCell.strokeCellSVG(ch, data)`): rainbow palette, plain colour-matched numbers
  with a white halo (NO circles), and an **overlap-relaxation** pass that spreads numbers
  apart where strokes share a start point (readability > exact placement). Locked style —
  keep it identical across all books.
- **Pages ship STATIC inline SVG** (built from that generator) so print / PDF / standalone
  all work with zero JS and no asset dependency. The cell carries `data-char="X"`. The
  `.ch` span is gone; `stroke-cell.js`/`stroke-data.json` are NOT loaded by the books —
  they're build/repro assets only. To re-render, run the generator over every
  `.charcard__cell` and replace its contents.
- **Untouched:** the textual stroke-breakdown row (`.charcard__strokes`, ①竖→②横折→③横),
  the radical/组词/句子 facts, and the 写一写 trace boxes (kept plain grey for tracing).
  Cell CSS (`.charcard__cell` 108×108, `overflow:hidden`, `.strokediagram`) lives in
  `textbook.css` and is mirrored into each book's inline `__pinyin-fixes` block (§6).
