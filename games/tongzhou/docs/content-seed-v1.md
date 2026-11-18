# 同舟 — Content Seed v1

Fingerprint: TZ-CS-v1.8 (2026-11-12). Chinese content reviewed by John 2026-11-11; 好 marked as a polyphone (TZ-D041). Companion to `charter-v1.md`.
Purpose: enough content for the paper prototype (G0) and the first digital slices (M2–M4). John reviews all Chinese before use; he is the content authority.

## 1. Components (tiles)

`variants` = the form the tile takes in a slot. Unlisted slots keep the base form.

| id | base | variants | Chinese name | pinyin (standalone) | domain tag | level |
|---|---|---|---|---|---|---|
| ri | 日 | — | 日字旁 | rì | light | 1 |
| yue | 月 | — | 月字旁 | yuè | light | 1 |
| mu | 木 | — | 木字旁 | mù | wood | 1 |
| huo | 火 | — | 火字旁 | huǒ | fire | 1 |
| shui | 水 | left: 氵 | 三点水 | shuǐ | water | 1 |
| ren | 人 | left: 亻 | 单人旁 | rén | people | 1 |
| kou | 口 | — | 口字旁 | kǒu | mouth | 1 |
| nv | 女 | — | 女字旁 | nǚ | people | 1 |
| zi | 子 | — | — | zǐ | people | 1 |
| men | 门 | — | 门字框 | mén | gate | 1 |
| mu4 | 目 | — | 目字旁 | mù | see | 1 |
| shan | 山 | — | — | shān | earth | 1 |
| shi | 石 | — | 石字旁 | shí | earth | 1 |
| tian | 田 | — | — | tián | earth | 1 |
| li | 力 | — | — | lì | force | 1 |
| xiao | 小 | — | — | xiǎo | — | 1 |
| da | 大 | — | — | dà | — | 1 |
| sheng | 生 | — | — | shēng | — | 1 |
| xin | 心 | left: 忄 | 竖心旁 | xīn | feeling | 2 |
| yan | 言 | left: 讠 | 言字旁 | yán | speech | 2 |
| shou | 手 | left: 扌 | 提手旁 | shǒu | hand | 2 |
| zu | 足 | left: ⻊ | 足字旁 | zú | move | 2 |
| shi2 | 食 | left: 饣 | 食字旁 | shí | food | 2 |
| qing | 青 | — | — | qīng | (phonetic) | 2 |
| bao | 包 | — | — | bāo | (phonetic) | 2 |
| ding | 丁 | — | — | dīng | (phonetic) | 2 |
| ke | 可 | — | — | kě | (phonetic) | 2 |

## 2. Characters

Structure codes: `LR` left-right, `TB` top-bottom, `ENC` enclosure (outside, inside). Parts are listed in slot order.

### 2.1 Level 1: compounds made of whole characters

| char | pinyin | structure | parts | meaning | effect tags |
|---|---|---|---|---|---|
| 明 | míng | LR | 日 月 | bright | light |
| 林 | lín | LR | 木 木 | woods | wood, shelter |
| 休 | xiū | LR | 人 木 | rest | rest |
| 好 | hǎo; also hào | LR | 女 子 | good; (hào) to be fond of | cheer (both readings until John authors a separate effect) |
| 从 | cóng | LR | 人 人 | follow | follow |
| 问 | wèn | ENC | 门 口 | ask | ask |
| 闪 | shǎn | ENC | 门 人 | flash, dodge | dodge, light |
| 男 | nán | TB | 田 力 | man | force |
| 炎 | yán | TB | 火 火 | blazing | fire |
| 岩 | yán | TB | 山 石 | rock | earth |
| 尖 | jiān | TB | 小 大 | sharp | pierce |
| 星 | xīng | TB | 日 生 | star | light, guide |
| 呆 | dāi | TB | 口 木 | dazed | daze |
| 杏 | xìng | TB | 木 口 | apricot | food |

呆 and 杏 use the same two tiles. Only the slot differs. This pair is the first lesson in structure.

### 2.2 Level 2: phonetic families

