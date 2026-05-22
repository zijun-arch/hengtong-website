/* ============================================
   PetPulse · 宠物AI健康助手 — App 核心逻辑
   ============================================ */

const STORAGE_KEY = 'petpulse_data';

let appData = {
  pets: [],
  scans: [],
  albums: []
};

let currentPetId = null;
let scanImageData = null;
let editingPetId = null;

/* ========== 初始化 ========== */
function init() {
  loadData();
  renderPetSelector();
  renderHome();
  renderProfiles();
  renderAlbum();
  setupTabs();
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      appData = { pets: parsed.pets || [], scans: parsed.scans || [], albums: parsed.albums || [] };
    }
  } catch (e) { console.warn('loadData:', e); }

  if (appData.pets.length === 0) {
    appData.pets.push({
      id: 'pet_default_1', name: '豆豆', type: 'cat', breed: '英国短毛猫',
      birthday: '2023-03-15', gender: 'male', weight: 5.2, neutered: 'yes',
      avatar: '', createdAt: Date.now()
    });
    saveData();
  }
  currentPetId = appData.pets[0].id;
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pets: appData.pets, scans: appData.scans, albums: appData.albums
    }));
  } catch (e) { console.warn('saveData:', e); }
}

function getCurrentPet() {
  return appData.pets.find(p => p.id === currentPetId) || appData.pets[0];
}

function getPetById(id) {
  return appData.pets.find(p => p.id === id);
}

function getPetScans(petId) {
  return appData.scans.filter(s => s.petId === petId).sort((a,b) => b.timestamp - a.timestamp);
}

/* ========== Toast ========== */
function showToast(msg, type) {
  type = type || 'success';
  const el = document.getElementById('toast');
  el.className = 'toast toast-' + type + ' show';
  el.textContent = msg;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ========== 页面路由 ========== */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  const tabMap = { 'page-home': 0, 'page-scan': 1, 'page-profiles': 3, 'page-album': 4 };
  if (tabMap[pageId] !== undefined) {
    document.querySelectorAll('.tab-item')[tabMap[pageId]].classList.add('active');
  }

  if (pageId === 'page-home') renderHome();
  if (pageId === 'page-profiles') renderProfiles();
  if (pageId === 'page-album') renderAlbum();
  if (pageId === 'page-scan') resetScan();
  if (pageId === 'page-settings') renderSettings();
}

function setupTabs() {
  document.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', () => showPage(item.dataset.page));
  });
}

/* ========== 宠物选择器 ========== */
function renderPetSelector(containerId) {
  containerId = containerId || 'petSelector';
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = '';
  appData.pets.forEach(pet => {
    const active = pet.id === currentPetId ? 'active' : '';
    const avatar = pet.avatar ? '<img src="'+pet.avatar+'" alt="">' : (pet.type==='cat'?'🐱':'🐶');
    html += '<button class="pet-selector-item '+active+'" onclick="switchPet(\''+pet.id+'\')">' +
      '<div class="avatar">'+avatar+'</div><span class="name">'+pet.name+'</span></button>';
  });
  html += '<button class="pet-selector-add" onclick="showAddPet()">+</button>';
  container.innerHTML = html;
}

function switchPet(petId) {
  currentPetId = petId;
  renderPetSelector();
  renderHome();
  renderProfiles();
  renderAlbum();
  renderScanPetSelector();
}

