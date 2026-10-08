// Independent verification of drill.html generators. Run after ANY change to GEN:
//   node scripts/verify.js [path=drill.html] [samples per shape=400] [samples]
// Every question is read back from its RENDERED MathML and solved by a different route than the
// generator used; a shape the checker cannot read is reported as unchecked, never as passed.
// It also flags rendering faults: sign collisions ("+ −5"), "1x", "+ 0", a printed exponent of 1.
"use strict";
const fs=require("fs"),path=require("path");
const src=fs.readFileSync(process.argv[2]||path.join(__dirname,"..","drill.html"),"utf8");
const block=src.slice(src.indexOf("/*GEN-START*/"),src.indexOf("/*GEN-END*/"));
const mod={};new Function("module",block+"\nmodule.exports={GEN,CATS,TIPMAP,TIPS,checkExpr};")(mod);
const {GEN,CATS,TIPMAP,TIPS,checkExpr}=mod.exports;
// every shape needs a hint card, and the parallel map must line up with the banks
for(const c of CATS)GEN[c].L.forEach((bk,i)=>{if(!TIPMAP[c]||bk.length!==TIPMAP[c][i].length){console.log("TIPMAP length mismatch",c,i+1);process.exitCode=1;}
  (TIPMAP[c]?TIPMAP[c][i]:[]).forEach((t)=>{if(!TIPS[t]){console.log("missing hint card",t);process.exitCode=1;}});});
const N=+process.argv[3]||400;

/* ---------- MathML -> linear text ---------- */
function parseXML(s){let i=0;const root={tag:"root",kids:[]},st=[root];
  while(i<s.length){if(s[i]==="<"){const j=s.indexOf(">",i);const t=s.slice(i+1,j);i=j+1;
      if(t[0]==="/"){st.pop();continue;}const m=t.match(/^(\w+)(.*)$/s);const n={tag:m[1],attrs:m[2],kids:[]};st[st.length-1].kids.push(n);st.push(n);}
    else{const j=s.indexOf("<",i);const t=s.slice(i,j<0?s.length:j);i=j<0?s.length:j;st[st.length-1].kids.push({text:t});}}
  return root;}
const ent=(s)=>s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
const txt=(n)=>n.text!==undefined?ent(n.text):n.kids.map(txt).join("");
const MO={"−":"-","×":"*","÷":"/","≡":"=","⋯":"...","…":"...","′":"'","″":"''"};
function lin(n){
  if(n.text!==undefined)return n.text;
  const K=n.kids.filter(k=>k.text===undefined||k.text.trim()!=="");
  switch(n.tag){
    case"root":return n.kids.map(lin).join("");
    case"math":case"mrow":
      if(/class="mixed"/.test(n.attrs))return`(${lin(K[0])} + ${lin(K[1])})`;
      return K.map(lin).join(" ");
    case"mn":return txt(n).replace(/ /g,"").replace("°","");
    case"mi":return txt(n).replace("′","'").replace("″","''");
    case"mo":{const t=txt(n);return MO[t]??t;}
    case"mtext":return txt(n);
    case"mspace":return" ";
    case"mfrac":return /linethickness="0"/.test(n.attrs)?`binom(${lin(K[0])},${lin(K[1])})`:`((${lin(K[0])})/(${lin(K[1])}))`;
    case"msqrt":return`sqrt(${K.map(lin).join(" ")})`;
    case"msup":{const b=lin(K[0]).trim(),e=lin(K[1]).trim();
      if(["sin","cos","tan"].includes(b))return`${b}^(${e})`;
      if(b==="f"&&(e==="'"||e==="''"))return"f"+e;
      return`(${b})^(${e})`;}
    case"msub":{const b=lin(K[0]).trim(),s=lin(K[1]).trim();
      if(b==="log")return`log_(${s})`;
      return`${b}_${s.replace(/\s+/g,"").replace(/\+/g,"p")}`;}
    case"msubsup":return`int(${lin(K[1])},${lin(K[2])})`;
    case"munderover":return`sum(${lin(K[1])};${lin(K[2])})`;
    case"mover":return`{${lin(K[0])}}`;
    case"span":return txt(n);
    default:throw new Error("tag "+n.tag);
  }}
