"""Builds the two ClearMatch storyboards from docs/screenshots/.
Needs Pillow (pip install pillow).
Usage, from the repo root: python docs/build_storyboards.py docs/screenshots docs"""
import sys, os, textwrap
from PIL import Image, ImageDraw, ImageFont, ImageChops

SRC, OUT = sys.argv[1], sys.argv[2]
# Inter if installed (Linux path), otherwise Windows Segoe UI / Arial, otherwise Pillow's default.
FONT_CANDIDATES = {
    "Regular":  ["/usr/share/fonts/opentype/inter/Inter-Regular.otf", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"],
    "SemiBold": ["/usr/share/fonts/opentype/inter/Inter-SemiBold.otf", "C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/arialbd.ttf"],
    "Bold":     ["/usr/share/fonts/opentype/inter/Inter-Bold.otf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"],
}
def font(style, size):
    for p in FONT_CANDIDATES[style]:
        try: return ImageFont.truetype(p, size)
        except OSError: pass
    return ImageFont.load_default(size)
F_TITLE, F_SUB, F_NUM, F_LBL, F_TXT, F_TAG = font("Bold",44), font("Regular",24), font("Bold",26), font("SemiBold",21), font("Regular",21), font("SemiBold",18)
INK, MUTED, LINE = (27,27,27), (90,98,110), (214,220,228)
GREEN, BLUE, AMBER, RED = (46,125,50), (21,101,192), (224,161,0), (198,40,40)

def content_crop(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    def yellowish(p): return p[0] > 245 and 235 < p[1] < 252 and 180 < p[2] < 215
    # the demo bar (and any browser chrome above it) ends at the last yellow row near the top
    ys = [y for y in range(min(160, h)) if yellowish(px[10, y])]
    top = 0
    if ys:
        top = ys[0]
        while top < h and (yellowish(px[10, top]) or top - ys[0] < 8): top += 1
    top += 3  # dashed border under the bar
    # drop a dark taskbar at the bottom
    bottom = h
    while bottom > top and sum(px[w//2, bottom-1]) < 300: bottom -= 1
    # ignore a scrollbar at the right edge when finding content
    region = im.crop((0, top, w - 24, bottom))
    bg = Image.new("RGB", region.size, (255,255,255))
    diff = ImageChops.difference(region, bg).convert("L").point(lambda v: 255 if v > 12 else 0)
    box = diff.getbbox() or (0, 0, region.width, region.height)
    pad = 28
    box = (max(box[0]-pad,0), max(box[1]-pad,0), min(box[2]+pad,region.width), min(box[3]+pad,region.height))
    return region.crop(box)

def fit(im, bw, bh):
    r = min(bw/im.width, bh/im.height)
    return im.resize((max(1,int(im.width*r)), max(1,int(im.height*r))), Image.LANCZOS)

def wrap(draw, text, fnt, width):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        t = (cur+" "+wd).strip()
        if draw.textlength(t, font=fnt) <= width: cur = t
        else: lines.append(cur); cur = wd
    if cur: lines.append(cur)
    return lines

def board(title, subtitle, tag, tag_col, panels, outname, loop_note):
    cols, pw, ih, cap_h, gap, m = 3, 760, 470, 175, 36, 60
    rows = (len(panels)+cols-1)//cols
    W = m*2 + cols*pw + (cols-1)*gap
    head = 190
    H = head + rows*(ih+cap_h+70) + (rows-1)*gap + m + 60
    cv = Image.new("RGB", (W,H), (255,255,255)); d = ImageDraw.Draw(cv)
    d.text((m, m-10), title, font=F_TITLE, fill=INK)
    d.text((m, m+50), subtitle, font=F_SUB, fill=MUTED)
    tw = d.textlength(tag, font=F_TAG)+28
    d.rounded_rectangle((m, m+92, m+tw, m+126), 8, fill=(255,255,255), outline=tag_col, width=2)
    d.text((m+14, m+99), tag, font=F_TAG, fill=tag_col)
    for i,(fname, player, system, flag) in enumerate(panels):
        r, c = divmod(i, cols)
        x = m + c*(pw+gap); y = head + r*(ih+cap_h+70+gap)
        d.rounded_rectangle((x, y, x+pw, y+ih+cap_h+60), 14, outline=LINE, width=2, fill=(250,251,253))
        # number badge
        d.ellipse((x+16, y+14, x+56, y+54), fill=INK)
        n = str(i+1); d.text((x+36-d.textlength(n,font=F_NUM)/2, y+18), n, font=F_NUM, fill=(255,255,255))
        if flag:
            ft = flag; fw = d.textlength(ft, font=F_TAG)+20
            d.rounded_rectangle((x+pw-fw-16, y+20, x+pw-16, y+50), 7, fill=(255,248,225), outline=AMBER, width=2)
            d.text((x+pw-fw-6, y+25), ft, font=F_TAG, fill=(120,85,0))
        img = fit(content_crop(os.path.join(SRC, fname)), pw-32, ih-20)
        ix = x + (pw-img.width)//2; iy = y+66 + (ih-20-img.height)//2
        cv.paste(img, (ix, iy)); d.rectangle((ix-1, iy-1, ix+img.width, iy+img.height), outline=LINE)
        cy = y+66+ih
        for lbl, txt, col in (("Player", player, BLUE), ("System", system, GREEN)):
            if not txt: continue
            d.text((x+20, cy), lbl, font=F_LBL, fill=col)
            lines = wrap(d, txt, F_TXT, pw-130)
            for j,l in enumerate(lines[:3]): d.text((x+110, cy+j*27), l, font=F_TXT, fill=INK)
            cy += max(1,len(lines[:3]))*27 + 10
    # loop note
    d.text((m, H-m-20), loop_note, font=F_LBL, fill=RED)
    os.makedirs(OUT, exist_ok=True); cv.save(os.path.join(OUT, outname), optimize=True)
    print("wrote", outname, cv.size)

board("Storyboard 1 · A real AI judgement, challenged and upheld",
      "Brickwall (p7) questions a low match score; a reviewer keeps it but explains why.",
      "REAL AI RESULT · live run 4, Gemini 3.5 Flash-Lite", GREEN,
      [("s1-01-profile.png", "Opens their private profile.", "Respect 3.8, Good, Improving. Match 1 lowered it: exact chat lines plus a labelled AI summary.", None),
       ("s1-02-challenge-form.png", "Clicks “Challenge this score” and picks a reason.", "Offers fixed reasons and an optional note (200 characters).", None),
       ("s1-03-under-review.png", "Submits the challenge.", "Shows “Challenged — under review”; the score still counts while pending.", None),
       ("s1-04-reviewer.png", None, "Reviewer sees the AI's proposal (2 of 5, confidence 0.90) and each evidence line with 2 messages before and after.", None),
       ("s1-05-upheld.png", "Reads the decision.", "“Upheld on review” with the reviewer's comment; the decision is final.", None),
       ("s1-06-lobby.png", "Clicks “Find next match”.", "Shows both teams (names only) and private reasons: teams balanced by teamwork.", None)],
      "storyboard-1-upheld.png",
      "Control: the player can contest; a human decides; the explanation stays visible.")

board("Storyboard 2 · An AI error, challenged and overturned",
      "Havoc (p5) is wrongly marked down for game language; overturning it restores the profile and the lobby explanation.",
      "SIMULATED AI ERROR · injected with a labelled demo control", AMBER,
      [("s2-01-lobby-before.png", "Checks the next match.", "Private reasons: players they muted or reported are not on their team; teams balanced by teamwork.", None),
       ("s2-03-profile-low.png", "Opens their profile.", "Respect 2.3, Low, Declining. Match 3 cites “gonna kill it this round”.", "simulated error"),
       ("s2-04-lobby-low.png", "Finds the next match again.", "Adds: “Your Respect is currently Low…” and “not every fairness rule could be met”.", "simulated error"),
       ("s2-05-reviewer.png", None, "Reviewer sees the lines in context (“stay with me”, “gg wp”): game calls, not threats. Overturns.", "simulated error"),
       ("s2-06-overturned.png", "Returns to the profile.", "“Overturned on review — this match no longer counts”; Respect recalculated to 3.0, Neutral.", None),
       ("s2-07-lobby-after.png", "Finds the next match.", "The Low and fairness messages are gone; same teams, explanation restored.", None)],
      "storyboard-2-overturned.png",
      "Closed loop: challenge → human review → profile recalculated → next lobby explanation changes.")
