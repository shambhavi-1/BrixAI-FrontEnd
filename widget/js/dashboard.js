/* ===============================================================
   BrixAI Dashboard JS
   - CONFIG: update to connect backend / bot
   - MOCK mode when CONFIG left empty (ideal for hackathon demo)
   =============================================================== */

const CONFIG = {
  BACKEND_BASE: 'http://localhost:5000/api', // Adjust for your backend
  API_REPORT: '/reports',
  API_TASKS: '/tasks',
  API_MATERIALS: '/materials',
  API_SUMMARY: '/summary',
  BOT_WEBHOOK: ''           // your server endpoint to post messages to Cliq
};
const MOCK = !CONFIG.BACKEND_BASE && !CONFIG.BOT_WEBHOOK;

/* App state (client-side mock) */
const state = {
  user: { name: 'User', role: 'labor' },
  project: { code: 'BP-DEMO', name: 'Demo Project' },
  feed: [],
  tasks: [],
  materials: [],
  crew: ['User']
};

/* DOM helpers */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = (p='id') => p + Math.random().toString(36).slice(2,9);
const now = () => new Date().toLocaleString();
const esc = s => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'<').replace(/>/g,'>') : '';

/* Boot */
function boot(){
  // Load user from localStorage
  const storedUser = JSON.parse(localStorage.getItem('user'));
  if (storedUser) {
    state.user = storedUser;
  } else {
    // Redirect to login if no user
    window.location.href = 'index.html';
    return;
  }

  // Sidebar nav
  $$('.sidebar-item').forEach(item => item.addEventListener('click', ()=> {
    $$('.sidebar-item').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    const page = item.getAttribute('data-page');
    showPage(page || 'home');
  }));

  // Header controls
  $('#btnCreate').addEventListener('click', ()=> {
    const pName = prompt('Project name'); if(!pName) return;
    state.project.name = pName;
    state.project.code = 'BP-'+Math.random().toString(36).slice(2,6).toUpperCase();
    applyUser();
    addFeed({ reporter: state.user.name, type:'system', text:`Created project ${pName} (${state.project.code})` });
  });
  $('#btnSwitch').addEventListener('click', ()=> $('#loginModal').style.display = 'flex');

  // Quick action: new task & AI summary
  $('#btnNewTask').addEventListener('click', newTaskPrompt);
  $('#btnAISummary').addEventListener('click', ()=> openAssistantAndAsk('Summarize today'));

  // Quick report cards
  $('#quickVoice').addEventListener('click', ()=> showPage('report'));
  $('#quickPhoto').addEventListener('click', ()=> showPage('report'));
  $('#quickText').addEventListener('click', ()=> showPage('report'));
  $('#reportVoice').addEventListener('click', startVoiceReport);
  $('#reportPhoto').addEventListener('click', startPhotoReport);
  $('#reportText').addEventListener('click', startTextReport);

  // Assistant
  $('#assistantToggle').addEventListener('click', toggleAssistant);
  $('#assistantClose').addEventListener('click', ()=> $('#assistantPanel').style.display='none');
  $('#assistantSend').addEventListener('click', sendAssistant);
  $('#assistantInput').addEventListener('keydown', (e)=> { if(e.key === 'Enter') sendAssistant(); });

  // Login modal
  $('#loginOK').addEventListener('click', doLogin);
  $('#loginCancel').addEventListener('click', ()=> $('#loginModal').style.display='none');

  // Attendance
  $('#btnCheckIn').addEventListener('click', ()=> {
    if(!state.crew.includes(state.user.name)) state.crew.push(state.user.name);
    renderCrew(); addFeed({ reporter: state.user.name, type: 'attendance', text: `${state.user.name} checked in` });
  });
  $('#btnCheckOut').addEventListener('click', ()=> {
    state.crew = state.crew.filter(x => x !== state.user.name); renderCrew(); addFeed({ reporter: state.user.name, type:'attendance', text: `${state.user.name} checked out` });
  });

  $('#projectCode').textContent = state.project.code;

  // Project creation from sidebar
  $('#projectCreateBtn').addEventListener('click', createProjectFromSidebar);

  seedDemo();
  renderAll();
  showPage('home');
}