/* ========== 首页 ========== */
function renderHome() {
  const pet = getCurrentPet();
  if (!pet) return;
  const scans = getPetScans(pet.id);
  const latest = scans[0];
  const hintEl = document.getElementById('petStatusHint');
  if (latest) {
    hintEl.textContent = '最近分析 · '+formatDate(latest.timestamp);
    renderHealthGrid(latest);
  } else {
    hintEl.textContent = '暂无最近分析';
    document.getElementById('healthGrid').innerHTML =
      '<div class="health-card"><div class="icon">🦴</div><div class="score">--</div><div class="label">BCS体况</div></div>'+
      '<div class="health-card"><div class="icon">✨</div><div class="score">--</div><div class="label">毛发皮肤</div></div>'+
      '<div class="health-card"><div class="icon">👁️</div><div class="score">--</div><div class="label">眼部</div></div>';
  }
  const recentEl = document.getElementById('recentScans');
  if (scans.length === 0) {
    recentEl.innerHTML = '<div class="empty-state" style="padding:20px"><p style="font-size:13px;color:var(--text-muted)">还没有分析记录，快去拍照吧 📸</p></div>';
  } else {
    let html = '';
    scans.slice(0,5).forEach(s => {
      html += '<div class="recent-scan" onclick="viewResult(\''+s.id+'\')" style="cursor:pointer;border-bottom:1px solid var(--cream-dark)">' +
        '<div class="thumb">'+(s.image?'<img src="'+s.image+'" alt="">':'📷')+'</div>' +
        '<div class="info"><div class="title">'+(s.result&&s.result.overallLabel||'健康分析')+'</div>' +
        '<div class="desc">BCS '+(s.result?s.result.bcs:'--')+'/9 · 综合 '+(s.result?s.result.overallScore:'--')+'/10</div>' +
        '<div class="time">'+formatDate(s.timestamp)+'</div></div></div>';
    });
    recentEl.innerHTML = html;
  }
}

function renderHealthGrid(scan) {
  const r = scan.result;
  if (!r) return;
  document.getElementById('healthGrid').innerHTML =
    '<div class="health-card"><div class="icon">🦴</div><div class="score">'+r.bcs+'/9</div><div class="label">BCS体况</div><div class="score-dots">'+renderDots(r.bcs,9)+'</div></div>'+
    '<div class="health-card"><div class="icon">✨</div><div class="score">'+r.skin+'/5</div><div class="label">毛发皮肤</div><div class="score-dots">'+renderDots(r.skin,5)+'</div></div>'+
    '<div class="health-card"><div class="icon">👁️</div><div class="score">'+r.eye+'/5</div><div class="label">眼部</div><div class="score-dots">'+renderDots(r.eye,5)+'</div></div>';
}

function renderDots(val, max) {
  let html = '';
  for (let i=0; i<max; i++) html += '<span class="dot'+(i<val?' filled':'')+'"></span>';
  return html;
}

function formatDate(ts) {
  const d = new Date(ts);
  const pad = n => n<10?'0'+n:n;
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());
}

/* ========== 拍照 ========== */
function resetScan() {
  scanImageData = null;
  document.getElementById('scanPreview').style.display='none';
  document.getElementById('scanPreview').src='';
  document.getElementById('scanPlaceholder').style.display='block';
  document.getElementById('captureBtn').style.display='flex';
  document.getElementById('retakeBtn').style.display='none';
  document.getElementById('analyzeBtn').style.display='none';
  renderScanPetSelector();
}

function renderScanPetSelector() {
  const container = document.getElementById('scanPetSelector');
  if (!container) return;
  let html = '';
  appData.pets.forEach(pet => {
    const active = pet.id===currentPetId?'active':'';
    html += '<button class="scan-pet-btn '+active+'" onclick="selectScanPet(\''+pet.id+'\')">'+
      (pet.type==='cat'?'🐱':'🐶')+' '+pet.name+'</button>';
  });
  container.innerHTML = html;
}

function selectScanPet(petId) {
  currentPetId = petId;
  document.querySelectorAll('.scan-pet-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
}

function capturePhoto() {
  const video = document.getElementById('scanVideo');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
    }).then(stream => {
      video.style.display = 'block';
      document.getElementById('scanPlaceholder').style.display='none';
      video.srcObject = stream;
      video.play();
      document.getElementById('captureBtn').innerHTML = '🔘';
      document.getElementById('captureBtn').onclick = function(){ takeSnapshot(video, stream); };
    }).catch(() => pickFromGallery());
  } else {
    pickFromGallery();
  }
}

