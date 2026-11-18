# Task cards

One card = one small job with a check that says `DONE`. Give a model `AGENTS.md` and exactly one card.

| Card | Job | Check |
|---|---|---|
| [01](01-gallery.md) | A page that draws every stage, for picking candidates | `node tasks/checks/t01.mjs` |
| [02](02-gem-count-rule.md) | A judge rule: every stage has exactly 3 gems | `node tasks/checks/t02.mjs` |
| [03](03-good.md) | Three new characters: 女 + 子 = 好 | `node tasks/checks/t03.mjs` |
| [04](04-forge-board.md) | The forge on the board (ROADMAP F3.2): placement labels, marks, forge burst, variant forms, dusk | `node tasks/checks/t04.mjs` |

Writing a new card: name the files that may change, give one worked example of input and output,
and write the check first. A card without a check is not ready to hand out.
