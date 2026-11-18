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
| [04](04-forge-board.md) | The forge on the board (ROADMAP F3.2): placement labels, marks, forge burst, variant forms, dusk | **Ready.** Needed before the G1 playtest | `node tasks/checks/t04.mjs` |
| [05](05-playlog.md) | Read the playtest log: the G1 numbers in one command | **Ready.** Needed after the G1 playtest | `node tasks/checks/t05.mjs` |
| [06](06-characters-1.md) | Character batch 1: 口 十 田 土 and 呆 杏 果 叶 古 早 赤 灶 (data only) | **Ready** | `node tasks/checks/t06.mjs` |
| [07](07-old-leaf.md) | Candidate isle `old-leaf`: 十 on 口 makes 古 | After 06 | `node tasks/checks/t07.mjs` |

Cards 04, 05 and 06 touch different files and can run at the same time on separate models. 07 needs 06.

## What a weak model cannot take (yet)

| Work | Why not | Unblocks when |
|---|---|---|
| G1 playtest (F3.4) | Needs people and phones, and a keep / retune / kill call | People are available; 04 is done |
| Body forging sim (F4.1, F4.2), its stage and solver (F4.4) | Sim, judge and tests are strong-model work | G1 says keep |
| Body forging client (F4.3) | Its check can only be written once F4.2 exists | F4.2 is done (the strong model then writes card 08) |
| Judge and lint (Phase 5), new elements with effects (CONTENT §3: dusk's cousins, frame, bind, mind) | Sim and judge code | Phase 4 is closed |
| Moving a candidate into `content/stages/` and `order.json` | A stage-design decision | The strong model or John plays it |
| Knob values in `FORGE` | Tuned from playtest numbers only (PLAYTEST §3) | After G1 |

## Writing a new card

Name the files that may change, give one worked example of input and output, and write the check
first. Prove the check can pass (do the work in a scratch copy, run the check, throw the work away)
before handing the card out. A card without a check is not ready to hand out.
