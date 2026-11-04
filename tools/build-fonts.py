"""把網站用到的字型裁切成小檔，放在 assets/fonts/（不用再連 Google Fonts）。

用法：python3 tools/build-fonts.py <原始字型資料夾>
原始字型（都是 SIL Open Font License）：
  Huninn-Regular.ttf          https://github.com/justfont/Huninn
  NotoSansTC[wght].ttf        https://github.com/google/fonts/tree/main/ofl/notosanstc
  LXGWWenKaiTC-Regular.ttf / LXGWWenKaiTC-Bold.ttf  https://github.com/lxgw/LxgwWenkaiTC
每個字型切成兩份：
  -site  網站目前用到的所有字（每頁都會下載，很小）
  -more  Big5 常用字裡其他的字（只有頁面用到這些字時瀏覽器才會下載）
新增教材後，如果用了常用字以外的字，重跑一次這個腳本即可。
"""
import glob, hashlib, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]
OUT = os.path.join(ROOT, "assets", "fonts")
os.makedirs(OUT, exist_ok=True)

files = [os.path.join(ROOT, "index.html")] + glob.glob(os.path.join(ROOT, "lessons", "*.html")) \
      + glob.glob(os.path.join(ROOT, "lessons", "data", "*.js")) + glob.glob(os.path.join(ROOT, "assets", "*.js"))
site = set()
for f in files:
    site |= set(open(f, encoding="utf-8").read())
site |= set(chr(c) for c in range(0x20, 0x7F))
site |= set("，。、；：？！「」『』（）《》〈〉…—～·・　％＋－＝／０１２３４５６７８９")
site = {ord(c) for c in site if ord(c) >= 0x20}

more = set()
for hi in range(0xA4, 0xC7):            # Big5 第一級常用字 A440–C67E
    for lo in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
        try:
            more.add(ord(bytes([hi, lo]).decode("big5")))
        except UnicodeDecodeError:
            pass
        if hi == 0xC6 and lo >= 0x7E:
            break
more -= site

def ranges(cps):
    cps = sorted(cps); out = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        out.append("U+%X" % cps[i] if i == j else "U+%X-%X" % (cps[i], cps[j]))
        i = j + 1
    return ",".join(out)

FONTS = [  # (family, weight css, source, out name, variable axis limits)
    ("Huninn", "400", "Huninn-Regular.ttf", "huninn", None),
    ("Noto Sans TC", "400 700", "NotoSansTC[wght].ttf", "noto-sans-tc", {"wght": (400, 700)}),
    ("LXGW WenKai TC", "400", "LXGWWenKaiTC-Regular.ttf", "lxgw-wenkai-tc-400", None),
    ("LXGW WenKai TC", "700", "LXGWWenKaiTC-Bold.ttf", "lxgw-wenkai-tc-700", None),
]
css = ["/* 教室小書櫃｜自架字型（由 tools/build-fonts.py 產生，請勿手改）",
       "   Huninn 粉圓體、Noto Sans TC、LXGW WenKai TC 霞鶩文楷：皆為 SIL Open Font License 1.1，見 assets/fonts/OFL.txt */"]
for fam, wt, src, name, axes in FONTS:
    base = TTFont(os.path.join(SRC, src))
    if axes:
        base = instancer.instantiateVariableFont(base, axes)
    tmp = os.path.join(OUT, "_tmp.ttf"); base.save(tmp)
    for part, cps in (("more", more), ("site", site)):
        opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]
        opts.name_IDs = ["*"]; opts.notdef_outline = True; opts.drop_tables += ["DSIG"]
        f = subset.load_font(tmp, opts)
        s = subset.Subsetter(opts); s.populate(unicodes=cps); s.subset(f)
        fn = "%s-%s.woff2" % (name, part)
        subset.save_font(f, os.path.join(OUT, fn), opts)
        print(fn, os.path.getsize(os.path.join(OUT, fn)) // 1024, "KB")
        # 「more」先宣告、範圍寫寬；「site」後宣告優先使用，所以網站已用到的字只會下載 site 檔
        rng = "U+2E80-9FFF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FFEF" if part == "more" else ranges(cps)
        ver = hashlib.md5(open(os.path.join(OUT, fn), "rb").read()).hexdigest()[:8]  # 換字後網址會變，離線快取才會更新
        css.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;"
                   "src:url('fonts/%s?v=%s') format('woff2');unicode-range:%s}" % (fam, wt, fn, ver, rng))
    os.remove(tmp)
open(os.path.join(ROOT, "assets", "fonts.css"), "w", encoding="utf-8").write("\n".join(css) + "\n")
print("assets/fonts.css written")
