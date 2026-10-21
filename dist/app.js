import {MODES,parseFrame,lineBuffer,validateConfig,convert,format} from './model.js';
const $=id=>document.getElementById(id);
let mode='voltage',channel='A0',source='idle',held=false,busy=false,stopping=false;
let reader=null,port=null,readTask=null,timer=null,rows=[],latest=null,start=null,lastSeen=0;
let config={reference:5,ratio:1,zero:2.5,sensitivity:.185,currentLimit:5,known:1000,threshold:50,confirmed:false};
const say=text=>{$('notice').textContent=text;};
function field(id,label,value,min,max,step='any'){return `<label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" min="${min}" ${max===null?'':`max="${max}"`} step="${step}" required>`;}
function settings(){
  let html='',hint='Direct voltage: selected analog input → signal; GND → circuit GND. Input must remain within 0–5 V.';
  if(mode==='voltage'){html=field('ratio','DIVIDER MULTIPLIER / (R TOP + R BOTTOM) ÷ R BOTTOM',config.ratio,1,100);hint+=' A multiplier above 1 needs an external divider and protection. It does not raise the Uno input limit.';}
  if(mode==='current'){html=field('zero','SENSOR ZERO-CURRENT OUTPUT / V',config.zero,0,5)+field('sensitivity','SENSOR SENSITIVITY / V PER A',config.sensitivity,.000001,null)+field('currentLimit','SENSOR RATED CURRENT LIMIT / A',config.currentLimit,.000001,null);hint='Connect the output of a suitable analog current sensor to the selected input. Use its actual datasheet and calibration. Never put an Arduino analog pin directly in the current path.';}
  if(mode==='resistance'||mode==='continuity'){html=field('known','KNOWN REFERENCE RESISTOR / Ω',config.known,1,10000000);hint='Use the Uno 5V supply as the ADC reference and divider supply: 5V → known resistor → analog input → unknown resistor → GND. Disconnect the tested component from power and other circuit paths.';}
  if(mode==='continuity')html+=field('threshold','CONTINUITY THRESHOLD / Ω',config.threshold,0,10000);
  if(mode==='pot')hint='Potentiometer outer terminals → 5V and GND, wiper → selected input. Shows electrical position; no total resistance rating is assumed.';
  if(mode==='ac'){html='<div class="blocked">Not available with this acquisition firmware. AC RMS, frequency, diode, and capacitance testing require suitable measurement hardware and a different acquisition method.</div>';hint='The current 20 Hz stream cannot measure mains-frequency waveforms accurately. Do not connect AC or mains directly.';}
  if(['voltage','current','resistance','continuity'].includes(mode))html+='<label class="check"><input type="checkbox" id="confirmed"><span>I have wired the matching external hardware and verified its ratings. Required for divider, current, and resistance modes.</span></label>';
  $('modeSettings').innerHTML=html;$('setupHint').textContent=hint;$('reference').value=config.reference;
  $('settings').querySelector('button').disabled=mode==='ac';
}
function controls(){
  $('connect').textContent=busy?'Connecting…':source==='usb'?'Disconnect device':'Connect device ↗';$('connect').disabled=busy;
  $('demo').textContent=source==='demo'?'□ Stop demo':'▷ Start demo';$('demo').disabled=busy||source==='usb';
  $('hold').disabled=source==='idle';$('hold').textContent=held?'▷ Resume':'Ⅱ Hold';$('holdBadge').hidden=!held;
  $('status').textContent=source==='usb'?'USB CONNECTED':source==='demo'?'DEMO RUNNING':'DISCONNECTED';
  $('source').textContent=source==='demo'?'SIMULATED':source==='usb'?'USB SERIAL':'NO SIGNAL';
  $('capture').textContent=held?'Held':source==='demo'?'Simulation':source==='usb'?'USB serial':'Idle';
  $('baud').disabled=busy||source==='usb';$('export').disabled=!rows.length;
}
function clear(){rows=[];latest=null;start=null;lastSeen=0;$('elapsed').textContent='00:00';render();}
function render(){
  controls();const info=MODES[mode];$('modeName').textContent=info.name;$('channelLabel').textContent=channel;
  $('graphUnit').textContent=`${info.name} / ${info.unit||'unavailable'}`;
  $('range').textContent=mode==='voltage'?`INPUT × ${config.ratio} · ${(config.reference*config.ratio).toFixed(2)} V FULL SCALE`:mode==='current'?`SENSOR RANGE ±${config.currentLimit} A`:mode==='pot'?'POSITION · 0–100%':mode==='ac'?'HARDWARE REQUIRED':`REFERENCE ${config.known} Ω`;
  const error=validateConfig(mode,config),measurement=latest?convert(latest.raw,mode,config):null;
  const displayed=format(measurement?.value??null,info.unit);
  $('reading').textContent=error?'SETUP':measurement?.status==='OL'?'OL':latest?displayed.number:'—.———';
  $('unit').textContent=displayed.unit;
  $('readingNote').textContent=error||measurement?.note||'Waiting for a device';
  $('raw').textContent=`RAW ${latest?.raw??'—'} / 1023`;$('barFill').style.width=latest?`${latest.raw/1023*100}%`:'0%';
  $('resolution').textContent=`${(config.reference/1023*1000).toFixed(2)} mV / ADC STEP`;
  $('sampleState').textContent=source==='idle'?'STOPPED':held?'HELD':lastSeen&&Date.now()-lastSeen<3000?'RECEIVING':'WAITING FOR CHANNEL';
  const values=rows.filter(r=>r.value!==null).map(r=>r.value);
  for(const [id,v] of [['min',values.length?Math.min(...values):null],['max',values.length?Math.max(...values):null],['avg',values.length?values.reduce((a,b)=>a+b,0)/values.length:null]]){const f=format(v,info.unit);$(id).textContent=`${f.number} ${f.unit}`;}
  $('count').textContent=rows.length.toLocaleString();$('empty').hidden=values.length>0;draw();
}
function accept(frame){if(!(channel in frame))return;lastSeen=Date.now();if(held)return;const time=Date.now();start??=time;
  const raw=frame[channel],m=convert(raw,mode,config);latest={time,raw,mode,channel,source,value:m.value,status:m.status};rows.push(latest);if(rows.length>10000)rows.shift();render();
}
function draw(){const canvas=$('chart'),rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const end=held||source==='idle'?(latest?.time||Date.now()):Date.now();const points=rows.filter(r=>r.time>=end-30000);const values=points.filter(r=>r.value!==null).map(r=>r.value);
  let low=Math.min(0,...values),high=Math.max(1,...values);if(high===low)high=low+1;
  const left=50,top=10,bottom=rect.height-8,width=rect.width;ctx.font='9px monospace';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=top+(bottom-top)*i/4;ctx.fillStyle='#7e8996';ctx.fillText((high-(high-low)*i/4).toFixed(1),0,y+3);ctx.strokeStyle='#2a3037';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width,y);ctx.stroke();}
  for(let i=0;i<=10;i++){const x=left+(width-left)*i/10;ctx.strokeStyle=i%5===0?'#30454c':'#1d2d34';ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();} ctx.strokeStyle='#64e6e5';ctx.lineWidth=1.7;ctx.beginPath();let connected=false,previous=0;
  for(const p of points){if(p.value===null){connected=false;continue;}const x=left+(width-left)*(p.time-end+30000)/30000,y=bottom-(bottom-top)*(p.value-low)/(high-low);if(!connected||p.time-previous>500)ctx.moveTo(x,y);else ctx.lineTo(x,y);connected=true;previous=p.time;}ctx.stroke();
}
async function readUSB(opened){const decoder=new TextDecoder();const push=lineBuffer(line=>{const frame=parseFrame(line);if(frame)accept(frame);});let failure='';
  try{reader=opened.readable.getReader();while(!stopping){const {value,done}=await reader.read();if(done)break;push(decoder.decode(value,{stream:true}));}}
  catch(e){if(!stopping)failure=`Connection lost: ${e.message}`;}
  finally{reader?.releaseLock();reader=null;try{await opened.close();}catch{}port=null;source='idle';held=false;render();say(failure||'Disconnected. Your readings remain available for export.');}
}
$('connect').addEventListener('click',async()=>{
  if(source==='usb'){busy=true;controls();stopping=true;try{await reader?.cancel();await readTask;}finally{busy=false;controls();}return;}
  if(!navigator.serial||!isSecureContext){say('USB serial needs desktop Chrome or Edge over HTTPS or localhost. Demo mode is available in this browser.');return;}
  busy=true;controls();let selected;
  try{selected=await navigator.serial.requestPort();await selected.open({baudRate:Number($('baud').value)});clearInterval(timer);timer=null;port=selected;source='usb';held=false;stopping=false;clear();say('USB connected. Waiting for the selected channel. Use the new firmware for A1–A5.');readTask=readUSB(selected);}
  catch(e){if(selected)try{await selected.close();}catch{}say(e.name==='NotFoundError'?'No device selected.':`Could not connect: ${e.message}. Close Serial Monitor and check your cable.`);}
  finally{busy=false;controls();}
});
$('demo').addEventListener('click',()=>{if(source==='demo'){clearInterval(timer);timer=null;source='idle';held=false;render();say('Demo stopped. All captured values are labeled simulated.');return;}
  source='demo';held=false;clear();const origin=Date.now();const tick=()=>{const t=(Date.now()-origin)/1000;accept(Object.fromEntries(Array.from({length:6},(_,i)=>[`A${i}`,Math.round(512+330*Math.sin(t*.6+i)+30*Math.sin(t*2))])));};tick();timer=setInterval(tick,50);say('SIMULATION ONLY. Setup-required modes remain unavailable until you configure their measurement model.');
});
$('hold').addEventListener('click',()=>{held=!held;render();say(held?'Capture paused. Resume to record new readings.':'Capture resumed.');});
$('reset').addEventListener('click',()=>{clear();say('Session cleared.');});
$('channel').addEventListener('change',()=>{channel=$('channel').value;clear();say(`Selected ${channel}. A1–A5 require the new multi-channel sketch; old firmware only sends A0.`);});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{mode=button.dataset.mode;config.confirmed=false;for(const b of document.querySelectorAll('[data-mode]')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));}settings();clear();say('Function changed. Review the wiring and apply the measurement setup before using additional hardware.');});
$('settings').addEventListener('submit',e=>{e.preventDefault();const next={...config,reference:Number($('reference').value),confirmed:$('confirmed')?.checked||false};for(const key of ['ratio','zero','sensitivity','currentLimit','known','threshold'])if($(key))next[key]=Number($(key).value);const error=validateConfig(mode,next);if(error){say(error);return;}config=next;clear();say('Measurement setup applied. A new session has started.');});
$('export').addEventListener('click',()=>{const head='timestamp,source,mode,channel,raw,value,unit,status,adc_reference_v,divider_multiplier,sensor_zero_v,sensitivity_v_per_a,sensor_limit_a,reference_resistor_ohms,continuity_threshold_ohms';const csv=[head,...rows.map(r=>[new Date(r.time).toISOString(),r.source,r.mode,r.channel,r.raw,r.value??'',MODES[r.mode].unit,r.status,config.reference,config.ratio,config.zero,config.sensitivity,config.currentLimit,config.known,config.threshold].join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`multimeter-${Date.now()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('guide').addEventListener('click',()=>$('guideDialog').showModal());$('closeGuide').addEventListener('click',()=>$('guideDialog').close());
new ResizeObserver(draw).observe($('chart').parentElement);setInterval(()=>{if(start&&source!=='idle'&&!held){const sec=Math.floor((Date.now()-start)/1000);$('elapsed').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;}render();},1000);
settings();render();
