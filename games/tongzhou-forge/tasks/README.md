# Task cards

One card = one small job with a check that says `DONE`. Give a model `AGENTS.md` and exactly one card.

## Handing a card to a weak model

Give it this, and nothing else:

> You work in `games/tongzhou-forge/` of this repo. Read `AGENTS.md`, then `tasks/<NN>-<name>.md`.
> Do only what the card says, change only the files it names, and run its check until it prints
> `DONE`. Do not edit anything in `tasks/checks/`. When it is done, commit on `master` with a message
> that starts with `Forge task <NN>:`, and push.

Then, as the strong model or a human: run the card's check yourself, run every suite
(`node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs && node conjure-test.mjs && node forge-test.mjs`),
read the diff for anything outside the card's files, and record the card in `docs/forge/ROADMAP.md`
§3. A card that needs a check changed goes back to the strong model; the weak model never edits a check.

## Cards

| Card | Job | Ready? | Check |
|---|---|---|---|
| [01](01-gallery.md) | A page that draws every stage, for picking candidates | Open (inherited from Conjure, still useful) | `node tasks/checks/t01.mjs` |
| [02](02-gem-count-rule.md) | A judge rule: every stage has exactly 3 gems | Open (inherited) | `node tasks/checks/t02.mjs` |
| [03](03-good.md) | Three new characters: 女 + 子 = 好 | **Do not hand out.** 女 子 好 were added another way; its check is stale (it wants 好 as `folk` and 22 characters) | `node tasks/checks/t03.mjs` |
| [04](04-forge-board.md) | The forge on the board (ROADMAP F3.2): placement labels, marks, forge burst, variant forms, dusk | **Done** 2026-11-18 | `node tasks/checks/t04.mjs` |
| [05](05-playlog.md) | Read the playtest log: the G1 numbers in one command | **Done** 2026-11-18 | `node tasks/checks/t05.mjs` |
| [06](06-characters-1.md) | Character batch 1: 口 十 田 土 and 呆 杏 果 叶 古 早 赤 灶 (data only) | **Done** 2026-11-18 (土 and 田 later became `earth`, so its two data items for them now fail by design) | `node tasks/checks/t06.mjs` |
| [07](07-old-leaf.md) | Candidate isle `old-leaf`: 十 on 口 makes 古 | **Done** 2026-11-18, then promoted to `content/stages/` (its check's "stays a candidate" item now fails by design) | `node tasks/checks/t07.mjs` |
| — | Body forging on the board (F4.3) | Done by the strong model | `node tasks/checks/t08.mjs` |
| — | Element effects on the board (dispel, earth) | Done by the strong model | `node tasks/checks/t09.mjs` |

No card is open for a weak model right now. Good next cards: a gallery page (01), the gem-count rule (02), and effects for the folk characters once their design is approved (see `docs/forge/RETROSPECTIVE.md` §5).

## What a weak model cannot take (yet)

| Work | Why not | Unblocks when |
|---|---|---|
| G1 playtest (F3.4) | Needs people and phones, and a keep / retune / kill call | People are available (everything it needs is built) |
| G2 playtest (F4.5) | Needs 2 to 4 people | Body forging is built (`on-my-shoulders`) |
| Judge and lint (Phase 5), new elements with effects (CONTENT §3: dusk's cousins, frame, bind, mind) | Sim and judge code | Phase 4 is closed |
| Moving a candidate into `content/stages/` and `order.json` | A stage-design decision | The strong model or John plays it |
| Knob values in `FORGE` | Tuned from playtest numbers only (PLAYTEST §3) | After G1 |

## Writing a new card

Name the files that may change, give one worked example of input and output, and write the check
first. Prove the check can pass (do the work in a scratch copy, run the check, throw the work away)
before handing the card out. A card without a check is not ready to hand out.