function takeSnapshot(video, stream) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 960;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  stream.getTracks().forEach(t => t.stop());
  video.style.display='none';
  video.srcObject=null;
  scanImageData = canvas.toDataURL('image/jpeg', 0.8);
  const preview = document.getElementById('scanPreview');
  preview.src = scanImageData;
  preview.style.display='block';
  document.getElementById('scanPlaceholder').style.display='none';
  document.getElementById('captureBtn').style.display='none';
  document.getElementById('retakeBtn').style.display='flex';
  document.getElementById('analyzeBtn').style.display='flex';
  document.getElementById('captureBtn').innerHTML='📷';
  document.getElementById('captureBtn').onclick=capturePhoto;
}

function pickFromGallery() { document.getElementById('fileInput').click(); }

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    scanImageData = e.target.result;
    const preview = document.getElementById('scanPreview');
    preview.src = scanImageData;
    preview.style.display='block';
    document.getElementById('scanPlaceholder').style.display='none';
    document.getElementById('captureBtn').style.display='none';
    document.getElementById('retakeBtn').style.display='flex';
    document.getElementById('analyzeBtn').style.display='flex';
  };
  reader.readAsDataURL(file);
}

function retakePhoto() { resetScan(); }

/* ========== AI分析 ========== */
function startAnalysis() {
  if (!scanImageData) { showToast('请先拍照或选择照片','error'); return; }
  const pet = getCurrentPet();
  if (!pet) { showToast('请先选择宠物','error'); return; }
  const overlay = document.getElementById('analyzingOverlay');
  overlay.classList.add('show');
  document.getElementById('analyzePetIcon').textContent = pet.type==='cat'?'🐱':'🐶';
  document.getElementById('analyzePetName').textContent = pet.name+' · '+pet.breed;

  for (let i=0; i<=5; i++) {
    const el = document.getElementById('step'+i);
    if (i===0) el.className='analyzing-step done';
    else if (i===1) el.className='analyzing-step active';
    else el.className='analyzing-step pending';
  }
  simulateAnalysis(pet);
}

function simulateAnalysis(pet) {
  const steps = [
    function(){ updateStep(1,'done'); updateStep(2,'active'); },
    function(){ updateStep(2,'done'); updateStep(3,'active'); },
    function(){ updateStep(3,'done'); updateStep(4,'active'); },
    function(){ updateStep(4,'done'); updateStep(5,'active'); },
    function(){ updateStep(5,'done'); setTimeout(function(){ finishAnalysis(pet); }, 500); }
  ];
  var i=0;
  function runNext() { if (i<steps.length) { steps[i](); i++; setTimeout(runNext,600+Math.random()*400); } }
  setTimeout(runNext, 500);
}

function updateStep(idx, status) {
  const el = document.getElementById('step'+idx);
  if (el) {
    el.className = 'analyzing-step '+status;
    var icon = el.querySelector('.step-icon');
    if (status==='done') icon.textContent='✓';
    if (status==='active') icon.textContent='⏳';
  }
}

function finishAnalysis(pet) {
  document.getElementById('analyzingOverlay').classList.remove('show');
  performAIAnalysis(scanImageData, pet).then(function(result) {
    const scanId = 'scan_'+Date.now();
    const scan = { id: scanId, petId: pet.id, timestamp: Date.now(), image: scanImageData, result: result };
    appData.scans.push(scan);
    saveData();
    viewResult(scanId);
  }).catch(function(err) {
    showToast('分析出错: '+err.message,'error');
  });
}

