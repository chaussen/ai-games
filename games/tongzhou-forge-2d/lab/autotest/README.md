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
# session 2
python3 lab/autotest/lockstep-repeat.py 3491         # same touch script, free loop vs ?lockstep=1: bit-exact?
node lab/autotest/personas.mjs 10 [isle-id]          # every route x persona (human.mjs motor channel) x seeds
node lab/autotest/ablate.mjs friends clouds_up 3     # which part of the motor model breaks a route
node lab/autotest/trace.mjs friends clouds_up 1      # frame trace of a route with N frames of input delay
node lab/autotest/clone-probe.mjs                    # can the World be deep-copied for a search mind?
# session 3: a mind that recovers (no script)
node lab/autotest/mind-zero.mjs [isle-id] [-v]       # acceptance 1: every isle, zero noise (≈2.5 min)
node lab/autotest/mind-personas.mjs 8 [isle-id ...]  # acceptance 2: isle x persona x seeds, 7 workers (≈13 min)
MAX=120 node lab/autotest/mind-ablate.mjs burn kid 6 # which motor noise costs a persona time on an isle
node lab/autotest/mind-trace.mjs dawn kid 1000       # one run: the mind's plan log, events, restarts, end state
node lab/autotest/friends-trap.mjs 200               # Friends: back up the pillar from its far side? (random thumb)
```

`mind.mjs` is the search mind: a stateless plan from the recipe tree (deliver, make, clear a wall or gap,
send a stranded stone home by the river), a navigation graph whose edges are simulated moves on world
copies, and a per-0.2 s choice of the move with the least time + cost-to-go. It drives `human.mjs` like
the route bots do, allows for its persona's median latency (`handsOf`), and restarts the isle when stuck.
`mind-personas.json` is the raw output of the last sweep (the numbers in `docs/AUTOTEST.md` §5, S3).

`human.mjs` is the motor channel (timing, stick, taps); any mind that drives a `World` can run through it.
Where the research stands and what's next: `docs/AUTOTEST-HANDOFF.md`.

`see-sun.claude.txt` is a headless Claude read of `see-sun.png` from pixels only (prompt in `docs/AUTOTEST.md` §5);
compare it with `see-sun.truth.json` (image pixels are 2× the CSS pixels in the truth file).