function render(q){ // prose with [math]
  return q.replace(/<math[^>]*>[\s\S]*?<\/math>/g,(m)=>"["+lin(parseXML(m)).replace(/\s+/g," ").trim()+"]")
          .replace(/<[^>]+>/g,"").replace(/\s+/g," ").replace(/f ' '/g,"f''").replace(/f '/g,"f'").trim();}

/* recurring decimals -> numeric literal */
function unrecur(s){return s.replace(/0\.(\d*)\s+\{(\d)\}((?:\s+\d)*)(?:\s+\{(\d)\})?/g,(m,pre,d1,mid,d2)=>{
  const rep=d1+(mid||"").replace(/\s+/g,"")+(d2||"");return String(parseFloat("0."+pre+rep.repeat(12)));});}

/* ---------- expression evaluator ---------- */
function tok(s){const t=[];let i=0;s=unrecur(s).replace(/⌊/g," floor(").replace(/⌋/g,") ");
  while(i<s.length){const c=s[i];
    if(/\s/.test(c)){i++;continue;}
    let m;
    if((m=s.slice(i).match(/^\d+(\.\d+)?/))){t.push({k:"n",v:parseFloat(m[0])});i+=m[0].length;continue;}
    if(s.startsWith("log_",i)){t.push({k:"id",v:"log_"});i+=4;continue;}
    if((m=s.slice(i).match(/^[A-Za-zα-ωθ][A-Za-z0-9_α-ωθ]*/))){t.push({k:"id",v:m[0]});i+=m[0].length;continue;}
    if(s.startsWith("...",i)){t.push({k:"op",v:"..."});i+=3;continue;}
    t.push({k:"op",v:c});i++;}
  return t;}
const D=Math.PI/180;
function factN(n){if(!Number.isInteger(n)||n<0)throw new Error("fact");let v=1;for(let i=2;i<=n;i++)v*=i;return v;}
function binomV(n,r){let row=[1];for(let i=1;i<=n;i++){const nr=[1];for(let j=1;j<i;j++)nr.push(row[j-1]+row[j]);nr.push(1);row=nr;}return row[r];}
function hcfV(a,b){for(let d=Math.min(a,b);d>=1;d--)if(a%d===0&&b%d===0)return d;}
function lcmV(...a){const m=Math.max(...a);for(let v=m;;v+=m)if(a.every(x=>v%x===0))return v;}
function evalExpr(s,env={}){const T=tok(s);let p=0;
  const peek=()=>T[p],eat=(v)=>{if(!T[p]||T[p].v!==v)throw new Error(`expected ${v} at ${p} in ${s}`);p++;};
  const startsPrimary=(t)=>t&&(t.k==="n"||t.k==="id"||t.v==="(");
  function expr(){let v=term();while(peek()&&(peek().v==="+"||peek().v==="-")){const o=T[p++].v;const r=term();v=o==="+"?v+r:v-r;}return v;}
  function term(){let v=unary();for(;;){const t=peek();if(t&&(t.v==="*"||t.v==="/")){p++;const r=unary();v=t.v==="*"?v*r:v/r;}
      else if(startsPrimary(t))v*=power();else break;}return v;}
  function unary(){const t=peek();if(t&&t.v==="-"){p++;return -unary();}if(t&&t.v==="+"){p++;return unary();}return power();}
  function power(){const b=postfix();if(peek()&&peek().v==="^"){p++;const e=unary();return Math.pow(b,e);}return b;}
  function postfix(){let v=primary();while(peek()&&(peek().v==="!"||peek().v==="%")){if(T[p++].v==="!")v=factN(v);else v/=100;}return v;}
  function primary(){const t=T[p++];if(!t)throw new Error("eof in "+s);
    if(t.k==="n")return t.v;
    if(t.v==="("){const v=expr();eat(")");return v;}
    if(t.k!=="id")throw new Error("unexpected "+t.v+" in "+s);
    const id=t.v;
    if(id==="sqrt"){eat("(");const v=expr();eat(")");return Math.sqrt(v);}
    if(id==="floor"){eat("(");const v=expr();eat(")");return Math.floor(v+1e-9);}
    if(id==="binom"){eat("(");const a=expr();eat(",");const b=expr();eat(")");return binomV(a,b);}
    if(id==="HCF"||id==="LCM"){eat("(");const a=[expr()];while(peek().v===","){p++;a.push(expr());}eat(")");return id==="HCF"?hcfV(...a):lcmV(...a);}
    if(id==="log_"){eat("(");const b=expr();eat(")");const x=power();return Math.log(x)/Math.log(b);}
    if(id==="log"){const x=power();return Math.log10(x);}
    if(id==="sin"||id==="cos"||id==="tan"){let e=1;if(peek()&&peek().v==="^"){p++;e=primary();}const a=postfix();
      const f=id==="sin"?Math.sin(a*D):id==="cos"?Math.cos(a*D):Math.tan(a*D);return Math.pow(f,e);}
    if(id in env){const v=env[id];if(typeof v==="function"){eat("(");const a=expr();eat(")");return v(a);}return v;}
    throw new Error("unknown id "+id+" in "+s);}
  const v=expr();if(p!==T.length)throw new Error("trailing tokens in "+s+" at "+p);return v;}

const close=(a,b,tol=1e-7)=>Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
const isInt=(v)=>Math.abs(v-Math.round(v))<1e-7*Math.max(1,Math.abs(v));
const split1=(s,op)=>{const i=s.indexOf(op);return[s.slice(0,i).trim(),s.slice(i+op.length).trim()];};
function quadCoef(e,env={}){const f=(x)=>evalExpr(e,{...env,x});const c=f(0),a=(f(1)+f(-1))/2-c,b=(f(1)-f(-1))/2;
  if(!close(f(2),4*a+2*b+c))throw new Error("not quadratic: "+e);return{a,b,c};}
function linRoot(e){const f=(x)=>evalExpr(e,{x});const d0=f(0),d1=f(1);return -d0/(d1-d0);}
function deriv(f,x,h=1e-3){return(-f(x+2*h)+8*f(x+h)-8*f(x-h)+f(x-2*h))/(12*h);}
function simpson(f,a,b,n=2000){const h=(b-a)/n;let s=f(a)+f(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*f(a+i*h);return s*h/3;}
function trigF(fn){return fn==="sin"?(t)=>Math.sin(t*D):fn==="cos"?(t)=>Math.cos(t*D):(t)=>Math.tan(t*D);}
function* perms(a){if(a.length<=1){yield a;return;}for(let i=0;i<a.length;i++)for(const r of perms([...a.slice(0,i),...a.slice(i+1)]))yield[a[i],...r];}
function seqTerms(s){const parts=s.split(",").map(x=>x.trim()).filter(x=>x&&x!=="...");return parts.map(x=>evalExpr(x));}
function primeFactors(n){const f=[];for(let p=2;p*p<=n;p++)while(n%p===0){f.push(p);n/=p;}if(n>1)f.push(n);return f;}

/* ---------- the checker: returns true/false, throws "UNCHECKED" if it cannot read the shape ---------- */
function check(o){
  const t=render(o.q),A=o.a,h=o.hint||"";let m;
  const V=(h.match(/[Ff]ind (\w+|θ)/)||[])[1];
  // ---- prose shapes ----
  if((m=t.match(/^\[(.+?) %\] of \[(.+?) %\] of \[(.+?)\]$/)))return close(evalExpr(m[1])*evalExpr(m[2])*evalExpr(m[3])/1e4,A);
  if((m=t.match(/^\[(.+?) %\] of \[(.+?)\]$/)))return close(evalExpr(m[1])*evalExpr(m[2])/100,A);
  if((m=t.match(/^\[(.+?)\] of \[(.+?)\]$/)))return close(evalExpr(m[1])*evalExpr(m[2]),A);
  if((m=t.match(/^Coefficient of \[(.+?)\] in \[\(\(\s*(.+?)\s*\)\)\^\((\d+)\)\]$/))){
    const k=m[1]==="x"?1:+m[1].match(/\^\((\d+)\)/)[1],n=+m[3];const f=(x)=>evalExpr(m[2],{x});const a=f(0),b=f(1)-a;
    let P=[1];for(let i=0;i<n;i++){const Q=Array(P.length+1).fill(0);P.forEach((c,j)=>{Q[j]+=c*a;Q[j+1]+=c*b;});P=Q;}return close(P[k],A);}
  if((m=t.match(/^Arrangements of the letters ([A-C ]+)$/))){const L=m[1].split(" ");const set=new Set();for(const q of perms(L))set.add(q.join(""));return set.size===A;}
  if((m=t.match(/^Number of positive divisors of \[(.+)\]$/))){
    if(/^\d+$/.test(m[1])){const n=+m[1];let c=0;for(let d=1;d<=n;d++)if(n%d===0)c++;return c===A;}
    const fac=m[1].split("*").map(x=>{x=x.trim();const mm=x.match(/^\((\d+)\)\^\((\d+)\)$/);return mm?[+mm[1],+mm[2]]:[+x,1];});
    if(fac.some(([p])=>primeFactors(p).length!==1))return false;
    let divs=[1n];for(const [p,e] of fac){const nd=[];for(const d of divs){let v=d;for(let i=0;i<=e;i++){nd.push(v);v*=BigInt(p);}}divs=nd;}
    return new Set(divs.map(String)).size===A;}
  if((m=t.match(/^Smallest prime factor of \[(\d+)\]$/)))return primeFactors(+m[1])[0]===A&&primeFactors(+m[1]).length>1;
  if((m=t.match(/^Sum of the prime factors of \[(\d+)\], counted with repeats$/)))return primeFactors(+m[1]).reduce((s,p)=>s+p,0)===A;
  if((m=t.match(/^Remainder when \[(\d+)\] is divided by \[(\d+)\]$/))){let r=+m[1];while(r>=+m[2])r-=+m[2];return r===A;}
  if((m=t.match(/^Remainder when \[(.+)\] is divided by \[\(\s*(.+?)\s*\)\]$/))){const r=linRoot(m[2]);return close(evalExpr(m[1],{x:r}),A);}
  if((m=t.match(/^\[\(\s*(.+?)\s*\)\] is a factor of \[(.+)\]$/))&&V==="k"){const r=linRoot(m[1]);
    return close(evalExpr(m[2],{x:r,k:A}),0,1e-9)&&!close(evalExpr(m[2],{x:r,k:A+1}),0,1e-9);}
  if((m=t.match(/^Number of zeros at the end of \[(\d+) !\]$/))){let f=1n;for(let i=2n;i<=BigInt(m[1]);i++)f*=i;return String(f).match(/0*$/)[0].length===A;}
  if((m=t.match(/^Largest \[k\] such that \[\((\d+)\)\^\(k\)\] divides \[(\d+) !\]$/))){let f=1n;for(let i=2n;i<=BigInt(m[2]);i++)f*=i;let e=0;const p=BigInt(m[1]);while(f%p===0n){f/=p;e++;}return e===A;}
  if((m=t.match(/^Last digit of \[\((\d+)\)\^\((\d+)\)\]$/)))return Number(BigInt(m[1])**BigInt(m[2])%10n)===A;
  if((m=t.match(/^How many of \[1 , 2 , 3 , \.\.\. , (\d+)\] are divisible by \[(\d+)\] or \[(\d+)\]\?$/))){let c=0;for(let i=1;i<=+m[1];i++)if(i%+m[2]===0||i%+m[3]===0)c++;return c===A;}
  if((m=t.match(/^Discriminant of \[(.+)\]$/))){const {a,b,c}=quadCoef(m[1]);return close(b*b-4*a*c,A);}
  if((m=t.match(/^\[(.+) \+ c\] is a perfect square$/))){const {a,b,c}=quadCoef(m[1]+" + "+A);return close(b*b-4*a*c,0);}
  if((m=t.match(/^(Sum|Product) of the roots of \[(.+) = 0\]$/))){const {a,b,c}=quadCoef(m[2]);const d=Math.sqrt(b*b-4*a*c);if(isNaN(d))return false;
    const r1=(-b+d)/(2*a),r2=(-b-d)/(2*a);return close(m[1]==="Sum"?r1+r2:r1*r2,A);}
  if((m=t.match(/^Larger root of \[(.+) = 0\]$/))){const {a,b,c}=quadCoef(m[1]);const d=Math.sqrt(b*b-4*a*c);return close(Math.max((-b+d)/(2*a),(-b-d)/(2*a)),A);}
  if((m=t.match(/^Minimum value of \[(.+)\]$/))){const f=(x)=>evalExpr(m[1],{x});let lo=-100,hi=100;
    for(let i=0;i<200;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(f(a)<f(b))hi=b;else lo=a;}return close(f((lo+hi)/2),A,1e-6);}
  if((m=t.match(/^\[(.+) = 0\] has a repeated root(?: and \[k ([<>]) 0\])?$/))&&V==="k"){
    const ok=(k)=>{const {a,b,c}=quadCoef(m[1],{k});return close(b*b,4*a*c,1e-9)&&(!m[2]||(m[2]===">"?k>0:k<0));};return ok(A)&&!ok(A+1)&&!ok(A-1);}
  if((m=t.match(/^\[α , β\] are the roots of \[(.+) = 0\]\. Find \[\(α\)\^\(2\) \+ \(β\)\^\(2\)\]$/))){const {a,b,c}=quadCoef(m[1]);const d=Math.sqrt(b*b-4*a*c);
    const r1=(-b+d)/(2*a),r2=(-b-d)/(2*a);return close(r1*r1+r2*r2,A);}
  if((m=t.match(/^How many integers \[x\] satisfy \[(.+) < 0\]\?$/))){let c=0;for(let x=-300;x<=300;x++)if(evalExpr(m[1],{x})<0)c++;return c===A;}
  if((m=t.match(/^\[x\]-coordinate of the turning point of \[y = (.+)\]$/))){const f=(x)=>evalExpr(m[1],{x});return close(deriv(f,A),0,1e-6)&&!close(deriv(f,A+1),0,1e-6);}
  if((m=t.match(/^Number of digits in \[(.+)\]$/))){const mm=m[1].match(/^\((\d+)\)\^\((\d+)\) \* \((\d+)\)\^\((\d+)\)$/);
    return String(BigInt(mm[1])**BigInt(mm[2])*BigInt(mm[3])**BigInt(mm[4])).length===A;}
  if((m=t.match(/^The (\d+)(?:st|nd|rd|th) term of \[(.+)\]$/))){const n=+m[1],[a,b,c]=seqTerms(m[2]);let v;
    if(close(b-a,c-b)){v=a;for(let i=1;i<n;i++)v+=b-a;}else if(close(b/a,c/b)){v=a;for(let i=1;i<n;i++)v*=b/a;}else return false;return close(v,A);}
  if((m=t.match(/^Sum of the positive multiples of \[(\d+)\] less than \[(\d+)\]$/))){let s=0;for(let i=+m[1];i<+m[2];i+=+m[1])s+=i;return s===A;}
  if((m=t.match(/^Sum to infinity of \[(.+) [+-] \.\.\.\]$/))){const ts=[...m[1].matchAll(/([+-]?)\s*(\d+)/g)].map(x=>(x[1]==="-"?-1:1)*+x[2]);
    const r=ts[1]/ts[0];if(!close(ts[2]/ts[1],r)||Math.abs(r)>=1)return false;let s=0,v=ts[0];for(let i=0;i<3000;i++){s+=v;v*=r;}return close(s,A,1e-6);}
  if((m=t.match(/^\[x_np1 = (.+)\] and \[x_1 = (.+)\]\. Find \[x_(\d)\]$/))){let v=evalExpr(m[2]);for(let i=1;i<+m[3];i++)v=evalExpr(m[1],{x_n:v});return close(v,A);}
  if((m=t.match(/^Arithmetic sequence with \[u_(\d+) = (.+)\] and \[u_(\d+) = (.+)\]\. Find \[u_(\d+)\]$/))){
    const i=+m[1],ui=evalExpr(m[2]),j=+m[3],uj=evalExpr(m[4]),n=+m[5];const d=(uj-ui)/(j-i);return close(ui+(n-i)*d,A);}
  if((m=t.match(/^\[f \( x \) = (.+)\]\. Find \[(f|f'|f'') \( (.+) \)\]$/))){const f=(x)=>evalExpr(m[1],{x}),x0=evalExpr(m[3]);
    const v=m[2]==="f"?f(x0):m[2]==="f'"?deriv(f,x0):deriv((x)=>deriv(f,x),x0);return close(v,A,1e-5);}
  if((m=t.match(/^\[y = (.+)\]\. Find \[\(\(d y\)\/\(d x\)\)\] at \[x = (.+)\]$/))){const f=(x)=>evalExpr(m[1],{x});return close(deriv(f,evalExpr(m[2]),1e-4),A,1e-5);}
  if((m=t.match(/^(Positive|Larger) \[x\]-coordinate of (?:a stationary point|the stationary points) of \[y = (.+)\]$/))){
    const f=(x)=>evalExpr(m[2],{x}),g=(x)=>deriv(f,x);const roots=[];
    for(let x=-30;x<30;x+=0.25){const a=g(x),b=g(x+0.25);if(a===0)roots.push(x);else if(a*b<0){let lo=x,hi=x+0.25;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(g(lo)*g(mid)<=0)hi=mid;else lo=mid;}roots.push((lo+hi)/2);}}
    if(roots.length!==2)return false;return close(m[1]==="Positive"?roots.find(r=>r>0):Math.max(...roots),A,1e-6);}
  if((m=t.match(/^\[f \( x \) = \(x\)\^\(2\) \+ p x \+ q\], with \[f \( 1 \) = (.+)\] and \[f \( 2 \) = (.+)\]$/))&&V==="p"){
    const q=evalExpr(m[1])-1-A;return close(4+2*A+q,evalExpr(m[2]));}
  if((m=t.match(/^\[(sin|cos|tan) θ = (.+)\] and \[(\d+) < θ ≤ (\d+)\]$/))){const f=trigF(m[1]),v=evalExpr(m[2]);const sol=[];
    for(let d=+m[3]+1;d<=+m[4];d++)if(Math.abs(f(d)-v)<1e-9)sol.push(d);return sol.length===1&&sol[0]===A;}
  if((m=t.match(/^Number of solutions of \[(sin|cos|tan) x = (.+)\] for \[0 ≤ x < (\d+)\]$/))){const f=trigF(m[1]),v=evalExpr(m[2]);let c=0;
    for(let d=0;d<+m[3];d++)if(Math.abs(f(d)-v)<1e-9)c++;return c===A;}
  if((m=t.match(/^Triangle with \[a = (\d+)\], \[b = (\d+)\] and angle \[C = (\d+)\] between them$/))){const a=+m[1],b=+m[2],C=+m[3]*D;
    const P=[b,0],Q=[a*Math.cos(C),a*Math.sin(C)];return close((P[0]-Q[0])**2+(P[1]-Q[1])**2,A);}
  if((m=t.match(/^Area of a triangle with sides \[(\d+)\] and \[(\d+)\] and included angle \[(\d+)\]$/))){const a=+m[1],b=+m[2],C=+m[3]*D;
    return close(Math.abs(a*b*Math.sin(C)-0)/2,A);}
  const P2="\\[\\( (.+?) , (.+?) \\)\\]";
  if((m=t.match(new RegExp(`^Distance from ${P2} to ${P2}$`)))){const [x1,y1,x2,y2]=m.slice(1).map(s=>evalExpr(s));return close(Math.hypot(x2-x1,y2-y1),A);}
  if((m=t.match(new RegExp(`^Gradient of the line through ${P2} and ${P2}$`)))){const [x1,y1,x2,y2]=m.slice(1).map(s=>evalExpr(s));return close((y2-y1)/(x2-x1),A);}
  if((m=t.match(new RegExp(`^\\[(x|y)\\]-coordinate of the midpoint of ${P2} and ${P2}$`)))){const [x1,y1,x2,y2]=m.slice(2).map(s=>evalExpr(s));return close(m[1]==="x"?(x1+x2)/2:(y1+y2)/2,A);}
  if((m=t.match(new RegExp(`^Gradient of a line perpendicular to the line through ${P2} and ${P2}$`)))){const [x1,y1,x2,y2]=m.slice(1).map(s=>evalExpr(s));
    return close(A*(y2-y1)/(x2-x1),-1);}
  if((m=t.match(new RegExp(`^\\[y\\]-intercept of the line through ${P2} with gradient \\[(.+)\\]$`)))){const [p,q,g]=m.slice(1).map(s=>evalExpr(s));return close(q+g*(0-p),A);}
  if((m=t.match(/^The line \[(.+) = (.+)\] meets the \[x\]-axis at \[\( k , 0 \)\]$/))&&V==="k")return close(evalExpr(m[1],{x:A,y:0}),evalExpr(m[2]));
  if((m=t.match(/^(?:Radius of the circle|The circle) \[(.+) = 0\](?: has centre \[\( p , q \)\])?$/))){const g=(x,y)=>evalExpr(m[1],{x,y});
    const F=g(0,0),Dd=(g(1,0)-g(-1,0))/2,E=(g(0,1)-g(0,-1))/2;
    if(t.startsWith("Radius"))return close(Math.sqrt(Dd*Dd/4+E*E/4-F),A);
    return close(V==="p"?-Dd/2:-E/2,A);}
  if((m=t.match(/^\[x\]-coordinate where \[y = (.+)\] meets \[y = (.+)\]$/)))return close(evalExpr(m[1],{x:A}),evalExpr(m[2],{x:A}))&&!close(evalExpr(m[1],{x:A+1}),evalExpr(m[2],{x:A+1}));
  if((m=t.match(new RegExp(`^Area of the triangle with vertices ${P2}, ${P2} and ${P2}$`)))){const v=m.slice(1).map(s=>evalExpr(s));
    const d=(i,j)=>Math.hypot(v[2*i]-v[2*j],v[2*i+1]-v[2*j+1]);const a=d(0,1),b=d(1,2),c=d(0,2),s=(a+b+c)/2;return close(Math.sqrt(Math.max(0,s*(s-a)*(s-b)*(s-c))),A,1e-6);}
  if((m=t.match(/^The line \[y = k\] is a tangent to \[(.+) = (.+)\] and \[k > 0\]$/))){const g=(x,y)=>evalExpr(m[1],{x,y}),r2=evalExpr(m[2]);
    // touches iff g(x,k)=r2 has exactly one x: minimum over x equals r2
    const mins=(k)=>{let lo=-100,hi=100;for(let i=0;i<200;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(g(a,k)<g(b,k))hi=b;else lo=a;}return g((lo+hi)/2,k);};
    return A>0&&close(mins(A),r2,1e-6);}
  if((m=t.match(/^Share \[(\d+)\] in the ratio \[(.+)\]\. The largest share\?$/))){const ps=m[2].split(":").map(x=>+x.trim());const s=ps.reduce((a,b)=>a+b,0);
    return close(Math.max(...ps.map(p=>p*+m[1]/s)),A);}
  if((m=t.match(/^\[(.+)\] in lowest terms$/))&&/\(\(p\)\/\(q\)\)$/.test(m[1])){const L=evalExpr(m[1].replace(/= \(\(p\)\/\(q\)\)$/,""));
    if(V==="q"){const p=L*A;return isInt(p)&&hcfV(Math.round(Math.abs(p)),A)===1;}
    if(V==="p"){const q=A/L;return isInt(q)&&q>0&&hcfV(Math.abs(A),Math.round(q))===1;}return false;}
  // ---- pure maths ----
  if(!(m=t.match(/^\[([^\[\]]+)\]$/)))throw new Error("UNCHECKED");
  const s=m[1];
  if((m=s.match(/^sum\(r = 1;(.+?)\) \((.+)\)$/))){let v=0;for(let r=1;r<=evalExpr(m[1]);r++)v+=evalExpr(m[2],{r});return close(v,A);}
  if((m=s.match(/^int\((.+?),(.+?)\) (.+) d x$/))){const f=(x)=>evalExpr(m[3],{x});return close(simpson(f,evalExpr(m[1]),evalExpr(m[2])),A,1e-6);}
  if(s.includes("...")){
    const [head,last]=s.split(/\s*\+?\s*\.\.\.\s*\+\s*/);
    if(head.replace(/^\(\s*/,"").startsWith("binom")){const n=evalExpr(last.match(/binom\((.+?),/)[1]);let v=0;for(let r=0;r<=n;r++)v+=binomV(n,r);return v===A;}
    const ts=head.split(" + ").map(x=>evalExpr(x)),L=evalExpr(last);let v=ts[0],sum=0,i=0;
    const arith=close(ts[1]-ts[0],ts[2]-ts[1]);while((ts[1]>ts[0]?v<=L+1e-9:v>=L-1e-9)&&i<10000){sum+=v;v=arith?v+(ts[1]-ts[0]):v*(ts[1]/ts[0]);i++;}
    return close(sum,A);}
  if(/=/.test(s)){
    const [l,r]=split1(s,"=");
    if((m=r.match(/^(p|X) \+ (q|Y) sqrt\((\d+)\)$/))){const L=evalExpr(l),rb=Math.sqrt(+m[3]);
      return V===m[1]?isInt((L-A)/rb):isInt(L-A*rb);}
    if(r==="c * (10)^(k)"&&V==="k"){const c=evalExpr(l)/Math.pow(10,A);return c>=1-1e-9&&c<10-1e-8;}
    if(!V)throw new Error("UNCHECKED");
    const env=(v)=>({[V]:v});
    if(/\bx\b/.test(s)&&V!=="x"){ // identity in x
      const ok=(v)=>[0,1,2,-3,0.5].every(x=>close(evalExpr(l,{...env(v),x}),evalExpr(r,{...env(v),x}),1e-9));return ok(A)&&!ok(A+1);}
    const rel=(a,b)=>a===b||Math.abs(a-b)<=1e-9*Math.max(Math.abs(a),Math.abs(b));
    const ok=(v)=>rel(evalExpr(l,env(v)),evalExpr(r,env(v)));
    const ne=(h.match(/≠ (\d+)/)||[])[1],skip=(v)=>ne!==undefined&&+ne===v;
    return ok(A)&&(skip(A+1)||!ok(A+1))&&(skip(A-1)||!ok(A-1))&&!skip(A);}
  return close(evalExpr(s),A,1e-7);
}

/* ---------- typed-expression answers ---------- */
// answer syntax -> this file's evaluator syntax (independent of the page's parser)
const fromAns=(e)=>e.replace(/√\(/g,"sqrt(").replace(/√(\d+|x)/g,"sqrt($1)");
const toAns=(l)=>l.replace(/sqrt\(/g,"√(");
const PTS=[0.6,1.4,2.3,3.7,5.2];
function checkE(o){
  const t=render(o.q),e=o.e,E=(x)=>evalExpr(fromAns(e),{x});let m,orig=null,ok;
  // the page's own checker must accept the answer it expects and refuse a wrong one
  if(!checkExpr(e,o).ok)return false;
  if(checkExpr(e+"+1",o).ok&&o.mode!=="anti")return false;
  if(o.mode==="anti"&&checkExpr(e+"+x",o).ok)return false;
  if((m=t.match(/^Differentiate \[y = (.+)\]$/))){const f=(x)=>evalExpr(m[1],{x});ok=PTS.every((x)=>close(deriv(f,x,1e-4),E(x),1e-6));}
  else if((m=t.match(/^Find \[∫ (.+) d x\]$/))){const f=(x)=>evalExpr(m[1],{x});ok=PTS.every((x)=>close(deriv(E,x,1e-4),f(x),1e-6));}
  else if((m=t.match(/^Simplify \[(.+)\]$/))){orig=m[1];const mm=e.match(/^(\d*)√(\d+)$/);
    ok=close(E(1),evalExpr(m[1]))&&!!mm&&primeFactors(+mm[2]).every((p,i,a)=>a.indexOf(p)===i);}
  else if((m=t.match(/^Rationalise the denominator of \[(.+)\]$/))){orig=m[1];const den=e.split("/")[1]||"";
    ok=close(E(1),evalExpr(m[1]))&&!den.includes("√");}
  else if((m=t.match(/^Expand \[(.+)\]$/))){orig=m[1];
    ok=PTS.every((x)=>close(E(x),evalExpr(m[1],{x})))&&!e.includes("(")&&(!e.includes("√")||/^\d+\+\d+√\d+$/.test(e));}
  else if((m=t.match(/^Factorise \[(.+)\]$/))){orig=m[1];ok=PTS.every((x)=>close(E(x),evalExpr(m[1],{x})))&&/^\(x[+-]\d+\)\(x[+-]\d+\)$/.test(e);}
  else if((m=t.match(/^Write \[(.+)\] as a single power of \[x\]$/))){orig=m[1];ok=PTS.every((x)=>close(E(x),evalExpr(m[1],{x})))&&/^x\^\(-?\d+\/2\)$/.test(e);}
  else throw new Error("UNCHECKED");
  // where a form is asked for, typing the question's own expression back must be refused
  if(ok&&o.form&&orig!==null){const r=checkExpr(toAns(orig),o);if(r.ok||!r.form)return false;}
  return ok;}

/* ---------- worked starts ----------
   M: every evaluable side of an "=" agrees.  class="id": an identity in x, checked at three values.
   class="ans": evaluates to the answer and is not a bare number.  No plain chunk may be just the answer. */
const wstats={eq:0,id:0,ans:0,bare:0,samples:[]};
function checkW(o){
  if(!o.w||typeof o.w!=="string")return "no worked start";
  const chunks=[...o.w.matchAll(/<math([^>]*)>[\s\S]*?<\/math>/g)];
  for(const [html,attrs] of chunks){
    const kind=(attrs.match(/class="(\w+)"/)||[])[1]||"";
    const t=lin(parseXML(html)).replace(/\s+/g," ").trim().replace(/f ' '/g,"f''").replace(/f '/g,"f'");
    const sides=t.split(" = ");
    if(kind==="ans"){let v;try{v=evalExpr(t);}catch(e){return "answer expression unreadable: "+t;}
      if(/^-?\d+(\.\d+)?$/.test(t))return "answer expression is a bare number: "+t;
      if(o.a!==undefined&&!close(v,o.a,1e-9))return `answer expression ${t} = ${v}, answer ${o.a}`;wstats.ans++;continue;}
    if(kind==="id"){for(const x of [0.7,1.9,3.2]){const vals=[];for(const sd of sides){try{vals.push(evalExpr(sd,{x}));}catch(e){}}
        if(vals.length>=2&&!vals.every((v)=>close(v,vals[0],1e-9)))return `identity fails at x=${x}: ${t}`;if(vals.length>=2)wstats.id++;}continue;}
    // a bare number equal to the answer is usually a coincidence ("divide by 20" when the answer is 20): tallied for review, not failed
    if(o.a!==undefined&&/^-?\d+(\.\d+)?$/.test(t)&&+t===o.a){wstats.bare++;if(wstats.samples.length<12)wstats.samples.push(render(o.q)+"  →  "+t);}
    if(sides.length>1){const vals=[];for(const sd of sides){try{vals.push(evalExpr(sd));}catch(e){}}
      if(vals.length>=2){if(!vals.every((v)=>close(v,vals[0],1e-9)))return "equation does not balance: "+t;wstats.eq++;}}
  }
  return null;}

/* ---------- run ---------- */
let total=0,fails=0;const failBy={};const unchecked={},failures=[],shapes={},vals={};
for(const c of CATS)GEN[c].L.forEach((bank,li)=>bank.forEach((g,gi)=>{
  const key=`${c} L${li+1} #${gi}`;shapes[key]=0;vals[key]=new Set();
  for(let i=0;i<N;i++){let o;try{o=g();}catch(e){failures.push([key,"THROW "+e.message]);fails++;continue;}
    total++;const t=render(o.q);vals[key].add(t);
    const bad=[];
    if(o.e===undefined&&!Number.isInteger(o.a))bad.push("non-integer answer "+o.a);
    if(/NaN|undefined|Infinity|null|object/.test(o.q+(o.hint||"")))bad.push("bad token");
    if(/[+\-]\s+-\s*\d/.test(t.replace(/\^\(- /g,"^(")))bad.push("sign collision");
    if(/(^|[\s(\[])1 x\b/.test(t)||/[+\-] 0(\s|\]|$)/.test(t)&&!/[=<>] 0/.test(t.match(/[+\-] 0(\s|\]|$)/)[0]))bad.push("unsimplified 1x / +0");
    const wbad=checkW(o);if(wbad)bad.push("worked start: "+wbad);
    let r;try{r=o.e!==undefined?checkE(o):check(o);}catch(e){if(e.message==="UNCHECKED"){unchecked[key]=(unchecked[key]||0)+1;r=null;}else{r=false;bad.push("check error "+e.message);}}
    if(r===false&&!bad.length)bad.push("WRONG");
    if(r===true)shapes[key]++;
    if(/\((?!10\))[^()]*\)\^\(1\)/.test(t))bad.push("exponent of 1 printed");
    if(bad.length){fails++;failBy[key]=(failBy[key]||0)+1;if(failures.length<(+process.env.MAXF||60))failures.push([key,bad.join("; "),t,o.hint||"",o.a]);}
  }}));
console.log(`questions ${total}, failures ${fails}`);
const checked=Object.values(shapes).reduce((a,b)=>a+b,0);
console.log(`independently recomputed: ${checked} / ${total} (${(100*checked/total).toFixed(1)}%)`);
console.log("unchecked shapes:",unchecked);console.log("worked starts checked: equations",wstats.eq,"· identities",wstats.id,"· answer expressions",wstats.ans);console.log("bare number equal to the answer (review):",wstats.bare,wstats.samples);console.log("failures by shape:",failBy);
for(const f of failures)console.log(JSON.stringify(f));
// variety: distinct questions per shape out of N
const low=Object.entries(vals).map(([k,s])=>[k,s.size]).sort((a,b)=>a[1]-b[1]).slice(0,12);
console.log("least varied shapes (distinct of "+N+"):",low.map(([k,n])=>`${k}=${n}`).join(", "));
if(process.argv[4]==="samples")for(const c of CATS)GEN[c].L.forEach((bank,li)=>bank.forEach((g,gi)=>{const o=g();console.log(`${c} L${li+1} #${gi}: ${render(o.q)}  {${o.hint||""}} → ${o.a}`);}));
