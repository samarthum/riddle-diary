import './style.css';
import { DiaryScene } from './scene.js';
import { Conversation } from './conversation.js';
import { cancelPageJobs } from './animation.js';
import { inkTip } from './ink.js';

const $ = selector => document.querySelector(selector);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const conversation = new Conversation();
const input = $('#inscription'); const form = $('#writing-form');
const status = $('#status'); const send = $('#send');
let scene, draftProgress = 0, draftActive = false, timer, fadeTimer, lastReply = '', generation = 0, controller;
let jobs = []; let soundEnabled = false, audio, scratch, gain;
let lastDraw = 0, replyVisible = false;
const markReplyInk = value => { $('#world').dataset.replyInk=value; };
function clearReplyPage() { scene.rightPage.setText('');scene.rightPage.render(0);markReplyInk('blank'); }

function setStatus(text) { status.textContent = text; }
function controls(busy) {
  input.disabled = busy; send.disabled = busy || !input.value.trim();
  $('#replay').disabled = busy || !lastReply || !!input.value.trim();
  $('#restart').disabled = busy;
}
function playSound(active) {
  if (!soundEnabled || !gain) return;
  gain.gain.setTargetAtTime(active ? .011 : 0, audio.currentTime, .08);
}
function toggleSound() {
  soundEnabled = !soundEnabled;
  if(soundEnabled && !audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if(!AudioContext) { soundEnabled=false;return; }
    audio=new AudioContext();
    const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);
    const data=buffer.getChannelData(0);
    let previous=0;
    for(let i=0;i<data.length;i++){const white=Math.random()*2-1;previous=(previous+.08*white)/1.08;data[i]=previous*3;}
    scratch=audio.createBufferSource();scratch.buffer=buffer;scratch.loop=true;
    const filter=audio.createBiquadFilter();filter.type='highpass';filter.frequency.value=1100;
    gain=audio.createGain();gain.gain.value=0;scratch.connect(filter);filter.connect(gain);gain.connect(audio.destination);scratch.start();
  }
  audio?.resume();
  if(!soundEnabled && gain)gain.gain.setTargetAtTime(0,audio.currentTime,.08);
  $('#sound').textContent=soundEnabled?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(soundEnabled));
}
function animatePage(side, type, duration) {
  jobs = cancelPageJobs(jobs, side);
  const page = side === 'left' ? scene.leftPage : scene.rightPage;
  if(scene.reduced && type==='write') {page.render(page.total+20);return Promise.resolve();}
  return new Promise(resolve => jobs.push({side,page,type,duration:scene.reduced?200:duration,start:performance.now(),resolve}));
}
function scheduleFade(token) {
  clearTimeout(fadeTimer);
  fadeTimer=setTimeout(async()=>{
    if(token!==generation || input.value.trim() || conversation.state!=='idle' || !scene.opened || !replyVisible)return;
    replyVisible=false;markReplyInk('absorbing');
    const finished=await animatePage('right','fade',1800);
    if(finished && token===generation){clearReplyPage();if(!input.value.trim())setStatus('The page is listening.');}
  },Math.max(22000,lastReply.split(/\s+/).length*800));
}
function onInput() {
  clearTimeout(timer);clearTimeout(fadeTimer);
  if(conversation.state!=='idle' || !scene.opened)return;
  if(replyVisible && input.value.length){
    replyVisible=false;markReplyInk('absorbing');const token=generation;
    animatePage('right','fade',1000).then(finished=>{if(finished && token===generation)clearReplyPage();});
  }
  scene.pickUpQuill();
  if(scene.mobile)scene.setFocus('left');
  scene.leftPage.setText(input.value);
  draftProgress=Math.min(draftProgress,scene.leftPage.total);
  draftActive=true;
  input.style.height='44px';input.style.height=Math.min(input.scrollHeight,80)+'px';
  controls(false);
  setStatus(input.value.trim()?'Your ink will not stay for long.':'The page is listening.');
  if(input.value.trim())timer=setTimeout(()=>submit(),4200);
}
async function submit() {
  clearTimeout(timer); clearTimeout(fadeTimer);
  if(!scene.opened)return;
  const text=input.value.trim();
  if(!conversation.begin(text))return;
  const token=++generation;draftActive=false;replyVisible=false;controls(true);input.blur();
  scene.leftPage.setText(text);scene.leftPage.render(scene.leftPage.total+20);
  controller=new AbortController();
  const answer=fetch('/api/diary',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({messages:conversation.messages}),
    signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])
  }).then(async response=>{
    const data=await response.json();
    if(!response.ok)throw new Error(response.status===429?'The diary needs a little rest. Try again in a few minutes.':'The ink faltered. Please try again.');
    if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('The ink faltered. Please try again.');
    return {reply:data.reply};
  }).catch(error=>({error}));
  setStatus('The ink is sinking into the paper.');
  await sleep(scene.reduced?150:850);
  if(token!==generation)return;
  await Promise.all([animatePage('left','fade',1600),animatePage('right','fade',1000)]);
  if(token!==generation)return;
  clearReplyPage();
  setStatus('Something stirs beneath the paper.');
  const result=await answer;
  if(token!==generation)return;
  if(result.error){
    conversation.fail();input.value=text;scene.leftPage.setText(text);scene.leftPage.render(scene.leftPage.total+20);
    setStatus(result.error.message.includes('rest')?result.error.message:'The ink faltered. Please try again.');controls(false);return;
  }
  conversation.reply(result.reply);lastReply=result.reply;
  input.value='';input.style.height='44px';draftProgress=0;
  scene.setFocus('right');scene.rightPage.setText(lastReply);scene.rightPage.render(0);markReplyInk('writing');
  setStatus('A memory answers.');
  if(scene.mobile)await sleep(scene.reduced?0:650);
  await animatePage('right','write',Math.max(2300,scene.rightPage.total/710*1000));
  if(token!==generation)return;
  $('#spoken-reply').textContent=lastReply;
  replyVisible=true;markReplyInk('visible');
  conversation.finish();controls(false);setStatus('Your turn.');scheduleFade(token);
}