| char | pinyin | structure | parts | meaning | effect tags |
|---|---|---|---|---|---|
| 跑 | pǎo | LR | 足 包 | run | speed |
| 抱 | bào | LR | 手 包 | hug, hold | hold |
| 泡 | pào | LR | 水 包 | bubble | float |
| 饱 | bǎo | LR | 食 包 | full | food |
| 炮 | pào | LR | 火 包 | cannon | blast |
| 清 | qīng | LR | 水 青 | clear | water-clear |
| 请 | qǐng | LR | 言 青 | please, invite | polite |
| 情 | qíng | LR | 心 青 | feeling | calm |
| 晴 | qíng | LR | 日 青 | sunny | weather-clear |
| 睛 | jīng | LR | 目 青 | eyeball | see |
| 灯 | dēng | LR | 火 丁 | lamp | light |
| 打 | dǎ | LR | 手 丁 | hit | strike |
| 叮 | dīng | LR | 口 丁 | sting, ding | alarm |
| 盯 | dīng | LR | 目 丁 | stare | see |
| 河 | hé | LR | 水 可 | river | water-add |

Design notes on the families:

- 包 family is the showpiece for P4. Same sound frame, five radicals, five clearly different effects.
- 青 family carries tone play: 清 qīng, 请 qǐng, 情/晴 qíng. A call of "qíng" still needs a second cue ("日字旁" or "sunny") to separate 情 and 晴.
- 睛 is saved for a set piece: 画龙点睛. Casting it at the Dragon Gate gives the boat's dragon its eyes.

## 3. Default effects by radical domain (wild characters)

| domain tag | default effect |
|---|---|
| water | Small rise in river level |
| fire | Brief light; dries nearby fog |
| wood | A tree grows on the bank |
| light | Short reveal of lookahead |
| people | +1 气 |
| mouth, speech | Nearest creature or person turns to listen |
| feeling | +1 气 |
| hand | Pulls nearest flotsam closer |
| move | Short speed burst |
| food | +1 气 |
| earth | A stone drops ahead in the lane |
| see | Reveals one hidden tile in flotsam |
| gate | Nearest gate rattles |
| force | Next strike or blast is stronger |

## 4. Encounters (seed)

| id | name | effect while aboard (on top of the standard 气 drain) | notes |
|---|---|---|---|
| fog | 雾 Fog | Dims the far half of the river | |
| night | 夜 Night | Incoming things stay hidden until close | |
| fire | 火 Fire on the water | Burns one random tile every 20 s | |
| rocks | 石 Rocks | Boat speed halved | |
| gate | 闸 Sluice gate + keeper | Boat held still | Keeper is a person; speech works |
| shallow | 旱 Shallows | Boat speed halved | |
| beast | 兽 River beast | Double 气 drain | Creature; feeling and speech work |
| hunger | 饿 Hunger | Double 气 drain | Crew status, not an object |

An encounter that reaches the boat unanswered is a trouble aboard and stays until solved (TZ-D032, D033). These effects are starting guesses for tuning.

## 5. Effect matrix (seed)

S = solves, P = partial, B = backfire, · = flavour only. Text in brackets is what players see happen.

| tag ↓ / encounter → | fog | night | fire | rocks | gate | shallow | beast | hunger |
|---|---|---|---|---|---|---|---|---|
| light | P (thins) | S | · | · | · | · | P (startled) | · |
| weather-clear | S | P (moon out) | · | · | · | B (hotter, shallower) | · | · |
| water-clear | P | · | · | P (rocks visible, lane hint) | · | · | · | · |
| water-add | · | · | S (doused) | P (rides higher) | · | S | · | · |
| float | · | · | P (hops over, singed) | S (floats over) | · | S | · | · |
| fire | P (burns off) | P (torchlight) | B (bigger) | · | · | · | P (scared) | · |
| wood, shelter | · | · | B (feeds fire) | · | · | · | P (hides boat) | · |
| blast | · | · | · | S (shattered) | B (keeper furious, gate barred longer) | · | S (flees) | · |
| strike | · | · | · | P | B | · | P | · |
| pierce | · | · | · | P | · | · | P | · |
| speed | · | · | P (dash through) | B (crash, worse) | · | · | S (outrun) | · |
| dodge | · | · | P | S | · | · | S | · |
| hold | · | · | · | · | · | · | P (calms when hugged) | · |
| polite | · | · | · | · | S (opens) | · | · | · |
| ask | · | · | · | · | P (keeper says what he wants) | · | · | · |
| calm, cheer | · | · | · | · | P | · | S (tamed, follows boat) | P |
| food | · | · | · | · | P (bribe) | · | S (fed, leaves) | S |
| rest | · | · | · | · | · | · | B (caught napping) | P |
| see | P | P | · | P (lane hint) | · | · | · | · |
| daze | B (crew stunned, 5 s no input) | B | B | B | B | B | S (beast dazed too) | B |
| guide | S (star to steer by) | S | · | · | · | · | · | · |
| alarm | · | · | · | · | P (wakes sleeping keeper) | · | B (angers) | · |
| force, follow, earth | · | · | · | · | · | · | · | · |

