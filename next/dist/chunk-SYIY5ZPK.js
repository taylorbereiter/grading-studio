import{a as y}from"./chunk-NVRZFDHS.js";import{b as v}from"./chunk-NWOEX5M7.js";import{a as d,h as x,j as f,k}from"./chunk-B33SDWGH.js";var z=`.ls-slide{--text-heading:24px;--text-display:28px}
.ls-slide{position:relative;width:1280px;height:720px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#000;background:#DFDBD5}
.ls-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,#ECEAE6 0%,#E2DED9 45%,#B9B6B1 100%)}
.ls-fade{position:absolute;left:0;right:0;top:212px;height:431px;background:linear-gradient(to bottom,rgba(223,219,213,0),#DFDBD5)}
.ls-wood{position:absolute;left:0;right:0;top:643px;height:78px;background:repeating-linear-gradient(90deg,#7A4E2D 0 90px,#8B5A35 90px 180px,#6E4528 180px 260px);background-size:cover;background-position:center}
.ls-t{position:absolute;left:152px;top:84px;width:1008px;height:110px;padding:10px 10px 0;font-size:42.7px;line-height:.95;text-transform:uppercase;overflow:hidden}
.ls-rule,.ls-trule{position:absolute;height:3.3px;background:var(--la,#B71E42)}
.ls-rule{left:153px;top:192px;width:1009px}
.ls-ttl{position:absolute;left:254px;top:84px;width:907px;height:266px;padding:6px 10px;display:flex;align-items:flex-end;font-size:78px;line-height:.92;text-transform:uppercase;overflow:hidden}
.ls-trule{left:254px;top:369px;width:907px}
.ls-sub{position:absolute;left:254px;top:373px;width:907px;height:103px;padding:8px 10px;font-size:var(--text-heading);line-height:1.25;text-transform:uppercase}
.ls-body{position:absolute;left:152px;top:211px;width:1008px;height:362px;padding:5px 10px;overflow:hidden;line-height:1.2}
.ls-pic{position:absolute;left:152px;top:211px;width:1008px;height:410px;display:flex;align-items:flex-start;justify-content:center}
.ls-pic img{max-width:100%;max-height:100%;object-fit:contain}
.ls-src{position:absolute;left:152px;top:622px;width:1008px;height:20px;text-align:center;font-size:13.3px;color:#222}
.ls-lk{position:absolute;inset:0;background:var(--lbg);color:var(--lt)}.ls-lk.lk-wood{background:none}
.ls-lk:not(.lk-wood) .ls-bg,.ls-lk:not(.lk-wood) .ls-fade,.ls-lk:not(.lk-wood) .ls-wood,.ls-lk:not(.lk-wood) .ls-rule,.ls-lk:not(.lk-wood) .ls-trule{display:none}
.ls-lk:not(.lk-wood) .ls-t,.ls-lk:not(.lk-wood) .ls-ttl,.ls-lk:not(.lk-wood) .ls-sub{text-transform:none}
.ls-lk:not(.lk-wood) .ls-t{font-weight:700;color:var(--ltt)}.ls-lk:not(.lk-wood) .ls-ttl{font-weight:700;color:var(--ltt)}
.lk-cream .ls-t,.lk-cream .ls-ttl,.lk-notebook .ls-t,.lk-notebook .ls-ttl{font-family:Georgia,serif;font-weight:400}
.lk-bigtype .ls-t,.lk-bigtype .ls-ttl{font-weight:800;letter-spacing:-.01em}
.ls-lk .ls-src{color:var(--lt);opacity:.85}
.ls-shape{position:absolute}
.ls-bx{position:absolute;display:flex;flex-direction:column;line-height:1.2;overflow:hidden}
.rt{position:relative;min-height:1.2em}
.rt.l1{margin-left:1.9em}.rt.l2{margin-left:3.8em}
.rt-b{padding-left:.86em}.rt-b::before{content:"\\2022";position:absolute;left:0;color:var(--la,#B71E42)}
.rt-n{padding-left:1.45em}.rt-n::before{content:attr(data-n) ".";position:absolute;left:0;color:var(--la,#B71E42)}
.rt b,.rt strong{font-weight:700}.rt u{text-decoration:underline}
.ls-body .rt{margin-top:13px}.ls-body .rt.l1,.ls-body .rt.l2{margin-top:7px}
.ls-bx .rt+.rt{margin-top:var(--gap)}
.ls-t,.ls-ttl,.ls-sub,.ls-body,.ls-bx{overflow-wrap:break-word}
.ls-full{align-items:center;background:var(--lbg)}
.ls-full img{width:100%;height:100%}
.ls-fullsrc{left:0;top:696px;width:1280px}
.ls-ph{color:#8a8580;text-transform:none}
.rt-cwrap{position:relative;display:inline-flex}
.rt-auto{width:100%}
.ls-vid{position:absolute;left:152px;top:211px;width:1008px;height:410px;display:flex;align-items:flex-start;justify-content:center}
.ls-vid img{max-width:100%;max-height:100%;object-fit:contain}
.ls-vlink{align-self:center;font-size:var(--text-display);color:#1A4F8A;text-decoration:underline;word-break:break-all;padding:20px}
.ls-play{position:absolute;left:50%;top:50%;width:96px;height:68px;margin:-34px 0 0 -48px;border-radius:16px;background:rgba(200,0,0,.9)}
.ls-play::after{content:"";position:absolute;left:38px;top:20px;border-left:28px solid #fff;border-top:14px solid transparent;border-bottom:14px solid transparent}`;var B=t=>typeof t=="string"&&t.startsWith("gsex:"),U=(t,o)=>"gsex:"+t+"|"+(+o||0),F=t=>{let o=/^gsex:([^|]+)\|(\d+)$/.exec(t||"");return o?{id:o[1],page:+o[2]}:null},r=new Map,a=new Map;function g(t){return r.has(t)?r.get(t):null}function h(t){if(r.has(t))return Promise.resolve(r.get(t));if(a.has(t))return a.get(t);let o=F(t),l=(o?v(o.id,o.page):Promise.resolve(null)).then(e=>e?URL.createObjectURL(e):"",()=>"").then(e=>(r.set(t,e),a.delete(t),e));return a.set(t,l),l}async function W(t){let o=await h(t);return o?new Promise(l=>{let e=new Image;e.onload=()=>l({w:e.naturalWidth,h:e.naturalHeight}),e.onerror=()=>l({w:0,h:0}),e.src=o}):{w:0,h:0}}var D=!1;function H(){if(D)return;D=!0;let t=document.createElement("style");t.dataset.slides="",t.textContent=z,document.head.appendChild(t)}function J({slide:t,lesson:o,plan:l,width:e=320,label:R,fill:p,...S}){H();let s=k(null),[u,A]=x(0);f(()=>{if(!p||!s.current||!s.current.parentNode)return;let i=s.current.parentNode,b=()=>A(Math.floor(i.clientWidth));if(b(),typeof ResizeObserver!="function")return;let w=new ResizeObserver(b);return w.observe(i),()=>w.disconnect()},[p]),p&&u&&(e=Math.min(e,u));let n=t&&t.img&&B(t.img.src)?t.img.src:"",[,M]=x(0);f(()=>{n&&g(n)==null&&h(n).then(()=>M(i=>i+1))},[n]);let c=n?{...t,img:{...t.img,src:g(n)||""}}:t,j=y(l),C=e/1280,m="";try{m=c?j.slideHtml(c,o,!1):""}catch(i){console.error(i)}return d("div",{class:"slidebox",ref:s,style:{width:e+"px",height:Math.round(e*720/1280)+"px"},role:"img","aria-label":R,...S},d("div",{class:"ls-slide","data-raw":!0,style:{transform:"scale("+C+")",transformOrigin:"0 0"},dangerouslySetInnerHTML:{__html:m}}))}export{B as a,U as b,h as c,W as d,J as e};
