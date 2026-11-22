# One Stroke 一笔 is obsolete (John, 2026-11-22)

John's verdict after playtest: the One Stroke version is too clumsy, in style, in design and in gameplay. The movement looks stiff;
the stick man was meant to be simple, small and supple but is big and awkward.

**Status:** obsolete. **Do not touch it for now.** That means:

- `cut.js`, `docs/design/one-stroke/`, `docs/ART-BRIEF-ONE-STROKE.md`, the `?art=cut` switch and the board's One Stroke chip, and
  `board-2d-onestroke` stay in the repo and still load; nothing is deleted or edited.
- It is not maintained: new elements (`C R D M L W V`, 云 风 …) get no One Stroke drawing; a missing drawing falls back to nothing
  or the greybox shape. It may look wrong after the upgrade; that is expected.
- Its screen tests are no longer part of the contract. The maintained looks are the **ink scroll** (default) and the **greybox**
  (for testing). Run `node screen-test.mjs` (ink) and `ART=greybox node screen-test.mjs`; do not run `ART=cut`.
- Keep `cut.js` loading without errors: it reads `world` fields; when the sim changes a field, keep or stub it. Do not edit `cut.js` to repair it.
- A future decision to revive, redesign or delete it belongs to John. It is not a blocker for anything in this upgrade.

The earlier direction note in `../../../TONGZHOU.md` ("both looks must keep working") is superseded by this page.
