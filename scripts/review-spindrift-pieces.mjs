#!/usr/bin/env node
/** Original artwork only: an offline, proportion-preserving height study. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "test-results/piece-review");
const pieces = {};
for (const color of ["w", "b"]) {
  for (const code of "KQBNRP") {
    pieces[color + code] =
      `data:image/svg+xml;base64,${readFileSync(resolve(root, `public/pieces/spindrift/${color}${code}.svg`)).toString("base64")}`;
  }
}
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spindrift — original pieces, height study</title>
<style>
*{box-sizing:border-box}body{font:16px system-ui;background:#f7f5f1;color:#222;margin:24px auto;max-width:1060px;padding:0 20px}
 h1{font-size:28px;margin-bottom:8px}h2{font-size:20px;margin:24px 0 8px}p{max-width:900px;line-height:1.5}a{color:#155bb2}button,select{font:inherit;padding:9px;margin:3px;border:1px solid #777;background:#fff;border-radius:6px;cursor:pointer}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #196dcc;outline-offset:2px}
 .panel{background:white;border-radius:12px;padding:18px;margin:20px 0}.strip{display:flex;align-items:end;gap:0}.row{display:flex;align-items:center;margin:8px 0;gap:12px}.label{width:150px;flex-shrink:0;font-size:14px}.square{width:var(--size);height:var(--size);position:relative;background:var(--light);flex-shrink:0;overflow:hidden}.square.shade{background:var(--dark)}.square img{position:absolute;width:100%;height:100%;left:0;top:0;transform-origin:0 0;max-width:none}
 .board-colors{--light:#f0d9b5;--dark:#b58863}.board-colors.dark{--light:#c2ab88;--dark:#8a6746}.rows{overflow-x:auto;padding-bottom:8px}.controls{display:flex;flex-wrap:wrap;gap:16px}.control{display:grid;gap:4px;min-width:140px}.control input{width:140px}.control output{font-size:14px}.names{display:flex;margin-left:162px}.names span{width:var(--size);flex-shrink:0;text-align:center;font-size:12px}table{border-collapse:collapse;font-size:14px;min-width:540px}td,th{padding:8px 12px;border-bottom:1px solid #ddd;text-align:right}th:first-child,td:first-child{text-align:left}.note{font-size:14px;color:#555}#error{color:#a00}
</style>
<h1>Original Spindrift pieces · height study</h1>
<p><strong>The game now uses the accepted halfway proportions with the original SVGs.</strong> This page changes only the size and position of each complete piece. Every curve, ornament and outline keeps its original proportions. Controls on this page are previews and do not change the game.</p>
<div class="panel"><h2>Measured reference heights</h2><p>King = 100%. FIDE values describe physical chessmen. Digital values below are measured from white SVG artwork bounds, including strokes, rendered at 1000px with alpha ≥ 50%; small rounding differences are expected.</p>
<div class="rows"><table><thead><tr><th>Reference</th><th>King</th><th>Queen</th><th>Bishop</th><th>Knight</th><th>Rook</th><th>Pawn</th></tr></thead><tbody>
<tr><td><a href="https://handbook.fide.com/chapter/ChessEquipmentWithoutElectronicComponenets032026">FIDE · March 2026 §6.3</a></td><td>100</td><td>89.5</td><td>73.7</td><td>63.2</td><td>57.9</td><td>52.6</td></tr>
<tr><td><a href="https://github.com/lichess-org/lila/tree/master/public/piece/cburnett">CBurnett · measured</a></td><td>100</td><td>100.4</td><td>99.1</td><td>95.4</td><td>89.7</td><td>91.3</td></tr>
<tr><td><a href="https://github.com/lichess-org/lila/tree/master/public/piece/merida">Merida · measured</a></td><td>100</td><td>100.6</td><td>96.2</td><td>98.6</td><td>96.1</td><td>93.4</td></tr>
<tr id="original-metrics"><td>Original Spindrift · measured</td></tr>
</tbody></table></div>
<p class="note">Reference measurements: 12 September 2026. Digital sets do not necessarily follow the physical height order; recognition also comes from the original silhouettes. Reference artwork is not included or used in this project.</p></div>
<div class="panel"><h2>Adjust one piece at a time</h2>
<p>Start with the pawn. The king stays at its current enlarged size. Each slider gives visible height relative to the king; width scales by exactly the same factor. The preview aligns all feet to the king’s baseline.</p>
<div><button id="restore">Original sizes</button><button id="half">Halfway toward FIDE</button><button id="fide">FIDE physical ratios</button></div>
<p class="note">“Halfway” is an experiment between the original measurements and FIDE ratios, not a published standard.</p>
<div class="controls" id="controls"></div>
<p><label>Square size <select id="size"><option>32</option><option>40</option><option>48</option><option selected>80</option></select></label> <label>Board palette <select id="theme"><option>light</option><option>dark</option></select></label></p>
<p id="error" role="alert"></p>
<div class="rows board-colors" id="study" style="--size:80px"></div>
</div>
<div class="panel"><h2>Three starting points</h2><p>All three use the same original paths. Compare at 40px squares as well as the enlarged view.</p><div class="rows board-colors" id="presets" style="--size:80px"></div></div>
<script>
const sources=${JSON.stringify(pieces)};
const names={K:'King',Q:'Queen',B:'Bishop',N:'Knight',R:'Rook',P:'Pawn'};
const fide={K:1,Q:85/95,B:70/95,N:60/95,R:55/95,P:50/95};
const metrics={},initial={},values={},inputs={};
const byId=id=>document.getElementById(id);
function row(label,color,ratios,aligned){
 const row=document.createElement('div');row.className='row';const title=document.createElement('span');title.className='label';title.textContent=label+' · '+(color==='w'?'white':'black');row.append(title);
 const strip=document.createElement('div');strip.className='strip';row.append(strip);
 for(const code of Object.keys(names)){
  const box=document.createElement('div');box.className='square'+(Object.keys(names).indexOf(code)%2?' shade':'');const img=new Image();img.alt=(color==='w'?'White ':'Black ')+names[code];img.src=sources[color+code];
  if(aligned){
   const m=metrics[code],scale=metrics.K.height*ratios[code]/m.height;
   const dx=(.5-(m.x+m.width/2)*scale)*100;
   const dy=(metrics.K.bottom-m.bottom*scale)*100;
   img.style.transform='translate('+dx+'%,'+dy+'%) scale('+scale+')';
  }
  box.append(img);strip.append(box);
 }
 return row;
}
function labels(container){const line=document.createElement('div');line.className='names';for(const name of Object.values(names)){const span=document.createElement('span');span.textContent=name;line.append(span);}container.append(line);}
function render(){
 const study=byId('study');study.replaceChildren();labels(study);
 for(const color of ['w','b']){study.append(row('Game now',color,Object.fromEntries(Object.keys(names).map(code=>[code,(initial[code]+fide[code])/2])),true));study.append(row('Height preview',color,values,true));}
 for(const code of Object.keys(inputs)){inputs[code].value=values[code]*100;byId('value-'+code).textContent=(values[code]*100).toFixed(1)+'% of king';}
 const presets=byId('presets');presets.replaceChildren();labels(presets);
 const half=Object.fromEntries(Object.keys(names).map(code=>[code,(initial[code]+fide[code])/2]));
 for(const [label,ratios]of [['Original',initial],['Halfway',half],['FIDE ratios',fide]])for(const color of ['w','b'])presets.append(row(label,color,ratios,label!=='Original'));
}
function setPreset(ratios){Object.assign(values,ratios);render();}
async function main(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1000;const ctx=canvas.getContext('2d');
 for(const code of Object.keys(names)){
  const img=new Image();img.src=sources['w'+code];await img.decode();ctx.clearRect(0,0,1000,1000);ctx.drawImage(img,0,0,1000,1000);
  const pixels=ctx.getImageData(0,0,1000,1000).data;let x0=1000,y0=1000,x1=-1,y1=-1;
  for(let y=0;y<1000;y++)for(let x=0;x<1000;x++){if(pixels[(y*1000+x)*4+3]<128)continue;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  metrics[code]={x:x0/1000,y:y0/1000,width:(x1-x0+1)/1000,height:(y1-y0+1)/1000,bottom:(y1+1)/1000};
 }
 for(const code of Object.keys(names)){
  initial[code]=metrics[code].height/metrics.K.height;values[code]=(initial[code]+fide[code])/2;
  const cell=document.createElement('td');cell.textContent=(initial[code]*100).toFixed(1);byId('original-metrics').append(cell);
  const label=document.createElement('label');label.className='control';label.textContent=names[code];
  const input=document.createElement('input');input.type='range';input.min=45;input.max=100;input.step=.1;input.value=values[code]*100;input.disabled=code==='K';input.setAttribute('aria-label',names[code]+' height as percentage of king');inputs[code]=input;
  const output=document.createElement('output');output.id='value-'+code;label.append(input,output);byId('controls').append(label);
  input.addEventListener('input',()=>{values[code]=Number(input.value)/100;render()});
 }
 byId('restore').onclick=()=>setPreset(initial);
 byId('fide').onclick=()=>setPreset(fide);
 byId('half').onclick=()=>setPreset(Object.fromEntries(Object.keys(names).map(code=>[code,(initial[code]+fide[code])/2])));
 byId('size').onchange=()=>document.querySelectorAll('.board-colors').forEach(el=>el.style.setProperty('--size',byId('size').value+'px'));
 byId('theme').onchange=()=>document.querySelectorAll('.board-colors').forEach(el=>el.classList.toggle('dark',byId('theme').value==='dark'));
 render();document.body.dataset.ready='true';
}
main().catch(error=>byId('error').textContent=error.message);
</script></html>`;
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "review.html"), html);
console.log(`Height study: ${resolve(output, "review.html")}`);
