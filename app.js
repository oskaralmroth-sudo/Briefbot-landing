// BriefBot — Complete Application Logic (Stripe Payments)

// ====== Konfiguration ======
const API_URL = window.location.origin + '/api';

// ====== State ======
let state = {
  user: null,
  token: localStorage.getItem('bb_token'),
  topics: [],
  briefs: [],
  payments: [],
  subscription: null
};

// ====== API Client ======
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const res = await fetch(API_URL + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok && data.error) throw new Error(data.error);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data;
}

// ====== Router ======
function getPage() {
  const hash = window.location.hash.slice(1);
  // Handle hash with query params: #payment?session_id=xxx
  if (hash.includes('?')) return hash.split('?')[0];
  return hash || 'home';
}

function getHashParams() {
  const hash = window.location.hash.slice(1);
  if (!hash.includes('?')) return {};
  const qs = hash.split('?')[1];
  const params = {};
  qs.split('&').forEach(p => {
    const [k, v] = p.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  return params;
}

function navigate(page) {
  window.location.hash = page;
  render();
}

window.addEventListener('hashchange', () => {
  const hashParams = getHashParams();
  // If returning from Stripe Checkout with session_id
  if (getPage() === 'payment' && hashParams.session_id) {
    render();
    handlePaymentReturn(hashParams.session_id);
  } else {
    render();
  }
});

// ====== Rendering ======
function render() {
  const page = getPage();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (state.token) {
    // Inloggad
    renderDashboardNav();
    switch (page) {
      case 'login': case 'home': navigate('dashboard'); return;
      case 'dashboard': renderDashboard(); break;
      case 'topics': renderTopics(); break;
      case 'briefs': renderBriefs(); break;
      case 'pricing': renderPricing(); break;
      case 'profile': renderProfile(); break;
      case 'payment': renderPaymentRedirect(); break;
      default: navigate('dashboard'); return;
    }
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    document.getElementById('app-dashboard')?.classList.add('active');
  } else {
    // Inte inloggad
    document.getElementById('app-loggedout')?.classList.add('active');
    switch (page) {
      case 'home': renderHome(); break;
      case 'login': renderLogin(); break;
      case 'signup': renderSignup(); break;
      default: navigate('home'); return;
    }
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
  }

  // Close modals
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
}

// ====== Auth actions ======
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const btn = e.target.querySelector('.btn');
  btn.disabled = true; btn.textContent = 'Loggar in...';

  try {
    const data = await api('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('bb_token', data.token);
    navigate('dashboard');
    loadDashboardData();
  } catch (err) {
    alert(err.message);
    btn.disabled = false; btn.textContent = 'Logga in';
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const name = document.getElementById('signup-name').value;
  const phone = document.getElementById('signup-phone').value;
  const btn = e.target.querySelector('.btn');
  btn.disabled = true; btn.textContent = 'Skapar konto...';

  try {
    const data = await api('/auth/signup', {
      method: 'POST', body: JSON.stringify({ email, password, name, phone })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('bb_token', data.token);
    navigate('dashboard');
    loadDashboardData();
  } catch (err) {
    alert(err.message);
    btn.disabled = false; btn.textContent = 'Skapa konto';
  }
}

function handleLogout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('bb_token');
  navigate('home');
}

// ====== Dashboard nav ======
function renderDashboardNav() {
  const nav = document.getElementById('dash-nav');
  if (!nav) return;
  const page = getPage();
  const email = state.user?.email || 'Användare';

  nav.innerHTML = `
    <a href="#dashboard" class="nav-logo">Brief<span>Bot</span></a>
    <div class="nav-links">
      <a href="#dashboard" class="${page === 'dashboard' ? 'active' : ''}">Översikt</a>
      <a href="#topics">Ämnen</a>
      <a href="#briefs">Briefs</a>
      <a href="#pricing">Pris</a>
      <a href="#profile">${email}</a>
      <a href="#" onclick="handleLogout()" style="color:var(--danger)">Logga ut</a>
    </div>
  `;
}

// ====== Dashboard data loading ======
async function loadDashboardData() {
  try {
    const [userData, topicsData, briefsData, subData] = await Promise.all([
      api('/me'),
      api('/topics'),
      api('/briefs?limit=5'),
      api('/subscription')
    ]);
    state.user = userData.user;
    state.topics = topicsData.topics;
    state.briefs = briefsData.briefs;
    state.subscription = subData.subscription;
    state.payments = subData.payments;
    render();
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      handleLogout();
    }
  }
}

// ====== Pages ======

function renderHome() {
  document.getElementById('page-home').innerHTML = `
    <nav class="nav">
      <a href="#home" class="nav-logo">Brief<span>Bot</span></a>
      <div class="nav-links">
        <a href="#home">Hem</a>
        <a href="#login">Logga in</a>
        <a href="#signup" class="btn btn-primary btn-sm">Kom igång</a>
      </div>
    </nav>
    <section class="hero">
      <h1>Din marknadsbevakning<br><span>automatiserad</span></h1>
      <p>Få korta, relevanta briefs om din bransch direkt i din inkorg. AI-genererade sammanfattningar av nyheter, trender och konkurrenter.</p>
      <div class="hero-actions">
        <a href="#signup" class="btn btn-primary">✉️ Kom igång</a>
        <a href="#features" class="btn btn-outline" onclick="document.getElementById('features').scrollIntoView({behavior:'smooth'})">Läs mer</a>
      </div>
    </section>
    <div class="features-grid" id="features">
      <div class="feature-card"><div class="feature-icon">📡</div><h3>Bevaka vad du vill</h3><p>Nyheter, bloggar, RSS — definiera dina ämnen och källor.</p></div>
      <div class="feature-card"><div class="feature-icon">🧠</div><h3>AI-sammanfattningar</h3><p>Varje brief är en koncis sammanfattning — bara det viktigaste.</p></div>
      <div class="feature-card"><div class="feature-icon">📬</div><h3>Levereras till inkorgen</h3><p>Dagligen eller veckovis — ett mejl med allt du behöver veta.</p></div>
      <div class="feature-card"><div class="feature-icon">⚡</div><h3>Snabbt att komma igång</h3><p>Ange dina ämnen. Första briefen inom 24h.</p></div>
      <div class="feature-card"><div class="feature-icon">💳</div><h3>Betala med kort eller Swish</h3><p>Trygg betalning via Stripe. 99 kr/mån — säg upp när du vill.</p></div>
      <div class="feature-card"><div class="feature-icon">🎯</div><h3>Skär bort bruset</h3><p>AI:n filtrerar bort irrelevant innehåll och prioriterar det viktiga.</p></div>
    </div>
    <section class="pricing-section">
      <div class="pricing-card">
        <h2>BriefBot</h2>
        <div class="price">99 kr <span>/mån</span></div>
        <ul>
          <li>Upp till 5 bevakningsämnen</li>
          <li>AI-briefs på svenska</li>
          <li>Mail och dashboard</li>
          <li>Ändra ämnen när som helst</li>
          <li>Säg upp när du vill</li>
        </ul>
        <a href="#signup" class="btn btn-primary" style="margin-top:1rem;width:100%;justify-content:center">✉️ Kom igång idag</a>
      </div>
    </section>
    <div class="footer"><p>© 2026 BriefBot.se — Drivs av AI. Byggt för dig.</p></div>
  `;
}

// ====== Login / Signup ======
function renderLogin() {
  document.getElementById('page-login').innerHTML = `
    <div class="auth-page"><div class="auth-card">
      <h1>Välkommen tillbaka</h1>
      <p>Logga in på ditt BriefBot-konto</p>
      <form onsubmit="handleLogin(event)">
        <div class="form-group"><label>E-post</label><input type="email" id="login-email" class="form-input" placeholder="din@epost.se" required></div>
        <div class="form-group"><label>Lösenord</label><input type="password" id="login-password" class="form-input" placeholder="••••••••" required></div>
        <button type="submit" class="btn btn-primary">Logga in</button>
      </form>
      <div class="auth-link">Har du inget konto? <a href="#signup">Skapa ett här</a></div>
      <div class="auth-link"><a href="#home">← Tillbaka</a></div>
    </div></div>
  `;
}

function renderSignup() {
  document.getElementById('page-signup').innerHTML = `
    <div class="auth-page"><div class="auth-card">
      <h1>Kom igång med BriefBot</h1>
      <p>Skapa ditt konto — första briefen inom 24h</p>
      <form onsubmit="handleSignup(event)">
        <div class="form-group"><label>Namn</label><input type="text" id="signup-name" class="form-input" placeholder="Ditt namn"></div>
        <div class="form-group"><label>E-post</label><input type="email" id="signup-email" class="form-input" placeholder="din@epost.se" required></div>
        <div class="form-group"><label>Telefon (frivilligt)</label><input type="tel" id="signup-phone" class="form-input" placeholder="0701234567"></div>
        <div class="form-group"><label>Lösenord</label><input type="password" id="signup-password" class="form-input" placeholder="Minst 6 tecken" required minlength="6"></div>
        <button type="submit" class="btn btn-primary">Skapa konto — prova gratis i 14 dagar</button>
      </form>
      <div class="auth-link">Har du redan ett konto? <a href="#login">Logga in</a></div>
      <div class="auth-link"><a href="#home">← Tillbaka</a></div>
    </div></div>
  `;
}

// ====== Dashboard overview ======
function renderDashboard() {
  const sub = state.subscription || {};
  const subStatus = sub.status === 'active'
    ? '<span class="badge badge-active">Aktiv</span>'
    : '<span class="badge badge-inactive">Inaktiv</span>';

  const topicCount = state.topics?.length || 0;
  const briefCount = state.briefs?.length || 0;
  const lastBrief = state.briefs?.[0];

  document.getElementById('page-dashboard').innerHTML = `
    <h1>Översikt</h1>
    <p class="subtitle">Välkommen tillbaka, ${state.user?.name || state.user?.email}</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem">
      <div class="card"><div style="font-size:2rem;font-weight:700;color:#fff">${topicCount}</div><div style="color:var(--text-muted);font-size:0.875rem">Bevakningsämnen</div></div>
      <div class="card"><div style="font-size:2rem;font-weight:700;color:#fff">${briefCount}</div><div style="color:var(--text-muted);font-size:0.875rem">Briefs skapade</div></div>
      <div class="card"><div style="font-size:1rem;font-weight:600;color:#fff">${subStatus}</div><div style="color:var(--text-muted);font-size:0.875rem">Prenumeration</div></div>
    </div>

    ${sub.status !== 'active' ? `
      <div class="card" style="border-color:var(--primary);margin-bottom:2rem;text-align:center">
        <p style="color:var(--text-muted);margin-bottom:1rem">Aktivera din prenumeration för att få dagliga briefs</p>
        <a href="#pricing" class="btn btn-primary">Betala 99 kr/mån →</a>
      </div>
    ` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem">
      <div>
        <h2 style="font-size:1.1rem;color:#fff;margin-bottom:1rem">Dina ämnen</h2>
        ${topicCount === 0 ? '<p style="color:var(--text-muted)">Inga ämnen än. <a href="#topics" style="color:var(--primary)">Lägg till ditt första ämne →</a></p>' :
          state.topics.slice(0,3).map(t => `
            <div class="topic-card" style="margin-bottom:0.5rem">
              <div class="topic-info"><div class="topic-name">${esc(t.name)}</div><div class="topic-meta">${t.keywords || 'Allmänt'} · ${t.frequency === 'weekly' ? 'Veckovis' : 'Dagligen'}</div></div>
              <span class="badge ${t.active ? 'badge-active' : 'badge-inactive'}">${t.active ? 'Aktiv' : 'Inaktiv'}</span>
            </div>
          `).join('')}
        ${topicCount > 3 ? `<a href="#topics" style="color:var(--primary);font-size:0.875rem">Visa alla ${topicCount} ämnen →</a>` : ''}
      </div>
      <div>
        <h2 style="font-size:1.1rem;color:#fff;margin-bottom:1rem">Senaste briefs</h2>
        ${briefCount === 0 ? '<p style="color:var(--text-muted)">Inga briefs än. <a href="#briefs" style="color:var(--primary)">Generera din första →</a></p>' :
          state.briefs.slice(0,3).map(b => `
            <div class="brief-card" onclick="showBrief(${b.id})">
              <div class="brief-header">
                <div class="brief-title">${esc(b.topic_name)}</div>
                <div class="brief-date">${b.created_at?.slice(0,10) || ''}</div>
              </div>
              <div class="brief-summary">${esc(b.summary || b.content?.slice(0,150) || '')}</div>
            </div>
          `).join('')}
      </div>
    </div>
  `;
}

// ====== Topics management ======
function renderTopics() {
  document.getElementById('page-topics').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem">
      <div><h1>Bevakningsämnen</h1><p class="subtitle" style="margin-bottom:0">Hantera vad BriefBot bevakar åt dig</p></div>
      <button class="btn btn-primary" onclick="showTopicForm()">+ Nytt ämne</button>
    </div>
    <div class="topic-list" id="topic-list">
      ${state.topics.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:3rem">Inga ämnen än. Klicka på "Nytt ämne" för att börja.</p>' : ''}
    </div>
  `;

  const list = document.getElementById('topic-list');
  if (list && state.topics.length > 0) {
    list.innerHTML = state.topics.map(t => `
      <div class="topic-card">
        <div class="topic-info">
          <div class="topic-name">${esc(t.name)}</div>
          <div class="topic-meta">${esc(t.keywords || 'Allmänt')} · ${t.frequency === 'weekly' ? 'Veckovis' : 'Dagligen'} · ${t.sources ? 'Källa: ' + esc(t.sources) : 'Allmänna källor'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span class="badge ${t.active ? 'badge-active' : 'badge-inactive'}">${t.active ? 'Aktiv' : 'Inaktiv'}</span>
          <button class="btn btn-outline btn-sm" onclick="editTopic(${t.id})">Ändra</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTopic(${t.id})">×</button>
        </div>
      </div>
    `).join('');
  }
}

function showTopicForm(topic) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${topic ? 'Ändra ämne' : 'Nytt bevakningsämne'}</h2>
      <form onsubmit="saveTopic(event, ${topic?.id || 'null'})">
        <div class="form-group">
          <label>Namn på ämnet *</label>
          <input type="text" id="topic-name" class="form-input" value="${esc(topic?.name || '')}" placeholder="t.ex. Svensk dagligvaruhandel" required>
        </div>
        <div class="form-group">
          <label>Nyckelord (kommaseparerade)</label>
          <input type="text" id="topic-keywords" class="form-input" value="${esc(topic?.keywords || '')}" placeholder="t.ex. Ica, Axfood, dagligvaruhandel">
        </div>
        <div class="form-group">
          <label>Källor (kommaseparerade)</label>
          <input type="text" id="topic-sources" class="form-input" value="${esc(topic?.sources || '')}" placeholder="t.ex. di.se, svd.se, breakit.se">
        </div>
        <div class="form-group">
          <label>Frekvens</label>
          <select id="topic-frequency" class="form-input">
            <option value="daily" ${topic?.frequency === 'daily' ? 'selected' : ''}>Dagligen</option>
            <option value="weekly" ${topic?.frequency === 'weekly' ? 'selected' : ''}>Veckovis</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Avbryt</button>
          <button type="submit" class="btn btn-primary">${topic ? 'Spara' : 'Skapa'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function saveTopic(e, topicId) {
  e.preventDefault();
  const data = {
    name: document.getElementById('topic-name').value,
    keywords: document.getElementById('topic-keywords').value,
    sources: document.getElementById('topic-sources').value,
    frequency: document.getElementById('topic-frequency').value
  };

  try {
    if (topicId) {
      await api(`/topics/${topicId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api('/topics', { method: 'POST', body: JSON.stringify(data) });
    }
    document.querySelector('.modal-overlay')?.remove();
    await loadDashboardData();
  } catch (err) {
    alert('Fel: ' + err.message);
  }
}

async function deleteTopic(topicId) {
  if (!confirm('Ta bort detta bevakningsämne?')) return;
  try {
    await api(`/topics/${topicId}`, { method: 'DELETE' });
    await loadDashboardData();
  } catch (err) {
    alert('Fel: ' + err.message);
  }
}

function editTopic(topicId) {
  const topic = state.topics.find(t => t.id === topicId);
  if (topic) showTopicForm(topic);
}

// ====== Briefs ======
function renderBriefs() {
  document.getElementById('page-briefs').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem">
      <div><h1>Dina briefs</h1><p class="subtitle" style="margin-bottom:0">Alla AI-genererade marknadsbriefs</p></div>
      <button class="btn btn-primary" onclick="generateBriefs()" ${state.subscription?.status !== 'active' ? 'disabled title="Prenumeration krävs"' : ''}>Generera nu</button>
    </div>
    <div class="brief-list" id="brief-list">
      ${state.briefs.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:3rem">Inga briefs än. Generera din första!</p>' : ''}
    </div>
  `;

  const list = document.getElementById('brief-list');
  if (list && state.briefs.length > 0) {
    list.innerHTML = state.briefs.map(b => `
      <div class="brief-card" onclick="showBrief(${b.id})">
        <div class="brief-header">
          <div>
            <div class="brief-title">${esc(b.topic_name)}</div>
            <div class="brief-topic">${b.title || ''}</div>
          </div>
          <div class="brief-date">${b.created_at?.replace('T', ' ').slice(0,16) || ''}</div>
        </div>
        <div class="brief-summary">${esc(b.summary || b.content?.slice(0,200) || '')}</div>
      </div>
    `).join('');
  }
}

async function generateBriefs() {
  const btn = document.querySelector('#page-briefs .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Genererar...'; }
  try {
    const data = await api('/briefs/generate', { method: 'POST' });
    alert(`${data.count} briefs genererade!`);
    await loadDashboardData();
  } catch (err) {
    alert('Fel: ' + err.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Generera nu'; }
}

let _briefDetail = null;
async function showBrief(briefId) {
  try {
    const data = await api(`/briefs/${briefId}`);
    const b = data.brief;
    _briefDetail = b;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="modal" style="max-width:700px;max-height:80vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem">
          <div>
            <h2 style="margin-bottom:0.25rem">${esc(b.topic_name)}</h2>
            <div style="color:var(--text-muted);font-size:0.85rem">${b.created_at?.replace('T', ' ').slice(0,16) || ''}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">Stäng</button>
        </div>
        <div style="font-size:0.9rem;color:var(--text);white-space:pre-wrap;line-height:1.7">${esc(b.content || '')}</div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (err) {
    alert('Fel: ' + err.message);
  }
}

// ====== Pricing & Payment (Stripe) ======
function renderPricing() {
  const sub = state.subscription || {};
  const isActive = sub.status === 'active';

  document.getElementById('page-pricing').innerHTML = `
    <h1>Prenumeration</h1>
    <p class="subtitle">${isActive ? 'Din prenumeration är aktiv' : 'Välj en plan för att komma igång'}</p>

    ${isActive ? `
      <div class="card" style="max-width:500px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;color:#fff;margin-bottom:0.25rem">BriefBot — Aktiv</div>
            <div style="color:var(--text-muted);font-size:0.85rem">Förnyas: ${sub.expires?.slice(0,10) || '-'}</div>
          </div>
          <span class="badge badge-active">Aktiv</span>
        </div>
        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
          <a href="#topics" class="btn btn-primary btn-sm">Hantera ämnen</a>
          <a href="#briefs" class="btn btn-outline btn-sm">Se briefs</a>
        </div>
      </div>

      <h2 style="font-size:1.1rem;color:#fff;margin:2rem 0 1rem">Betalningshistorik</h2>
      ${state.payments?.length ? state.payments.map(p => `
        <div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text-muted)">${p.created_at?.slice(0,10)}</span>
          <span style="font-weight:600">${(p.amount/100).toFixed(0)} kr</span>
          <span class="badge ${p.status === 'paid' ? 'badge-active' : 'badge-pending'}">${p.status === 'paid' ? 'Betald' : p.status}</span>
        </div>
      `).join('') : '<p style="color:var(--text-muted)">Inga betalningar än</p>'}
    ` : `
      <div class="pricing-section" style="padding:0;max-width:500px;margin:0">
        <div class="pricing-card">
          <h2>BriefBot</h2>
          <div class="price">99 kr <span>/mån</span></div>
          <ul>
            <li>Upp till 5 bevakningsämnen</li>
            <li>AI-briefs på svenska</li>
            <li>Mail och dashboard</li>
            <li>Ändra ämnen när som helst</li>
            <li>Säg upp när du vill</li>
          </ul>
          <button class="btn btn-primary" onclick="startStripeCheckout()" style="margin-top:1rem;width:100%;justify-content:center" id="checkout-btn">
            💳 Betala med kort/Swish
          </button>
          <p style="color:var(--text-dim);font-size:0.75rem;margin-top:0.75rem">
            Betalningen hanteras av Stripe. Kort, Swish & Apple Pay.
          </p>
        </div>
      </div>
    `}
  `;
}

async function startStripeCheckout() {
  const btn = document.getElementById('checkout-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Skickar till Stripe...'; }

  try {
    const data = await api('/stripe/create-checkout', {
      method: 'POST', body: JSON.stringify({ plan: 'monthly' })
    });

    if (data.alreadyActive) {
      alert('Din prenumeration är redan aktiv!');
      await loadDashboardData();
      return;
    }

    if (data.url) {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } else {
      alert('Kunde inte skapa betalningslänk. Försök igen.');
    }
  } catch (err) {
    alert('Fel: ' + err.message);
    if (btn) { btn.disabled = false; btn.textContent = '💳 Betala med kort/Swish'; }
  }
}

function renderPaymentRedirect() {
  // This page is shown briefly after Stripe redirects back
  const hashParams = getHashParams();
  const sessionId = hashParams.session_id;

  document.getElementById('page-payment').innerHTML = `
    <div style="text-align:center;padding:4rem 2rem">
      <div style="font-size:3rem;margin-bottom:1rem">⏳</div>
      <h1>Verifierar betalning...</h1>
      <p class="subtitle">Vi kontrollerar din betalning. Det tar bara några sekunder.</p>
      <div class="loading" style="margin:2rem 0">
        <div class="spinner"></div>
      </div>
    </div>
  `;
}

async function handlePaymentReturn(sessionId) {
  if (!sessionId) return;

  try {
    const data = await api('/stripe/verify', {
      method: 'POST', body: JSON.stringify({ sessionId })
    });

    if (data.payment?.status === 'paid') {
      document.getElementById('page-payment').innerHTML = `
        <div style="text-align:center;padding:4rem 2rem">
          <div style="font-size:3rem;margin-bottom:1rem">✅</div>
          <h1>Betalning mottagen!</h1>
          <p class="subtitle">Din prenumeration är aktiverad. Dina briefs börjar komma inom kort.</p>
          <a href="#dashboard" class="btn btn-primary" style="margin-top:1.5rem">Gå till översikt</a>
        </div>
      `;
      await loadDashboardData();
    } else {
      document.getElementById('page-payment').innerHTML = `
        <div style="text-align:center;padding:4rem 2rem">
          <div style="font-size:3rem;margin-bottom:1rem">⏳</div>
          <h1>Betalningen väntar fortfarande</h1>
          <p class="subtitle">Om du nyss betalat, vänta några sekunder och ladda om sidan.</p>
          <a href="#pricing" class="btn btn-primary" style="margin-top:1.5rem">Tillbaka till priser</a>
        </div>
      `;
      // Poll once more after 3 seconds
      setTimeout(() => handlePaymentReturn(sessionId), 3000);
    }
  } catch (err) {
    document.getElementById('page-payment').innerHTML = `
      <div style="text-align:center;padding:4rem 2rem">
        <div style="font-size:3rem;margin-bottom:1rem">❌</div>
        <h1>Kunde inte verifiera betalning</h1>
        <p class="subtitle">${esc(err.message)}</p>
        <a href="#pricing" class="btn btn-primary" style="margin-top:1.5rem">Försök igen</a>
      </div>
    `;
  }
}

// ====== Profile ======
function renderProfile() {
  const u = state.user || {};
  document.getElementById('page-profile').innerHTML = `
    <div class="profile-section">
      <h1>Profil</h1>
      <p class="subtitle">Dina uppgifter</p>

      <div class="card">
        <div class="profile-info">
          <p><strong>Namn</strong> ${esc(u.name || '—')}</p>
          <p><strong>E-post</strong> ${esc(u.email)}</p>
          <p><strong>Telefon</strong> ${esc(u.phone || '—')}</p>
          <p><strong>Prenumeration</strong> <span class="badge ${u.subscription_status === 'active' ? 'badge-active' : 'badge-inactive'}">${u.subscription_status === 'active' ? 'Aktiv' : 'Inaktiv'}</span></p>
          <p><strong>Medlem sedan</strong> ${u.created_at?.slice(0,10) || '—'}</p>
        </div>

        <h3 style="color:#fff;font-size:1rem;margin:1.5rem 0 1rem">Uppdatera uppgifter</h3>
        <form onsubmit="updateProfile(event)">
          <div class="form-group">
            <label>Namn</label>
            <input type="text" id="profile-name" class="form-input" value="${esc(u.name || '')}">
          </div>
          <div class="form-group">
            <label>Telefon</label>
            <input type="tel" id="profile-phone" class="form-input" value="${esc(u.phone || '')}" placeholder="0701234567">
          </div>
          <button type="submit" class="btn btn-primary">Spara</button>
        </form>
      </div>
    </div>
  `;
}

async function updateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value;
  const phone = document.getElementById('profile-phone').value;

  try {
    await api('/me', {
      method: 'PUT', body: JSON.stringify({ name, phone })
    });
    alert('Profil uppdaterad!');
    await loadDashboardData();
  } catch (err) {
    alert('Fel: ' + err.message);
  }
}

// ====== Helpers ======
function esc(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ====== Init ======
render();
if (state.token) {
  loadDashboardData();
}