/* Page navigation */
function showPage(page){
  const role = state.user.role;
  const rolePermissions = {
    home: ['manager', 'engineer', 'mistri', 'labor', 'vendor', 'safety'],
    report: ['manager', 'engineer', 'mistri', 'labor', 'vendor', 'safety'],
    feed: ['manager', 'engineer', 'mistri', 'labor', 'vendor', 'safety'],
    tasks: ['manager', 'engineer', 'mistri'],
    materials: ['manager', 'engineer', 'mistri', 'vendor'],
    attendance: ['manager', 'engineer', 'mistri'],
    issues: ['manager', 'engineer', 'mistri', 'safety'],
    ai: ['manager', 'engineer', 'mistri'],
    settings: ['manager', 'engineer']
  };

  if (!rolePermissions[page] || !rolePermissions[page].includes(role)) {
    // If page is not accessible, redirect to home
    page = 'home';
  }

  ['home','report','feed','tasks','materials','attendance','issues','ai','settings'].forEach(p => {
    const el = document.getElementById('page-'+p);
    if(el) el.style.display = (p === page) ? 'block' : 'none';
  });
  if(page === 'feed') renderFeed();
  if(page === 'tasks') renderTasks();
  if(page === 'materials') renderMaterials();
  if(page === 'attendance') renderCrew();
  if(page === 'issues') renderIssues();
  if(page === 'ai') renderAI();
}

/* Apply user/project display */
function applyUser(){
  $('#sideAvatar').textContent = state.user.name.charAt(0).toUpperCase();
  $('#sideName').textContent = state.user.name;
  $('#sideRole').textContent = state.user.role;
  $('#projectCode').textContent = state.project.code;
  $('#dashboardTitle').textContent = state.project.name + ' — ' + state.project.code;

  // Role-based visibility
  const role = state.user.role;
  const rolePermissions = {
    home: ['manager', 'engineer', 'mistri', 'labor', 'vendor', 'safety'],
    report: ['manager', 'engineer', 'mistri', 'labor', 'vendor', 'safety'],
    feed: ['manager', 'engineer', 'mistri', 'labor', 'vendor', 'safety'],
    tasks: ['manager', 'engineer', 'mistri'],
    materials: ['manager', 'engineer', 'mistri', 'vendor'],
    attendance: ['manager', 'engineer', 'mistri'],
    issues: ['manager', 'engineer', 'mistri', 'safety'],
    ai: ['manager', 'engineer', 'mistri'],
    settings: ['manager', 'engineer']
  };

  $$('.sidebar-item').forEach(item => {
    const page = item.getAttribute('data-page');
    if (rolePermissions[page] && rolePermissions[page].includes(role)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });

  // Hide pages that are not accessible
  Object.keys(rolePermissions).forEach(page => {
    const el = document.getElementById('page-' + page);
    if (el && (!rolePermissions[page] || !rolePermissions[page].includes(role))) {
      el.style.display = 'none';
    }
  });
}

/* Feed functions */
function addFeed(item){
  item.id = uid('f'); item.timestamp = now();
  state.feed.unshift(item); renderFeed(); renderDashboardFeed();
  // optionally, send to server/bot: use CONFIG.BOT_WEBHOOK
  if(!MOCK && CONFIG.BOT_WEBHOOK){
    fetch(CONFIG.BOT_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ project: state.project.code, payload: item }) }).catch(()=>{});
  }
}

function renderFeed(){
  const list = $('#feedList'); if(!list) return;
  list.innerHTML = '';
  state.feed.forEach(f => {
    const div = document.createElement('div'); div.className = 'feed-item';
    div.innerHTML = `
      <div class="media">${f.photo ? `<img src="${f.photo}" style="width:100%;height:100%;object-fit:cover" alt="photo"/>` : '&mdash;'}</div>
      <div class="meta"><div class="who">${esc(f.reporter)}</div><div class="time">${f.timestamp} · ${esc(f.type)}</div><div style="margin-top:8px">${esc(f.text)}</div></div>
    `;
    list.appendChild(div);
  });
}

