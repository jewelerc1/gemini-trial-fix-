const fs = require('fs');

let html = fs.readFileSync('/tmp/pulled_repo/index.html', 'utf8');

// 1. Add apk-download-btn styles and button for web visitors
if (!html.includes('.apk-download-btn')) {
  html = html.replace('</style>', 'html.android-webview .apk-download-btn{display:none!important}\n</style>');
  html = html.replace('<button class="primary" onclick="goSetup()">התחל משחק</button>',
    '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin:18px 0;"><button class="primary" style="min-width:210px" onclick="goSetup()">התחל משחק</button><a href="/download/apk" download="all-or-nothing-debug.apk" class="secondary apk-download-btn" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;min-width:210px;"><span>📱</span><span>הורד אפליקציה לטלפון (APK)</span></a></div>'
  );
}

// 2. Adapt speech for AndroidTTS JavaScript bridge
const oldSpeechInit = `if('speechSynthesis' in window){
  loadHebrewVoice();
  window.speechSynthesis.onvoiceschanged=loadHebrewVoice;
}else{
  voiceEnabled=false;
  window.addEventListener('load',()=>{
    const b=document.getElementById('voiceBtn');
    if(b)b.textContent='🔇 קול לא זמין ב־WebView';
  });
}`;

const newSpeechInit = `function hasSpeechSupport(){
  return (typeof window!=='undefined'&&((window.AndroidTTS&&typeof window.AndroidTTS.speak==='function')||('speechSynthesis' in window)));
}
if(typeof window!=='undefined'&&window.AndroidTTS&&typeof window.AndroidTTS.speak==='function'){
  voiceEnabled=true;
}else if('speechSynthesis' in window){
  loadHebrewVoice();
  window.speechSynthesis.onvoiceschanged=loadHebrewVoice;
}else{
  voiceEnabled=false;
  window.addEventListener('load',()=>{
    const b=document.getElementById('voiceBtn');
    if(b&&(!window.AndroidTTS||typeof window.AndroidTTS.speak!=='function'))b.textContent='🔇 קול לא זמין ב־WebView';
  });
}`;

if (html.includes(oldSpeechInit)) {
  html = html.replace(oldSpeechInit, newSpeechInit);
} else {
  console.log("oldSpeechInit not found directly, checking match...");
}

const oldSpeak = `function speakHebrew(text,priority=false){
  if(!voiceEnabled||!('speechSynthesis' in window))return;
  let t=cleanForSpeech(text);
  if(!t)return;`;

const newSpeak = `function speakHebrew(text,priority=false){
  if(!voiceEnabled)return;
  let t=cleanForSpeech(text);
  if(!t)return;
  if(window.AndroidTTS && typeof window.AndroidTTS.speak === 'function'){
    if(priority && typeof window.AndroidTTS.stop === 'function') window.AndroidTTS.stop();
    window.AndroidTTS.speak(t);
    return;
  }
  if(!('speechSynthesis' in window))return;`;

if (html.includes(oldSpeak)) {
  html = html.replace(oldSpeak, newSpeak);
} else {
  console.log("oldSpeak not found directly, checking match...");
}

const oldToggle = `function toggleVoice(){
  voiceEnabled=!voiceEnabled;
  let b=document.getElementById('voiceBtn');
  if(b)b.textContent=voiceEnabled?'🔊 קול פעיל':'🔇 קול כבוי';
  if(!voiceEnabled&&'speechSynthesis' in window){
    voiceQueue=[];
    voiceSpeaking=false;
    window.speechSynthesis.cancel();
  }else if(voiceEnabled){
    speakHebrew('הקול פעיל',true);
  }
}`;

const newToggle = `function toggleVoice(){
  voiceEnabled=!voiceEnabled;
  let b=document.getElementById('voiceBtn');
  if(b)b.textContent=voiceEnabled?'🔊 קול פעיל':'🔇 קול כבוי';
  if(window.AndroidTTS && typeof window.AndroidTTS.setEnabled === 'function'){
    window.AndroidTTS.setEnabled(voiceEnabled);
  }
  if(!voiceEnabled){
    if(window.AndroidTTS && typeof window.AndroidTTS.stop === 'function') window.AndroidTTS.stop();
    if('speechSynthesis' in window){
      voiceQueue=[];
      voiceSpeaking=false;
      window.speechSynthesis.cancel();
    }
  }else if(voiceEnabled){
    speakHebrew('הקול פעיל',true);
  }
}`;

if (html.includes(oldToggle)) {
  html = html.replace(oldToggle, newToggle);
} else {
  console.log("oldToggle not found directly, checking match...");
}

fs.writeFileSync('/app/applet/index.html', html, 'utf8');
fs.writeFileSync('/app/applet/app/src/main/assets/index.html', html, 'utf8');
console.log('SUCCESS: index.html updated in both locations! Length:', html.length);