Rules for authors extending the matrix:

1. Every encounter needs at least 3 different solving tags from at least 2 radical domains.
2. Every encounter needs at least 1 backfire.
3. No tag may solve more than half of all encounters.
4. A blank cell falls back to the domain default in §3. Nothing is ever inert.

## 6. Paper prototype kit (Gate G0)

No devices. 3–4 players, one facilitator (John), 20 minutes per session, three sessions with different groups.

### 6.1 Materials

| Item | Count | Detail |
|---|---|---|
| Tile cards | 2 of each component in §1 | Glyph only on the face. Pinyin and Chinese name small on the back for L1 players. |
| Encounter cards | 8 | From §4. Picture or word. |
| Whiteboard or A3 sheet + one marker | 1 | The forge and the inking pad |
| Matrix sheet | 1 | §5, facilitator only |
| Timer | 1 | 60 s between blind draws; 8 minutes per run |
| Lookup sheet | 1 | Character, pinyin, meaning. Facilitator only. |
| Blank slips | 20 | For characters in the hold |
| Operator cards | 5 | 不 很 太 吗 了, for G0b only |
| Tally sheet | 1 | See 6.4 |

### 6.2 Rules (forward play, v1.2)

1. Deal 4 tiles each (5 for a pair), hidden. Mark a hold on the table: 2 places for a pair, 3 otherwise. Shuffle the encounter cards face down. A run is 8 minutes.
2. Every 60 seconds the facilitator draws one encounter card blind and lays it face up. It stays visible until solved. If 4 are face up (3 for a pair), the boat is bogged: draw no more until one is cleared.
3. **Forge and tackle when ready.** Players may say anything but show nothing. To try a combination, each places a tile **face down** on the board in position (left/right, top/bottom, outside/inside), then both flip.
4. Not a character in the lookup: the facilitator slides the tiles back. No comment, no cost.
5. A character: the facilitator says it once and gives its meaning from the lookup sheet. Players write it on the board **one stroke each; nobody writes twice in a row**. Out-of-order strokes are not corrected; the facilitator quietly marks it crisp, loose or wild.
6. The facilitator points at a player who did not write the last stroke. That player repeats the character with its tone.
7. Write the character and its meaning on a slip and put it in the hold. If the hold is full, make room by discarding a slip first. Used tiles are discarded; draw back to full hand.
8. **Tackle.** At any time the crew may spend one slip from the hold on any face-up encounter. The facilitator narrates the outcome from the matrix. Solve: remove the card. Partial: turn the card sideways; a second partial clears it. Backfire or flavour: the card stays. Score: cards cleared in 8 minutes.
9. Never say "wrong". Never say which character would work.

### 6.3 Retired

Track B (orders) was retired by TZ-D025 and is not tested.

### 6.4 Tally (facilitator)

| Observation | Count how |
|---|---|
| Tile requests by voice using a Chinese name or sound | Tick per request |
| Tile requests by English, pointing or showing | Tick per request |
| Unintended solutions (not the one the facilitator expected) | Tick + note |
| Laughs at an outcome | Tick |
| Longest idle stretch per player | Seconds |
| One player directing others' tiles | Tick per instance |
| Unprompted "again" or "one more" | Yes/No |

GO and NO-GO thresholds are in `charter-v1.md` §7. Log the verdict and the pair-fight result in the charter Decision Log.