/* ========== AI分析函数 ========== */
async function performAIAnalysis(imageData, pet) {
  // 模拟AI分析结果，后续接入通义千问视觉模型替换此函数
  await new Promise(r => setTimeout(r, 300));
  const bcs = randomInt(4,7);
  const skin = randomInt(3,5);
  const eye = randomInt(3,5);
  const ear = randomInt(3,5);
  const mouth = randomInt(3,5);
  const mood = randomMood();

  const overallScore = Math.round(((bcs/9 + skin/5 + eye/5 + ear/5 + mouth/5)/5)*10*10)/10;

  let overallLabel, suggestion;
  if (overallScore >= 8) {
    overallLabel = '非常健康 🎉';
    suggestion = pet.name+'非常健康！继续保持饮食和运动习惯。';
  } else if (overallScore >= 6) {
    overallLabel = '健康状况良好 👍';
    suggestion = pet.name+'健康状况良好！继续保持日常护理。';
  } else if (overallScore >= 4) {
    overallLabel = '需要关注 ⚠️';
    suggestion = pet.name+'有一些指标需要关注，建议加强护理。';
  } else {
    overallLabel = '建议就医 🩺';
    suggestion = '建议带'+pet.name+'去兽医做进一步检查。';
  }

  var suggs = [];
  if (bcs<=3) suggs.push('体况偏瘦，建议增加营养');
  if (bcs>=7) suggs.push('体况偏胖，建议控制饮食');
  if (skin<=2) suggs.push('毛发状态不佳');
  if (eye<=2) suggs.push('眼部有异常');
  if (suggs.length>0) suggestion = suggs.join('；')+'。';

  return {
    bcs: bcs, bcsDesc: getBCSDesc(bcs, pet.type),
    skin: skin, skinDesc: getSkinDesc(skin),
    eye: eye, eyeDesc: getEyeDesc(eye),
    ear: ear, earDesc: getEarDesc(ear),
    mouth: mouth, mouthDesc: getMouthDesc(mouth),
    mood: mood, moodDesc: getMoodDesc(mood),
    overallScore: overallScore, overallLabel: overallLabel, suggestion: suggestion
  };
}

function randomInt(min, max) { return Math.floor(Math.random()*(max-min+1))+min; }
function randomMood() { var m=['relaxed','happy','curious','tired','alert']; return m[Math.floor(Math.random()*m.length)]; }

function getBCSDesc(score) {
  if (score<=3) return '偏瘦，肋骨明显可触，腰线显著';
  if (score<=5) return '理想体态，肋骨可触但不可见';
  if (score<=7) return '偏胖，肋骨触摸有难度，腰部不明显';
  return '肥胖，大量脂肪覆盖，腹部隆起';
}
function getSkinDesc(score) { return ['毛发光泽暗淡，有明显皮屑','毛发光泽一般，轻微皮屑','毛发光泽正常','毛发光泽良好','毛发光泽亮丽'][score-1]||'正常'; }
function getEyeDesc(score) { return ['大量分泌物，眼睛红肿','有明显分泌物','少量分泌物色正常','眼睛干净','眼睛非常清洁'][score-1]||'正常'; }
function getEarDesc(score) { return ['耳道明显红肿','耳道红肿异常分泌物','耳道轻微发红','耳道干净少量耳垢','耳道非常干净'][score-1]||'正常'; }
function getMouthDesc(score) { return ['严重牙结石牙龈红肿','明显牙结石牙龈红肿','少量牙结石','牙齿清洁牙龈粉红','牙齿非常清洁'][score-1]||'正常'; }
function getMoodDesc(mood) {
  var map = { relaxed:'😊 放松愉悦 — 耳位自然，眼神温和', happy:'😄 开心活泼 — 眼神明亮', curious:'🤔 好奇 — 耳朵竖起',
    tired:'😴 略显疲惫', alert:'😯 警惕专注' };
  return map[mood]||'状态正常';
}