function renderDashboardFeed(){
  const el = $('#dashboardFeed'); if(!el) return;
  el.innerHTML = '';
  state.feed.slice(0,4).forEach(f => {
    const d = document.createElement('div'); d.style.color = 'var(--muted)'; d.style.marginBottom = '6px';
    d.textContent = `${f.reporter} — ${f.text}`;
    el.appendChild(d);
  });
}

/* Tasks */
function renderTasks(){
  const board = $('#taskBoard'); if(!board) return;
  board.innerHTML = '';
  const cols = { todo:[], inprogress:[], done:[] };
  state.tasks.forEach(t => cols[t.status || 'todo'].push(t));
  ['todo','inprogress','done'].forEach(k => {
    const col = document.createElement('div'); col.className = `task-col ${k}`;
    col.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${k.toUpperCase()}</div>`;
    cols[k].forEach(t => {
      const card = document.createElement('div'); card.className = 'task-card';
      card.innerHTML = `<div style="font-weight:700">${esc(t.title)}</div><div style="font-size:13px;color:var(--muted)">Assignee: ${esc(t.assignee)}</div>`;
      card.addEventListener('click', ()=> editTaskPrompt(t));
      col.appendChild(card);
    });
    board.appendChild(col);
  });
  $('#kpiTasks').textContent = state.tasks.length;
  $('#kpiIssues').textContent = state.feed.filter(x=>x.type==='issue').length;
  $('#kpiWorkers').textContent = state.crew.length;
}

function newTaskPrompt(){
  const title = prompt('Task title'); if(!title) return;
  const task = { id: uid('t'), title, assignee: 'Unassigned', status: 'todo' };
  state.tasks.push(task); renderTasks(); addFeed({ reporter: state.user.name, type:'task', text:`New task: ${title}` });
}

function editTaskPrompt(task){
  const title = prompt('Edit task title', task.title); if(!title) return;
  task.title = title; renderTasks(); addFeed({ reporter: state.user.name, type:'task', text:`Task updated: ${title}` });
}

/* Materials */
function renderMaterials(){
  const tbody = $('#materialsTable'); if(!tbody) return;
  tbody.innerHTML = '';
  state.materials.forEach(m => {
    const tr = document.createElement('tr');
    tr.className = (m.qty < m.threshold) ? 'low-stock' : '';
    const suggestedQty = Math.max(50, m.threshold - m.qty);
    tr.innerHTML = `
      <td>${esc(m.name)}</td>
      <td>${m.qty}</td>
      <td>${m.threshold}</td>
      <td>
        <div class="order-controls">
          <button class="btn btn-ghost decrement-btn" onclick="adjustOrder('${m.id}', -10)">-</button>
          <input type="number" class="order-qty" id="order-${m.id}" value="${suggestedQty}" min="1" style="width: 60px; text-align: center; border: 1px solid var(--border-color); border-radius: 4px; padding: 2px;">
          <button class="btn btn-ghost increment-btn" onclick="adjustOrder('${m.id}', 10)">+</button>
          <button class="btn btn-primary order-btn" onclick="orderMaterial('${m.id}')">Order</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  const alertEl = $('#materialsAlert'); if(alertEl){ alertEl.innerHTML = ''; state.materials.filter(x=>x.qty<x.threshold).forEach(m=>{ const d = document.createElement('div'); d.style.color='var(--muted)'; d.textContent = `${m.name} — ${m.qty} left (threshold ${m.threshold})`; alertEl.appendChild(d); }); }
}

window.adjustOrder = function(id, delta){
  const input = $(`#order-${id}`);
  if(!input) return;
  const current = parseInt(input.value) || 0;
  input.value = Math.max(1, current + delta);
}

window.orderMaterial = function(id){
  const m = state.materials.find(x=>x.id === id);
  if(!m) return alert('Material not found');
  const qtyInput = $(`#order-${id}`);
  const orderQty = parseInt(qtyInput.value) || 0;
  if(orderQty <= 0) return alert('Invalid quantity');
  m.qty += orderQty;
  renderMaterials();
  addFeed({ reporter: state.user.name, type:'material', text:`Ordered ${orderQty} ${m.name}. New qty ${m.qty}` });
  // optionally call backend:
  // fetch(CONFIG.BACKEND_BASE + CONFIG.API_MATERIALS + '/order', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ materialId: m.id, qty: orderQty }) }).catch(()=>{});
}

/* Crew / Attendance */
function renderCrew(){
  const ul = $('#crewList'); if(!ul) return;
  ul.innerHTML = '';
  state.crew.forEach(c => { const li = document.createElement('li'); li.textContent = c; ul.appendChild(li); });
}

/* Issues */
function renderIssues(){
  const list = $('#issuesList'); if(!list) return;
  list.innerHTML = '';
  const issues = state.feed.filter(f => f.type === 'issue');
  if(issues.length === 0){
    list.innerHTML = '<div style="color: var(--text-secondary);">No issues reported yet.</div>';
    return;
  }
  issues.forEach(f => {
    const div = document.createElement('div'); div.className = 'feed-item';
    div.innerHTML = `
      <div class="media">${f.photo ? `<img src="${f.photo}" style="width:100%;height:100%;object-fit:cover" alt="photo"/>` : '&mdash;'}</div>
      <div class="meta"><div class="who">${esc(f.reporter)}</div><div class="time">${f.timestamp}</div><div style="margin-top:8px">${esc(f.text)}</div></div>
    `;
    list.appendChild(div);
  });
}

/* AI Assistant Page */
function renderAI(){
  // The AI page is static, but we can add functionality here if needed
  // For now, it just displays the input and button
}

/* Reporting (mock STT) */
async function startVoiceReport(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ alert('Recording not supported'); return; }
  if(!confirm('Start 5 second recording?')) return;
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();
    setTimeout(()=> recorder.stop(), 5000);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type:'audio/webm' });
      const url = URL.createObjectURL(blob);
      const transcript = prompt('Simulate transcript (edit if needed):', 'Plastering floor 2 — 60%');
      if(transcript){
        addFeed({ reporter: state.user.name, type:'report', text: transcript, voice: url });
        if(!MOCK){ /* upload voice file to backend; implement endpoint that accepts FormData */ }
        alert('Report submitted');
      }
      stream.getTracks().forEach(t => t.stop());
    };
  } catch(e){ alert('Recording failed: ' + e.message); }
}

