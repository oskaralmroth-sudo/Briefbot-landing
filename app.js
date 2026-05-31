// BriefBot — Complete Application Logic

// ====== Konfiguration ======
const API_URL = window.location.origin + '/api';  // Workers proxied through Pages
// För lokal utveckling: API_URL = 'https://briefbot.se.workers.dev'

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
  return window.location.hash.slice(1) || 'home';
}

function navigate(page) {
  window.location.hash = page;
  render();
}

window.addEventListener('hashchange', render);

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
      case 'payment': renderPayment(); break;
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
        <a href="#signup" class="btn btn-primary btn-sm">✉️ Kom igång</a>
      </div>
    </nav>

    <!-- HERO -->
    <section class="hero" style="padding:5rem 1.5rem 3rem">
      <div style="background:rgba(59,130,246,0.1);display:inline-block;padding:0.3rem 0.8rem;border-radius:999px;font-size:0.8rem;color:var(--primary);margin-bottom:1.5rem;border:1px solid rgba(59,130,246,0.2)">
        ✨ AI-driven marknadsbevakning för svenska företag
      </div>
      <h1>Lägg 2 minuter om dagen<br>istället för 2 timmar <span>på bevakning</span></h1>
      <p style="font-size:1.15rem;max-width:600px">BriefBot scannar nyheter, bloggar och branschkällor dygnet runt. Du får en kort, AI-sammanfattad brief varje morgon — direkt i din inkorg.</p>
      <div class="hero-actions">
        <a href="#signup" class="btn btn-primary" style="font-size:1rem;padding:1rem 2.5rem">✉️ Starta din bevakning — 99 kr/mån</a>
        <a href="#features" class="btn btn-outline" onclick="document.getElementById('features').scrollIntoView({behavior:'smooth'})">Se hur det funkar</a>
      </div>
    </section>

    <!-- SOCIAL PROOF -->
    <div style="max-width:600px;margin:-1rem auto 3rem;text-align:center">
      <p style="color:var(--text-dim);font-size:0.85rem">✉️ Levereras varje vardag · 🇸🇪 Svenska källor · 🔒 Din data är privat</p>
    </div>

    <!-- HOW IT WORKS -->
    <div style="max-width:1000px;margin:0 auto;padding:3rem 1.5rem">
      <h2 style="text-align:center;font-size:1.8rem;color:#fff;margin-bottom:3rem">Så här fungerar det</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;text-align:center">
        <div>
          <div style="width:48px;height:48px;background:var(--primary);border-radius:50%;line-height:48px;font-weight:700;font-size:1.2rem;margin:0 auto 1rem;color:#fff">1</div>
          <h3 style="color:#fff;margin-bottom:0.5rem">Ange dina ämnen</h3>
          <p style="color:var(--text-muted);font-size:0.9rem">Berätta vad du vill bevaka — bransch, konkurrenter eller specifika nyckelord. Klart på 2 minuter.</p>
        </div>
        <div>
          <div style="width:48px;height:48px;background:var(--primary);border-radius:50%;line-height:48px;font-weight:700;font-size:1.2rem;margin:0 auto 1rem;color:#fff">2</div>
          <h3 style="color:#fff;margin-bottom:0.5rem">AI bevakar dygnet runt</h3>
          <p style="color:var(--text-muted);font-size:0.9rem">Vår AI (xAI Grok) scannar nyheter och källor efter det som är relevant för just dig.</p>
        </div>
        <div>
          <div style="width:48px;height:48px;background:var(--primary);border-radius:50%;line-height:48px;font-weight:700;font-size:1.2rem;margin:0 auto 1rem;color:#fff">3</div>
          <h3 style="color:#fff;margin-bottom:0.5rem">Få briefen varje morgon</h3>
          <p style="color:var(--text-muted);font-size:0.9rem">Kl 06:00 varje vardag. Läs på 2 minuter och var uppdaterad. Inget flöde att scrolla.</p>
        </div>
      </div>
    </div>

    <!-- FEATURES -->
    <div class="features-grid" id="features">
      <div class="feature-card"><div class="feature-icon">⏱️</div><h3>Spara 10 timmar i veckan</h3><p>Sluta scrolla nyhetssajter. BriefBot gör jobbet åt dig — sammanfattat och klart.</p></div>
      <div class="feature-card"><div class="feature-icon">🎯</div><h3>Skräddarsytt för dig</h3><p>Du väljer ämnen, nyckelord och källor. Bara det relevanta — inget brus.</p></div>
      <div class="feature-card"><div class="feature-icon">🤖</div><h3>AI från xAI Grok</h3><p>Briefs skrivs på svenska av världsklass AI. Lättläst, koncist, korrekt.</p></div>
      <div class="feature-card"><div class="feature-icon">📬</div><h3>Kommer till din inkorg</h3><p>Ingen app att ladda ner. Mejl varje morgon — öppna, läs, klart.</p></div>
      <div class="feature-card"><div class="feature-icon">📱</div><h3>Betala med Swish</h3><p>99 kr/mån. Inget bindningstid. Säg upp när du vill — inget krångel.</p></div>
      <div class="feature-card"><div class="feature-icon">🔒</div><h3>Svensk integritet</h3><p>Dina uppgifter lagras inom EU. Ingen datadelning med tredje part.</p></div>
    </div>

    <!-- WHO IS IT FOR -->
    <div style="max-width:1000px;margin:0 auto;padding:4rem 1.5rem">
      <h2 style="text-align:center;font-size:1.8rem;color:#fff;margin-bottom:2.5rem">För dig som...</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">
        <div class="card card-hover"><div style="font-size:2rem;margin-bottom:0.5rem">🏢</div><h3 style="color:#fff;font-size:1rem;margin-bottom:0.25rem">Äger eller leder ett företag</h3><p style="color:var(--text-muted);font-size:0.85rem">Håll koll på konkurrenter, branschnyheter och trender utan att lägga timmar om dagen.</p></div>
        <div class="card card-hover"><div style="font-size:2rem;margin-bottom:0.5rem">📈</div><h3 style="color:#fff;font-size:1rem;margin-bottom:0.25rem">Jobbar med försäljning eller marknad</h3><p style="color:var(--text-muted);font-size:0.85rem">Var först med att veta vad som händer i din bransch. Dina kunder märker skillnaden.</p></div>
        <div class="card card-hover"><div style="font-size:2rem;margin-bottom:0.5rem">💼</div><h3 style="color:#fff;font-size:1rem;margin-bottom:0.25rem">Är konsult eller rådgivare</h3><p style="color:var(--text-muted);font-size:0.85rem">Imponera på dina kunder med aktuell branschkunskap — utan att lägga tid på research.</p></div>
      </div>
    </div>

    <!-- PRICING -->
    <section class="pricing-section">
      <div class="pricing-card" style="position:relative">
        <div style="background:var(--primary);color:#fff;position:absolute;top:-12px;left:50%;transform:translateX(-50%);padding:0.25rem 1.5rem;border-radius:999px;font-size:0.8rem;font-weight:600">MEST POPULÄR</div>
        <h2>BriefBot Pro</h2>
        <div class="price">99 kr <span>/mån</span></div>
        <p style="color:var(--text-muted);margin-bottom:1.5rem;font-size:0.9rem">Ingen bindningstid. Säg upp när du vill.</p>
        <ul>
          <li>Upp till 5 bevakningsämnen</li>
          <li>AI-briefs på svenska varje vardag</li>
          <li>Levereras direkt till din inkorg</li>
          <li>Dashboard med historik</li>
          <li>Ändra ämnen när som helst</li>
          <li>Swish-betalning</li>
        </ul>
        <a href="#signup" class="btn btn-primary" style="margin-top:1.5rem;width:100%;justify-content:center;font-size:1rem;padding:1rem">✉️ Starta din kostnadsfria testperiod</a>
        <p style="color:var(--text-dim);font-size:0.8rem;margin-top:0.75rem">99 kr/mån. Första dragningen efter 7 dagar.</p>
      </div>
    </section>

    <!-- FAQ -->
    <div style="max-width:600px;margin:0 auto;padding:3rem 1.5rem">
      <h2 style="text-align:center;font-size:1.5rem;color:#fff;margin-bottom:2rem">Vanliga frågor</h2>
      <div class="card" style="margin-bottom:0.75rem">
        <h3 style="color:#fff;font-size:0.95rem;margin-bottom:0.25rem">Vilka källor bevakar BriefBot?</h3>
        <p style="color:var(--text-muted);font-size:0.85rem">Du väljer själva. Vanliga exempel: DI.se, SvD, Breakit, Dagens Handel, Byggnyheter, och allmänna RSS-flöden. AI:n kan även hitta relevanta nyheter utan specifika källor.</p>
      </div>
      <div class="card" style="margin-bottom:0.75rem">
        <h3 style="color:#fff;font-size:0.95rem;margin-bottom:0.25rem">Kan jag ändra mina ämnen?</h3>
        <p style="color:var(--text-muted);font-size:0.85rem">Ja, när som helst från din dashboard. Ändringar träder i kraft till nästa brief.</p>
      </div>
      <div class="card" style="margin-bottom:0.75rem">
        <h3 style="color:#fff;font-size:0.95rem;margin-bottom:0.25rem">Hur avslutar jag?</h3>
        <p style="color:var(--text-muted);font-size:0.85rem">Ett klick i dashboarden. Ingen bindningstid, inget krångel. Du får ingen ytterligare faktura.</p>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;padding:4rem 2rem;background:radial-gradient(ellipse 50% 50% at 50% 100%, rgba(59,130,246,0.08), transparent)">
      <h2 style="color:#fff;font-size:2rem;margin-bottom:1rem">Redo att spara tid?</h2>
      <p style="color:var(--text-muted);max-width:450px;margin:0 auto 2rem;font-size:1.05rem">Börja idag. Första briefen inom 24h. 99 kr/mån — säg upp när du vill.</p>
      <a href="#signup" class="btn btn-primary" style="font-size:1.1rem;padding:1rem 3rem">✉️ Starta din bevakning</a>
    </div>

    <div class="footer"><p>© 2026 BriefBot.se — Drivs av xAI Grok. Byggt för svenska företag.</p></div>
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
        <div class="form-group"><label>Telefon (för Swish)</label><input type="tel" id="signup-phone" class="form-input" placeholder="0701234567"></div>
        <div class="form-group"><label>Lösenord</label><input type="password" id="signup-password" class="form-input" placeholder="Minst 6 tecken" required minlength="6"></div>
        <button type="submit" class="btn btn-primary">Skapa konto</button>
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

