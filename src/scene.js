import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { InkPage } from './ink.js';
import { DeskInteractions } from './interactions.js';

const smooth = x => x * x * (3 - 2 * x);
const clamp = THREE.MathUtils.clamp;
const PAGE_W = 1.58, PAGE_H = 2.37, PAGE_Y = .243;

export const cameraBlend = (reduced, dt) => reduced ? 1 : 1 - Math.exp(-dt * 3);
export const overviewDistance = aspect => aspect<.85 ? 6.8/(2*Math.tan(Math.PI/10)*aspect) : 6.3;

export function pageRelief(side, u, y) {
  const spine = side === 'left' ? u : 1 - u;
  return .034 * Math.sin(spine * Math.PI) + .004 * (1 + Math.sin(y * 5 + u * 8));
}

export class DiaryScene {
  constructor(host) {
    this.host = host; this.opened = false; this.focusSide = 'left';
    this.desk = new DeskInteractions(); this.targets = []; this.flames = []; this.settledBook='closed';
    this.raycaster = new THREE.Raycaster(); this.hitPointer = new THREE.Vector2();
    this.quillTip = null; this.quillWriting = false; this.quillPose = 'resting';
    this.quillRest = new THREE.Vector3(1.99,.045,1.23);
    this.quillTarget = new THREE.Vector3(-1.38,PAGE_Y+.05,-.62);
    this.quillRestRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,-.48));
    this.quillIdleRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.92,0,-.20));
    this.quillWriteRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.92,0,-.20));
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#100e0b');
    this.scene.fog = new THREE.FogExp2('#100e0b', .035);
    this.camera = new THREE.PerspectiveCamera(36, 1, .05, 60);
    this.camera.position.set(4.8, 4.5, 5.3);
    this.camera.lookAt(.5, .2, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#bbc6d3', '#342719', .95));
    const moon = new THREE.DirectionalLight('#b5c8df', 1.7);
    moon.position.set(3, 6, -5); this.scene.add(moon);
    const fill = new THREE.DirectionalLight('#e6caa5', .8);
    fill.position.set(0, 5, 4); this.scene.add(fill);
    this.lampLight = new THREE.PointLight('#ffd49a', 32, 12, 2);
    this.lampLight.position.set(-2.5, 1.7, -.8);
    this.lampLight.castShadow = true;
    this.lampLight.shadow.mapSize.set(1024, 1024);
    this.lampLight.shadow.bias = -.001;
    this.lampLight.shadow.normalBias = .02;
    this.scene.add(this.lampLight);
    this.clock = new THREE.Clock(); this.elapsed = 0;
    this.look = new THREE.Vector3(.4, .15, 0); this.pointer = new THREE.Vector2();
    this.loader = new THREE.TextureLoader();
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
    host.addEventListener('pointermove', e => {
      this.pointer.set((e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * 2);
      host.style.cursor = this.hitTest(e.clientX,e.clientY) ? 'pointer' : 'default';
    });
    host.addEventListener('pointerleave',()=>{host.style.cursor='default';});
    host.addEventListener('click',e=>{
      const kind=this.hitTest(e.clientX,e.clientY);
      if(kind)this.onObjectClick?.(kind);
    });
    this.resize();
  }
  async texture(name, color = false, repeat = 1) {
    const t = await this.loader.loadAsync('/assets/tex/' + name + '.jpg');
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  async init() {
    await Promise.all([
      document.fonts.load('48px "Cedarville Cursive"'),
      document.fonts.load('78px "Pinyon Script"'),
      document.fonts.load('25px "IM FELL English"'),
    ]);
    const [desk, deskNormal, deskRough, cover, coverNormal, coverRough, page, pageNormal, edge, wall] = await Promise.all([
      this.texture('desk_diff', true, 3), this.texture('desk_nor', false, 3), this.texture('desk_rough', false, 3),
      this.texture('cover_diff', true), this.texture('cover_nor'), this.texture('cover_rough'),
      this.texture('page_diff', true), this.texture('page_nor'), this.texture('edge_diff', true), this.texture('wall_diff', true, 4),
    ]);
    const tableMat = new THREE.MeshStandardMaterial({ map: desk, normalMap: deskNormal, normalScale: new THREE.Vector2(.4,.4), roughnessMap: deskRough, roughness: .95, color:'#89745e' });
    this.box(15, .25, 10, tableMat, 0, -.15, -1);
    const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), new THREE.MeshStandardMaterial({ map:wall, color:'#777469', roughness:1 }));
    wallMesh.position.set(0, 3.8, -5); wallMesh.receiveShadow=true; this.scene.add(wallMesh);
    this.leather = new THREE.MeshStandardMaterial({ map:cover, normalMap:coverNormal, roughnessMap:coverRough, roughness:.9, normalScale:new THREE.Vector2(.17,.17), color:'#6c6257' });
    this.edgeMat = new THREE.MeshStandardMaterial({ map:edge, color:'#bfb298', roughness:1 });
    this.box(1.75,.065,2.53,this.leather,.835,.045,0,.025);
    this.box(1.57,.17,2.35,this.edgeMat,.815,.15,0,.014);
    // The spine remains visible between the page blocks.
    this.box(.065,.20,2.46,this.leather,-.015,.11,0,.025);
    this.leftBlock = new THREE.Group(); this.leftBlock.visible=false; this.scene.add(this.leftBlock);
    this.box(1.57,.17,2.35,this.edgeMat,-.815,.15,0,.014,this.leftBlock);
    this.leftPage = new InkPage(page.image, 'left'); this.rightPage = new InkPage(page.image, 'right');
    this.leftMesh = this.makePage('left', this.leftPage.texture, pageNormal);
    this.leftBlock.add(this.leftMesh);
    this.rightMesh = this.makePage('right', this.rightPage.texture, pageNormal);
    this.scene.add(this.rightMesh);
    // Cover opens around a real hinge, not a CSS transform.
    this.hinge = new THREE.Group(); this.hinge.position.set(-.015,.29,0); this.scene.add(this.hinge);
    const coverCanvas = document.createElement('canvas'); coverCanvas.width=1024; coverCanvas.height=1536;
    const ctx = coverCanvas.getContext('2d'); ctx.drawImage(cover.image,0,0,1024,1536);
    ctx.strokeStyle='#b29a6e34'; ctx.lineWidth=2; ctx.strokeRect(54,61,916,1414); ctx.strokeRect(64,71,896,1394);
    ctx.fillStyle='#bfa77cba'; ctx.textAlign='center'; ctx.font='34px "IM FELL English"';
    ctx.fillText('T. M. RIDDLE',512,1250);
    ctx.font='22px "IM FELL English"'; ctx.fillStyle='#bfa77c80'; ctx.fillText('1 9 4 3',512,1307);
    const frontTexture = new THREE.CanvasTexture(coverCanvas); frontTexture.colorSpace=THREE.SRGBColorSpace;
    const frontMat=this.leather.clone(); frontMat.map=frontTexture;
    this.box(1.75,.065,2.53,this.leather,.85,0,0,.025,this.hinge);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.70,2.48),frontMat);
    front.rotation.x=-Math.PI/2; front.position.set(.85,.034,0); this.hinge.add(front);
    await this.addLamp();
    this.addProps(); await this.addQuill(); this.addDust();
    this.bookHit=this.addTarget('book',new THREE.BoxGeometry(1,1,1));
    this.bookHit.position.set(.835,.16,0);this.bookHit.scale.set(1.8,.4,2.55);
    this.startTime=performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
    return this;
  }
  box(w,h,d,mat,x,y,z,r=0,parent=this.scene) {
    const geo = r ? new RoundedBoxGeometry(w,h,d,3,r) : new THREE.BoxGeometry(w,h,d);
    const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; parent.add(m); return m;
  }
  makePage(side, map, normal) {
    const geo=new THREE.PlaneGeometry(PAGE_W,PAGE_H,30,30);
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), u=(x/PAGE_W+.5);
      p.setZ(i,pageRelief(side,u,y));
    }
    geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({map,normalMap:normal,normalScale:new THREE.Vector2(.16,.16),roughness:.93,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geo,mat); mesh.rotation.x=-Math.PI/2;
    mesh.position.set(side==='left'?-.815:.815,PAGE_Y,0); mesh.receiveShadow=true;
    return mesh;
  }
  async addLamp() {
    try {
      const gltf=await new GLTFLoader().loadAsync('/assets/lamp/vintage_oil_lamp.gltf');
      const lamp=gltf.scene; lamp.scale.setScalar(2.85); lamp.position.set(-2.65,0,-.85); lamp.rotation.y=.4;
      lamp.traverse(m=>{
        if (!m.isMesh) return;
        m.castShadow=true; m.receiveShadow=true;
        if(m.material?.name?.includes('flame')) { m.material.emissive=new THREE.Color('#ffad48'); m.material.emissiveIntensity=3; m.castShadow=false; this.flames.push(m); }
        if(m.material?.name?.includes('glass')) { m.castShadow=false; m.material.transparent=true; m.material.opacity=.28; m.material.depthWrite=false; }
      });
      this.scene.add(lamp);this.lamp=lamp;
      this.lampHit=this.addTarget('lamp',new THREE.CylinderGeometry(.38,.38,2.35,12));
      this.lampHit.position.set(-2.65,1.16,-.85);
    } catch(e) { console.warn('Lamp model could not load', e.message); }
  }
  addProps() {
    const brass=new THREE.MeshStandardMaterial({color:'#9c793e',metalness:.82,roughness:.43});
    const glass=new THREE.MeshPhysicalMaterial({color:'#141d1d',metalness:.2,roughness:.18,clearcoat:1});
    const ink=new THREE.MeshStandardMaterial({color:'#070b0b',roughness:.22,metalness:.2});
    const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.19,.23,.28,8),glass); bottle.position.set(2.1,.16,.6); bottle.castShadow=true; this.scene.add(bottle);
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.10,.13,.16,16),glass); neck.position.set(2.1,.37,.6); this.scene.add(neck);
    const surface=new THREE.Mesh(new THREE.CircleGeometry(.09,24),ink); surface.rotation.x=-Math.PI/2; surface.position.set(2.1,.44,.6); this.scene.add(surface);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(.115,.115,.065,24),brass); lid.position.set(2.42,.04,.7); lid.rotation.z=.15; lid.castShadow=true; this.scene.add(lid);
    // A few shut, leather-bound volumes at the edge of the lamplight.
    const colors=['#392d21','#2d3026','#35201c'];
    for(let i=0;i<3;i++) {
      const group=new THREE.Group(); group.position.set(2.9+i*.04,.11+i*.17,-1.65); group.rotation.y=-.16+i*.13;
      const mat=new THREE.MeshStandardMaterial({color:colors[i],roughness:.8});
      this.box(1.15,.035,1.7,mat,0,-.07,0,.018,group);
      this.box(1.10,.11,1.62,this.edgeMat,0,0,0,.008,group);
      this.box(1.15,.035,1.7,mat,0,.07,0,.018,group);
      this.scene.add(group);
    }
    // Seal and ribbon: restrained detail, no interface floating in the room.
    const seal=new THREE.Mesh(new THREE.CylinderGeometry(.17,.18,.035,32),new THREE.MeshStandardMaterial({color:'#4b1816',roughness:.6}));
    seal.position.set(-2.05,.025,1.7);seal.rotation.y=.5;seal.castShadow=true;this.scene.add(seal);
    const ribbon=new THREE.Mesh(new THREE.PlaneGeometry(.06,.7),new THREE.MeshStandardMaterial({color:'#48251e',side:THREE.DoubleSide,roughness:1}));
    ribbon.rotation.x=-Math.PI/2; ribbon.position.set(.7,.014,1.5);this.scene.add(ribbon);
  }
  async addQuill() {
    const tex=await this.loader.loadAsync('/assets/quill.png');tex.colorSpace=THREE.SRGBColorSpace;
    this.quill=new THREE.Group();
    const width=.32,height=1.30;
    const featherGeometry=new THREE.PlaneGeometry(width,height);
    // The texture's actual inked nib, not its bounding-box centre, is the pivot.
    featherGeometry.translate((.5-.467)*width,(.988-.5)*height,0);
    const feather=new THREE.Mesh(featherGeometry,new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.04,side:THREE.DoubleSide,depthWrite:false}));
    feather.renderOrder=3;this.quill.add(feather);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.007,.009,.40,8),new THREE.MeshStandardMaterial({color:'#c3a772',roughness:.5}));
    shaft.position.set(0,.20,.004);shaft.castShadow=true;this.quill.add(shaft);
    const nib=new THREE.Mesh(new THREE.ConeGeometry(.012,.065,8),new THREE.MeshStandardMaterial({color:'#241b12',metalness:.4,roughness:.35}));
    nib.rotation.z=Math.PI;nib.position.y=.016;this.quill.add(nib);
    this.quillHit=this.addTarget('quill',new THREE.BoxGeometry(.38,1.34,.10),this.quill);
    this.quillHit.position.y=.63;
    this.quill.position.copy(this.quillRest);this.quill.quaternion.copy(this.quillRestRotation);
    this.scene.add(this.quill);
  }
  addDust() {
    const arr=new Float32Array(80*3);
    for(let i=0;i<80;i++){arr[i*3]=(Math.random()-.5)*9;arr[i*3+1]=Math.random()*4;arr[i*3+2]=(Math.random()-.5)*6;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
    this.dust=new THREE.Points(geo,new THREE.PointsMaterial({color:'#f9d599',size:.012,transparent:true,opacity:.23,depthWrite:false})); this.scene.add(this.dust);
  }
  nib(side, tip) {
    if(!this.quill || !this.desk.quillHeld || !this.desk.bookTarget)return;
    this.quillWriting=!!tip;
    if(tip){
      this.quillTip=side;
      this.quillTarget.set((side==='left'?-.815:.815)+(tip.x/1024-.5)*PAGE_W,PAGE_Y+.048,(tip.y/1536-.5)*PAGE_H);
      this.lastStroke=performance.now();
    }
  }
  open() { this.setBookOpen(true); }
  close() { this.setBookOpen(false); }
  toggleBook() { this.setBookOpen(!this.desk.bookTarget); }
  setBookOpen(open) {
    if(this.desk.bookTarget===(open?1:0))return;
    this.desk.setBookOpen(open);this.settledBook=null;this.onBookTargetChange?.(open);
  }
  toggleLamp() {
    const on=this.desk.toggleLamp();
    this.lampLight.visible=on;
    for(const flame of this.flames)flame.visible=on;
    return on;
  }
  pickUpQuill() {
    if(this.desk.quillHeld)return;
    this.open();this.desk.pickQuill();this.quillWriting=false;this.quillTip='left';
    this.quillTarget.set(-1.38,PAGE_Y+.05,-.62);this.lastStroke=performance.now();
  }
  putQuillDown() {this.desk.putQuillDown();this.quillWriting=false;}
  updateQuill(dt,now) {
    const held=this.desk.quillHeld && !!this.desk.bookTarget;
    if(held && !this.quillWriting && now-(this.lastStroke||0)>1100){
      this.quillTarget.set(this.focusSide==='left'?-1.34:1.34,PAGE_Y+.05,.82);
    }
    const target=held?this.quillTarget:this.quillRest;
    const writing=this.quillWriting || (now-(this.lastStroke||0)<1100);
    const rotation=held?(writing?this.quillWriteRotation:this.quillIdleRotation):this.quillRestRotation;
    const blend=this.reduced?1:1-Math.exp(-dt*6);
    this.quill.position.lerp(target,blend);this.quill.quaternion.slerp(rotation,blend);
    const moving=this.quill.position.distanceTo(target)>.045 || this.quill.quaternion.angleTo(rotation)>.06;
    this.quillPose=held?(moving?'lifting':this.quillWriting?'writing':'ready'):(moving?'returning':'resting');
  }
  addTarget(kind,geometry,parent=this.scene) {
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false,side:THREE.DoubleSide}));
    mesh.userData.kind=kind;parent.add(mesh);this.targets.push(mesh);return mesh;
  }
  hitTest(x,y) {
    if(!this.targets.length)return null;
    const r=this.renderer.domElement.getBoundingClientRect();
    this.hitPointer.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);
    this.raycaster.setFromCamera(this.hitPointer,this.camera);
    return this.raycaster.intersectObjects(this.targets,false)[0]?.object.userData.kind||null;
  }
  positionControl(id,point,label,pressed) {
    const button=document.getElementById(id);if(!button)return;
    const projected=point.clone().project(this.camera);
    const x=Math.round((projected.x*.5+.5)*this.width),y=Math.round((-projected.y*.5+.5)*this.height);
    button.hidden=projected.z>1 || projected.z<0 || x<10 || x>this.width-10 || y<10 || y>this.height-10;
    button.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
    if(button.getAttribute('aria-label')!==label){button.setAttribute('aria-label',label);button.title=label;}
    button.setAttribute('aria-pressed',String(pressed));
  }
  updateControls() {
    this.positionControl('lamp-object',new THREE.Vector3(-2.65,.45,-.85),this.desk.lampOn?'Switch lamp off':'Switch lamp on',this.desk.lampOn);
    this.positionControl('book-object',new THREE.Vector3(.835*(1-this.desk.bookProgress),.3,.65),this.desk.bookTarget?'Close the diary':'Open the diary',!!this.desk.bookTarget);
    this.positionControl('quill-object',this.quill.localToWorld(new THREE.Vector3(0,.65,0)),this.desk.quillHeld?'Put down the quill':'Pick up the quill',this.desk.quillHeld);
    const quillControl=document.getElementById('quill-object');if(quillControl)quillControl.dataset.pose=this.quillPose;
  }
  setFocus(side) { this.focusSide=side; }
  resize() {
    const height=window.visualViewport?.height || innerHeight;
    this.width=innerWidth; this.height=height;
    document.documentElement.style.setProperty('--vh',height+'px');
    this.renderer.setSize(this.width,height);
    this.camera.aspect=this.width/height; this.camera.updateProjectionMatrix();
    this.mobile=this.width<700;
  }
  frame() {
    const now=performance.now(),dt=Math.min(this.clock.getDelta(),1);this.elapsed+=dt;
    this.desk.advance(dt,this.reduced);
    const p=this.desk.bookProgress,t=smooth(p);
    this.hinge.rotation.z=t*Math.PI;this.hinge.position.y=.29-.22*t;
    this.leftBlock.visible=p>.62;this.opened=p===1;
    this.bookHit.position.x=.835*(1-t);this.bookHit.scale.x=1.8+1.65*t;
    if(p===1 && this.settledBook!=='open'){this.settledBook='open';this.onOpen?.();}
    if(p===0 && this.settledBook!=='closed'){this.settledBook='closed';this.onClose?.();}
    const intro=this.reduced?1:smooth(clamp((now-this.startTime)/4800,0,1));
    const wideTarget=new THREE.Vector3(this.mobile?.1:.72,.15,.05);
    const wideDist=overviewDistance(this.camera.aspect);
    const widePosition=new THREE.Vector3(4.8,4.5,5.3).lerp(new THREE.Vector3(this.mobile?.7:2.35,wideDist*.78,wideDist*.64),intro);
    const x=this.mobile?(this.focusSide==='left'?-.815:.815):0;
    const viewH=Math.max(this.mobile?3.5:3.65,(this.mobile?1.97:4.9)/this.camera.aspect);
    const dist=viewH/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)));
    const closeTarget=new THREE.Vector3(x,.17,this.height<520?.12:.34);
    const closePosition=closeTarget.clone().add(new THREE.Vector3(0,dist*.965,dist*.262));
    const target=wideTarget.lerp(closeTarget,t),position=widePosition.lerp(closePosition,t);
    if(!this.mobile && !this.reduced){position.x+=this.pointer.x*.055;position.z+=this.pointer.y*.035;}
    const blend=cameraBlend(this.reduced,dt);
    this.camera.position.lerp(position,blend);this.look.lerp(target,blend);this.camera.lookAt(this.look);
    this.lampLight.intensity=this.desk.lampOn?32+(this.reduced?0:(Math.sin(this.elapsed*5.2)+Math.sin(this.elapsed*12.7)*.45)*.65):0;
    if(!this.reduced)this.dust.rotation.y+=dt*.004;
    this.onFrame?.(dt,now);this.updateQuill(dt,now);
    this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld();this.updateControls();
    this.renderer.render(this.scene,this.camera);
  }
}