/* ========== 查看结果 ========== */
function viewResult(scanId) {
  const scan = appData.scans.find(s => s.id===scanId);
  if (!scan) { showToast('记录未找到','error'); return; }
  const pet = getPetById(scan.petId);
  if (!pet) return;
  const r = scan.result;

  document.getElementById('resultPetIcon').textContent = pet.type==='cat'?'🐱':'🐶';
  document.getElementById('resultPetName').textContent = pet.name;
  document.getElementById('resultPetBreed').textContent = pet.breed+' · '+getAge(pet.birthday);
  document.getElementById('resultDate').textContent = formatDate(scan.timestamp);
  document.getElementById('resultOverallScore').textContent = r.overallScore;
  document.getElementById('resultOverallLabel').textContent = r.overallLabel;
  const angle = (r.overallScore/10)*360;
  document.getElementById('resultScoreRing').style.background = 'conic-gradient(var(--orange) 0deg '+angle+'deg, var(--cream-dark) '+angle+'deg 360deg)';

  var dims = [
    {icon:'🦴',name:'体态·BCS评分',score:r.bcs,max:9,desc:r.bcsDesc},
    {icon:'✨',name:'毛发皮肤',score:r.skin,max:5,desc:r.skinDesc},
    {icon:'👁️',name:'眼部',score:r.eye,max:5,desc:r.eyeDesc},
    {icon:'👂',name:'耳部',score:r.ear,max:5,desc:r.earDesc},
    {icon:'🦷',name:'口腔',score:r.mouth,max:5,desc:r.mouthDesc},
    {icon:'😌',name:'情绪状态',score:0,max:0,desc:r.moodDesc}
  ];
  var dimHtml = '';
  dims.forEach(function(d){
    if (d.max>0) {
      var stars = Math.round(d.score/d.max*5);
      dimHtml += '<div class="dimension-card"><div class="d-header"><div class="d-title">'+d.icon+' '+d.name+'</div>'+
        '<div class="d-score">'+'⭐'.repeat(stars)+'☆'.repeat(Math.max(0,5-stars))+'</div></div>'+
        '<div class="d-dots">'+renderDots(d.score,d.max)+'</div><div class="d-desc">'+d.desc+'</div></div>';
    } else {
      dimHtml += '<div class="dimension-card"><div class="d-header"><div class="d-title">'+d.icon+' '+d.name+'</div></div>'+
        '<div class="d-desc">'+d.desc+'</div></div>';
    }
  });
  document.getElementById('resultDimensions').innerHTML = dimHtml;
  document.getElementById('resultSuggestionText').textContent = r.suggestion;
  window._currentScanId = scanId;
  showPage('page-result');
}

function getAge(birthday) {
  if (!birthday) return '未知';
  var b = new Date(birthday), n = new Date();
  var y = n.getFullYear()-b.getFullYear(), m = n.getMonth()-b.getMonth();
  if (m<0) { y--; m+=12; }
  return y>0 ? y+'岁'+m+'个月' : m+'个月';
}

/* ========== 分享卡片 ========== */
function showShareCard() {
  var scanId = window._currentScanId;
  if (!scanId) { showToast('没有可分享的内容','error'); return; }
  var scan = appData.scans.find(function(s){ return s.id===scanId; });
  if (!scan) return;
  var pet = getPetById(scan.petId);
  if (!pet) return;
  var r = scan.result;
  document.getElementById('sharePetIcon').textContent = pet.type==='cat'?'🐱':'🐶';
  document.getElementById('sharePetName').textContent = pet.name;
  document.getElementById('sharePetInfo').textContent = pet.breed+' · '+getAge(pet.birthday);
  document.getElementById('shareDate').textContent = formatDate(scan.timestamp);
  document.getElementById('shareScores').innerHTML =
    '<div style="text-align:center;padding:8px;background:var(--cream);border-radius:var(--radius-sm)"><div style="font-size:13px;font-weight:700;color:var(--orange)">综合评分</div><div style="font-size:24px;font-weight:800;color:var(--orange)">'+r.overallScore+'/10</div></div>'+
    '<div style="text-align:center;padding:8px;background:var(--cream);border-radius:var(--radius-sm)"><div style="font-size:13px;font-weight:700">BCS体况</div><div style="font-size:24px;font-weight:800">'+r.bcs+'/9</div></div>'+
    '<div style="text-align:center;padding:8px;background:var(--cream);border-radius:var(--radius-sm)"><div style="font-size:13px;font-weight:700">毛发皮肤</div><div style="font-size:24px;font-weight:800">'+r.skin+'/5</div></div>'+
    '<div style="text-align:center;padding:8px;background:var(--cream);border-radius:var(--radius-sm)"><div style="font-size:13px;font-weight:700">眼部</div><div style="font-size:24px;font-weight:800">'+r.eye+'/5</div></div>';
  openModal('shareModal');
}

function downloadShareCard() { showToast('请截图保存图片','success'); }

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