async function startPhotoReport(){
  const input = document.createElement('input'); input.type='file'; input.accept='image/*';
  input.onchange = () => {
    const file = input.files[0]; if(!file) return;
    const url = URL.createObjectURL(file);
    const note = prompt('Optional note for photo:', 'Found leak near column');
    addFeed({ reporter: state.user.name, type:'issue', text: note || 'Photo issue', photo: url });
    if(!MOCK){ /* upload file to backend: implement server endpoint */ }
    alert('Photo report added');
  };
  input.click();
}

async function startTextReport(){
  const t = prompt('Quick report (1-2 lines)'); if(!t) return;
  addFeed({ reporter: state.user.name, type:'report', text: t });
  if(!MOCK){
    fetch(CONFIG.BACKEND_BASE + CONFIG.API_REPORT, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ project: state.project.code, reporter: state.user.name, text: t }) }).catch(()=>{});
  }
  alert('Report added');
}

/* Assistant (animated typing + simple mock LLM) */
function toggleAssistant(){
  const panel = $('#assistantPanel');
  panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
  if(panel.style.display === 'block') $('#assistantInput').focus();
}

function openAssistantAndAsk(q){
  $('#assistantPanel').style.display = 'block'; $('#assistantInput').value = q; sendAssistant();
}

function appendUserMessage(text){
  const body = $('#assistantBody');
  const row = document.createElement('div'); row.className = 'assistant-row user';
  row.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  body.appendChild(row); body.scrollTop = body.scrollHeight;
}

