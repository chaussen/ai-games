"""Re-subset the brush font so it holds every character the game can draw.

  ~/.venv/bin/python tools/font.py <full MaShanZheng-Regular.ttf>   rebuild vendor/MaShanZheng-subset.woff2
  ~/.venv/bin/python tools/font.py --check                         exit 1 if a game character is missing

The full font (OFL, Google Fonts: github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf,
about 6 MB) is never committed: download it once anywhere outside the repo and pass its path.
The kept set = what the subset already holds (never drop a glyph) + every Han character in
content/ (glyphs, forms, stages, candidates), levels.js, app.js and index.html.
It also writes vendor/MaShanZheng-subset.chars.txt (the characters held), which smoke-test.mjs reads.
Needs fontTools with brotli (pip install fonttools brotli; both are in ~/.venv)."""
import glob, os, re, sys
from fontTools.ttLib import TTFont
from fontTools import subset

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "vendor", "MaShanZheng-subset.woff2")
CHARS = os.path.join(HERE, "vendor", "MaShanZheng-subset.chars.txt")
HAN = re.compile(r"[㐀-䶿一-鿿豈-﫿]")

def wanted():
    files = glob.glob(os.path.join(HERE, "content", "**", "*.json"), recursive=True)
    files += [os.path.join(HERE, f) for f in ("levels.js", "app.js", "index.html")]
    out = set()
    for f in files:
        if os.path.exists(f):
            out |= set(HAN.findall(open(f, encoding="utf-8").read()))
    return out

def held(path):
    return {chr(u) for u in TTFont(path).getBestCmap()}

def check():
    have = held(OUT)
    miss = sorted(wanted() - have)
    listed = set(open(CHARS, encoding="utf-8").read().rstrip("\n")) if os.path.exists(CHARS) else set()
    ok = not miss and listed == have
    if miss:
        print("missing from the brush font:", "".join(miss))
    if listed != have:
        print("vendor/MaShanZheng-subset.chars.txt is out of date (run tools/font.py <full font>)")
    print(f"brush font: {len(have)} characters, " + ("covers the game" if ok else "NOT OK"))
    return 0 if ok else 1

def build(full):
    src = held(full)
    keep = held(OUT) | wanted() | {chr(c) for c in range(0x20, 0x7f)}
    lost = sorted(c for c in keep - src if HAN.match(c))
    if lost:
        print("the full font lacks:", "".join(lost))
    keep &= src
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    font = TTFont(full)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[ord(c) for c in keep])
    sub.subset(font)
    font.flavor = "woff2"
    font.save(OUT)
    have = held(OUT)
    with open(CHARS, "w", encoding="utf-8") as f:
        f.write("".join(sorted(have)) + "\n")
    print(f"wrote {os.path.relpath(OUT, HERE)}: {len(have)} characters, {os.path.getsize(OUT)} bytes")
    return check()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__); sys.exit(2)
    sys.exit(check() if sys.argv[1] == "--check" else build(sys.argv[1]))