### 6.5 Pair session (2 players, TZ-D013–D017)

Run both variants back to back with the same pair.

| Variant | Rules on top of Track A |
|---|---|
| River deck | Hand of 5. Two face-down draw piles, one per player; you draw only from yours and never show it. Every second encounter, each player passes their oldest unplayed tile face down into the other's pile (tide). |
| Crossed hands | Hand of 4, held facing outward: your partner sees the glyphs, you see only the pinyin pencilled on the backs. Shuffle your fan after every cast. Partner must tell you what to play by sound and slot. |

Extra tally for pairs: which variant produced more spoken Chinese per minute, and which one the pair asks to replay.

## 7. Content pack growth plan

| Pack | Size | Source | Gate |
|---|---|---|---|
| seed | 27 tiles, 29 characters, 8 encounters | This file | G0–G2 |
| L1 full | ~60 characters | John's beginner list | M6 |
| L2 families | ~15 phonetic families, ~90 characters | John + pipeline suggestions | M6 |
| wild | ~9,000 characters with default effects | Make Me a Hanzi dictionary (etymology field gives semantic and phonetic parts) | M6 |
| book pack | One whole textbook list, mixed | John's list through `make-pack` with fit report; lesson tags optional | M6 |

## 8. Operators (seed, shared by all packs; John to review)

Operators are whole tiles. Once inked and in the hold, an operator is spent onto another held character.

| Word | pinyin | Op | Effect on the held character | Paper narration |
|---|---|---|---|---|
| 不 | bù | invert | Reverses its effect | "The opposite happens." |
| 很 | hěn | scale | Stronger (×1.5) | "A big one." |
| 太 | tài | overshoot | Far too strong: solves become backfires by excess | "Too much!" |
| 吗 | ma | preview | Asks instead of doing: shows the outcome without spending the character | Facilitator says what would happen; slip stays |
| 了 | le | instant | Takes effect at once, even before arrival | Resolve the horizon card now |
| 再 | zài | repeat | Repeats the last character spent | Reuse the last slip |
| 也 | yě | carryOver | The effect also applies to the next encounter | Keep the slip for one more card |

G0b uses only 不 很 太 吗 了.

## 9. Fitting a vocabulary list

| Class | Test | Result |
|---|---|---|
| Operator | Entry is in §8 | Whole tile, operator |
| Word | Entry has two or more characters | Each character classified separately; word forms in the hold |
| Thing or action | Entry has authored tags | Matrix effects |
| Default | Entry has a semantic radical but no authored tags | Domain default from §3 |
| Whole tile | Entry cannot be split into two known components | Arrives as its own tile |
| Unclassified | None of the above | Listed in the fit report for John |

## 10. Every character the seed tiles can make (wild list)

Generated 2026-11-12 from the Make Me a Hanzi dictionary: all real characters whose top level is exactly two seed tiles. 107 characters: 29 seed, 78 others. Traditional and Japanese-only forms were removed. "common" is Chat's guess at everyday characters; John decides which to keep, which to hide as too obscure, and which deserve authored effects. Machine-readable copy: `wild-seed.json`. Glosses are the dictionary's, cut at 60 characters.