function appendTyping(){
  const body = $('#assistantBody');
  const row = document.createElement('div'); row.className = 'assistant-row';
  row.innerHTML = `<div class="bubble ai"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  body.appendChild(row); body.scrollTop = body.scrollHeight;
  return row;
}

function replaceTyping(node, text){
  node.innerHTML = `<div class="bubble ai">${esc(text)}</div>`;
  $('#assistantBody').scrollTop = $('#assistantBody').scrollHeight;
}

function generateMockAnswer(q){
  if(/cement|stock|bag/i.test(q)) return 'Cement stock is low (≈40 bags). Recommended: order 120 bags now.';
  if(/summar/i.test(q)) return `Summary: ${state.tasks.filter(t=>t.status==='done').length} tasks completed, ${state.tasks.filter(t=>t.status!=='done').length} pending. Issues: ${state.feed.filter(f=>f.type==='issue').length}.`;
  if(/delay/i.test(q)) return 'Prediction (rule-based): Medium risk of 2-day delay due to pending plumbing tasks.';
  return 'I suggest ordering cement and assigning 2 more workers to critical tasks. Want me to create an order or task?';
}

function sendAssistant(){
  const q = $('#assistantInput').value.trim(); if(!q) return;
  appendUserMessage(q); $('#assistantInput').value = '';
  const typing = appendTyping();
  // simulate a network/LLM delay
  setTimeout(()=>{
    const ans = generateMockAnswer(q);
    replaceTyping(typing, ans);
    addFeed({ reporter: 'BrixAI', type:'summary', text: ans });
  }, 800 + Math.random()*800);
}

/* Login */
function doLogin(){
  const name = $('#loginName').value.trim() || state.user.name;
  const role = $('#loginRole').value;
  state.user = { name, role };
  $('#loginModal').style.display = 'none';
  applyUser();
  addFeed({ reporter: 'System', type:'system', text: `${name} signed in as ${role}` });
}

/* Seed demo data */
function seedDemo(){
  state.project = { code: 'BP-DEMO', name: 'Demo Project' };
  state.tasks = [
    { id:'t1', title:'Plaster Floor 2', assignee:'Ram', status:'todo' },
    { id:'t2', title:'Fix leak - Block C', assignee:'Plumber', status:'inprogress' },
    { id:'t3', title:'Electrical check - Block B', assignee:'Sita', status:'done' }
  ];
  state.materials = [
    { id:'m1', name:'Cement', qty:40, threshold:50 },
    { id:'m2', name:'Sand', qty:1200, threshold:300 },
    { id:'m3', name:'Bricks', qty:2800, threshold:1500 }
  ];
  state.feed = [
    { id: uid('f'), reporter:'Ram', type:'report', text:'Started plastering Floor 2', photo:'', timestamp: now() },
    { id: uid('f'), reporter:'Sita', type:'issue', text:'Water leak at basement near column 4', photo:'https://picsum.photos/seed/22/300/160', timestamp: now() }
  ];
}

/* Render all */
function renderAll(){
  applyUser(); renderTasks(); renderMaterials(); renderFeed(); renderDashboardFeed(); renderCrew();
}

/* Project creation from sidebar */
function createProjectFromSidebar(){
  const input = $('#projectInput');
  const pName = input.value.trim();
  if(!pName) return alert('Please enter a project name or code');
  state.project.name = pName;
  state.project.code = 'BP-'+Math.random().toString(36).slice(2,6).toUpperCase();
  input.value = '';
  applyUser();
  addFeed({ reporter: state.user.name, type:'system', text:`Created project ${pName} (${state.project.code})` });
  alert(`Project "${pName}" created with code ${state.project.code}`);
}

/* Logout */
function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

/* Init */
boot();
