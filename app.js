// BriefBot — Complete Application Logic v2 (Polished UX)
// ====== Konfiguration ======
const API_URL = window.location.origin + '/api';

// ====== Toast system (ersätter alla alert()) ======
function showToast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  // Trigger enter animation
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ====== State ======
let state = {
  user: null,
  token: localStorage.getItem('bb_token'),
  topics: [],
  briefs: [],
  payments: [],
  subscription: null,
  slack_webhook_url: '',
  company_name: '',
  company_industry: '',
  company_description: '',
  competitors: '',
  focus_areas: '',
  newsletters: [],
  onboardingDone: localStorage.getItem('bb_onboarding') === '1',
  searchQuery: ''
};

// ====== API Client ======
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  try {
    const res = await fetch(API_URL + path, { ...options, headers });
    const data = await res.json();
    if (!res.ok && data.error) throw new Error(data.error);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return data;
  } catch (err) {
    if (err.message === 'Failed to fetch') throw new Error('Nätverksfel — kontrollera din anslutning');
    throw err;
  }
}

// ====== Router ======
function getPage() {
  const hash = window.location.hash.slice(1);
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
function navigate(page, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  window.location.hash = page;
  render();
}

// ====== Cookie Consent ======
function acceptCookies() {
  localStorage.setItem('bb_cookies', '1');
  document.getElementById('cookie-consent')?.classList.remove('cookie-visible');
}

window.addEventListener('hashchange', () => {
  const hashParams = getHashParams();
  const page = getPage();
  if (page === 'payment' && hashParams.session_id) {
    render();
    handlePaymentReturn(hashParams.session_id);
  } else if (page === 'login' && hashParams.token) {
    // Google OAuth redirect
    state.token = hashParams.token;
    localStorage.setItem('bb_token', hashParams.token);
    state.user = { name: hashParams.name || '', email: hashParams.email || '' };
    navigate('dashboard');
    loadDashboardData();
    showToast('Inloggad med Google! 🎉', 'success');
  } else {
    render();
  }
});

// ====== Rendering ======
function render() {
  const page = getPage();

  // Hide all pages
  document.querySelectorAll('#app-loggedout .page, #main-content .page').forEach(p => p.classList.remove('active'));

  if (state.token) {
    document.getElementById('app-loggedout')?.classList.remove('active');
    document.getElementById('app-dashboard')?.classList.add('active');
    renderDashboardNav(page);
    renderSidebar(page);

    switch (page) {
      case 'login': case 'home': navigate('dashboard'); return;
      case 'dashboard': renderDashboard(); break;
      case 'topics': renderTopics(); break;
      case 'briefs': renderBriefs(); break;
      case 'newsletter': renderNewsletter(); break;
      case 'pricing': renderPricing(); break;
      case 'profile': renderProfile(); break;
      case 'payment': renderPaymentRedirect(); break;
      case 'faq': renderFAQ(true); break;
      case 'reset': renderResetPassword(); break;
      default: navigate('dashboard'); return;
    }
    const el = document.getElementById('page-' + page);
    if (el) {
      el.classList.add('active');
      el.style.animation = 'fadeIn 0.25s ease';
    }
  } else {
    document.getElementById('app-dashboard')?.classList.remove('active');
    document.getElementById('app-loggedout')?.classList.add('active');
    document.getElementById('app-loggedout').style.animation = 'fadeIn 0.2s ease';

    switch (page) {
      case 'home': renderHome(); break;
      case 'login': renderLogin(); break;
      case 'signup': renderSignup(); break;
      case 'faq': renderFAQ(false); break;
      case 'reset': renderResetPassword(); break;
      default: navigate('home'); return;
    }
    const el = document.getElementById(page === 'faq' ? 'page-faq-out' : 'page-' + page);
    if (el) {
      el.classList.add('active');
      el.style.animation = 'fadeIn 0.25s ease';
    }
  }

  // Close modals
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
}

// ====== Cookie banner on first visit ======
if (!localStorage.getItem('bb_cookies')) {
  setTimeout(() => {
    document.getElementById('cookie-consent')?.classList.add('cookie-visible');
  }, 1000);
}

// ====== Dashboard Navigation ======
function renderDashboardNav(page) {
  const nav = document.getElementById('dash-nav');
  if (!nav) return;
  nav.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.75rem">
      <button class="btn btn-icon hamburger" onclick="toggleSidebar()" aria-label="Meny">☰</button>
      <a href="#dashboard" class="nav-logo" onclick="navigate('dashboard',event)"><img src="/briefbot-logo.svg" alt="BriefBot" style="height:28px;vertical-align:middle"></a>
    </div>
    <div class="nav-links nav-desktop">
      <a href="#dashboard" class="${page === 'dashboard' ? 'active' : ''}">Översikt</a>
      <a href="#topics">Ämnen</a>
      <a href="#briefs">Briefs</a>
      <a href="#pricing">Pris</a>
      <a href="#profile" title="${state.user?.email || ''}">
        <span class="nav-avatar">${(state.user?.name || state.user?.email || '?')[0].toUpperCase()}</span>
      </a>
    </div>
  `;
}

function renderSidebar(page) {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const items = [
    { h: '#dashboard', i: '📊', l: 'Översikt' },
    { h: '#topics', i: '📡', l: 'Ämnen' },
    { h: '#briefs', i: '📄', l: 'Briefs' },
    { h: '#newsletter', i: '📬', l: 'Nyhetsbrev' },
    { h: '#pricing', i: '💳', l: 'Prenumeration' },
    { h: '#profile', i: '👤', l: 'Profil' },
    { h: '#faq', i: '❓', l: 'FAQ' },
  ];
  sb.innerHTML = `
    <div class="sidebar-user">
      <div class="sidebar-avatar">${(state.user?.name || state.user?.email || '?')[0].toUpperCase()}</div>
      <div class="sidebar-name">${esc(state.user?.name || state.user?.email || '')}</div>
    </div>
    <h3>Meny</h3>
    <ul class="sidebar-menu">
      ${items.map(it => `
        <li><a href="${it.h}" class="${page === it.l.toLowerCase().replace('ä','a').replace('ö','o') ? 'active' : ''}" onclick="navigate('${it.h.slice(1)}',event);closeSidebar()">${it.i} ${it.l}</a></li>
      `).join('')}
      <li style="margin-top:2rem">
        <a href="#" onclick="handleLogout()" style="color:var(--danger)" class="logout-link">🚪 Logga ut</a>
      </li>
    </ul>
  `;
}

// ====== Sidebar toggle for mobile ======
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
}

// ====== Auth ======
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
    showToast('Välkommen tillbaka!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
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
    state.onboardingDone = false;
    localStorage.removeItem('bb_onboarding');
    navigate('dashboard');
    loadDashboardData();
    showToast('Konto skapat! Välkommen till BriefBot 🎉', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false; btn.textContent = 'Skapa konto';
  }
}

function handleLogout() {
  state.token = null;
  state.user = null;
  state.onboardingDone = false;
  localStorage.removeItem('bb_token');
  localStorage.removeItem('bb_onboarding');
  closeSidebar();
  navigate('home');
  showToast('Du är utloggad', 'info');
}

// ====== Dashboard data loading ======
async function loadDashboardData() {
  try {
    const [userData, topicsData, briefsData, subData, settingsData, nlData] = await Promise.all([
      api('/me'),
      api('/topics'),
      api('/briefs?limit=200'),
      api('/subscription'),
      api('/settings'),
      api('/newsletter')
    ]);
    state.user = userData.user;
    state.topics = topicsData.topics;
    state.briefs = briefsData.briefs;
    state.subscription = subData.subscription;
    state.payments = subData.payments;
    state.slack_webhook_url = settingsData?.slack_webhook_url || '';
    state.company_name = settingsData?.company_name || '';
    state.company_industry = settingsData?.company_industry || '';
    state.company_description = settingsData?.company_description || '';
    state.competitors = settingsData?.competitors || '';
    state.focus_areas = settingsData?.focus_areas || '';
    state.newsletters = nlData?.newsletters || [];
    state.daily_email = settingsData?.daily_email || 0;
    state.brief_time = settingsData?.brief_time || '08:00';
    state.deliv_slack = settingsData?.deliv_slack !== false;
    render();
    // Show onboarding if first time
    if (!state.onboardingDone && state.topics.length === 0) {
      setTimeout(showOnboarding, 500);
    }
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      handleLogout();
    }
  }
}

// ====== Onboarding ======
function showOnboarding() {
  if (state.onboardingDone) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.innerHTML = `
    <div class="modal onboarding-modal" style="max-width:480px">
      <div class="onboarding-steps">
        <div class="onboarding-step active" data-step="1">
          <div class="onboarding-icon">👋</div>
          <h2>Välkommen till BriefBot!</h2>
          <p>Du har precis tagit första steget mot smartare konkurrentbevakning. Låt oss hjälpa dig igång på 30 sekunder.</p>
          <div class="onboarding-actions">
            <button class="btn btn-outline" onclick="finishOnboarding()">Hoppa över</button>
            <button class="btn btn-primary" onclick="nextOnboardingStep(1)">Kom igång →</button>
          </div>
        </div>
        <div class="onboarding-step" data-step="2">
          <div class="onboarding-icon">📡</div>
          <h2>Skapa ditt första ämne</h2>
          <p>Berätta vad du vill bevaka — det kan vara en bransch (t.ex. "Svensk dagligvaruhandel"), ett företag (t.ex. "Ica") eller en trend (t.ex. "AI i fastighetsbranschen").</p>
          <p style="color:var(--text-muted);font-size:0.85rem">Tips: Klicka på "Nytt ämne" under fliken Ämnen. Ange ett namn och använd 🤖 Förslag för att få AI-genererade nyckelord och källor.</p>
          <div class="onboarding-actions">
            <button class="btn btn-outline" onclick="finishOnboarding()">Hoppa över</button>
            <button class="btn btn-primary" onclick="finishOnboarding();navigate('topics')">Gå till Ämnen →</button>
          </div>
        </div>
        <div class="onboarding-step" data-step="3">
          <div class="onboarding-icon">⚡</div>
          <h2>Generera din första brief</h2>
          <p>När du lagt till ett ämne, gå till fliken "Briefs" och klicka på "Generera nu". BriefBot söker webben och skapar en konkurrentanalys på svenska.</p>
          <div class="onboarding-actions">
            <button class="btn btn-outline" onclick="finishOnboarding()">Hoppa över</button>
            <button class="btn btn-primary" onclick="finishOnboarding()">OK, fattar! ✅</button>
          </div>
        </div>
      </div>
      <div class="onboarding-dots">
        <span class="dot active"></span><span class="dot"></span><span class="dot"></span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function nextOnboardingStep(current) {
  const steps = document.querySelectorAll('.onboarding-step');
  const dots = document.querySelectorAll('.dot');
  steps.forEach(s => s.classList.remove('active'));
  dots.forEach(d => d.classList.remove('active'));
  const next = steps[current];
  const nd = dots[current];
  if (next) { next.classList.add('active'); if (nd) nd.classList.add('active'); }
}

function finishOnboarding() {
  state.onboardingDone = true;
  localStorage.setItem('bb_onboarding', '1');
  document.querySelector('.onboarding-modal')?.closest('.modal-overlay')?.remove();
}

// ====== Pages ======

function renderHome() {
  document.getElementById('page-home').innerHTML = `
    <nav class="nav">
      <a href="#home" class="nav-logo" onclick="navigate('home',event)"><img src="/briefbot-logo.svg" alt="BriefBot" style="height:28px;vertical-align:middle"></a>
      <div class="nav-links">
        <a href="#faq" onclick="navigate('faq',event)">FAQ</a>
        <a href="#pricing" onclick="renderPricing();navigate('pricing',event)" class="">Pris</a>
        <a href="#login" onclick="navigate('login',event)">Logga in</a>
        <a href="#signup" onclick="navigate('signup',event)" class="btn btn-primary btn-sm">🚀 Kom igång gratis</a>
      </div>
    </nav>
    <section class="hero">
      <div class="hero-badge anim-fade">💼 Byggd för småföretag — från 0 kr/mån</div>
      <h1 class="anim-fade-up" style="animation-delay:0.1s">Din konkurrentbevakning<br><span>— automatiserad för 99 kr/mån</span></h1>
      <p class="hero-sub anim-fade-up" style="animation-delay:0.2s">Få dagliga AI-briefs om dina konkurrenter — precis som storföretagen. <strong>Från 99 kr/mån</strong>. Första ämnet gratis för alltid. Inget kontokort.</p>
      <div class="hero-actions anim-fade-up" style="animation-delay:0.3s">
        <a href="#signup" class="btn btn-primary btn-lg" onclick="navigate('signup',event)">🚀 Starta gratis — 14 dagar</a>
        <a href="#features" class="btn btn-outline btn-lg" onclick="document.getElementById('features').scrollIntoView({behavior:'smooth'})">Läs mer</a>
      </div>
      <div class="hero-stats anim-fade-up" style="animation-delay:0.4s">
        <div class="hero-stat"><strong>99 kr/mån</strong> istället för 15.000</div>
        <div class="hero-stat"><strong>1 ämne</strong> gratis för alltid</div>
        <div class="hero-stat"><strong>AI</strong> med Google Search</div>
      </div>
    </section>
    <section class="usp-section stagger">
      <div class="usp-grid">
        <div class="usp-card">
          <div class="usp-icon">🤖</div>
          <h3>Analys som kommer till dig</h3>
          <p>Du behöver inte logga in varje dag. Briefsen levereras automatiskt till din dashboard, Slack eller mejl — redo när du är.</p>
        </div>
        <div class="usp-card usp-featured">
          <div class="usp-icon">🧠</div>
          <h3>Ser mönster du missar</h3>
          <p>Varje brief jämförs automatiskt med förra veckans. Du ser trender och förändringar — inte bara dagens rubriker.</p>
        </div>
        <div class="usp-card">
          <div class="usp-icon">💰</div>
          <h3>99 kr istället för 15.000</h3>
          <p>Retriever, Meltwater och liknande kostar 3.000–15.000 kr/mån. BriefBot gör samma jobb för 99 kr. Första ämnet är gratis för alltid.</p>
        </div>
      </div>
    </section>
    <div class="logos-section">
      <p class="logos-title">Perfekt för</p>
      <div class="logos-row">
        <span>🔧 Småföretagare</span>
        <span>📈 Marknadschefer</span>
        <span>🏢 Säljare</span>
        <span>💼 Konsulter</span>
        <span>🚀 Startups</span>
        <span>🏭 VD/ägare</span>
      </div>
    </div>
    <div class="how-it-works" id="features">
      <h2>Så här fungerar det</h2>
      <p>Kom igång på 30 sekunder — inget kontokort krävs</p>
      <div class="steps stagger">
        <div class="step">
          <div class="step-num">1</div>
          <h3>Skapa konto</h3>
          <p>Registrera dig gratis. Första ämnet är alltid gratis.</p>
        </div>
        <div class="step-arrow">›</div>
        <div class="step">
          <div class="step-num">2</div>
          <h3>Välj ämne</h3>
          <p>Ange bransch, konkurrenter eller nyckelord att bevaka.</p>
        </div>
        <div class="step-arrow">›</div>
        <div class="step">
          <div class="step-num">3</div>
          <h3>Få briefs</h3>
          <p>AI med Google Search levererar dagliga analyser automatiskt.</p>
        </div>
      </div>
    </div>
    <div class="features-grid stagger">
      <div class="feature-card">
        <div class="feature-icon">🔍</div>
        <h3>Håll koll på konkurrenterna</h3>
        <p>Automatisk bevakning av konkurrenters lanseringar, priser och strategier — utan att du lyfter ett finger.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🧠</div>
        <h3>Aktuell data, inte gammal AI</h3>
        <p>Google Search i varje brief. Ingen hallucination, ingen gammal träningsdata — bara relevanta nyheter.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📬</div>
        <h3>Levereras dit du jobbar</h3>
        <p>Dashboard, Slack eller dela med teamet. Briefsen kommer till dig — du behöver inte leta.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🏢</div>
        <h3>Anpassat till ditt företag</h3>
        <p>Fyll i bransch och konkurrenter — briefsen blir personliga och relevanta för just din verksamhet.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📊</div>
        <h3>Trendanalys över tid</h3>
        <p>Varje brief jämförs med föregående. Du ser utveckling, inte bara en ögonblicksbild.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🎯</div>
        <h3>Rollanpassade perspektiv</h3>
        <p>VD, säljare eller marknadschef — olika roller får olika insikter. Alla får relevant information.</p>
      </div>
    </div>`;
}

// ====== Login / Signup ======
function renderLogin() {
  document.getElementById('page-login').innerHTML = `
    <div class="auth-page"><div class="auth-card">
      <a href="#home" onclick="navigate('home',event)" style="color:var(--text-muted);text-decoration:none;display:inline-block;margin-bottom:1rem;font-size:0.85rem">← Tillbaka</a>
      <h1>Välkommen tillbaka</h1>
      <p>Logga in på ditt BriefBot-konto</p>
      <form onsubmit="handleLogin(event)">
        <div class="form-group"><label>E-post</label><input type="email" id="login-email" class="form-input" placeholder="din@epost.se" required autocomplete="email"></div>
        <div class="form-group"><label>Lösenord</label><input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password"></div>
        <button type="submit" class="btn btn-primary">Logga in</button>
        <div style="text-align:center;margin-top:0.5rem">
          <a href="#reset" onclick="navigate('reset',event)" style="font-size:0.8rem;color:var(--primary)">Glömt lösenord?</a>
        </div>
        <div class="social-divider" style="margin:1rem 0;text-align:center;color:var(--text-muted);font-size:0.8rem;position:relative">
          <span style="background:var(--bg);padding:0 0.5rem;position:relative;z-index:1">eller</span>
          <div style="border-top:1px solid var(--border);margin-top:-0.6rem"></div>
        </div>
        <button type="button" class="btn btn-outline" onclick="loginWithGoogle()" style="width:100%;justify-content:center">
          G Logga in med Google
        </button>
      </form>
      <div class="auth-link">Har du inget konto? <a href="#signup" onclick="navigate('signup',event)">Skapa ett här</a></div>
    </div></div>
  `;
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

// ====== Glömt lösenord ======
function renderResetPassword() {
  const params = getHashParams();
  const token = params.token;

  document.getElementById('page-reset').innerHTML = `
    <div class="auth-page"><div class="auth-card">
      <a href="#login" onclick="navigate('login',event)" style="color:var(--text-muted);text-decoration:none;display:inline-block;margin-bottom:1rem;font-size:0.85rem">← Tillbaka till inloggning</a>
      <h1>${token ? 'Återställ lösenord' : 'Glömt lösenord'}</h1>
      <p>${token ? 'Ange ditt nya lösenord' : 'Skriv din e-postadress så skickar vi en återställningslänk'}</p>
      ${token ? `
        <form onsubmit="handleResetPassword(event)">
          <div class="form-group"><label>Nytt lösenord</label><input type="password" id="reset-password" class="form-input" placeholder="Minst 6 tecken" required minlength="6"></div>
          <div class="form-group"><label>Bekräfta lösenord</label><input type="password" id="reset-password2" class="form-input" placeholder="Samma som ovan" required minlength="6"></div>
          <input type="hidden" id="reset-token" value="${token}">
          <button type="submit" class="btn btn-primary">Återställ lösenord</button>
        </form>
      ` : `
        <form onsubmit="handleForgotPassword(event)">
          <div class="form-group"><label>E-post</label><input type="email" id="forgot-email" class="form-input" placeholder="din@epost.se" required autocomplete="email"></div>
          <button type="submit" class="btn btn-primary">Skicka återställningslänk</button>
        </form>
      `}
    </div></div>
  `;
  setTimeout(() => {
    const el = document.getElementById('reset-password') || document.getElementById('forgot-email');
    if (el) el.focus();
  }, 100);
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value;
  const btn = e.target.querySelector('.btn');
  btn.disabled = true; btn.textContent = 'Skickar...';
  try {
    const data = await api('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email })
    });
    showToast('Om kontot finns skickas en återställningslänk till din e-post', 'success');
    navigate('login');
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
    btn.disabled = false; btn.textContent = 'Skicka återställningslänk';
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const token = document.getElementById('reset-token').value;
  const password = document.getElementById('reset-password').value;
  const password2 = document.getElementById('reset-password2').value;
  if (password !== password2) return showToast('Lösenorden matchar inte', 'warning');
  const btn = e.target.querySelector('.btn');
  btn.disabled = true; btn.textContent = 'Återställer...';
  try {
    const data = await api('/auth/reset', {
      method: 'PUT', body: JSON.stringify({ token, password })
    });
    showToast('Lösenord återställt! Logga in med ditt nya lösenord.', 'success');
    navigate('login');
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
    btn.disabled = false; btn.textContent = 'Återställ lösenord';
  }
}

// ====== Google OAuth ======
function loginWithGoogle() {
  window.location.href = API_URL + '/auth/google';
}

function renderSignup() {
  document.getElementById('page-signup').innerHTML = `
    <div class="auth-page"><div class="auth-card auth-card-signup">
      <a href="#home" onclick="navigate('home',event)" style="color:var(--text-muted);text-decoration:none;display:inline-block;margin-bottom:1rem;font-size:0.85rem">← Tillbaka</a>
      <h1>Kom igång med BriefBot</h1>
      <p>Skapa ditt konto — första briefen inom 24h. <strong>Gratis för alltid!</strong></p>
      <div class="signup-benefits">
        <span>✅ Inget kontokort</span>
        <span>✅ Ingen bindningstid</span>
        <span>✅ Första ämnet gratis för alltid</span>
      </div>
      <form onsubmit="handleSignup(event)">
        <div class="form-group"><label>Namn</label><input type="text" id="signup-name" class="form-input" placeholder="Ditt namn" autocomplete="name"></div>
        <div class="form-group"><label>E-post *</label><input type="email" id="signup-email" class="form-input" placeholder="din@epost.se" required autocomplete="email"></div>
        <div class="form-group"><label>Telefon (frivilligt)</label><input type="tel" id="signup-phone" class="form-input" placeholder="0701234567" autocomplete="tel"></div>
        <div class="form-group"><label>Lösenord *</label><input type="password" id="signup-password" class="form-input" placeholder="Minst 6 tecken" required minlength="6" autocomplete="new-password"></div>
        <button type="submit" class="btn btn-primary">Skapa konto — prova gratis i 14 dagar</button>
      </form>
      <div class="auth-link">Har du redan ett konto? <a href="#login" onclick="navigate('login',event)">Logga in</a></div>
    </div></div>
  `;
  setTimeout(() => document.getElementById('signup-name')?.focus(), 100);
}

// ====== Dashboard overview ======
function renderDashboard() {
  const sub = state.subscription || {};
  const subStatus = sub.status === 'active'
    ? '<span class="badge badge-active">✅ Aktiv</span>'
    : '<span class="badge badge-inactive">❌ Inaktiv</span>';

  const topicCount = state.topics?.length || 0;
  const briefCount = state.briefs?.length || 0;
  const lastWeek = state.briefs?.filter(b => {
    const d = new Date(b.created_at);
    return d > new Date(Date.now() - 7 * 86400000);
  }).length || 0;
  const lastBrief = state.briefs?.[0];
  const daysLeft = sub.expires ? Math.ceil((new Date(sub.expires) - new Date()) / 86400000) : null;

  document.getElementById('page-dashboard').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2rem;flex-wrap:wrap;gap:1rem">
      <div>
        <h1>Översikt</h1>
        <p class="subtitle" style="margin-bottom:0">Välkommen tillbaka, ${esc(state.user?.name || state.user?.email)}</p>
      </div>
      <div style="display:flex;gap:0.75rem">
        <button class="btn btn-primary" onclick="navigate('briefs')">📄 Generera briefs</button>
        <button class="btn btn-outline" onclick="navigate('topics')">+ Nytt ämne</button>
      </div>
    </div>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-value">${topicCount}</div>
        <div class="stat-label">Bevakningsämnen</div>
        <div class="stat-trend ${topicCount > 0 ? 'trend-up' : ''}">${topicCount > 0 ? 'Aktiva' : 'Lägg till ämnen →'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${briefCount}</div>
        <div class="stat-label">Briefs totalt</div>
        <div class="stat-trend ${lastWeek > 0 ? 'trend-up' : ''}">${lastWeek > 0 ? `${lastWeek} denna vecka` : 'Generera din första'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${daysLeft !== null ? daysLeft : '—'}</div>
        <div class="stat-label">Dagar kvar på trial</div>
        <div class="stat-trend">${sub.status === 'active' ? (sub.expires ? 'Aktiv' : 'Obegränsad') : 'Prenumerera'}</div>
      </div>
    </div>

    ${sub.status !== 'active' ? `
      <div class="card alert-card" style="margin-bottom:2rem">
        <p style="color:var(--text-muted);margin-bottom:1rem">Aktivera din prenumeration för att få dagliga briefs och obegränsad åtkomst.</p>
        <a href="#pricing" class="btn btn-primary" onclick="navigate('pricing',event)">Betala 99 kr/mån →</a>
      </div>
    ` : ''}

    <div class="dash-grid">
      <div class="dash-col">
        <div class="dash-section-header">
          <h2>Dina ämnen</h2>
          <a href="#topics" onclick="navigate('topics',event)" class="dash-see-all">Se alla</a>
        </div>
        ${topicCount === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📡</div>
            <h3>Inga ämnen än</h3>
            <p>Lägg till ditt första bevakningsämne för att komma igång.</p>
            <button class="btn btn-primary" onclick="navigate('topics')">+ Lägg till ämne</button>
          </div>
        ` : state.topics.slice(0,4).map(t => {
          const hasBriefs = state.briefs?.some(b => b.topic_id === t.id);
          return `
            <div class="topic-card-sm">
              <div class="topic-card-info">
                <div class="topic-card-name">${esc(t.name)}</div>
                <div class="topic-card-meta">${t.keywords ? esc(t.keywords) : 'Allmänt'} · ${t.frequency === 'weekly' ? 'Veckovis' : 'Dagligen'}</div>
              </div>
              <div style="display:flex;align-items:center;gap:0.5rem">
                <span class="status-dot ${t.active ? 'dot-green' : 'dot-gray'}"></span>
                <span class="badge ${hasBriefs ? 'badge-active' : 'badge-pending'}">${hasBriefs ? 'Aktiv' : 'Ny'}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="dash-col">
        <div class="dash-section-header">
          <h2>Senaste briefs</h2>
          <a href="#briefs" onclick="navigate('briefs',event)" class="dash-see-all">Se alla</a>
        </div>
        ${briefCount === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📄</div>
            <h3>Inga briefs än</h3>
            <p>Generera din första brief för att se en analys.</p>
            <button class="btn btn-primary" onclick="navigate('briefs')">Generera nu</button>
          </div>
        ` : state.briefs.slice(0,4).map(b => `
          <div class="brief-card-sm" onclick="showBrief(${b.id})">
            <div class="brief-sm-header">
              <span class="brief-sm-topic">${esc(b.topic_name)}</span>
              <span class="brief-sm-date">${b.created_at?.slice(0,10) || ''}</span>
            </div>
            <div class="brief-sm-summary">${esc((b.summary || b.content || '').slice(0,120))}${(b.summary || b.content || '').length > 120 ? '...' : ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ====== Topics management ======
function renderTopics() {
  document.getElementById('page-topics').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Bevakningsämnen</h1>
        <p class="subtitle" style="margin-bottom:0">Hantera vad BriefBot bevakar åt dig</p>
      </div>
      <button class="btn btn-primary" onclick="showTopicForm()">+ Nytt ämne</button>
    </div>
    <div class="topic-list" id="topic-list">
      ${state.topics.length === 0 ? `
        <div class="empty-state" style="padding:4rem 2rem">
          <div class="empty-icon">📡</div>
          <h3>Inga bevakningsämnen än</h3>
          <p>Klicka på "+ Nytt ämne" för att börja bevaka konkurrenter, branscher eller trender.</p>
        </div>
      ` : ''}
    </div>
  `;

  const list = document.getElementById('topic-list');
  if (list && state.topics.length > 0) {
    list.innerHTML = state.topics.map(t => {
      const lastBrief = state.briefs?.filter(b => b.topic_id === t.id);
      const lastDate = lastBrief?.length > 0 ? lastBrief[0].created_at?.slice(0,10) : null;
      const roleLabels = { vd:'VD', salj:'Sälj', marknad:'Marknad', allman:'Allmän' };
      return `
        <div class="topic-card">
          <div class="topic-info">
            <div class="topic-name">${esc(t.name)}</div>
            <div class="topic-meta">
              ${esc(t.keywords || 'Allmänt')} · ${t.frequency === 'weekly' ? 'Veckovis' : 'Dagligen'}
              ${t.sources ? ' · Källa: ' + esc(t.sources) : ''}
              ${lastDate ? ` · Senast: ${lastDate}` : ''}
              · <span class="badge badge-active" style="font-size:0.7rem">${roleLabels[t.role]||'Allmän'}</span>
            </div>
          </div>
          <div class="topic-actions">
            <span class="status-dot ${t.active ? 'dot-green' : 'dot-gray'}"></span>
            <button class="btn btn-outline btn-sm" onclick="showTimeline(${t.id})" title="Visa tidslinje">📅</button>
            <button class="btn btn-outline btn-sm" onclick="editTopic(${t.id})" title="Ändra">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTopic(${t.id})" title="Ta bort">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function showTopicForm(topic) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <h2>${topic ? 'Ändra ämne' : 'Nytt bevakningsämne'}</h2>
      ${!topic ? '<p style="color:var(--text-muted);margin-bottom:1.25rem;font-size:0.9rem">Ange vad du vill bevaka — t.ex. en bransch, ett företag eller en trend.</p>' : ''}
      <form onsubmit="saveTopic(event, ${topic?.id || 'null'})">
        <div class="form-group">
          <label>Namn på ämnet *</label>
          <div style="display:flex;gap:0.5rem">
            <input type="text" id="topic-name" class="form-input" value="${esc(topic?.name || '')}" placeholder="t.ex. Svensk dagligvaruhandel, Ica, AI i byggbranschen" required autofocus oninput="document.getElementById('suggest-btn').style.display=this.value.trim()?'inline-flex':'none'">
            <button type="button" id="suggest-btn" class="btn btn-outline btn-sm" onclick="suggestKeywords()" style="${topic?.name ? 'display:inline-flex' : 'display:none'}" title="Få AI-förslag">🤖 Förslag</button>
          </div>
        </div>
        <div class="form-group">
          <label>Nyckelord (kommaseparerade)</label>
          <input type="text" id="topic-keywords" class="form-input" value="${esc(topic?.keywords || '')}" placeholder="t.ex. Ica, Axfood, dagligvaruhandel">
          <div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">Använd 🤖 Förslag för att få AI-genererade nyckelord</div>
        </div>
        <div class="form-group">
          <label>Källor (kommaseparerade, frivilligt)</label>
          <input type="text" id="topic-sources" class="form-input" value="${esc(topic?.sources || '')}" placeholder="t.ex. di.se, svd.se, breakit.se">
        </div>
        <div class="form-group">
          <label>Frekvens</label>
          <select id="topic-frequency" class="form-input">
            <option value="daily" ${topic?.frequency === 'daily' ? 'selected' : ''}>Dagligen — brief varje vardag</option>
            <option value="weekly" ${topic?.frequency === 'weekly' ? 'selected' : ''}>Veckovis — brief varje måndag</option>
          </select>
        </div>
        <div class="form-group">
          <label>Perspektiv (vem är briefen för?)</label>
          <select id="topic-role" class="form-input">
            <option value="allman" ${(topic?.role||'allman')==='allman'?'selected':''}>Allmän — för hela organisationen</option>
            <option value="vd" ${topic?.role==='vd'?'selected':''}>VD/ägare — strategi, hot, möjligheter</option>
            <option value="salj" ${topic?.role==='salj'?'selected':''}>Säljare — priser, lanseringar, argument</option>
            <option value="marknad" ${topic?.role==='marknad'?'selected':''}>Marknad — positionering, kampanjer, PR</option>
          </select>
          <div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">BriefBot anpassar analysen efter perspektivet</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Avbryt</button>
          <button type="submit" class="btn btn-primary">${topic ? '💾 Spara ändringar' : '✅ Skapa ämne'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('topic-name')?.focus(), 100);
}

async function suggestKeywords() {
  const name = document.getElementById('topic-name')?.value;
  if (!name || !name.trim()) return showToast('Ange ett ämnesnamn först', 'warning');
  const btn = document.getElementById('suggest-btn');
  btn.disabled = true; btn.textContent = '🤔 Tänker...';
  try {
    const data = await api('/topics/suggest', {
      method: 'POST', body: JSON.stringify({ name: name.trim() })
    });
    if (data.keywords) document.getElementById('topic-keywords').value = data.keywords;
    if (data.sources) document.getElementById('topic-sources').value = data.sources;
    btn.textContent = '✅ Förslag klara';
    showToast('Förslag hämtade från AI', 'success');
    setTimeout(() => { btn.textContent = '🤖 Förslag'; btn.disabled = false; }, 2000);
  } catch (err) {
    btn.textContent = '❌ Misslyckades';
    showToast('Kunde inte hämta förslag: ' + err.message, 'error');
    setTimeout(() => { btn.textContent = '🤖 Förslag'; btn.disabled = false; }, 2000);
  }
}

async function saveTopic(e, topicId) {
  e.preventDefault();
  const data = {
    name: document.getElementById('topic-name').value.trim(),
    keywords: document.getElementById('topic-keywords').value.trim(),
    sources: document.getElementById('topic-sources').value.trim(),
    frequency: document.getElementById('topic-frequency').value,
    role: document.getElementById('topic-role').value
  };
  if (!data.name) return showToast('Ange ett namn på ämnet', 'warning');

  try {
    if (topicId) {
      await api(`/topics/${topicId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Ämne uppdaterat!', 'success');
    } else {
      await api('/topics', { method: 'POST', body: JSON.stringify(data) });
      showToast('Nytt ämne skapat! 🎉', 'success');
    }
    document.querySelector('.modal-overlay')?.remove();
    await loadDashboardData();
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
  }
}

async function deleteTopic(topicId) {
  showConfirm('Ta bort detta ämne? Alla tillhörande briefs raderas också.', async () => {
    try {
      await api(`/topics/${topicId}`, { method: 'DELETE' });
      showToast('Ämne borttaget', 'info');
      await loadDashboardData();
    } catch (err) {
      showToast('Fel: ' + err.message, 'error');
    }
  });
}

function editTopic(topicId) {
  const topic = state.topics.find(t => t.id === topicId);
  if (topic) showTopicForm(topic);
}

// ====== Confirm dialog (ersätter confirm()) ======
function showConfirm(msg, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <p style="margin-bottom:1.5rem;color:var(--text);line-height:1.5">${msg}</p>
      <div style="display:flex;gap:0.75rem;justify-content:flex-end">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Avbryt</button>
        <button class="btn btn-danger" id="confirm-btn">Bekräfta</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('confirm-btn').onclick = () => {
    overlay.remove();
    onConfirm();
  };
}

// ====== Briefs ======
function renderBriefs() {
  document.getElementById('page-briefs').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Dina briefs</h1>
        <p class="subtitle" style="margin-bottom:0">AI-genererade konkurrentanalyser</p>
      </div>
      <button class="btn btn-primary" onclick="generateBriefs()" ${state.subscription?.status !== 'active' ? 'disabled title="Prenumeration krävs"' : ''}>📄 Generera nu</button>
    </div>

    ${state.briefs.length > 0 ? `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="form-input search-input" id="brief-search" placeholder="Sök i briefs..." value="${esc(state.searchQuery)}" oninput="filterBriefs(this.value)">
      </div>
    ` : ''}

    <div class="brief-stats">
      <span>${state.briefs.length} briefs · Senaste: ${state.briefs[0]?.created_at?.slice(0,10) || '—'}</span>
      <span>${state.topics.length} ämnen</span>
    </div>

    <div class="brief-list" id="brief-list">
      ${state.briefs.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <h3>Inga briefs än</h3>
          <p>Klicka på "Generera nu" för att skapa din första konkurrentanalys.</p>
        </div>
      ` : ''}
    </div>
  `;

  if (state.briefs.length > 0) {
    filterBriefs(state.searchQuery);
    setTimeout(() => document.getElementById('brief-search')?.focus(), 100);
  }
}

function filterBriefs(query) {
  state.searchQuery = query;
  const list = document.getElementById('brief-list');
  if (!list) return;

  const filtered = !query ? state.briefs : state.briefs.filter(b =>
    (b.topic_name || '').toLowerCase().includes(query.toLowerCase()) ||
    (b.title || '').toLowerCase().includes(query.toLowerCase()) ||
    (b.summary || b.content || '').toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>Inga träffar</h3><p>Inga briefs matchade "${esc(query)}"</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(b => `
    <div class="brief-card" onclick="showBrief(${b.id})">
      <div class="brief-card-header">
        <div>
          <div class="brief-title">${esc(b.topic_name)}</div>
          <div class="brief-topic">${esc(b.title || '')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">
          <span class="brief-date">${b.created_at?.replace('T', ' ').slice(0,10) || ''}</span>
          <button class="btn btn-icon btn-sm" onclick="event.stopPropagation();deleteBrief(${b.id})" title="Radera" style="color:var(--text-dim)">🗑️</button>
        </div>
      </div>
      <div class="brief-summary">${esc((b.summary || b.content || '').slice(0,300))}${(b.summary || b.content || '').length > 300 ? '...' : ''}</div>
      <div class="brief-card-footer">
        <span class="badge badge-active">${esc(b.topic_name)}</span>
      </div>
    </div>
  `).join('');
}

async function generateBriefs() {
  const btn = document.querySelector('#page-briefs .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Genererar...'; }

  try {
    if (state.topics.length === 0) {
      showToast('Du måste skapa ett ämne först!', 'warning');
      if (btn) { btn.disabled = false; btn.textContent = '📄 Generera nu'; }
      return;
    }

    let selected = state.topics.filter(t => t.active).map(t => t.id);
    if (selected.length > 1) {
      const picked = await showTopicPicker();
      if (!picked || picked.length === 0) {
        if (btn) { btn.disabled = false; btn.textContent = '📄 Generera nu'; }
        return;
      }
      selected = picked;
    }

    // Visa laddnings-overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay generate-overlay';
    overlay.innerHTML = `
      <div class="generate-loading">
        <div class="generate-spinner"></div>
        <h3>Genererar briefs...</h3>
        <p class="generate-status">Söker webben och skapar analys</p>
        <div class="generate-bar"><div class="generate-bar-fill"></div></div>
      </div>
    `;
    document.body.appendChild(overlay);
    // Visa "tar lite längre tid" om det dröjer
    let slowTimer = setTimeout(() => {
      const status = overlay.querySelector('.generate-status');
      if (status) status.textContent = 'Tar lite längre tid — Gemini söker webben efter aktuell data...';
    }, 8000);
    let longTimer = setTimeout(() => {
      const status = overlay.querySelector('.generate-status');
      if (status) status.textContent = 'Fortfarande igång. Google Search kan ta tid — tack för tålamodet!';
    }, 20000);

    const data = await api('/briefs/generate', { method: 'POST', body: JSON.stringify({ topic_ids: selected }) });
    clearTimeout(slowTimer); clearTimeout(longTimer);
    overlay.remove();
    showToast(`${data.count} brief${data.count !== 1 ? 's' : ''} genererad${data.count !== 1 ? 'e' : ''}! 🎉`, 'success');
    await loadDashboardData();
  } catch (err) {
    // Stäng overlay om den finns
    document.querySelector('.generate-overlay')?.remove();
    showToast('Fel: ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '📄 Generera nu'; }
}

function showTopicPicker() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay._resolve = resolve;
    const activeTopics = state.topics.filter(t => t.active);
    const topicCards = activeTopics.map(t => {
      const hasBriefs = state.briefs?.some(b => b.topic_id === t.id);
      return `
        <label class="topic-pick-item">
          <div style="flex:1;min-width:0">
            <div style="font-weight:500;margin-bottom:0.15rem">${esc(t.name)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${t.keywords ? esc(t.keywords) : 'Allmänt'} ${hasBriefs ? '· Har briefs' : ''}</div>
          </div>
          <input type="checkbox" class="topic-pick-cb" value="${t.id}" checked>
        </label>
      `;
    }).join('');
    overlay.innerHTML = `
      <div class="modal" style="max-width:450px">
        <h2 style="margin-top:0">Välj ämnen</h2>
        <p style="color:var(--text-muted);margin-bottom:1.25rem">Vilka ämnen vill du generera briefs för?</p>
        <div style="margin-bottom:1.5rem;max-height:300px;overflow-y:auto">${topicCards || '<p style="color:var(--text-muted)">Inga aktiva ämnen</p>'}</div>
        <div style="display:flex;gap:1rem;justify-content:flex-end">
          <button class="btn btn-outline" id="tp-cancel-btn">Avbryt</button>
          <button class="btn btn-primary" id="tp-generate-btn">📄 Generera</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    // Uppdatera knapptext dynamiskt när checkboxar ändras
    function updateCount(){
      const btn=document.getElementById('tp-generate-btn');
      const checked=overlay.querySelectorAll('.topic-pick-cb:checked').length;
      if(btn)btn.textContent=checked>0 ? `📄 Generera (${checked} st)` : '📄 Generera';
    }
    overlay.querySelectorAll('.topic-pick-cb').forEach(cb=>{
      cb.addEventListener('change',updateCount);
    });
    updateCount();
    document.getElementById('tp-generate-btn').onclick=function(){
      const cbs=overlay.querySelectorAll('.topic-pick-cb:checked');
      overlay._resolve(Array.from(cbs).map(c=>parseInt(c.value)));
      overlay.remove();
    };
    document.getElementById('tp-cancel-btn').onclick=function(){
      overlay._resolve([]);
      overlay.remove();
    };
  });
}

async function deleteBrief(briefId) {
  showConfirm('Radera denna brief?', async () => {
    try {
      await api('/briefs/' + briefId, { method: 'DELETE' });
      state.briefs = state.briefs.filter(b => b.id !== briefId);
      render();
      showToast('Brief raderad', 'info');
    } catch (err) {
      showToast('Fel: ' + err.message, 'error');
    }
  });
}

async function shareBrief(briefId) {
  try {
    const data = await api(`/briefs/${briefId}/share`, { method: 'POST' });
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(data.shareUrl);
      showToast('🔗 Länk kopierad till urklipp!', 'success');
    } else {
      prompt('Dela denna länk:', data.shareUrl);
    }
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
  }
}

async function showBrief(briefId) {
  try {
    const data = await api(`/briefs/${briefId}`);
    const b = data.brief;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="modal brief-view-modal" style="max-width:720px;max-height:85vh">
        <div class="brief-view-header">
          <div>
            <h2 style="margin-bottom:0.25rem;margin-top:0">${esc(b.topic_name)}</h2>
            <div class="brief-view-meta">
              <span>${b.created_at?.replace('T', ' ').slice(0,16) || ''}</span>
              <span class="badge badge-active">${esc(b.topic_name)}</span>
            </div>
          </div>
          <div class="brief-view-actions">
            <button class="btn btn-outline btn-sm" onclick="shareBrief(${b.id})" title="Dela">🔗</button>
            <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">Stäng ✕</button>
          </div>
        </div>
        <div class="brief-view-content">
          ${formatBriefContent(b.content || '')}
        </div>
        <div class="brief-view-footer">
          <span>Genererad av BriefBot</span>
          <button class="btn btn-outline btn-sm" onclick="copyBriefContent(this, \`${esc(b.content || '').replace(/`/g,'\\`')}\`)">📋 Kopiera</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
  }
}

function formatBriefContent(text) {
  if (!text) return '<p style="color:var(--text-muted)">Inget innehåll</p>';
  // Format markdown-like content as HTML
  let html = esc(text)
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^(\d+)\.\s(.+)$/gm, '<li>$1. $2</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, match => '<ul>' + match.replace(/\n/g, '') + '</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  return '<p>' + html + '</p>';
}

function copyBriefContent(btn, text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    btn.textContent = '✅ Kopierad!';
    setTimeout(() => btn.textContent = '📋 Kopiera', 2000);
  }
}

// ====== Newsletter ======
function renderNewsletter() {
  const company = state.company_name || 'Ditt företag';
  const latest = state.newsletters?.[0] || null;

  document.getElementById('page-newsletter').innerHTML = `
    <div class="page-header">
      <div>
        <h1>📬 Nyhetsbrev</h1>
        <p class="subtitle" style="margin-bottom:0">Veckovisa nyhetsbrev redo att skickas till dina kunder</p>
      </div>
      <button class="btn btn-primary" onclick="generateNewsletter()">📄 Generera nyhetsbrev</button>
    </div>

    <div class="card" style="margin-bottom:2rem">
      <h3 style="margin-top:0;margin-bottom:0.5rem">Så fungerar det</h3>
      <ol style="color:var(--text-muted);margin:0;padding-left:1.25rem;line-height:1.8">
        <li><strong>Ange ditt företagsnamn</strong> i Profil så nyhetsbrevet ser professionellt ut</li>
        <li><strong>Klicka "Generera nyhetsbrev"</strong> så skapar BriefBot ett nyhetsbrev från dina senaste 7 dagars briefs</li>
        <li><strong>Kopiera HTML-koden</strong> och klistra in i Mailchimp, Brevo, eller skicka som vanligt mail</li>
      </ol>
    </div>

    ${latest ? `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem">
          <div>
            <h3 style="margin:0">${esc(latest.title)}</h3>
            <p style="color:var(--text-muted);font-size:0.85rem;margin:0.25rem 0 0 0">Genererad: ${latest.generated_at?.replace('T',' ').slice(0,16) || ''}</p>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button class="btn btn-outline btn-sm" onclick="showNewsletterHTML(${latest.id})" title="Visa HTML">📋 Kopiera HTML</button>
          </div>
        </div>
        <div class="newsletter-preview" style="border:1px solid #e5e7eb;border-radius:8px;padding:1.5rem;background:#fafafa;max-height:400px;overflow-y:auto;font-size:0.9rem;line-height:1.6;white-space:pre-wrap">
          ${esc((latest.content || '').slice(0,2000))}${(latest.content || '').length > 2000 ? '...' : ''}
        </div>
      </div>

      ${state.newsletters.length > 1 ? `
        <h3 style="margin-bottom:1rem">Tidigare nyhetsbrev</h3>
        ${state.newsletters.slice(1).map(n => `
          <div class="topic-card" style="cursor:pointer" onclick="showNewsletterHTML(${n.id})">
            <div class="topic-info">
              <div class="topic-name">${esc(n.title)}</div>
              <div class="topic-meta">${n.generated_at?.replace('T',' ').slice(0,10) || ''}</div>
            </div>
            <div class="topic-actions">
              <span class="badge ${n.sent ? 'badge-active' : 'badge-pending'}">${n.sent ? '✅ Skickat' : '📋 Utkast'}</span>
            </div>
          </div>
        `).join('')}
      ` : ''}
    ` : `
      <div class="empty-state">
        <div class="empty-icon">📬</div>
        <h3>Inga nyhetsbrev än</h3>
        <p>Generera dina första briefs, klicka sedan här för att skapa ett veckovist nyhetsbrev.</p>
        <button class="btn btn-primary" onclick="generateNewsletter()">📄 Generera nyhetsbrev</button>
      </div>
    `}
  `;
}

async function generateNewsletter() {
  const btn = document.querySelector('#page-newsletter .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Genererar nyhetsbrev...'; }

  try {
    const data = await api('/newsletter/generate', { method: 'POST' });
    showToast('Nyhetsbrev genererat! 🎉', 'success');
    await loadDashboardData();
    render();
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '📄 Generera nyhetsbrev'; }
  }
}

async function showNewsletterHTML(nlId) {
  try {
    const data = await api('/newsletter/' + nlId);
    const n = data.newsletter;
    if (!n) return showToast('Nyhetsbrev ej funnet', 'error');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="modal" style="max-width:700px;max-height:90vh">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <h2 style="margin:0">${esc(n.title)}</h2>
          <div style="display:flex;gap:0.5rem">
            <button class="btn btn-outline btn-sm" onclick="copyNewsletterHTML(${n.id})">📋 Kopiera HTML</button>
            <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">Stäng ✕</button>
          </div>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:1px;max-height:70vh;overflow-y:auto;background:#fff">
          <iframe srcdoc="${esc(n.html_content || '').replace(/"/g,'&quot;')}" style="width:100%;height:500px;border:none"></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
  }
}

async function copyNewsletterHTML(nlId) {
  try {
    const data = await api('/newsletter/' + nlId);
    const n = data.newsletter;
    if (navigator.clipboard && n.html_content) {
      await navigator.clipboard.writeText(n.html_content);
      showToast('📋 HTML kopierad! Klistra in i ditt nyhetsbrevsverktyg.', 'success');
    } else {
      showToast('Kunde inte kopiera. Försök manuellt.', 'warning');
    }
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
  }
}

// ====== Timeline per ämne ======
async function showTimeline(topicId) {
  try {
    const data = await api(`/topics/${topicId}/timeline`);
    const t = data.topic;
    const briefs = data.briefs;
    const roleLabels = { vd:'VD/ägare', salj:'Säljare', marknad:'Marknad', allman:'Allmän' };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="modal timeline-modal" style="max-width:600px;max-height:85vh">
        <div class="timeline-header">
          <div>
            <h2 style="margin:0 0 0.25rem">${esc(t.name)}</h2>
            <div style="color:var(--text-muted);font-size:0.85rem">
              Perspektiv: ${roleLabels[t.role]||'Allmän'} · ${t.frequency === 'weekly' ? 'Veckovis' : 'Dagligen'}
              ${t.keywords ? '· ' + esc(t.keywords) : ''}
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">Stäng ✕</button>
        </div>
        <div class="timeline-body">
          ${briefs.length === 0 ? '<div class="empty-state" style="padding:2rem"><div class="empty-icon">📄</div><h3>Inga briefs än</h3></div>' :
            briefs.map((b, i) => `
              <div class="timeline-item" onclick="showBrief(${b.id})" style="cursor:pointer">
                <div class="timeline-dot ${i === 0 ? 'timeline-dot-latest' : ''}"></div>
                <div class="timeline-content">
                  <div class="timeline-date">${b.created_at?.replace('T', ' ').slice(0,16) || ''} ${i === 0 ? '<span class="badge badge-active">Senaste</span>' : ''}</div>
                  <div class="timeline-summary">${esc((b.summary||'').slice(0,200))}${(b.summary||'').length > 200 ? '...' : ''}</div>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
  }
}

// ====== Pricing & Payment (Stripe) ======
function renderPricing() {
  const sub = state.subscription || {};
  const tier = state.user?.subscription_tier || 'free';
  const isActive = sub.status === 'active';
  const tierLabels = { free:'Gratis', pro:'Pro', team:'Team' };
  const tierLimits = { free:1, pro:5, team:20 };

  document.getElementById('page-pricing').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Prenumeration</h1>
        <p class="subtitle" style="margin-bottom:0">Du har <strong>${tierLabels[tier]||'Gratis'}</strong> - ${tierLimits[tier]||1} ämne${tier==='team'?'n':(tier==='pro'?'n':'')}</p>
      </div>
    </div>

    <div class="plans-grid">
      <!-- Free (current or upgrade target) -->
      <div class="pricing-card ${tier==='free'?'pricing-current':''}">
        <h2>BriefBot Free</h2>
        <div class="price">0 kr <span>/mån</span></div>
        <ul>
          <li>1 bevakningsämne</li>
          <li>Veckovisa briefs</li>
          <li>Dashboard med tidslinje</li>
          <li>Grundläggande analys</li>
        </ul>
        ${tier==='free' ? '<span class="badge badge-active" style="display:inline-block;margin-top:0.5rem">✅ Din nuvarande plan</span>' : ''}
      </div>

      <!-- Pro -->
      <div class="pricing-card ${tier==='pro'?'pricing-current':'pricing-featured'}">
        ${tier!=='pro' ? '<div class="pricing-badge">Populär</div>' : ''}
        <h2>BriefBot Pro</h2>
        <div class="price">99 kr <span>/mån</span></div>
        <ul>
          <li>5 bevakningsämnen</li>
          <li>Dagliga briefs</li>
          <li>Slack-integration</li>
          <li>Rollanpassad analys</li>
          <li>Trendanalys över tid</li>
        </ul>
        ${tier==='pro' ? '<span class="badge badge-active" style="display:inline-block;margin-top:0.5rem">✅ Din nuvarande plan</span>' :
          tier==='free' ? `<button class="btn btn-primary" onclick="startStripeCheckout('pro')" style="margin-top:1rem;width:100%;justify-content:center">💳 Uppgradera till Pro 99 kr/mån</button>` :
          ''}
      </div>

      <!-- Team -->
      <div class="pricing-card ${tier==='team'?'pricing-current':''}">
        <h2>BriefBot Team</h2>
        <div class="price">299 kr <span>/mån</span></div>
        <ul>
          <li>20 bevakningsämnen</li>
          <li>Allt i Pro ingår</li>
          <li>Prioriterad support</li>
          <li>API-tillgång</li>
        </ul>
        ${tier==='team' ? '<span class="badge badge-active" style="display:inline-block;margin-top:0.5rem">✅ Din nuvarande plan</span>' :
          tier==='pro' || tier==='free' ? `<button class="btn btn-primary" onclick="startStripeCheckout('team')" style="margin-top:1rem;width:100%;justify-content:center">💳 Uppgradera till Team 299 kr/mån</button>` :
          ''}
      </div>
    </div>

    ${(state.payments?.length > 0) ? `
      <h2 class="section-title">Betalningshistorik</h2>
      <div class="payment-list">
        ${state.payments.map(p => `
          <div class="payment-row">
            <span class="payment-date">${p.created_at?.slice(0,10) || '—'}</span>
            <span class="payment-amount">${(p.amount/100).toFixed(0)} kr</span>
            <span class="badge ${p.status === 'paid' ? 'badge-active' : 'badge-pending'}">${p.status === 'paid' ? '✅ Betald' : '⏳ ' + p.status}</span>
          </div>
        `).join('')}
      </div>
    ` : tier!=='free' ? '<p style="color:var(--text-muted);margin-top:2rem">Inga betalningar än</p>' : ''}
  `;
}

async function startStripeCheckout(plan) {
  const btn = document.querySelector('.pricing-card .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Skickar till Stripe...'; }

  try {
    const data = await api('/stripe/create-checkout', {
      method: 'POST', body: JSON.stringify({ plan: plan || 'pro' })
    });

    if (data.alreadyActive) {
      showToast('Din prenumeration är redan aktiv!', 'info');
      await loadDashboardData();
      return;
    }

    if (data.url) {
      window.location.href = data.url;
    } else {
      showToast('Kunde inte skapa betalningslänk. Försök igen.', 'error');
    }
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = plan==='team' ? '💳 Uppgradera till Team 299 kr/mån' : '💳 Uppgradera till Pro 99 kr/mån'; }
  }
}

function renderPaymentRedirect() {
  document.getElementById('page-payment').innerHTML = `
    <div class="payment-status-page">
      <div class="payment-status-icon">⏳</div>
      <h1>Verifierar betalning...</h1>
      <p class="subtitle">Vi kontrollerar din betalning. Det tar bara några sekunder.</p>
      <div class="loading"><div class="spinner"></div></div>
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
        <div class="payment-status-page">
          <div class="payment-status-icon">✅</div>
          <h1>Betalning mottagen!</h1>
          <p class="subtitle">Din prenumeration är aktiverad. Dina briefs börjar komma direkt.</p>
          <a href="#dashboard" class="btn btn-primary" style="margin-top:1.5rem" onclick="navigate('dashboard',event)">📊 Gå till översikt</a>
        </div>
      `;
      showToast('Prenumerationen är aktiv! 🎉', 'success');
      await loadDashboardData();
    } else {
      document.getElementById('page-payment').innerHTML = `
        <div class="payment-status-page">
          <div class="payment-status-icon">⏳</div>
          <h1>Betalningen väntar fortfarande</h1>
          <p class="subtitle">Om du nyss betalat, ladda om sidan eller kontakta support@briefbot.se</p>
          <a href="#pricing" class="btn btn-primary" style="margin-top:1.5rem" onclick="navigate('pricing',event)">Tillbaka till priser</a>
        </div>
      `;
      setTimeout(() => handlePaymentReturn(sessionId), 3000);
    }
  } catch (err) {
    document.getElementById('page-payment').innerHTML = `
      <div class="payment-status-page">
        <div class="payment-status-icon">❌</div>
        <h1>Kunde inte verifiera betalning</h1>
        <p class="subtitle">${esc(err.message)}</p>
        <a href="#pricing" class="btn btn-primary" style="margin-top:1.5rem" onclick="navigate('pricing',event)">Försök igen</a>
      </div>
    `;
  }
}

// ====== Profile ======
function renderProfile() {
  const u = state.user || {};
  document.getElementById('page-profile').innerHTML = `
    <div class="profile-section">
      <div class="page-header">
        <div>
          <h1>Profil</h1>
          <p class="subtitle" style="margin-bottom:0">Dina uppgifter och inställningar</p>
        </div>
      </div>

      <div class="profile-cards">
        <div class="card">
          <h3 class="card-title">👤 Personuppgifter</h3>
          <div class="profile-info">
            <div class="info-row"><span class="info-label">Namn</span><span>${esc(u.name || '—')}</span></div>
            <div class="info-row"><span class="info-label">E-post</span><span>${esc(u.email)}</span></div>
            <div class="info-row"><span class="info-label">Telefon</span><span>${esc(u.phone || '—')}</span></div>
            <div class="info-row"><span class="info-label">Status</span><span class="badge ${u.subscription_status === 'active' ? 'badge-active' : 'badge-inactive'}">${u.subscription_status === 'active' ? 'Aktiv' : 'Inaktiv'}</span></div>
            <div class="info-row"><span class="info-label">Företag</span><span>${esc(state.company_name || '—')}</span></div>
            ${state.company_industry ? `<div class="info-row"><span class="info-label">Bransch</span><span>${esc(state.company_industry)}</span></div>` : ''}
            ${state.competitors ? `<div class="info-row"><span class="info-label">Konkurrenter</span><span>${esc(state.competitors)}</span></div>` : ''}
            ${state.focus_areas ? `<div class="info-row"><span class="info-label">Fokus</span><span>${esc(state.focus_areas)}</span></div>` : ''}
            <div class="info-row"><span class="info-label">Medlem sedan</span><span>${u.created_at?.slice(0,10) || '—'}</span></div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">✏️ Uppdatera uppgifter</h3>
          <form onsubmit="updateProfile(event)">
            <div class="form-group">
              <label>Namn</label>
              <input type="text" id="profile-name" class="form-input" value="${esc(u.name || '')}" placeholder="Ditt namn">
            </div>
            <div class="form-group">
              <label>Telefon</label>
              <input type="tel" id="profile-phone" class="form-input" value="${esc(u.phone || '')}" placeholder="0701234567">
            </div>
            <hr style="margin:1rem 0;border:none;border-top:1px solid var(--border)">
            <h4 style="margin:0 0 0.8rem 0;font-size:0.95rem;color:var(--text)">🏢 Företagsprofil</h4>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1rem">
              Beskriv ditt företag så blir briefsen personligt anpassade till just er verksamhet. Informationen används i AI-analysen.
            </p>
            <div class="form-group">
              <label>Företagsnamn (används i nyhetsbrev)</label>
              <input type="text" id="profile-company" class="form-input" value="${esc(state.company_name || '')}" placeholder="Ditt företag AB">
            </div>
            <div class="form-group">
              <label>Bransch</label>
              <input type="text" id="profile-industry" class="form-input" value="${esc(state.company_industry || '')}" placeholder="t.ex. OVK-besiktning, byggkonsult, IT">
            </div>
            <div class="form-group">
              <label>Beskrivning (vad gör företaget?)</label>
              <textarea id="profile-description" class="form-input" rows="3" placeholder="Kort beskrivning av verksamheten, era kunder och vad ni är bäst på..." style="resize:vertical;font-family:inherit">${esc(state.company_description || '')}</textarea>
            </div>
            <div class="form-group">
              <label>Egna konkurrenter (kommaseparerade)</label>
              <input type="text" id="profile-competitors" class="form-input" value="${esc(state.competitors || '')}" placeholder="t.ex. Företag A, Företag B, Företag C">
            </div>
            <div class="form-group">
              <label>Fokusområden (kommaseparerade — vad vill du bevaka extra?)</label>
              <input type="text" id="profile-focusareas" class="form-input" value="${esc(state.focus_areas || '')}" placeholder="t.ex. prisförändringar, regelverk, tekniknyheter, marknadstrender">
            </div>
            <button type="submit" class="btn btn-primary">💾 Spara företagsprofil</button>
          </form>
        </div>

        <div class="card">
          <h3 class="card-title">🔔 Leveransinställningar</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">
            Bestäm hur och när BriefBot skickar dina briefs automatiskt. Kostnadsfritt — endast Slack (kräver webhook) och dashboard.
          </p>
          <form id="delivery-form" onsubmit="saveDeliverySettings(event)">
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
              <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
                <input type="checkbox" id="deliv-daily" ${state.daily_email ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)">
                <span style="color:var(--text);font-size:0.9rem">Skicka briefs automatiskt</span>
              </label>
            </div>
            <div class="form-group" id="deliv-time-group" style="${state.daily_email ? '' : 'opacity:0.4;pointer-events:none'}">
              <label>Tid för daglig leverans</label>
              <select id="deliv-time" class="form-input" style="max-width:200px">
                ${['06:00','07:00','08:00','09:00','10:00','12:00','16:00','18:00'].map(t =>
                  `<option value="${t}" ${state.brief_time===t?'selected':''}>${t}</option>`
                ).join('')}
              </select>
            </div>
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
              <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
                <input type="checkbox" id="deliv-slack" ${state.deliv_slack ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)">
                <span style="color:var(--text);font-size:0.9rem">Leverera till Slack (om kopplad)</span>
              </label>
            </div>
            <div class="form-group">
              <label>Slack Webhook URL</label>
              <input type="url" id="slack-webhook" class="form-input" value="${esc(state.slack_webhook_url || '')}" placeholder="https://hooks.slack.com/services/...">
              <div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">
                <a href="https://api.slack.com/apps" target="_blank" rel="noopener" style="color:var(--primary)">Skapa en Slack Webhook →</a>
              </div>
            </div>
            <button type="submit" class="btn btn-primary">💾 Spara leveransinställningar</button>
          </form>
        </div>
      </div>
    </div>
  `;
  // Toggla tidväljare när checkbox ändras
  document.getElementById('deliv-daily')?.addEventListener('change', function(){
    const grp = document.getElementById('deliv-time-group');
    if(grp) grp.style.opacity = this.checked ? '1' : '0.4';
    if(grp) grp.style.pointerEvents = this.checked ? 'auto' : 'none';
  });
}

async function updateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value;
  const phone = document.getElementById('profile-phone').value;
  const company = document.getElementById('profile-company')?.value || '';
  const industry = document.getElementById('profile-industry')?.value || '';
  const description = document.getElementById('profile-description')?.value || '';
  const competitors = document.getElementById('profile-competitors')?.value || '';
  const focusAreas = document.getElementById('profile-focusareas')?.value || '';

  try {
    await api('/me', {
      method: 'PUT', body: JSON.stringify({ name, phone })
    });
    // Spara företagsprofil via settings
    await api('/settings', {
      method: 'PUT', body: JSON.stringify({
        company_name: company,
        company_industry: industry,
        company_description: description,
        competitors: competitors,
        focus_areas: focusAreas
      })
    });
    showToast('Profil och företagsuppgifter sparade!', 'success');
    await loadDashboardData();
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
  }
}

async function saveDeliverySettings(e) {
  if(e)e.preventDefault();
  const slackUrl = document.getElementById('slack-webhook')?.value || '';
  const dailyEmail = document.getElementById('deliv-daily')?.checked || false;
  const briefTime = document.getElementById('deliv-time')?.value || '08:00';
  const delivSlack = document.getElementById('deliv-slack')?.checked !== false;
  try {
    await api('/settings', { method: 'PUT', body: JSON.stringify({
      slack_webhook_url: slackUrl, daily_email: dailyEmail,
      brief_time: briefTime, deliv_slack: delivSlack
    })});
    state.slack_webhook_url = slackUrl;
    state.daily_email = dailyEmail;
    state.brief_time = briefTime;
    state.deliv_slack = delivSlack;
    showToast('Leveransinställningar sparade!', 'success');
  } catch (err) {
    showToast('Fel: ' + err.message, 'error');
  }
}

// ====== FAQ ======
function renderFAQ(loggedIn) {
  const pageId = loggedIn ? 'page-faq' : 'page-faq-out';
  const page = document.getElementById(pageId);
  if (!page) return;

  const faqs = [
    { q: 'Vad är BriefBot?', a: 'BriefBot är en AI-driven tjänst som automatiskt bevakar konkurrenter, branschtrender och marknadsnyheter. Du får dagliga briefs med sammanfattningar och analyser — helt automatiskt.' },
    { q: 'Hur fungerar det?', a: 'Du skapar ett konto, lägger till ämnen du vill bevaka (t.ex. "Svensk dagligvaruhandel" eller "Ica"), och BriefBot söker webben med Google Search för att skapa en konkurrentanalys på svenska. Briefsen levereras i dashboarden och kan delas via Slack.' },
    { q: 'Vad kostar det?', a: 'BriefBot kostar 99 kr/månad för upp till 5 ämnen. För team och agency finns planer på 299 kr/mån respektive 999 kr/mån. Du får 14 dagars gratis provperiod — inget kontokort krävs.' },
    { q: 'Kan jag prova gratis?', a: 'Ja! Alla nya konton får 14 dagars gratis provperiod med full åtkomst. Ingen bindningstid — du kan säga upp när som helst.' },
    { q: 'Vilka betalsätt accepterar ni?', a: 'Betalningar hanteras av Stripe. Du kan betala med kort, Swish och Apple Pay. All betalning är krypterad och säker.' },
    { q: 'Hur säger jag upp?', a: 'Du kan säga upp din prenumeration när som helst. Kontakta oss på support@briefbot.se så hjälper vi dig. Ingen bindningstid.' },
    { q: 'Kan jag dela briefs med kollegor?', a: 'Ja! Varje brief har en "Dela"-knapp som skapar en publik länk. Du kan skicka länken till kollegor, kunder eller partners — de behöver inget konto för att läsa.' },
    { q: 'Hur kopplar jag Slack?', a: 'Gå till Profil → Slack-integration. Skapa en webhook i Slack (api.slack.com/apps → Incoming Webhooks) och klistra in URL:en. När du genererar briefs levereras de automatiskt till din Slack-kanal.' },
    { q: 'Vad är skillnaden mot Retriever/Meltwater?', a: 'BriefBot är mycket enklare och billigare. Retriever och Meltwater kostar 3.000–15.000 kr/mån och är designade för stora företag med heltidsanalytiker. BriefBot kostar 99 kr/mån och är byggd för små och medelstora företag som vill ha snabb, automatiserad konkurrentbevakning.' },
    { q: 'Hur hanterar ni min data?', a: 'Vi lagrar endast den information du anger (email, namn, ämnen). Ingen betaldata lagras hos oss — all betalning hanteras av Stripe. Dina briefs genereras med Gemini (Google) och vi sparar dem i vår databas så du kan läsa dem när du vill.' },
  ];

  page.innerHTML = `
    ${!loggedIn ? `
      <nav class="nav">
        <a href="#home" class="nav-logo" onclick="navigate('home',event)"><img src="/briefbot-logo.svg" alt="BriefBot" style="height:28px;vertical-align:middle"></a>
        <div class="nav-links">
          <a href="#login" onclick="navigate('login',event)">Logga in</a>
          <a href="#signup" onclick="navigate('signup',event)" class="btn btn-primary btn-sm">Kom igång</a>
        </div>
      </nav>
    ` : ''}
    <div class="faq-page">
      <h1>Vanliga frågor</h1>
      <p class="subtitle">Svar på de vanligaste frågorna om BriefBot</p>
      <div class="faq-list">
        ${faqs.map((f, i) => `
          <div class="faq-item">
            <button class="faq-question" onclick="toggleFAQ(this)">
              <span>${f.q}</span>
              <span class="faq-arrow">▼</span>
            </button>
            <div class="faq-answer" id="faq-answer-${i}">
              <p>${f.a}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="faq-contact">
        <p>Har du fler frågor? Kontakta oss på <a href="mailto:support@briefbot.se">support@briefbot.se</a></p>
      </div>
    </div>
  `;
}

function toggleFAQ(btn) {
  const answer = btn.nextElementSibling;
  const arrow = btn.querySelector('.faq-arrow');
  const isOpen = answer.classList.contains('faq-open');

  // Close all
  document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('faq-open'));
  document.querySelectorAll('.faq-arrow').forEach(a => a.textContent = '▼');

  if (!isOpen) {
    answer.classList.add('faq-open');
    arrow.textContent = '▲';
  }
}

// ====== CSS animations (injected once) ======
(function injectAnimations() {
  if (document.getElementById('bb-animations')) return;
  const style = document.createElement('style');
  style.id = 'bb-animations';
  style.textContent = `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }

    .toast { animation: slideDown 0.3s ease; }
    .page.active { animation: fadeIn 0.25s ease; }
    .modal { animation: slideUp 0.2s ease; }
    .faq-open { animation: fadeIn 0.2s ease; }
    .cookie-visible { animation: slideUp 0.3s ease; }
  `;
  document.head.appendChild(style);
})();

// ====== Helpers ======
function esc(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ====== Init ======
// Check for Google OAuth redirect on initial page load (hashchange doesn't fire on fresh load)
(function init() {
  const hashParams = getHashParams();
  const page = getPage();
  if (page === 'login' && hashParams.token) {
    // Google OAuth redirect
    state.token = hashParams.token;
    localStorage.setItem('bb_token', hashParams.token);
    state.user = { name: hashParams.name || '', email: hashParams.email || '' };
    navigate('dashboard');
    loadDashboardData();
    showToast('Inloggad med Google! 🎉', 'success');
  } else {
    render();
    if (state.token) {
      loadDashboardData();
    }
  }
})();
