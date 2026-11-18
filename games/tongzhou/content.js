// 同舟 V0.2 content, transcribed from docs/content-seed-v1.md (TZ-CS-v1.8) §1-§5.
// Pure data. English outcome lines are placeholders; John is the content authority.

// §1 tiles: id, base glyph, left-slot variant, standalone pinyin, radical domain.
export const TILES = [
  ['ri', '日', null, 'rì', 'light'], ['yue', '月', null, 'yuè', 'light'],
  ['mu', '木', null, 'mù', 'wood'], ['huo', '火', null, 'huǒ', 'fire'],
  ['shui', '水', '氵', 'shuǐ', 'water'], ['ren', '人', '亻', 'rén', 'people'],
  ['kou', '口', null, 'kǒu', 'mouth'], ['nv', '女', null, 'nǚ', 'people'],
  ['zi', '子', null, 'zǐ', 'people'], ['men', '门', null, 'mén', 'gate'],
  ['mu4', '目', null, 'mù', 'see'], ['shan', '山', null, 'shān', 'earth'],
  ['shi', '石', null, 'shí', 'earth'], ['tian', '田', null, 'tián', 'earth'],
  ['li', '力', null, 'lì', 'force'], ['xiao', '小', null, 'xiǎo', null],
  ['da', '大', null, 'dà', null], ['sheng', '生', null, 'shēng', null],
  ['xin', '心', '忄', 'xīn', 'feeling'], ['yan', '言', '讠', 'yán', 'speech'],
  ['shou', '手', '扌', 'shǒu', 'hand'], ['zu', '足', '⻊', 'zú', 'move'],
  ['shi2', '食', '饣', 'shí', 'food'], ['qing', '青', null, 'qīng', null],
  ['bao', '包', null, 'bāo', null], ['ding', '丁', null, 'dīng', null],
  ['ke', '可', null, 'kě', null]
].map(function (t) { return { id: t[0], base: t[1], left: t[2], pinyin: t[3], domain: t[4] }; });

// §2 seed characters: short meaning, picture, effect tags.
export const SEED = {
  '明': ['bright', '💡', ['light']], '林': ['woods', '🌲', ['wood', 'shelter']],
  '休': ['rest', '😴', ['rest']], '好': ['good', '👍', ['cheer']],
  '从': ['follow', '👣', ['follow']], '问': ['ask', '❓', ['ask']],
  '闪': ['flash, dodge', '⚡', ['dodge', 'light']], '男': ['man', '💪', ['force']],
  '炎': ['blazing', '🔥', ['fire']], '岩': ['rock', '⛰️', ['earth']],
  '尖': ['sharp', '📌', ['pierce']], '星': ['star', '⭐', ['light', 'guide']],
  '呆': ['dazed', '😵', ['daze']], '杏': ['apricot', '🍑', ['food']],
  '跑': ['run', '🏃', ['speed']], '抱': ['hug, hold', '🤗', ['hold']],
  '泡': ['bubble', '🫧', ['float']], '饱': ['full', '😋', ['food']],
  '炮': ['cannon', '💥', ['blast']], '清': ['clear', '💧', ['water-clear']],
  '请': ['please, invite', '🙏', ['polite']], '情': ['feeling', '❤️', ['calm']],
  '晴': ['sunny', '☀️', ['weather-clear']], '睛': ['eyeball', '👁️', ['see']],
  '灯': ['lamp', '🏮', ['light']], '打': ['hit', '👊', ['strike']],
  '叮': ['sting, ding', '🔔', ['alarm']], '盯': ['stare', '👀', ['see']],
  '河': ['river', '🌊', ['water-add']]
};

// §4 encounters. drain = multiplier on the standard 气 drain; slow = speed multiplier.
export const ENCOUNTERS = {
  fog: { label: 'Fog', picture: '🌫️', veil: 'fog' },
  night: { label: 'Night', picture: '🌙', veil: 'night' },
  fire: { label: 'Fire on the water', picture: '🔥', burns: true },
  rocks: { label: 'Rocks', picture: '🪨', slow: 0.5 },
  gate: { label: 'Sluice gate and keeper', picture: '⛩️', slow: 0 },
  shallow: { label: 'Shallows', picture: '🏜️', slow: 0.5 },
  beast: { label: 'River beast', picture: '🐉', drain: 2 },
  hunger: { label: 'Hunger', picture: '🍚', drain: 2 }
};

