#!/usr/bin/env python3
"""Build design previews of drill.html: previews/paper.html and previews/chalk.html.

Each preview is drill.html plus one extra stylesheet and a small script, so the app underneath is the
real one. Run again after changing drill.html:  python3 scripts/make-previews.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = (ROOT / "drill.html").read_text(encoding="utf-8")

# Hand-drawn marks next to the verdict, the question number in the margin, the final score circled.
# show / flash / updateBar / finish are global function bindings in drill.html, so wrapping them here
# changes what every caller gets.
SCRIPT = r"""
<script>
"use strict";
(()=>{
  const TICK='<svg class="pen" viewBox="0 0 60 50" aria-hidden="true"><path pathLength="100" d="M6 29 C12 33 17 38 21 44 C29 28 40 14 55 5"/></svg>';
  const CROSS='<svg class="pen" viewBox="0 0 50 50" aria-hidden="true"><path pathLength="100" d="M9 8 C20 20 32 32 43 44"/><path class="p2" pathLength="100" d="M42 7 C30 20 19 31 8 43"/></svg>';
  const f0=flash; flash=function(k){f0(k);$("verdict").insertAdjacentHTML("afterbegin",k==="ok"?TICK:CROSS);};
  const s0=show; show=function(...a){s0(...a);$("q").classList.remove("marked");};
  const stage=$("q").parentElement;
  const u0=updateBar; updateBar=function(){u0();if(run)stage.dataset.qn=run.phase==="review"?`R${run.ri+1}`:run.n+1;};
  const e0=finish; finish=function(){e0();delete stage.dataset.qn;$("q").classList.add("marked");};
})();
</script>
"""

COMMON = """
/* ---- preview: marks shared by both looks ---- */
.flash-ok,.flash-bad{animation:none}
.verdict svg.pen{width:1.35em;height:1.15em;vertical-align:-.18em;margin-right:.3em;fill:none;stroke:currentColor;
  stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.verdict svg.pen path{stroke-dasharray:100;stroke-dashoffset:100;animation:draw .32s ease-out forwards}
.verdict svg.pen path.p2{animation-delay:.18s}
@keyframes draw{to{stroke-dashoffset:0}}
#q.marked{position:relative;padding:.05em .4em}
#q.marked::after{content:"";position:absolute;inset:-.12em -.35em;border:3px solid var(--mark);
  border-radius:50% 46% 54% 48%;transform:rotate(-4deg);animation:ring .5s ease-out both}