/* ========== 档案列表 ========== */
function renderProfiles() {
  var list = document.getElementById('profileList');
  if (!list) return;
  var html = '';
  appData.pets.forEach(function(pet) {
    var av = pet.avatar ? '<img src="'+pet.avatar+'" alt="">' : (pet.type==='cat'?'🐱':'🐶');
    html += '<div class="profile-card" onclick="viewProfile(\''+pet.id+'\')"><div class="avatar">'+av+'</div>'+
      '<div class="name">'+pet.name+'</div><div class="breed">'+pet.breed+'</div>'+
      '<div class="meta">'+(pet.type==='cat'?'🐱':'🐶')+' · '+getAge(pet.birthday)+'</div></div>';
  });
  html += '<div class="profile-add-card" onclick="showAddPet()"><div class="icon">➕</div><div class="text">添加新宠物</div></div>';
  list.innerHTML = html;
}

function viewProfile(petId) {
  currentPetId = petId;
  var pet = getPetById(petId);
  if (!pet) return;
  document.getElementById('detailHeaderName').textContent = pet.name+'的档案';
  var av = pet.avatar ? '<img src="'+pet.avatar+'" alt="">' : (pet.type==='cat'?'🐱':'🐶');
  document.getElementById('detailAvatar').innerHTML = av;
  document.getElementById('detailName').textContent = pet.name;
  document.getElementById('detailBreed').textContent = pet.breed;
  var genderText = pet.gender==='male'?'🧑 男孩':'👩 女孩';
  var neuteredText = pet.neutered==='yes'?'✅ 已绝育':'❌ 未绝育';
  document.getElementById('detailInfoGrid').innerHTML =
    '<div class="info-item"><div class="label">类型</div><div class="value">'+(pet.type==='cat'?'🐱 猫咪':'🐶 狗狗')+'</div></div>'+
    '<div class="info-item"><div class="label">品种</div><div class="value">'+pet.breed+'</div></div>'+
    '<div class="info-item"><div class="label">性别</div><div class="value">'+genderText+'</div></div>'+
    '<div class="info-item"><div class="label">生日</div><div class="value">'+(pet.birthday||'未设置')+'</div></div>'+
    '<div class="info-item"><div class="label">年龄</div><div class="value">'+getAge(pet.birthday)+'</div></div>'+
    '<div class="info-item"><div class="label">体重</div><div class="value">'+(pet.weight?pet.weight+' kg':'未设置')+'</div></div>'+
    '<div class="info-item"><div class="label">绝育</div><div class="value">'+neuteredText+'</div></div>';

  var scans = getPetScans(petId);
  var trendsEl = document.getElementById('detailHealthTrends');
  if (scans.length>0) {
    var th = '<div style="font-size:13px;color:var(--text-secondary)">';
    var reversed = scans.slice().reverse();
    reversed.slice(0,10).forEach(function(s){
      var d=new Date(s.timestamp);
      var ds=(d.getMonth()+1)+'/'+d.getDate();
      th += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--cream-dark)"><span>'+ds+'</span><span><strong>BCS '+s.result.bcs+'/9</strong> · 综合 '+s.result.overallScore+'/10</span></div>';
    });
    th+='</div>';
    trendsEl.innerHTML = th;
  } else {
    trendsEl.innerHTML = '<div class="empty-state" style="padding:20px"><p style="font-size:13px;color:var(--text-muted)">暂无分析数据</p></div>';
  }

  var historyEl = document.getElementById('detailScanHistory');
  if (scans.length>0) {
    var hh = '';
    scans.slice(0,5).forEach(function(s){
      hh += '<div class="recent-scan" onclick="viewResult(\''+s.id+'\')" style="cursor:pointer;border-bottom:1px solid var(--cream-dark)">'+
        '<div class="thumb">'+(s.image?'<img src="'+s.image+'" alt="">':'📷')+'</div>'+
        '<div class="info"><div class="title">'+(s.result?s.result.overallLabel:'健康分析')+'</div>'+
        '<div class="desc">BCS '+(s.result?s.result.bcs:'--')+'/9</div>'+
        '<div class="time">'+formatDate(s.timestamp)+'</div></div></div>';
    });
    historyEl.innerHTML = hh;
  } else {
    historyEl.innerHTML = '<div class="empty-state" style="padding:20px"><p style="font-size:13px;color:var(--text-muted)">还没有分析记录</p></div>';
  }
  showPage('page-profile-detail');
}

