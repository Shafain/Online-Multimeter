export const MODES = {
  voltage:{name:'DC VOLTAGE',unit:'V'}, current:{name:'DC CURRENT',unit:'A'},
  resistance:{name:'RESISTANCE',unit:'Ω'},continuity:{name:'CONTINUITY',unit:'Ω'},
  pot:{name:'POTENTIOMETER',unit:'%'},ac:{name:'AC / ADVANCED',unit:''}
};
export function parseFrame(line) {
  const text=line.trim(); if(!text)return null;
  const valid=x=>Number.isInteger(x)&&x>=0&&x<=1023;
  if(/^\d+$/.test(text)){const raw=Number(text);return valid(raw)?{A0:raw}:null;}
  try {const v=JSON.parse(text);if(!v||typeof v!=='object')return null;if(valid(v.raw))return {A0:v.raw};
    const result={};for(let i=0;i<6;i++){const key=`A${i}`;if(valid(v[key]))result[key]=v[key];}
    return Object.keys(result).length?result:null;
  } catch{return null;}
}
export function parseReading(line){return parseFrame(line)?.A0??null;}
export function lineBuffer(onLine){let pending='',discard=false;return chunk=>{for(const c of chunk){if(c==='\n'){if(!discard)onLine(pending);pending='';discard=false;}else if(!discard){pending+=c;if(pending.length>512){pending='';discard=true;}}}};}
export function validateConfig(mode,c){
  if(!Number.isFinite(c.reference)||c.reference<=0||c.reference>5)return 'ADC reference must be greater than 0 and at most 5 V.';
  if(mode==='ac')return 'AC RMS and advanced modes need a dedicated front end and firmware.';
  if(mode==='voltage'&&(!Number.isFinite(c.ratio)||c.ratio<1||c.ratio>100))return 'Divider multiplier must be between 1 and 100.';
  if(mode==='current'&&(!Number.isFinite(c.zero)||c.zero<0||c.zero>c.reference||!Number.isFinite(c.sensitivity)||c.sensitivity<=0||!Number.isFinite(c.currentLimit)||c.currentLimit<=0))return 'Enter the sensor zero voltage, positive V/A sensitivity, and rated current limit.';
  if(['resistance','continuity'].includes(mode)&&(!Number.isFinite(c.known)||c.known<=0))return 'Enter a positive reference resistance.';
  if(mode==='continuity'&&(!Number.isFinite(c.threshold)||c.threshold<0))return 'Enter a nonnegative continuity threshold.';
  if((mode==='current'||mode==='resistance'||mode==='continuity'||(mode==='voltage'&&c.ratio>1))&&!c.confirmed)return 'Confirm the matching measurement hardware before enabling this mode.';
  return null;
}
export function convert(raw,mode,c){
  const error=validateConfig(mode,c);if(error)return {value:null,status:'SETUP',note:error};
  const v=raw/1023*c.reference;
  if(mode==='voltage')return {value:v*c.ratio,status:raw===1023?'RAIL':'OK',note:raw===1023?'ADC at full scale; input may exceed the range.':'DC voltage relative to GND'};
  if(mode==='pot')return {value:raw/1023*100,status:'OK',note:'Electrical position, not a resistance measurement'};
  if(mode==='current'){
    const value=(v-c.zero)/c.sensitivity;
    if(raw===0||raw===1023||Math.abs(value)>c.currentLimit)return {value:null,status:'OL',note:'Sensor or ADC range exceeded. Check the circuit.'};
    return {value,status:'OK',note:'Calculated from the configured analog current sensor'};
  }
  if(raw===1023)return {value:null,status:'OL',note:'Open circuit or resistance outside the usable range'};
  const value=c.known*raw/(1023-raw);
  return {value,status:mode==='continuity'?(value<=c.threshold?'CLOSED':'OPEN'):'OK',note:mode==='continuity'?(value<=c.threshold?'Below continuity threshold':'Above continuity threshold'):'Reference divider estimate · unpowered component only'};
}
export function format(value,unit){if(value===null||!Number.isFinite(value))return {number:'—',unit};const abs=Math.abs(value);if(unit==='Ω'&&abs>=1e6)return {number:(value/1e6).toFixed(3),unit:'MΩ'};if(unit==='Ω'&&abs>=1000)return {number:(value/1000).toFixed(3),unit:'kΩ'};return {number:value.toFixed(unit==='%'?1:unit==='Ω'?1:3),unit};}