@keyframes ring{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@media (prefers-reduced-motion:reduce){.verdict svg.pen path{animation:none;stroke-dashoffset:0}#q.marked::after{animation:none}}
.stage{position:relative}
"""

PAPER = """
/* ==== preview: EXAM PAPER — a printed answer booklet, marked in red pen ==== */
html:root:not(#x){
  --bg:#E4DED0; --surface:#FCFAF4; --sunk:#F4EFE3;
  --ink:#1C1B18; --muted:#524E47; --faint:#5F5A51; --line:#D3CAB7;
  --accent:#1C1B18; --accent-soft:#ECE6D7; --on-accent:#FCFAF4; --start-bg:#F2ECDD;
  --ok:#1F6B45; --bad:#B3261E; --bad-soft:#F6E3DC; --mark:#C42A1F;
  --font-serif:"Source Serif 4",Georgia,serif; --font-pen:"Caveat",cursive;
  --font-math:"STIX Two Math","Noto Sans Math",math;
  color-scheme:light;
}
h1{font-family:var(--font-serif);font-weight:700;letter-spacing:-.01em}
header{border-bottom:2px solid var(--ink);padding-bottom:14px}
.quote blockquote{font-family:var(--font-serif)}
.streak b{font-family:var(--font-serif);font-weight:700}
.card{border:0;border-radius:0;position:relative;
  box-shadow:0 1px 0 rgba(60,50,30,.06),0 14px 30px -14px rgba(60,50,30,.35)}
.card.second{box-shadow:inset 0 0 0 2px var(--mark),0 14px 30px -14px rgba(60,50,30,.35)}
.bar{border-bottom:1px solid var(--ink);font-family:var(--font-serif);padding:12px 22px}
.bar .t{font-weight:700}
#qn{display:none}
.stage{padding:44px 72px 36px}
.stage[data-qn]::before{content:attr(data-qn);position:absolute;left:24px;top:40px;
  font:700 1.55rem/1 var(--font-serif);color:var(--ink)}
body.running .stage::after{content:"[1]";position:absolute;right:24px;top:44px;font:400 1rem/1 var(--font-serif);color:var(--muted)}
/* during a run the question reads like a booklet: number in the margin, question and answer box set left */
body.running .stage{align-items:flex-start;justify-content:flex-start;text-align:left;gap:18px}
body.running .tags,body.running .ansrow{justify-content:flex-start}
@media (max-width:560px){.stage{padding:40px 16px 28px 46px}.stage[data-qn]::before{left:14px}
  body.running .stage::after{right:14px;top:14px}}
.qtext{font-family:var(--font-serif)}
.qhint{font-family:var(--font-serif);font-style:italic}
.tag{background:none;border:1px solid var(--line);border-radius:0;color:var(--muted)}
.tag.retry{border-color:var(--mark);color:var(--mark);font:700 1.15rem var(--font-pen);text-transform:none;letter-spacing:0}
.ansbox::before{content:"Answer";display:block;text-align:left;margin-bottom:4px;
  font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
input[type=text],.ansbox.expr .ansview{background:#FFFFFF;border:1.5px solid var(--ink);border-radius:0}
.ansbox.expr input{top:auto;height:calc(100% - 1.4rem)}
.verdict{font:700 1.65rem/1.2 var(--font-pen);color:var(--mark)}
.verdict.ok,.verdict.bad{color:var(--mark)}
#q.marked{font:700 3.4rem/1.1 var(--font-pen);color:var(--mark)}
.tipbox{background:var(--sunk);border-left:2px solid var(--ink);border-radius:0}
.tipbox .label{color:var(--ink)}
button.primary{font-family:var(--font-serif);font-weight:700;letter-spacing:.01em}
.chip{border-radius:0}
.chip[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.focusbtn{background:transparent}
dialog{border-radius:0;border-color:var(--ink)}
.tblwrap,.boxed{border:0;background:transparent;border-radius:0}
.empty{text-align:left;padding:2px 0;font-family:var(--font-serif);font-style:italic}
th{border-bottom:1.5px solid var(--ink)}
.weak td{background:transparent}
.weak td.name::after{color:var(--mark);font:700 1rem var(--font-pen)}
footer{border-top:1px solid var(--ink)}
"""

NOISE = ("url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .075 0'/></filter>"
         "<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")")

CHALK = """
/* ==== preview: CHALKBOARD — slate board in a wooden frame, chalk-white and chalk-yellow ==== */
html:root:not(#x){
  --bg:#141A17; --surface:#26342D; --sunk:#1F2B25;
  --ink:#EEEDE6; --muted:#BEC8C0; --faint:#A3AFA6; --line:#3F5047;
  --accent:#F3DA7A; --accent-soft:#33453B; --on-accent:#1F2B25; --start-bg:transparent;
  --ok:#A9E2A1; --bad:#F4AAA2; --bad-soft:#3F3430; --mark:#F3DA7A;
  --font-chalk:"Cabin Sketch","Figtree",sans-serif;
  color-scheme:dark;
}
h1{font-family:var(--font-chalk);font-weight:700;letter-spacing:.01em}
.card{border:10px solid #4B3A2B;border-radius:3px;background-color:var(--surface);
  background-image:radial-gradient(ellipse at 22% 28%,rgba(255,255,255,.06),transparent 55%),
    radial-gradient(ellipse at 78% 72%,rgba(255,255,255,.045),transparent 50%),NOISE;
  box-shadow:inset 0 0 50px rgba(0,0,0,.35),0 0 0 1px #2E241B,0 18px 36px -14px rgba(0,0,0,.7)}
.card.second{border-color:#6A3B33}
.bar{border-bottom:1px dashed var(--line);color:var(--muted)}
.bar .t{font-family:var(--font-chalk);font-size:1.35rem;font-weight:700}
.qtext,.verdict,.bar .t,h1,button.primary,#q.marked{text-shadow:0 0 1px rgba(238,237,230,.5),0 0 8px rgba(238,237,230,.08)}
.tag{background:none;border:1px dashed var(--faint);color:var(--muted);border-radius:2px}
.tag.retry{border-color:var(--bad);color:var(--bad);background:none}
input[type=text],.ansbox.expr .ansview{background:transparent;border:0;border-bottom:2px solid rgba(238,237,230,.7);border-radius:0}
.verdict{font-weight:600}
#q.marked{font-family:var(--font-chalk);font-weight:700;font-size:3.2rem;color:var(--ink)}
.tipbox{background:rgba(0,0,0,.18);border-left:2px dashed var(--accent)}
button.primary{font-family:var(--font-chalk);font-weight:700;font-size:1.6rem}
.chip{border-radius:2px}
dialog{border-radius:3px}
.tblwrap,.boxed{border:0;background:transparent}
.empty{text-align:left;padding:2px 0}
th,td{border-bottom:1px dashed var(--line)}
.weak td{background:transparent}
footer{border-top:1px dashed var(--line)}
""".replace("NOISE", NOISE)

LOOKS = {
    # the paper look became drill.html itself on 2026-10-18; previews/paper.html is the old serif snapshot
    "chalk": ("Quick Maths Chalk", CHALK, "family=Cabin+Sketch:wght@400;700"),
}

out = ROOT / "previews"
out.mkdir(exist_ok=True)
for name, (title, css, fonts) in LOOKS.items():
    s = SRC
    assert s.count("<title>Quick Maths</title>") == 1 and s.count("</style>") == 1 and s.rstrip().endswith("</script>")
    s = s.replace("<title>Quick Maths</title>",
                  f'<title>{title}</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&display=swap">')
    s = s.replace("</style>", f"</style>\n<style>{COMMON}{css}</style>")
    s = s.rstrip() + "\n" + SCRIPT
    (out / f"{name}.html").write_text(s, encoding="utf-8")
    print("wrote", out / f"{name}.html")