/* ========== 添加宠物 ========== */
var petForm = { type:'cat', gender:'male', neutered:'no', avatar:'' };

function showAddPet(petId) {
  editingPetId = petId||null;
  petForm = { type:'cat', gender:'male', neutered:'no', avatar:'' };
  document.getElementById('addPetTitle').textContent = editingPetId?'✏️ 编辑宠物':'🐾 添加宠物';
  document.getElementById('inputPetName').value='';
  document.getElementById('inputPetBreed').value='';
  document.getElementById('inputPetBirthday').value='';
  document.getElementById('inputPetWeight').value='';
  document.getElementById('addPetAvatarPreview').textContent='🐱';

  if (editingPetId) {
    var pet = getPetById(editingPetId);
    if (pet) {
      document.getElementById('inputPetName').value=pet.name;
      document.getElementById('inputPetBreed').value=pet.breed;
      document.getElementById('inputPetBirthday').value=pet.birthday||'';
      document.getElementById('inputPetWeight').value=pet.weight||'';
      document.getElementById('addPetAvatarPreview').textContent = pet.avatar?'📷':(pet.type==='cat'?'🐱':'🐶');
      petForm = { type:pet.type, gender:pet.gender, neutered:pet.neutered, avatar:pet.avatar };
    }
  }
  updateAddPetUI();
  openModal('addPetModal');
}

function updateAddPetUI() {
  document.querySelectorAll('.pet-type-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.type===petForm.type);
  });
  document.getElementById('genderMale').classList.toggle('active', petForm.gender==='male');
  document.getElementById('genderFemale').classList.toggle('active', petForm.gender==='female');
  document.getElementById('neuteredYes').classList.toggle('active', petForm.neutered==='yes');
  document.getElementById('neuteredNo').classList.toggle('active', petForm.neutered==='no');
}

function selectPetType(t) { petForm.type=t; updateAddPetUI(); }
function selectGender(g) { petForm.gender=g; updateAddPetUI(); }
function selectNeutered(n) { petForm.neutered=n; updateAddPetUI(); }

function previewPetAvatar(event) {
  var f=event.target.files[0];
  if(!f)return;
  var r=new FileReader();
  r.onload=function(e){
    petForm.avatar=e.target.result;
    document.getElementById('addPetAvatarPreview').innerHTML='<img src="'+petForm.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
  };
  r.readAsDataURL(f);
}

function savePet() {
  var name = document.getElementById('inputPetName').value.trim();
  if (!name) { showToast('请输入宠物名字','error'); return; }
  var breed = document.getElementById('inputPetBreed').value.trim()||'未知品种';
  var birthday = document.getElementById('inputPetBirthday').value;
  var weight = parseFloat(document.getElementById('inputPetWeight').value)||0;

  if (editingPetId) {
    var pet = getPetById(editingPetId);
    if (pet) {
      pet.name=name; pet.breed=breed; pet.birthday=birthday; pet.weight=weight;
      pet.type=petForm.type; pet.gender=petForm.gender; pet.neutered=petForm.neutered;
      if (petForm.avatar) pet.avatar=petForm.avatar;
    }
  } else {
    appData.pets.push({
      id: 'pet_'+Date.now(), name: name, type: petForm.type, breed: breed,
      birthday: birthday, gender: petForm.gender, weight: weight,
      neutered: petForm.neutered, avatar: petForm.avatar, createdAt: Date.now()
    });
  }
  saveData();
  closeModal('addPetModal');
  renderPetSelector();
  renderProfiles();
  renderHome();
  showToast('✅ 档案已保存');
}

function editCurrentPet() {
  showAddPet(currentPetId);
}