async function boot() {
  try {
    scene=await new DiaryScene($('#world')).init();
    scene.onFrame=(dt,now)=>{
      if(now-lastDraw<33)return;const inkDt=Math.min(.25,(now-lastDraw)/1000);lastDraw=now;
      let pen=false;
      if(draftActive){
        draftProgress=Math.min(scene.leftPage.total+20,draftProgress+inkDt*2200);
        scene.leftPage.render(draftProgress);
        const tip=inkTip(scene.leftPage.lines,draftProgress);
        scene.nib('left',tip);pen=!!tip;
        if(draftProgress>=scene.leftPage.total+20)draftActive=false;
      }
      jobs=jobs.filter(job=>{
        const t=Math.min(1,(now-job.start)/job.duration);
        if(job.type==='write'){
          const tip=job.page.render((job.page.total+22)*t);
          scene.nib(job.side,t<1?tip:null);pen=!!tip;
        }else job.page.render(job.page.total+22,1,t*t);
        if(t>=1){job.resolve(true);return false;}return true;
      });
      if(!pen)scene.nib('left',null);playSound(pen);
    };
    scene.onBookTargetChange=open=>{
      $('#invitation').hidden=true;$('#writing-ui').hidden=true;
      document.body.dataset.state=open?'opening':'closing';
      if(!open){clearTimeout(timer);clearTimeout(fadeTimer);input.blur();playSound(false);}
    };
    scene.onOpen=()=>{
      $('#invitation').hidden=true;$('#writing-ui').hidden=false;
      document.body.dataset.state='ready';controls(conversation.state!=='idle');
      if(replyVisible && conversation.state==='idle')scheduleFade(generation);
    };
    scene.onClose=()=>{
      $('#writing-ui').hidden=true;$('#invitation').hidden=false;document.body.dataset.state='closed';
    };
    scene.onObjectClick=kind=>{
      if(kind==='lamp')scene.toggleLamp();
      if(kind==='book')scene.toggleBook();
      if(kind==='quill'){
        if(scene.desk.quillHeld)scene.putQuillDown();
        else {scene.setFocus('left');scene.pickUpQuill();if(scene.opened && conversation.state==='idle' && !scene.mobile)input.focus();}
      }
    };
    for(const kind of ['lamp','book','quill']){
      const button=$('#'+kind+'-object');
      // Pointer clicks act on the object without taking keyboard focus; Tab focus still activates with Enter/Space.
      button.addEventListener('mousedown',event=>event.preventDefault());
      button.addEventListener('click',()=>scene.onObjectClick(kind));
    }
    markReplyInk('blank');
    $('#loading').style.opacity='0';await sleep(scene.reduced?0:850);$('#loading').hidden=true;
    $('#invitation').hidden=false;document.body.dataset.state='closed';
    // The camera approaches automatically; objects themselves own clicks.
    $('#open').addEventListener('click',()=>scene.open());
    input.addEventListener('input',onInput);
    input.addEventListener('focus',()=>{if(scene.mobile && conversation.state==='idle')scene.setFocus('left');});
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();submit();}});
    form.addEventListener('submit',event=>{event.preventDefault();submit();});
    $('#sound').addEventListener('click',toggleSound);
    $('#replay').addEventListener('click',async()=>{
      if(!lastReply||conversation.state!=='idle'||input.value.trim())return;
      clearTimeout(fadeTimer);jobs=cancelPageJobs(jobs,'right');scene.setFocus('right');scene.rightPage.setText(lastReply);scene.rightPage.render(scene.rightPage.total+22);replyVisible=true;markReplyInk('visible');setStatus('Some words linger.');scheduleFade(generation);
    });
    $('#restart').addEventListener('click',()=>{
      if(!window.confirm('Begin again? The diary will forget this conversation.'))return;
      generation++;controller?.abort();clearTimeout(timer);clearTimeout(fadeTimer);
      for(const job of jobs)job.resolve();jobs=[];
      conversation.reset();lastReply='';replyVisible=false;input.value='';draftProgress=0;draftActive=false;scene.putQuillDown();
      scene.leftPage.setText('');scene.leftPage.render(0);clearReplyPage();scene.setFocus('left');
      $('#spoken-reply').textContent='';setStatus('A blank page. A fresh beginning.');controls(false);
    });
    window.addEventListener('keydown',event=>{
      // Printable keys write in the diary; Space on a focused object control stays a deliberate activation.
      const fromScene=event.target===document.body || (event.target.classList?.contains('object-control') && event.key!==' ');
      if(scene.opened && conversation.state==='idle' && !$('#about-dialog').open && fromScene && event.key.length===1 && !event.ctrlKey && !event.metaKey && !event.altKey) input.focus();
    });
  } catch(error) {
    console.error('Diary failed to open',error);
    $('#loading').replaceChildren(Object.assign(document.createElement('p'),{textContent:'The diary could not open. Please use a browser with WebGL, or reload the page.'}));
  }
}
$('#about').addEventListener('click',()=>$('#about-dialog').showModal());
$('#close-about').addEventListener('click',()=>$('#about-dialog').close());
$('#about-dialog').addEventListener('click',event=>{if(event.target===$('#about-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
boot();
