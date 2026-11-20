# lab/autotest: spikes for the automated play-testing research

Throwaway experiments behind `docs/AUTOTEST.md` (read that first). They don't belong to the test suite. Each one
proves or disproves one technical claim against the real build. The server never serves this folder.

```sh
cd games/tongzhou-forge-2d
PORT=3491 HOST=127.0.0.1 node server.js &            # a test port, never 3000
python3 lab/autotest/lockstep.py 3491 lab/autotest   # pause the page clock, step it, real CDP touch, repeatability
node lab/autotest/monkey.mjs 20 60 1                 # seeded random player on all isles: speed, coverage, invariants
node lab/autotest/replay-dawn.mjs                    # replays the one flag the monkey raised (bridge lands on the hero)
python3 lab/autotest/see.py 3491 sun-and-moon lab/autotest/see-sun   # screenshot + sim ground truth for a "see" test
```

`see-sun.claude.txt` is a headless Claude read of `see-sun.png` from pixels only (prompt in `docs/AUTOTEST.md` §5);
compare it with `see-sun.truth.json` (image pixels are 2× the CSS pixels in the truth file).
