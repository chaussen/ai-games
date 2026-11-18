# Task 02 — a judge rule: exactly three gems

**Goal.** The result screen shows three gem slots, so every stage must have exactly 3 gems.
Make the judge say so.

**You may create:** `tools/judge/rules/gem-count.mjs` (one file). **Change nothing else.**

## How rules work

Every `.mjs` file in `tools/judge/rules/` is loaded by the judge. It must look like this:

```js
export default {
  id: 'gem-count',                    // becomes the problem code
  check(stage, add) {
    // stage is the parsed JSON. Call add(where, msg) once for each problem.
    // where: the field name, here 'gems'.
    // msg: one sentence saying what is wrong and what to do.
  }
};
```

## The rule

- `stage.gems` missing counts as 0 gems.
- If the count is not 3, call `add('gems', msg)`. The message must contain the count found and the
  number 3, for example: `this stage has 2 gems; every stage needs exactly 3.`
- If the count is 3, do nothing.

**Done when** `node tasks/checks/t02.mjs` ends with `--- TASK 02 DONE ---`.
