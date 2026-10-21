import {parseReading, measure, lineBuffer} from './model.js';
const $ = id => document.getElementById(id);
let mode = 'voltage', source = 'idle', port = null, reader = null, readTask = null;
let busy = false, stopping = false, held = false, rows = [], latest = null, started = null, lastReceived = 0;
let demoTimer = null, reference = 5, resistance = 10000;
const notice = message => { $('notice').textContent = message; };
const units = {voltage:'V',resistance:'kΩ',percent:'%'};
const labels = {voltage:'DC voltage · calculated from ADC',resistance:'Estimated wiper-to-GND resistance',percent:'Electrical position · fraction of full scale'};
function controls() {
  const active = source !== 'idle';
  $('connect').textContent = busy ? 'Connecting…' : source === 'usb' ? 'Disconnect Arduino' : '＋ Connect Arduino';
  $('connect').disabled = busy;
  $('demo').disabled = busy || source === 'usb';
  $('demo').textContent = source === 'demo' ? 'Stop demo □' : 'Try demo ▷';
  $('baud').disabled = busy || source === 'usb';
  $('pause').disabled = !active;
  $('pause').textContent = held ? '▷ Resume reading' : 'Ⅱ Hold reading';
  $('status').textContent = source === 'demo' ? 'Demo running' : source === 'usb' ? 'Arduino connected' : 'Not connected';
  $('dot').classList.toggle('on',active);
  $('sourceLabel').textContent = held ? 'Capture paused' : source === 'demo' ? 'Simulated data' : source === 'usb' ? 'USB serial · A0' : 'Ready when you are';
  $('dataSource').textContent = source === 'demo' ? 'Simulation' : source === 'usb' ? 'USB serial' : '—';
  $('sessionTag').textContent = held ? 'HOLD' : source === 'demo' ? 'DEMO' : source === 'usb' ? 'LIVE' : 'IDLE';
  $('captureState').textContent = held ? 'Reading held · capture paused' : source === 'idle' ? 'Waiting for signal' : !latest ? 'Waiting for first sample' : source === 'demo' ? 'Simulated signal' : 'Receiving samples';
}
function update() {
  $('readingLabel').textContent = labels[mode];
  $('unit').textContent = units[mode];
  $('modeTag').textContent = `A0 / ${mode.toUpperCase()}`;
  if (latest) {
    const m = measure(latest.raw, reference, resistance);
    $('reading').textContent = (mode === 'resistance' ? m.resistance / 1000 : m[mode]).toFixed(mode === 'percent' ? 1 : 3);
    $('raw').textContent = `${latest.raw} / 1023`;
    $('scaleFill').style.width = `${m.percent}%`;
  } else { $('reading').textContent = '—.———'; $('raw').textContent = '— / 1023'; $('scaleFill').style.width = '0%'; }
  const values = rows.map(r => r.voltage);
  for (const [id, v] of [['min',values.length ? Math.min(...values) : null],['max',values.length ? Math.max(...values) : null],['avg',values.length ? values.reduce((a,b)=>a+b,0)/values.length : null]]) {
    $(id).innerHTML = `${v === null ? '—' : v.toFixed(3)} <small>V</small>`;
  }
  $('samples').textContent = rows.length.toLocaleString();
  $('export').disabled = !rows.length;
  $('chartEmpty').hidden = rows.length > 0;
  controls(); draw();
}
function reset() { rows = []; latest = null; started = null; lastReceived = 0; $('duration').textContent = '00:00'; update(); }
function accept(raw) {
  lastReceived = Date.now();
  if (held) return;
  const time = Date.now();
  if (started === null) started = time;
  latest = {time,source,...measure(raw, reference, resistance)};
  rows.push(latest); if (rows.length > 10000) rows.shift();
  update();
}
function draw() {
  const canvas = $('chart'), rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width*dpr); canvas.height = Math.round(rect.height*dpr);
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
  const width=rect.width, height=rect.height, left=37, top=8, bottom=height-5;
  const end = held || source === 'idle' ? (latest?.time || Date.now()) : Date.now();
  const points = rows.filter(r => r.time >= end-30000);
  const ceiling = Math.max(reference,...points.map(r=>r.voltage));
  ctx.font='9px monospace'; ctx.fillStyle='#a1abb2'; ctx.lineWidth=1;
  for (let i=0;i<=4;i++) { const y=top+(bottom-top)*i/4;ctx.fillText((ceiling*(1-i/4)).toFixed(1)+'V',0,y+3);ctx.strokeStyle='#eef1f3';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width,y);ctx.stroke(); }
  if (!points.length) return;
  const xy = r => [left+(width-left)*(r.time-(end-30000))/30000,bottom-(bottom-top)*r.voltage/ceiling];
  ctx.beginPath();points.forEach((r,i)=>{const [x,y]=xy(r);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  ctx.strokeStyle='#91b747';ctx.lineWidth=2;ctx.stroke();
  const last=xy(points.at(-1));ctx.lineTo(last[0],bottom);ctx.lineTo(xy(points[0])[0],bottom);ctx.closePath();
  const gradient=ctx.createLinearGradient(0,top,0,bottom);gradient.addColorStop(0,'#cce9a466');gradient.addColorStop(1,'#cce9a400');ctx.fillStyle=gradient;ctx.fill();
  ctx.beginPath();ctx.arc(last[0],last[1],3,0,Math.PI*2);ctx.fillStyle='#91b747';ctx.fill();
}
async function stopUSB() {
  stopping = true;
  if (reader) { try { await reader.cancel(); } catch {} }
  if (readTask) await readTask;
}
async function readUSB(opened) {
  const decoder = new TextDecoder();
  const push = lineBuffer(line => { const value = parseReading(line); if (value !== null) accept(value); });
  let errorMessage = '';
  try {
    reader = opened.readable.getReader();
    while (!stopping) { const {value,done} = await reader.read(); if(done) break; push(decoder.decode(value,{stream:true})); }
  } catch (error) { if (!stopping) errorMessage = `Connection lost: ${error.message}. Reconnect your Uno to continue.`; }
  finally {
    reader?.releaseLock(); reader = null;
    try { await opened.close(); } catch {}
    port = null; source = 'idle'; held = false; controls();
    notice(errorMessage || 'Arduino disconnected. Your captured readings are still available to export.');
  }
}
$('connect').addEventListener('click',async()=>{
  if (source === 'usb') { await stopUSB(); return; }
  if (!('serial' in navigator) || !window.isSecureContext) { notice('USB needs desktop Chrome or Edge on HTTPS or localhost. Demo mode works here, too.'); return; }
  busy = true; controls();
  let selected = null;
  try {
    selected = await navigator.serial.requestPort();
    await selected.open({baudRate:Number($('baud').value)});
    clearInterval(demoTimer); demoTimer = null;
    source = 'usb'; held = false; stopping = false; port = selected; reset();
    notice('Connected. Waiting for A0 data… If no signal arrives, upload the included sketch and match its baud rate.');
    readTask = readUSB(selected);
  } catch(error) {
    if (selected) { try { await selected.close(); } catch {} }
    notice(error.name === 'NotFoundError' ? 'No port selected. Connect your Uno when you’re ready.' : `Could not connect: ${error.message}. Close Arduino Serial Monitor and check the USB cable.`);
  } finally { busy = false; controls(); }
});
$('demo').addEventListener('click',()=>{
  if (source === 'demo') { clearInterval(demoTimer);demoTimer=null;source='idle';held=false;controls();notice('Demo stopped. Simulated readings remain available to export.');return; }
  source='demo';held=false;reset();notice('Demo mode: all readings are simulated. Connect your Arduino for real measurements.');
  const origin=Date.now();
  const tick=()=>{const t=(Date.now()-origin)/1000;accept(Math.round(512+340*Math.sin(t*.55)+42*Math.sin(t*2.1)));};
  tick();demoTimer=setInterval(tick,50);
});
$('pause').addEventListener('click',()=>{held=!held;controls();notice(held?'Reading held. New samples are not recorded until you resume.':'Capture resumed.');});
$('reset').addEventListener('click',()=>{reset();notice('Session cleared. New incoming samples will start a fresh recording.');});
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});update();}));
for (const id of ['reference','pot']) $(id).addEventListener('change',()=>{
  if (!$(id).checkValidity()) {$(id).reportValidity();return;}
  if(id==='reference') reference=Number($(id).value);else resistance=Number($(id).value);
  reset();notice('Settings updated. Session cleared so measurements use one calibration.');
});
function download(text,name,type) {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').addEventListener('click',()=>{
  const header='timestamp,source,adc_raw,voltage_v,position_percent,estimated_resistance_ohms,reference_v,potentiometer_ohms';
  download([header,...rows.map(r=>[new Date(r.time).toISOString(),r.source,r.raw,r.voltage.toFixed(6),r.percent.toFixed(4),r.resistance.toFixed(3),reference,resistance].join(','))].join('\r\n'),'multimeter-'+new Date().toISOString().replace(/[:.]/g,'-')+'.csv','text/csv');
});
$('guide').addEventListener('click',()=>$('setup').showModal());
$('closeGuide').addEventListener('click',()=>$('setup').close());
$('setup').addEventListener('click',e=>{if(e.target===$('setup')){const r=$('setup').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('setup').close();}});
new ResizeObserver(draw).observe($('chart').parentElement);
setInterval(()=>{
  if (started && source !== 'idle' && !held) {const secs=Math.floor((Date.now()-started)/1000);$('duration').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');}
  if(source==='usb' && !held && (!lastReceived || Date.now()-lastReceived>3000)) $('captureState').textContent='Waiting for data · check sketch / baud';
  draw();
},1000);
update();