/* ========== 相册 ========== */
function renderAlbum() {
  var pet = getCurrentPet();
  if (!pet) return;
  var petAlbums = appData.albums.filter(function(a){ return a.petId===pet.id; });
  document.getElementById('albumTitle').textContent = pet.name+'的相册 📸';

  var content = document.getElementById('albumContent');
  if (petAlbums.length===0) {
    content.innerHTML = '<div class="empty-state"><div class="icon">📸</div><h3>记录美好瞬间</h3><p>上传你家毛孩子的可爱照片吧</p><button class="btn btn-primary" onclick="uploadToAlbum()">📤 上传照片</button></div>';
  } else {
    var html = '<div class="album-grid">';
    petAlbums.slice().reverse().forEach(function(a){
      html += '<div class="album-item" onclick="viewAlbumPhoto(\''+a.id+'\')"><img src="'+a.image+'" alt="">';
      if (a.caption) html += '<div class="overlay">'+a.caption+'</div>';
      html += '</div>';
    });
    html += '</div><button class="btn btn-secondary btn-block mt-16" onclick="uploadToAlbum()">📤 上传新照片</button>';
    content.innerHTML = html;
  }
}

function uploadToAlbum() { document.getElementById('albumFileInput').click(); }

function handleAlbumUpload(event) {
  var files = event.target.files;
  if (!files || files.length===0) return;
  var pet = getCurrentPet();
  if (!pet) return;

  Array.from(files).forEach(function(file, idx) {
    var reader = new FileReader();
    reader.onload = function(e) {
      appData.albums.push({
        id: 'album_'+Date.now()+'_'+idx,
        petId: pet.id,
        image: e.target.result,
        caption: '',
        timestamp: Date.now()
      });
      if (idx === files.length-1) {
        saveData();
        renderAlbum();
        showToast('✅ 已上传'+(files.length>1?files.length+'张':'')+'照片');
      }
    };
    reader.readAsDataURL(file);
  });
}

function viewAlbumPhoto(albumId) {
  var album = appData.albums.find(function(a){ return a.id===albumId; });
  if (!album) return;
  window._currentAlbumId = albumId;

  var caption = prompt('添加描述（可选）:', album.caption||'');
  if (caption !== null) {
    album.caption = caption;
    saveData();
    renderAlbum();
  }
}

/* ========== 设置页面 ========== */
function renderSettings() {
  var list = document.getElementById('settingsPetList');
  if (!list) return;
  var html = '';
  appData.pets.forEach(function(pet) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--cream-dark)">'+
      '<span>'+(pet.type==='cat'?'🐱':'🐶')+' '+pet.name+'</span>'+
      '<button class="btn btn-sm btn-secondary" onclick="if(confirm(\'确认删除'+pet.name+'？所有分析数据也将清除。\')){deletePet(\''+pet.id+'\')}">🗑️</button></div>';
  });
  list.innerHTML = html || '<div style="color:var(--text-muted);font-size:13px">暂无宠物</div>';
}

function deletePet(petId) {
  appData.pets = appData.pets.filter(function(p){ return p.id!==petId; });
  appData.scans = appData.scans.filter(function(s){ return s.petId!==petId; });
  appData.albums = appData.albums.filter(function(a){ return a.petId!==petId; });
  if (currentPetId===petId && appData.pets.length>0) currentPetId=appData.pets[0].id;
  saveData();
  renderPetSelector();
  renderHome();
  renderProfiles();
  renderAlbum();
  renderSettings();
  showToast('已删除');
}

function exportData() {
  var blob = new Blob([JSON.stringify(appData, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'petpulse_backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  showToast('数据已导出');
}

function importData(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var d = JSON.parse(e.target.result);
      if (d.pets && Array.isArray(d.pets)) {
        appData = { pets: d.pets||[], scans: d.scans||[], albums: d.albums||[] };
        saveData();
        currentPetId = appData.pets.length>0 ? appData.pets[0].id : null;
        init();
        showToast('✅ 数据已导入');
      } else {
        showToast('文件格式错误','error');
      }
    } catch(e) { showToast('文件格式错误','error'); }
  };
  reader.readAsText(file);
}

/* ========== 启动 ========== */
document.addEventListener('DOMContentLoaded', init);
