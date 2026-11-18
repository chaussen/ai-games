"""Re-subset the brush font (Ma Shan Zheng, OFL) to every character the 2D game shows.

  ~/.venv/bin/python tools/font.py <full MaShanZheng-Regular.ttf>   rebuild vendor/MaShanZheng-subset.woff2
  ~/.venv/bin/python tools/font.py --check                          exit 1 if a shown character is missing

Copied from games/tongzhou-forge/tools/font.py and pointed at this folder's files. The full font (about
6 MB, github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf) is never committed:
download it once outside the repo and pass its path. The subset keeps everything it held before plus
every Han character in content.js, isles.js, app.js and index.html.
"""
import os, re, sys
from fontTools.ttLib import TTFont
from fontTools import subset

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "vendor", "MaShanZheng-subset.woff2")
CHARS = os.path.join(HERE, "vendor", "MaShanZheng-subset.chars.txt")
HAN = re.compile(r"[⺀-⿟　-〿㐀-䶿一-鿿豈-﫿]")
SOURCES = ("content.js", "isles.js", "app.js", "index.html", "rules.js")


def wanted():
    out = set()
    for f in SOURCES:
        p = os.path.join(HERE, f)
        if os.path.exists(p):
            out |= set(HAN.findall(open(p, encoding="utf-8").read()))
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