// §5 effect matrix. Cell = 'S' solve, 'P' partial, 'B' backfire, optionally '|what players see'.
const ROWS = {
  'light': { fog: 'P|the fog thins', night: 'S|the dark lifts', beast: 'P|the beast is startled' },
  'weather-clear': { fog: 'S|the sun burns the fog away', night: 'P|the moon comes out', shallow: 'B|hotter, and shallower still' },
  'water-clear': { fog: 'P|the air clears a little', rocks: 'P|the rocks show through the water' },
  'water-add': { fire: 'S|doused', rocks: 'P|the boat rides higher', shallow: 'S|the river fills' },
  'float': { fire: 'P|hops over, a little singed', rocks: 'S|the boat floats over', shallow: 'S|the boat bobs across' },
  'fire': { fog: 'P|some fog burns off', night: 'P|torchlight', fire: 'B|the fire grows', beast: 'P|the beast is scared' },
  'wood': { fire: 'B|the wood feeds the fire', beast: 'P|the trees hide the boat' },
  'shelter': { fire: 'B|the wood feeds the fire', beast: 'P|the trees hide the boat' },
  'blast': { rocks: 'S|shattered', gate: 'B|the keeper is furious and bars the gate', beast: 'S|the beast flees' },
  'strike': { rocks: 'P|a crack appears', gate: 'B|the keeper shouts back', beast: 'P|the beast flinches' },
  'pierce': { rocks: 'P|a chip flies off', beast: 'P|the beast backs away' },
  'speed': { fire: 'P|a dash through the flames', rocks: 'B|a crash: worse than before', beast: 'S|the boat outruns it' },
  'dodge': { fire: 'P|a near miss', rocks: 'S|the boat slips between them', beast: 'S|the beast snaps at air' },
  'hold': { beast: 'P|the beast calms when hugged' },
  'polite': { gate: 'S|the keeper bows and opens the gate' },
  'ask': { gate: 'P|the keeper says what he wants' },
  'calm': { gate: 'P|the keeper softens', beast: 'S|tamed: it follows the boat', hunger: 'P|the crew forgets its hunger for a while' },
  'cheer': { gate: 'P|the keeper softens', beast: 'S|tamed: it follows the boat', hunger: 'P|the crew forgets its hunger for a while' },
  'food': { gate: 'P|the keeper takes the bribe and thinks about it', beast: 'S|fed, it swims off', hunger: 'S|everyone eats' },
  'rest': { beast: 'B|caught napping', hunger: 'P|sleep dulls the hunger' },
  'see': { fog: 'P|shapes show in the fog', night: 'P|eyes adjust to the dark', rocks: 'P|a lane shows between the rocks' },
  'daze': { fog: 'B|the crew is stunned', night: 'B|the crew is stunned', fire: 'B|the crew stares at the flames', rocks: 'B|the crew stares at the rocks', gate: 'B|the keeper stares back', shallow: 'B|the crew is stunned', beast: 'S|the beast is dazed too', hunger: 'B|too dazed to cook' },
  'guide': { fog: 'S|a star to steer by', night: 'S|a star to steer by' },
  'alarm': { gate: 'P|the sleeping keeper wakes', beast: 'B|the noise angers it' }
};
const CODE = { S: 'solve', P: 'partial', B: 'backfire' };
export const MATRIX = {};
for (const tag in ROWS) {
  MATRIX[tag] = {};
  for (const enc in ROWS[tag]) {
    const cell = ROWS[tag][enc].split('|');
    MATRIX[tag][enc] = { result: CODE[cell[0]], text: cell[1] };
  }
}

// §3 default effect per radical domain (wild characters and blank cells).
// effect: 'qi' = +1 气, 'burst' = short speed burst, 'reveal' = lifts fog and night veils briefly.
export const DEFAULTS = {
  water: { text: 'the river rises a little' },
  fire: { text: 'a brief light dries the air', effect: 'reveal' },
  wood: { text: 'a tree grows on the bank' },
  light: { text: 'the way ahead shows for a moment', effect: 'reveal' },
  people: { text: 'the crew takes heart', effect: 'qi' },
  mouth: { text: 'something turns to listen' },
  speech: { text: 'something turns to listen' },
  feeling: { text: 'the crew takes heart', effect: 'qi' },
  hand: { text: 'driftwood is pulled closer' },
  move: { text: 'a short burst of speed', effect: 'burst' },
  food: { text: 'a snack for the crew', effect: 'qi' },
  earth: { text: 'a stone drops into the river ahead' },
  see: { text: 'something glints in the water' },
  gate: { text: 'a gate rattles somewhere' },
  force: { text: 'the crew feels stronger' },
  none: { text: 'it sinks with a quiet ripple' }
};