| Character | Pinyin | Structure | Parts (slot order) | Dictionary gloss | Note |
|---|---|---|---|---|---|
| 仂 | lè | LR | 人 力 | excess, remainder, surplus |  |
| 仃 | dīng | LR | 人 丁 | lonely, solitary |  |
| 仌 | bīng | TB | 人 人 | frozen; ice-cold |  |
| 从 | cóng | LR | 人 人 | from, by, since, whence, through | seed |
| 仔 | zǐ | LR | 人 子 | small thing, child; young animal | common |
| 仙 | xiān | LR | 人 山 | god; fairy; immortal, transcendent | common |
| 们 | men | LR | 人 门 | plural marker for pronouns and some nouns | common |
| 休 | xiū | LR | 人 木 | to rest; to stop; to retire | seed |
| 伙 | huǒ | LR | 人 火 | companion, colleague; utensils | common |
| 佃 | diàn | LR | 人 田 | tenant farmer; to be a tenant farmer |  |
| 何 | hé | LR | 人 可 | what, why, where, which, how | common |
| 促 | cù | LR | 人 足 | to urge, to rush, to hurry; hasty; near, close | common |
| 信 | xìn | LR | 人 言 | to trust, to believe; letter, sign | common |
| 倩 | qiàn | LR | 人 青 | beautiful, lovely; son-in-law |  |
| 冒 | mào | TB | 日 目 | to risk, to brave, to dare | common |
| 加 | jiā | LR | 力 口 | to add to, to increase, to augment | common |
| 另 | lìng | TB | 口 力 | another; separate, other | common |
| 叮 | dīng | LR | 口 丁 | to persistently exhort or urge; sting (as of an insect) | seed |
| 叻 | lè | LR | 口 力 | used in transliterations |  |
| 吕 | lǚ | TB | 口 口 | a musical note; surname |  |
| 吣 | qìn | LR | 口 心 | to vomit |  |
| 呆 | dāi | TB | 口 木 | dull, simple, stupid | seed |
| 呵 | hē | LR | 口 可 | to scold; to yawn; the sound of someone laughing (when repea |  |
| 咆 | páo | LR | 口 包 | to roar |  |
| 哥 | gē | TB | 可 可 | elder brother | common |
| 唁 | yàn | LR | 口 言 | to offer condolences |  |
| 夯 | hāng | TB | 大 力 | burden, load; to lift up; to tamp down |  |
| 奇 | qí | TB | 大 可 | strange, unusual, odd; uncanny, occult | common |
| 奋 | fèn | TB | 大 田 | to strive, to exert effort; to arouse |  |
| 好 | hǎo | LR | 女 子 | good, excellent, fine; proper, suitable; well | seed |
| 如 | rú | LR | 女 口 | as, as if, like, such as, supposing | common |
| 妟 | yàn | TB | 日 女 | banquet, feast; to entertain |  |
| 姓 | xìng | LR | 女 生 | name, family name, surname; clan, people | common |
| 婧 | jìng | LR | 女 青 | modest; supple |  |
| 孙 | sūn | LR | 子 小 | grandchild, descendent; surname | common |
| 孢 | bāo | LR | 子 包 | spore |  |
| 尖 | jiān | TB | 小 大 | sharp, pointed, acute; keen, shrewd | seed |
| 屾 | shēn | LR | 山 山 | mountain range |  |
| 岢 | kě | TB | 山 可 | the name of a mountain |  |
| 岩 | yán | TB | 山 石 | cliff; rocks; mountain | seed |
| 忕 | shì | LR | 心 大 | habit; accustomed to |  |
| 思 | sī | TB | 田 心 | to think, to ponder, to consider; final particle | common |
| 性 | xìng | LR | 心 生 | sex, nature, character; suffix converting a verb to an adjec | common |
| 情 | qíng | LR | 心 青 | emotion, feeling, sentiment | seed |
| 打 | dǎ | LR | 手 丁 | to attack, to beat, to hit, to strike | seed |
| 扣 | kòu | LR | 手 口 | to detain; to knock, to tap; button | common |
| 扪 | mén | LR | 手 门 | to stoke, to pat; to grope, to feel |  |
| 抱 | bào | LR | 手 包 | to embrace, to hold in one's arms; to enfold | seed |
| 拓 | tà | LR | 手 石 | to develop, to expand, to open up |  |
| 拜 | bài | LR | 手 手 | to bow, to salute; to worship, to pay respects | common |
| 捉 | zhuō | LR | 手 足 | to clutch, to grasp, to seize | common |
| 旲 | tái | TB | 日 大 | daylight, sunlight |  |
| 明 | míng | LR | 日 月 | bright, clear; to explain, to understand, to shed light | seed |
| 星 | xīng | TB | 日 生 | star, planet; a point of light | seed |
| 晴 | qíng | LR | 日 青 | clear weather, fine weather | seed |
| 朋 | péng | LR | 月 月 | friend, pal, acquaintance | common |
| 李 | lǐ | TB | 木 子 | plum; luggage; surname | common |
| 杏 | xìng | TB | 木 口 | apricot; almond | seed |
| 杰 | jié | TB | 木 火 | hero; heroic, outstanding | common |
| 杲 | gǎo | TB | 日 木 | brilliant, shining; high |  |
| 杳 | yǎo | TB | 木 日 | dark, mysterious, obscure; deep |  |
| 林 | lín | LR | 木 木 | forest, grove; surname | seed |
| 果 | guǒ | TB | 田 木 | fruit, nut; result | common |
| 柘 | zhè | LR | 木 石 | cudrania, mulberry; sugarcane |  |
| 柯 | kē | LR | 木 可 | axe-handle, bough, stalk; surname |  |
| 氽 | tǔn | TB | 人 水 | to float; to deep-fry |  |
| 汀 | tīng | LR | 水 丁 | bank, sandbar; beach, shore |  |
| 汕 | shàn | LR | 水 山 | bamboo; basket for catching fish; Shantou |  |
| 汝 | rǔ | LR | 水 女 | you |  |
| 汨 | mì | LR | 水 日 | to sink; a river in Hunan where Qu Yuan drowned himself |  |
| 沁 | qìn | LR | 水 心 | to soak, to seep in, to percolate |  |
| 沐 | mù | LR | 水 木 | to bathe, to cleanse, to shampoo, to wash |  |
| 沓 | tà | TB | 水 日 | connected, joined; repeated |  |
| 河 | hé | LR | 水 可 | river, stream; the Yellow river | seed |
| 泡 | pào | LR | 水 包 | bubble, blister; swollen, puffed up | seed |
| 泪 | lèi | LR | 水 目 | tears; to cry, to weep | common |
| 泵 | bèng | TB | 石 水 | to pump |  |
| 浞 | zhuó | LR | 水 足 | to soak, to steep in water |  |
| 清 | qīng | LR | 水 青 | clean, pure; clear, distinct; peaceful | seed |
| 灯 | dēng | LR | 火 丁 | lamp, lantern, light | seed |
| 灿 | càn | LR | 火 山 | vivid, illuminating, brilliant |  |
| 炅 | jiǒng | TB | 日 火 | brilliant, shining |  |
| 炎 | yán | TB | 火 火 | flame, blaze; hot | seed |
| 炏 | kài | LR | 火 火 | grass |  |
| 炙 | zhì | TB | 月 火 | to roast, to broil; to cauterize |  |
| 炮 | pào | LR | 火 包 | cannon, artillery | seed |
| 炻 | shí | LR | 火 石 | china, stoneware |  |
| 男 | nán | TB | 田 力 | man, boy; male; baron; surname | seed |
| 町 | tīng | LR | 田 丁 | a raised path between fields |  |
| 盯 | dīng | LR | 目 丁 | to rivet one's gaze upon; to keep eyes on | seed |
| 相 | xiāng | LR | 木 目 | mutual, reciprocal; equal; each other | common |
| 看 | kàn | TB | 手 目 | to look, to see; to examine, to scrutinize | common |
| 眚 | shěng | TB | 生 目 | cataract; fault, error, crime |  |
| 睛 | jīng | LR | 目 青 | eyeball; pupil | seed |
| 订 | dìng | LR | 言 丁 | to make an order; to draw up an agreement | common |
| 认 | rèn | LR | 言 人 | to know, to recognize, to understand | common |
| 讪 | shàn | LR | 言 山 | to abuse, to slander, to vilify; to ridicule |  |
| 诃 | hē | LR | 言 可 | to scold loudly, to curse, to abuse |  |
| 请 | qǐng | LR | 言 青 | to ask, to request; to invite; please | seed |
| 跑 | pǎo | LR | 足 包 | to run, to flee, to escape | seed |
| 跖 | zhí | LR | 足 石 | the sole of the foot |  |
| 闪 | shǎn | ENC | 门 人 | flash, lightning; to dodge, to evade | seed |
| 问 | wèn | ENC | 门 口 | to ask about, to inquire after | seed |
| 闲 | xián | ENC | 门 木 | fence, guard; to defend; idle time | common |
| 间 | jiān | ENC | 门 日 | between, among; midpoint; space, place, locality | common |
| 闷 | mèn | ENC | 门 心 | gloomy, depressed, melancholy | common |
| 饱 | bǎo | LR | 食 包 | satisfied; to eat one's fill | seed |