// ====== Pricing & Payment ======
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
          <button class="btn btn-primary" onclick="startPayment()" style="margin-top:1rem;width:100%;justify-content:center">
            Betala med Swish
          </button>
        </div>
      </div>
    `}
  `;
}

async function startPayment() {
  try {
    const data = await api('/swish/pay', {
      method: 'POST', body: JSON.stringify({ plan: 'monthly' })
    });
    navigate('payment');
    renderPayment(data.payment);
  } catch (err) {
    // If phone missing, show profile update
    if (err.message.includes('Telefonnummer')) {
      if (confirm('Du måste ange ett telefonnummer för Swish-betalning. Gå till profil?')) {
        navigate('profile');
      }
    } else {
      alert('Fel: ' + err.message);
    }
  }
}

function renderPayment(payment) {
  document.getElementById('page-payment').innerHTML = `
    <h1>Betala med Swish</h1>
    <p class="subtitle">Slutför din betalning för BriefBot</p>

    <div class="card" style="max-width:500px;margin:0 auto;text-align:center">
      <div style="font-size:1.25rem;font-weight:600;color:#fff;margin-bottom:0.5rem">BriefBot — 99 kr</div>
      <div style="color:var(--text-muted);margin-bottom:2rem">Månadsvis prenumeration</div>

      <div style="background:var(--bg);padding:2rem;border-radius:var(--radius);margin-bottom:1.5rem">
        <div style="font-size:2.5rem;font-weight:800;color:#fff;margin-bottom:0.5rem">99 kr</div>
        <div style="color:var(--text-muted)">Skicka till <strong style="color:#fff">1234 567 890</strong> (Swish-nummer)</div>
      </div>

      <div class="swish-steps">
        <p style="color:#fff;font-weight:600;margin-bottom:0.75rem">Så här betalar du:</p>
        <ol style="text-align:left">
          <li>Öppna Swish-appen</li>
          <li>Skicka 99 kr till <strong>123 456 78 90</strong></li>
          <li>Ange meddelande: <strong>BB-${payment?.id || Date.now()}</strong></li>
          <li>Betalningen hanteras automatiskt</li>
        </ol>
      </div>

      <div style="display:flex;gap:1rem;justify-content:center;margin-top:1.5rem">
        <button class="btn btn-primary" onclick="checkPayment(${payment?.id || 0})">Jag har betalat</button>
        <button class="btn btn-outline" onclick="navigate('dashboard')">Gå till översikt</button>
      </div>
    </div>
  `;
}

async function checkPayment(paymentId) {
  if (!paymentId) { alert('Ingen betalning att kolla'); return; }
  try {
    const data = await api(`/swish/status/${paymentId}`);
    const p = data.payment;
    if (p.status === 'paid') {
      alert('✅ Betalning mottagen! Din prenumeration är aktiverad.');
      await loadDashboardData();
      navigate('dashboard');
    } else if (p.status === 'created' || p.status === 'pending') {
      alert('⏳ Betalningen väntar fortfarande. Kontrollera att du genomfört Swish-betalningen.');
    } else {
      alert('Status: ' + p.status);
    }
  } catch (err) {
    alert('Fel: ' + err.message);
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
            <label>Telefon (för Swish)</label>
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
