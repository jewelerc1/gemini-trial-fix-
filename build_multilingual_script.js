
// ==================== ENTITLEMENT & LICENSE SYSTEM ====================
let entitlementState = 'FREE_TRIAL'; // 'FREE_TRIAL', 'PAID', 'OWNER', 'LOCKED'
let trialTurnsUsed = 0;
let trialMaxTurns = 20;
let trialRemainingTurns = 20;
let trialIntensityCap = 'touch';

function initEntitlement() {
  if (window.AndroidLicense && typeof window.AndroidLicense.getEntitlementInfo === 'function') {
    try {
      const info = JSON.parse(window.AndroidLicense.getEntitlementInfo());
      updateEntitlementFromInfo(info);
    } catch(e) {
      console.error('Failed to parse entitlement info', e);
    }
  } else {
    // Check localStorage fallback for browser
    try {
      const savedEnt = localStorage.getItem('allOrNothingEntitlement');
      if (savedEnt) {
        const info = JSON.parse(savedEnt);
        updateEntitlementFromInfo(info);
      }
    } catch(e){}
  }
}

function updateEntitlementFromInfo(info) {
  if (!info) return;
  entitlementState = info.state || 'FREE_TRIAL';
  trialTurnsUsed = Number.isInteger(info.turns_used) ? info.turns_used : 0;
  trialMaxTurns = Number.isInteger(info.max_turns) ? info.max_turns : 20;
  trialRemainingTurns = Number.isInteger(info.remaining_turns) ? info.remaining_turns : Math.max(0, trialMaxTurns - trialTurnsUsed);
  trialIntensityCap = info.intensity_cap || 'touch';

  updateLicenseBadge();

  if (entitlementState === 'LOCKED') {
    const gameScreen = document.getElementById('screenGame');
    if (gameScreen && !gameScreen.classList.contains('hidden')) {
      showPaywallModal();
    }
  }
}

function updateLicenseBadge() {
  const btns = document.querySelectorAll('.license-status-badge');
  btns.forEach(b => {
    if (entitlementState === 'PAID' || entitlementState === 'OWNER') {
      b.textContent = t('status_paid');
      b.style.borderColor = 'rgba(74, 222, 128, 0.5)';
      b.style.color = '#4ade80';
    } else {
      b.textContent = t('status_trial', { n: trialRemainingTurns });
      b.style.borderColor = 'rgba(255, 170, 0, 0.5)';
      b.style.color = '#ffa500';
    }
  });
}

function onLicenseStatusClick() {
  if (entitlementState === 'PAID' || entitlementState === 'OWNER') {
    showInfo(t('status_paid'), t('license_success'));
  } else {
    showPaywallModal();
  }
}

window.onEntitlementUpdated = function(info) {
  updateEntitlementFromInfo(info);
};

window.onLicenseActivationResult = function(success, errorCode, newState) {
  if (success) {
    entitlementState = newState || 'PAID';
    try {
      localStorage.setItem('allOrNothingEntitlement', JSON.stringify({ state: entitlementState }));
    } catch(e){}
    updateLicenseBadge();
    showActivationSuccessModal();
  } else {
    showActivationErrorModal(errorCode);
  }
};

window.onTrialTurnCommitted = function(allowed, showPaywall, remaining) {
  trialRemainingTurns = remaining;
  updateLicenseBadge();
  if (showPaywall || !allowed || remaining <= 0) {
    entitlementState = 'LOCKED';
    showPaywallModal();
  }
};

function showPaywallModal() {
  const html = `<h3>${esc(t('paywall_title'))}</h3><p>${esc(t('paywall_body'))}</p><div class="choices" style="flex-direction:column;gap:8px;width:100%;margin-top:8px;"><button class="primary" style="width:100%;min-height:44px;" onclick="openPurchasePage()">${esc(t('paywall_unlock_btn'))}</button><button class="secondary" style="width:100%;min-height:40px;" onclick="showLicenseInputModal()">${esc(t('paywall_activate'))}</button></div>`;
  modal(html);
}

function openPurchasePage() {
  if (window.AndroidLicense && typeof window.AndroidLicense.openPurchasePage === 'function') {
    window.AndroidLicense.openPurchasePage();
  } else {
    window.open('https://all-or-nothing.co.il/buy', '_blank');
  }
}

function showLicenseInputModal() {
  const html = `<h3>${esc(t('paywall_activate'))}</h3><p style="font-size:12px;margin-bottom:6px;">${esc(t('license_placeholder'))}</p><div style="width:100%;display:flex;gap:6px;margin:4px 0;"><input type="text" id="licenseCodeInput" placeholder="${esc(t('license_placeholder'))}" style="flex:1;padding:8px;border-radius:8px;border:1px solid #ff4b9a;background:#1a0f1e;color:#fff;font-size:14px;text-align:center;text-transform:uppercase;"></div><div id="activationErrorMsg" style="color:#ff6b6b;font-size:12px;display:none;margin:4px 0;"></div><div class="choices" style="margin-top:6px;width:100%;"><button class="primary" id="btnSubmitActivation" onclick="submitLicenseActivation()">${esc(t('btn_activate'))}</button><button class="secondary" onclick="closeModal()">${esc(t('btn_back'))}</button></div>`;
  modal(html);
}

function submitLicenseActivation() {
  const input = document.getElementById('licenseCodeInput');
  if (!input) return;
  const code = (input.value || '').trim();
  if (!code) {
    const errEl = document.getElementById('activationErrorMsg');
    if (errEl) { errEl.textContent = t('invalid_license'); errEl.style.display = 'block'; }
    return;
  }
  const btn = document.getElementById('btnSubmitActivation');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  if (window.AndroidLicense && typeof window.AndroidLicense.activateLicense === 'function') {
    window.AndroidLicense.activateLicense(code);
  } else {
    setTimeout(() => {
      window.onLicenseActivationResult(true, 'SUCCESS', 'PAID');
    }, 400);
  }
}

function showActivationSuccessModal() {
  const html = `<h3 style="color:#4ade80;">👑 ${esc(t('app_title'))}</h3><p>${esc(t('license_success'))}</p><button class="primary" onclick="closeModal();updateUI();">${esc(t('continue'))}</button>`;
  modal(html);
}

function showActivationErrorModal(code) {
  let msg = t('error_' + String(code).toLowerCase());
  if (!msg || msg === 'error_' + String(code).toLowerCase()) {
    if (code === 'DEVICE_LIMIT') msg = t('device_limit');
    else if (code === 'LICENSE_EXPIRED') msg = t('license_expired');
    else if (code === 'LICENSE_NOT_ACTIVE') msg = t('license_not_active');
    else msg = t('invalid_license');
  }
  const html = `<h3 style="color:#ff6b6b;">⚠️ ${esc(t('paywall_activate'))}</h3><p>${esc(msg)}</p><div class="choices"><button class="primary" onclick="showLicenseInputModal()">${esc(t('btn_back'))}</button><button class="secondary" onclick="closeModal()">${esc(t('continue'))}</button></div>`;
  modal(html);
}
// ==================== END ENTITLEMENT SYSTEM ====================

(function(){
  const ua=navigator.userAgent||'';
  if(/;\s*wv\)/i.test(ua)||(/Android/i.test(ua)&&/Version\/4\.0/i.test(ua))) document.documentElement.classList.add('android-webview');
})();

const COLORS=['#ff3b3b','#3b8cff','#39d36d','#b650ff','#ff9f1a','#20c7c9','#ff5fa2','#d5c64d'];
const DICE=['⚀','⚁','⚂','⚃','⚄','⚅'];

const WHEEL_CATS=[
  {k:'pair',tKey:'pair',i:'❤️'},
  {k:'bold',tKey:'bold_task',i:'💋'},
  {k:'truthdare',tKey:'truth_or_dare',i:'🎭'},
  {k:'replace',tKey:'swap',i:'🔄'},
  {k:'luck',tKey:'luck',i:'🍀'},
  {k:'choose',tKey:'choose_player',i:'👥'},
  {k:'aon',tKey:'app_title',i:'👑'},
  {k:'pair',tKey:'pair',i:'❤️'},
  {k:'bold',tKey:'bold_task',i:'💋'},
  {k:'truthdare',tKey:'truth_or_dare',i:'🎭'},
  {k:'replace',tKey:'swap',i:'🔄'},
  {k:'luck',tKey:'luck',i:'🍀'},
  {k:'choose',tKey:'choose_player',i:'👥'},
  {k:'aon',tKey:'app_title',i:'👑'}
];

const STORAGE_KEY = 'allOrNothingGameStateV1';
let currentModalHtml = null;
let hasRestoredState = false;
let currentLang = 'he'; // 'he', 'en', 'ru'
let gameMode='straight', players=[],current=0,busy=false,extraTurn=false,wheelRotation=0,chainDepth=0,pendingChoiceAction=null,completedTurns=0,taskReplacementFor={};

// Lookup maps for cards
const ALL_CARDS_MAP = {};
const NOTHING_CARDS_MAP = {};
const BOLD_CARDS_MAP = {};
const PAIR_CARDS_MAP = {};
const LUCK_EVENTS_MAP = {};

function initLanguagePack() {
  const pack = window.ALL_OR_NOTHING_LANG_PACK;
  if (!pack) return;
  if (Array.isArray(pack.all_cards)) {
    pack.all_cards.forEach(c => { ALL_CARDS_MAP[c.id] = c; });
  }
  if (Array.isArray(pack.nothing_cards)) {
    pack.nothing_cards.forEach(c => { NOTHING_CARDS_MAP[c.id] = c; });
  }
  if (Array.isArray(pack.bold_cards)) {
    pack.bold_cards.forEach(c => { BOLD_CARDS_MAP[c.id] = c; });
  }
  if (Array.isArray(pack.pair_cards)) {
    pack.pair_cards.forEach(c => { PAIR_CARDS_MAP[c.id] = c; });
  }
  if (pack.luck_events) {
    Object.assign(LUCK_EVENTS_MAP, pack.luck_events);
  }
}

function t(key, params = {}) {
  const pack = window.ALL_OR_NOTHING_LANG_PACK;
  let text = '';
  if (pack && pack.ui && pack.ui[key]) {
    text = pack.ui[key][currentLang] || pack.ui[key].he || key;
  } else if (pack && pack.system_strings && pack.system_strings[key]) {
    text = pack.system_strings[key][currentLang] || pack.system_strings[key].he || key;
  } else if (pack && pack.luck_events && pack.luck_events[key]) {
    const ev = pack.luck_events[key];
    const item = ev[currentLang] || ev.he;
    text = (typeof item === 'object') ? (item.title + ' — ' + item.body) : String(item);
  } else {
    const custom = {
      'badge_adult': { he: '18+ · משחק למבוגרים בלבד', en: '18+ · Adults Only Game', ru: '18+ · Только для взрослых' },
      'start_tagline': { he: 'משחק שולחן דיגיטלי · אין מנצחים — המטרה היא הכיף', en: 'Digital Board Game · No winners — The goal is fun', ru: 'Цифровая настольная игра · Без победителей — Главное веселье' },
      'btn_start_game': { he: 'התחל משחק', en: 'Start Game', ru: 'Начать игру' },
      'game_setup_title': { he: 'הגדרת משחק', en: 'Game Setup', ru: 'Настройка игры' },
      'game_setup_note': { he: 'בחר סוג משחק והזן רק את המשתתפים שמשחקים בפועל. שורות ריקות לא נכנסות למשחק.', en: 'Choose game mode and enter only players actually playing. Blank rows are ignored.', ru: 'Выберите тип игры и укажите только реальных участников. Пустые строки не учитываются.' },
      'add_player': { he: '+ הוסף משתתף', en: '+ Add Player', ru: '+ Добавить игрока' },
      'male': { he: 'גבר', en: 'Male', ru: 'Мужчина' },
      'female': { he: 'אישה', en: 'Female', ru: 'Женщина' },
      'copyright': { he: '© 2026 רועי ג׳רי חן · כל הזכויות שמורות', en: '© 2026 Roy Jerry Chen · All rights reserved', ru: '© 2026 Рой Джерри Чен · Все права защищены' },
      'player_chip_meta': { he: 'מיקום {pos} · 🛡 {immunity}', en: 'Pos {pos} · 🛡 {immunity}', ru: 'Клетка {pos} · 🛡 {immunity}' },
      'next_turn_badge': { he: ' · ⛔ תור הבא', en: ' · ⛔ Next turn', ru: ' · ⛔ Спуск хода' },

      'paywall_title': { he: 'פתיחת המשחק המלא — 49.90 ₪', en: 'Unlock Full Game — ₪49.90', ru: 'Открыть полную версию — 49,90 ₪' },
      'paywall_body': { he: 'גרסת הניסיון הסתיימה. ניתן לפתוח את הגרסה המלאה ברכישה חד־פעמית.', en: 'The trial version has ended. Unlock the full game with a one-time purchase.', ru: 'Пробная версия завершена. Вы можете разблокировать полную версию разовой покупкой.' },
      'paywall_activate': { he: 'כבר רכשתי / הפעל רישיון', en: 'Already purchased / Activate license', ru: 'Уже купили / Активировать лицензию' },
      'paywall_unlock_btn': { he: 'פתיחת המשחק המלא — 49.90 ₪', en: 'Unlock Full Game — ₪49.90', ru: 'Открыть полную версию — 49,90 ₪' },
      'license_placeholder': { he: 'הזן קוד רישיון...', en: 'Enter license code...', ru: 'Введите код лицензии...' },
      'btn_activate': { he: 'הפעל', en: 'Activate', ru: 'Активировать' },
      'btn_back': { he: 'חזור', en: 'Back', ru: 'Назад' },
      'license_success': { he: 'הרישיון הופעל בהצלחה! המשחק המלא פתוח ללא הגבלה.', en: 'License activated successfully! Full game is now unlocked.', ru: 'Лицензия успешно активирована! Полная версия игры разблокирована.' },
      'status_trial': { he: 'ניסיון: נותרו {n} תורות', en: 'Trial: {n} turns left', ru: 'Пробный: {n} ходов' },
      'status_paid': { he: 'משחק מלא 👑', en: 'Full Game 👑', ru: 'Полная игра 👑' },
      'invalid_license': { he: 'קוד רישיון לא תקין', en: 'Invalid license code', ru: 'Неверный код лицензии' },
      'license_not_active': { he: 'הרישיון אינו פעיל', en: 'License is not active', ru: 'Лицензия не активна' },
      'license_expired': { he: 'הרישיון פג תוקף', en: 'License expired', ru: 'Срок действия лицензии истек' },
      'device_limit': { he: 'הגעת למגבלת המכשירים עבור רישיון זה (עד 2 מכשירים)', en: 'Device limit reached for this license (max 2 devices)', ru: 'Достигнут лимит устройств для этой лицензии (макс. 2)' },
      
      'wild_card_choose': { he: 'בחר סוג פעולה: כלום, נועז או זוג', en: 'Choose an action: Nothing, Bold or Pair', ru: 'Выберите действие: Ничего, Смелое или Пара' },
      'spin_again': { he: 'סובב שוב', en: 'Spin Again', ru: 'Крутить снова' },
      'player_loses_next': { he: '{player} מפסיד/ה את התור הבא', en: '{player} loses their next turn', ru: '{player} пропускает следующий ход' },
      'immunity_given': { he: '{player} קיבל/ה חסינות ממך', en: '{player} received immunity from you', ru: '{player} получил(а) иммунитет от вас' },
      'player_moved_back': { he: '{player} חזר/ה {n} משבצות', en: '{player} moved back {n} spaces', ru: '{player} перемещен(а) назад на {n}' },
      'player_moved_forward': { he: '{player} התקדם/ה {n} משבצות', en: '{player} moved forward {n} spaces', ru: '{player} продвинут(а) вперед на {n}' },

      'error_server_error': { he: 'שגיאת שרת או בעיית חיבור. נסה שוב מאוחר יותר.', en: 'Server error or connection issue. Try again later.', ru: 'Ошибка сервера или соединения. Попробуйте позже.' },

    };
    if (custom[key]) {
      text = custom[key][currentLang] || custom[key].he || key;
    } else {
      text = key;
    }
  }

  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
  }
  return text;
}

function setLanguage(lang) {
  if (lang !== 'he' && lang !== 'en' && lang !== 'ru') lang = 'he';
  currentLang = lang;

  if (currentLang === 'he') {
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    document.body.dir = 'rtl';
  } else {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = 'ltr';
    document.body.dir = 'ltr';
  }

  document.querySelectorAll('.lang-selector .seg').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  });
  const activeBtn = document.getElementById('lang' + (currentLang.charAt(0).toUpperCase() + currentLang.slice(1)));
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-pressed', 'true');
  }

  applyTranslations();

  if (window.AndroidTTS && typeof window.AndroidTTS.setLanguage === 'function') {
    window.AndroidTTS.setLanguage(currentLang);
  }

  const gameScreen = document.getElementById('screenGame');
  if (gameScreen && !gameScreen.classList.contains('hidden')) {
    buildBoard();
    buildWheelVisual();
    updateUI();
  }

  saveGameState();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = t(key);
  });
  const vb = document.getElementById('voiceBtn');
  if (vb) {
    vb.textContent = voiceEnabled ? ('🔊 ' + t('voice_is_active')) : ('🔇 ' + t('voice_disabled'));
  }
  const rb = document.getElementById('rollBtn');
  if (rb) {
    rb.textContent = '🎲 ' + t('roll_dice');
  }
  const eff = document.getElementById('effectStatus');
  if (eff && !eff.classList.contains('landed')) {
    eff.textContent = t('ready_to_roll');
  }
  renderEditors();
}

function getCardText(deckKey, cardId) {
  let map = ALL_CARDS_MAP;
  if (deckKey === 'nothing') map = NOTHING_CARDS_MAP;
  else if (deckKey === 'bold') map = BOLD_CARDS_MAP;
  else if (deckKey === 'pair') map = PAIR_CARDS_MAP;

  const card = map[cardId];
  if (!card) return cardId;
  return card[currentLang] || card.he || cardId;
}

// 150 Nothing card IDs
const ALL_150_NOTHING_IDS = Array.from({ length: 150 }, (_, i) => 'nothing_' + String(i + 1).padStart(3, '0'));

// 150 Bold card IDs
const ALL_150_BOLD_IDS = Array.from({ length: 150 }, (_, i) => 'bold_' + String(i + 1).padStart(3, '0'));

// 130 Pair card IDs
const ALL_130_PAIR_IDS = Array.from({ length: 130 }, (_, i) => 'pair_' + String(i + 1).padStart(3, '0'));

function getAllTierCardIds(level) {
  if (level === 1) return Array.from({ length: 40 }, (_, i) => 'all_' + String(i + 1).padStart(3, '0'));
  if (level === 2) return Array.from({ length: 40 }, (_, i) => 'all_' + String(i + 41).padStart(3, '0'));
  if (level === 3) return Array.from({ length: 50 }, (_, i) => 'all_' + String(i + 81).padStart(3, '0'));
  if (level >= 4) return Array.from({ length: 20 }, (_, i) => 'all_' + String(i + 131).padStart(3, '0'));
  return [];
}

function getAllUnlockedCardIdsForLevel(level) {
  const ids = [];
  for (let l = 1; l <= Math.min(level, 4); l++) {
    ids.push(...getAllTierCardIds(l));
  }
  return ids;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initPlayerDecks() {
  return {
    nothing: {
      bag: shuffleArray([...ALL_150_NOTHING_IDS]),
      used: []
    },
    all: {
      bag: shuffleArray([...getAllTierCardIds(1)]),
      used: [],
      heatLevel: 1
    }
  };
}

function drawPlayerNothingCard(playerIndex = current) {
  const p = players[playerIndex];
  if (!p) return null;
  if (!p.decks || !p.decks.nothing) {
    p.decks = p.decks || {};
    p.decks.nothing = {
      bag: shuffleArray([...ALL_150_NOTHING_IDS]),
      used: []
    };
  }
  const deck = p.decks.nothing;
  if (!Array.isArray(deck.bag) || deck.bag.length === 0) {
    deck.bag = shuffleArray([...ALL_150_NOTHING_IDS]);
    deck.used = [];
  }
  const cardId = deck.bag.pop();
  if (!Array.isArray(deck.used)) deck.used = [];
  deck.used.push(cardId);
  saveGameState();
  return cardId;
}

function drawPlayerAllCard(playerIndex = current) {
  const p = players[playerIndex];
  if (!p) return null;
  if (!p.decks || !p.decks.all) {
    p.decks = p.decks || {};
    p.decks.all = {
      bag: shuffleArray([...getAllTierCardIds(1)]),
      used: [],
      heatLevel: 1
    };
  }
  const deck = p.decks.all;
  const curHeat = currentHeatLevel();
  const prevHeat = deck.heatLevel || 1;

  if (curHeat > prevHeat) {
    const usedSet = new Set(Array.isArray(deck.used) ? deck.used : []);
    const newlyUnlocked = [];
    for (let l = prevHeat + 1; l <= curHeat; l++) {
      const tier = getAllTierCardIds(l);
      for (const id of tier) {
        if (!usedSet.has(id)) {
          newlyUnlocked.push(id);
        }
      }
    }
    deck.heatLevel = curHeat;
    const currentUnused = Array.isArray(deck.bag) ? deck.bag.filter(x => !usedSet.has(x)) : [];
    deck.bag = shuffleArray(Array.from(new Set([...currentUnused, ...newlyUnlocked])));
  }

  if (!Array.isArray(deck.bag) || deck.bag.length === 0) {
    const allUnlocked = getAllUnlockedCardIdsForLevel(curHeat);
    const usedSet = new Set(Array.isArray(deck.used) ? deck.used : []);
    const unused = allUnlocked.filter(x => !usedSet.has(x));
    if (unused.length > 0) {
      deck.bag = shuffleArray(unused);
    } else {
      deck.bag = shuffleArray(allUnlocked);
      deck.used = [];
    }
  }

  if (deck.bag.length === 0) return null;
  const cardId = deck.bag.pop();
  if (!Array.isArray(deck.used)) deck.used = [];
  deck.used.push(cardId);
  saveGameState();
  return cardId;
}

// Global decks for pair and bold
const DECK_CONFIG = {
  nothing: {
    progressive: false,
    getAll: () => ALL_150_NOTHING_IDS
  },
  all: {
    progressive: true,
    getTier: (lvl) => getAllTierCardIds(lvl)
  },
  bold: {
    progressive: true,
    getTier: (lvl) => {
      if (lvl === 1) return ALL_150_BOLD_IDS.slice(0, 40);
      if (lvl === 2) return ALL_150_BOLD_IDS.slice(40, 80);
      if (lvl === 3) return ALL_150_BOLD_IDS.slice(80, 130);
      if (lvl >= 4) return ALL_150_BOLD_IDS.slice(130, 150);
      return [];
    }
  },
  pair: {
    progressive: true,
    getTier: (lvl) => {
      if (lvl === 1) return ALL_130_PAIR_IDS.slice(0, 30);
      if (lvl === 2) return ALL_130_PAIR_IDS.slice(30, 65);
      if (lvl === 3) return ALL_130_PAIR_IDS.slice(65, 105);
      if (lvl >= 4) return ALL_130_PAIR_IDS.slice(105, 130);
      return [];
    }
  }
};

const shuffledBags = {};
const deckHeatLevels = {};
const usedCardIndexes = {};

function initDeck(deckKey) {
  const cfg = DECK_CONFIG[deckKey];
  if (!cfg) return;
  if (!usedCardIndexes[deckKey]) usedCardIndexes[deckKey] = new Set();
  if (!cfg.progressive) {
    const all = cfg.getAll();
    shuffledBags[deckKey] = shuffleArray(all);
    usedCardIndexes[deckKey].clear();
  } else {
    const curLevel = currentHeatLevel();
    deckHeatLevels[deckKey] = curLevel;
    usedCardIndexes[deckKey].clear();
    let initialPool = [];
    for (let l = 1; l <= curLevel; l++) {
      initialPool.push(...cfg.getTier(l));
    }
    initialPool = Array.from(new Set(initialPool));
    shuffledBags[deckKey] = shuffleArray(initialPool);
  }
}

function resetCardHistory() {
  Object.keys(usedCardIndexes).forEach(k => delete usedCardIndexes[k]);
  Object.keys(shuffledBags).forEach(k => delete shuffledBags[k]);
  Object.keys(deckHeatLevels).forEach(k => delete deckHeatLevels[k]);
  if (typeof usedLuckEvents !== 'undefined') usedLuckEvents.clear();
  Object.keys(DECK_CONFIG).forEach(k => initDeck(k));
  if (Array.isArray(players)) {
    players.forEach(p => {
      p.decks = initPlayerDecks();
    });
  }
}

function drawUnique(deckKey, source, playerIndex = current) {
  if (deckKey === 'nothing') {
    return drawPlayerNothingCard(playerIndex);
  }
  if (deckKey === 'all') {
    return drawPlayerAllCard(playerIndex);
  }
  const cfg = DECK_CONFIG[deckKey];
  if (!cfg) {
    if (!usedCardIndexes[deckKey]) usedCardIndexes[deckKey] = new Set();
    const used = usedCardIndexes[deckKey];
    const available = (source || []).filter(c => typeof c === 'string' && c.trim() && !used.has(c));
    if (!available.length) return null;
    const card = available[Math.floor(Math.random() * available.length)];
    used.add(card);
    saveGameState();
    return card;
  }
  if (!usedCardIndexes[deckKey]) usedCardIndexes[deckKey] = new Set();
  if (!shuffledBags[deckKey]) initDeck(deckKey);
  if (cfg.progressive) {
    const curLevel = currentHeatLevel();
    const prevLevel = deckHeatLevels[deckKey] || 1;
    if (curLevel > prevLevel) {
      const used = usedCardIndexes[deckKey];
      const newlyUnlocked = [];
      for (let l = prevLevel + 1; l <= curLevel; l++) {
        const tierCards = cfg.getTier(l).filter(c => !used.has(c));
        newlyUnlocked.push(...tierCards);
      }
      deckHeatLevels[deckKey] = curLevel;
      const mergedRemaining = Array.from(new Set([...shuffledBags[deckKey], ...newlyUnlocked]));
      shuffledBags[deckKey] = shuffleArray(mergedRemaining);
    }
  }
  if (shuffledBags[deckKey].length === 0) {
    const curLevel = currentHeatLevel();
    let allUnlocked = [];
    for (let l = 1; l <= curLevel; l++) {
      allUnlocked.push(...cfg.getTier(l));
    }
    allUnlocked = Array.from(new Set(allUnlocked));
    const unused = allUnlocked.filter(c => !usedCardIndexes[deckKey].has(c));
    if (unused.length > 0) {
      shuffledBags[deckKey] = shuffleArray(unused);
    } else {
      shuffledBags[deckKey] = shuffleArray(allUnlocked);
      usedCardIndexes[deckKey].clear();
    }
  }
  if (shuffledBags[deckKey].length === 0) return null;
  const card = shuffledBags[deckKey].pop();
  usedCardIndexes[deckKey].add(card);
  saveGameState();
  return card;
}

function roundNumber() {
  return players.length ? Math.floor(completedTurns / players.length) + 1 : 1;
}

function currentHeatLevel() {
  const r = roundNumber();
  let lvl = 1;
  if (r <= 2) lvl = 1;
  else if (r <= 5) lvl = 2;
  else if (r <= 8) lvl = 3;
  else lvl = 4;

  // Structural entitlement: Trial intensity capped at TOUCH (level 2). BOLD and EXTREME never unlock in FREE_TRIAL!
  if (entitlementState === 'FREE_TRIAL') {
    return Math.min(lvl, 2);
  }
  return lvl;
}

function heatName(level = currentHeatLevel()) {
  const keys = ['', 'heat_warmup', 'heat_touch', 'heat_bold', 'heat_extreme'];
  return t(keys[level] || 'heat_warmup');
}

function boldHeatName(level = currentHeatLevel()) {
  return heatName(level);
}

function showTruthCard(title) {
  const displayTitle = title || t('truth');
  const cardId = drawPlayerNothingCard(current);
  if (cardId === null) {
    showInfo(displayTitle, t('no_questions'));
    return;
  }
  showCard(displayTitle, cardId, 'nothing', 'nothing', null);
}

function showDareCard(title) {
  const displayTitle = title || t('dare');
  const cardId = drawPlayerAllCard(current);
  if (cardId === null) {
    showInfo(displayTitle, t('no_tasks'));
    return;
  }
  showCard(displayTitle + ' · ' + heatName(), cardId, 'all', 'all', null);
}

function showHeatAllCard() {
  const cardId = drawPlayerAllCard(current);
  if (cardId === null) {
    showInfo(t('all'), t('no_tasks'));
    return;
  }
  showCard(t('all') + ' · ' + heatName(), cardId, 'all', 'all', null);
}

function showUniqueCard(title, deckKey, source, kind) {
  const card = drawUnique(deckKey, source, current);
  if (card === null) {
    showInfo(title, t('unique_cards_exhausted'));
    return;
  }
  showCard(title, card, kind, deckKey, source);
}

// Cold launch detection
function isGenuineColdLaunch() {
  if (window.location && window.location.search && window.location.search.includes('cold=1')) {
    return true;
  }
  if (window.AndroidTTS && typeof window.AndroidTTS.isColdLaunch === 'function') {
    if (window.AndroidTTS.isColdLaunch()) {
      return true;
    }
  }
  const hasActiveSession = !!(
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('allOrNothingSessionAlive') === '1') ||
    (window.history && window.history.state && window.history.state.allOrNothingSessionAlive)
  );
  if (!hasActiveSession) {
    return true;
  }
  return false;
}

function saveGameState() {
  try {
    const gameScreen = document.getElementById('screenGame');
    if (!gameScreen || gameScreen.classList.contains('hidden') || !players || players.length < 2) {
      return;
    }
    const cardHistorySerialized = {};
    for (const [k, v] of Object.entries(usedCardIndexes)) {
      if (v instanceof Set) {
        cardHistorySerialized[k] = Array.from(v);
      } else if (Array.isArray(v)) {
        cardHistorySerialized[k] = v;
      }
    }
    const state = {
      version: 3,
      savedAt: Date.now(),
      selectedLanguage: currentLang,
      gameMode: gameMode,
      players: players.map(p => ({
        name: p.name,
        gender: p.gender,
        color: p.color,
        pos: p.pos,
        immunity: p.immunity,
        loseNext: !!p.loseNext,
        decks: p.decks ? {
          nothing: {
            bag: Array.isArray(p.decks.nothing?.bag) ? [...p.decks.nothing.bag] : [],
            used: Array.isArray(p.decks.nothing?.used) ? [...p.decks.nothing.used] : []
          },
          all: {
            bag: Array.isArray(p.decks.all?.bag) ? [...p.decks.all.bag] : [],
            used: Array.isArray(p.decks.all?.used) ? [...p.decks.all.used] : [],
            heatLevel: p.decks.all?.heatLevel || 1
          }
        } : null
      })),
      current: current,
      completedTurns: completedTurns,
      extraTurn: !!extraTurn,
      wheelRotation: wheelRotation || 0,
      taskReplacementFor: Object.assign({}, taskReplacementFor),
      usedCardIndexes: cardHistorySerialized,
      shuffledBags: shuffledBags,
      deckHeatLevels: deckHeatLevels,
      usedLuckEvents: (typeof usedLuckEvents !== 'undefined') ? Array.from(usedLuckEvents) : [],
      pendingChoiceAction: pendingChoiceAction,
      currentCardDeckKey: currentCardDeckKey,
      currentCardSource: Array.isArray(currentCardSource) ? currentCardSource : null,
      currentCardTitle: currentCardTitle,
      currentCardKind: currentCardKind,
      modalHtml: currentModalHtml,
      voiceEnabled: !!voiceEnabled
    };

    const stateJson = JSON.stringify(state);
    try {
      sessionStorage.setItem('allOrNothingSessionAlive', '1');
      sessionStorage.setItem(STORAGE_KEY, stateJson);
    } catch(e){}
    try {
      localStorage.setItem(STORAGE_KEY, stateJson);
    } catch(e){}
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({ allOrNothingSessionAlive: true, gameState: state }, '');
      }
    } catch(e){}
  } catch(e) {
    console.error('saveGameState error:', e);
  }
}

function clearSavedGameState() {
  hasRestoredState = false;
  try {
    sessionStorage.removeItem('allOrNothingSessionAlive');
    sessionStorage.removeItem(STORAGE_KEY);
  } catch(e){}
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch(e){}
  try {
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '');
    }
  } catch(e){}
}

function restoreSavedGameState() {
  if (hasRestoredState) return true;
  try {
    if (isGenuineColdLaunch()) {
      clearSavedGameState();
      const startScreen = document.getElementById('screenStart');
      const setupScreen = document.getElementById('screenSetup');
      const gameScreen = document.getElementById('screenGame');
      if (startScreen) startScreen.classList.remove('hidden');
      if (setupScreen) setupScreen.classList.add('hidden');
      if (gameScreen) gameScreen.classList.add('hidden');
      document.body.classList.remove('game-active', 'modal-open');
      return false;
    }

    let raw = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch(e){}
    if (!raw) {
      try {
        raw = localStorage.getItem(STORAGE_KEY);
      } catch(e){}
    }
    if (!raw && window.history && window.history.state && window.history.state.gameState) {
      raw = JSON.stringify(window.history.state.gameState);
    }
    if (!raw) return false;

    const state = (typeof raw === 'string') ? JSON.parse(raw) : raw;
    if (!state || !Array.isArray(state.players) || state.players.length < 2) return false;

    hasRestoredState = true;
    if (state.selectedLanguage) {
      currentLang = state.selectedLanguage;
      if (currentLang === 'he') {
        document.documentElement.lang = 'he';
        document.documentElement.dir = 'rtl';
        document.body.dir = 'rtl';
      } else {
        document.documentElement.lang = currentLang;
        document.documentElement.dir = 'ltr';
        document.body.dir = 'ltr';
      }
      const activeBtn = document.getElementById('lang' + (currentLang.charAt(0).toUpperCase() + currentLang.slice(1)));
      if (activeBtn) {
        document.querySelectorAll('.lang-selector .seg').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-pressed', 'true');
      }
      if (window.AndroidTTS && typeof window.AndroidTTS.setLanguage === 'function') {
        window.AndroidTTS.setLanguage(currentLang);
      }
    }

    gameMode = state.gameMode || 'straight';
    const modeBtn = document.getElementById('mode' + (gameMode.charAt(0).toUpperCase() + gameMode.slice(1)));
    if (modeBtn) {
      document.querySelectorAll('.segment .seg').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      modeBtn.classList.add('active');
      modeBtn.setAttribute('aria-pressed', 'true');
    }

    players = state.players.map((p, idx) => ({
      name: p.name,
      gender: p.gender,
      color: p.color || COLORS[idx % COLORS.length],
      pos: Number.isInteger(p.pos) ? p.pos : 0,
      immunity: Number.isInteger(p.immunity) ? p.immunity : 0,
      loseNext: !!p.loseNext,
      decks: p.decks ? {
        nothing: {
          bag: Array.isArray(p.decks.nothing?.bag) ? [...p.decks.nothing.bag] : [],
          used: Array.isArray(p.decks.nothing?.used) ? [...p.decks.nothing.used] : []
        },
        all: {
          bag: Array.isArray(p.decks.all?.bag) ? [...p.decks.all.bag] : [],
          used: Array.isArray(p.decks.all?.used) ? [...p.decks.all.used] : [],
          heatLevel: p.decks.all?.heatLevel || 1
        }
      } : initPlayerDecks()
    }));

    current = (Number.isInteger(state.current) && state.current >= 0 && state.current < players.length) ? state.current : 0;
    completedTurns = Number.isInteger(state.completedTurns) ? state.completedTurns : 0;
    extraTurn = !!state.extraTurn;
    wheelRotation = typeof state.wheelRotation === 'number' ? state.wheelRotation : 0;
    taskReplacementFor = state.taskReplacementFor || {};
    pendingChoiceAction = state.pendingChoiceAction || null;
    currentCardDeckKey = state.currentCardDeckKey || null;
    currentCardSource = state.currentCardSource || null;
    currentCardTitle = state.currentCardTitle || null;
    currentCardKind = state.currentCardKind || null;

    if (typeof state.voiceEnabled === 'boolean') {
      voiceEnabled = state.voiceEnabled;
      const vb = document.getElementById('voiceBtn');
      if (vb) vb.textContent = voiceEnabled ? ('🔊 ' + t('voice_is_active')) : ('🔇 ' + t('voice_disabled'));
      if (window.AndroidTTS && typeof window.AndroidTTS.setEnabled === 'function') {
        window.AndroidTTS.setEnabled(voiceEnabled);
      }
    }

    if (state.shuffledBags && typeof state.shuffledBags === 'object') {
      for (const [k, v] of Object.entries(state.shuffledBags)) {
        if (Array.isArray(v)) shuffledBags[k] = [...v];
      }
    }
    if (state.deckHeatLevels && typeof state.deckHeatLevels === 'object') {
      for (const [k, v] of Object.entries(state.deckHeatLevels)) {
        deckHeatLevels[k] = v;
      }
    }
    Object.keys(usedCardIndexes).forEach(k => delete usedCardIndexes[k]);
    if (state.usedCardIndexes && typeof state.usedCardIndexes === 'object') {
      for (const [k, v] of Object.entries(state.usedCardIndexes)) {
        if (Array.isArray(v)) {
          usedCardIndexes[k] = new Set(v);
        }
      }
    }
    if (typeof usedLuckEvents !== 'undefined') {
      usedLuckEvents.clear();
      if (Array.isArray(state.usedLuckEvents)) {
        state.usedLuckEvents.forEach(e => usedLuckEvents.add(e));
      }
    }
    busy = false;

    document.getElementById('screenStart').classList.add('hidden');
    document.getElementById('screenSetup').classList.add('hidden');
    document.getElementById('screenGame').classList.remove('hidden');
    document.body.classList.add('game-active');

    buildBoard();
    buildWheelVisual();
    const disc = document.getElementById('wheelDisc');
    if (disc) {
      disc.style.transform = 'rotate(' + wheelRotation + 'deg)';
    }
    updateUI();
    applyTranslations();

    if (state.modalHtml && typeof state.modalHtml === 'string' && state.modalHtml.trim()) {
      modal(state.modalHtml);
    }
    requestAnimationFrame(fitGameToViewport);
    return true;
  } catch(e) {
    console.error('Failed to restore saved game state:', e);
    return false;
  }
}

function startGame() {
  resetCardHistory();
  completedTurns = 0;
  taskReplacementFor = {};
  players = players.filter(p => p.name.trim());
  if (players.length < 2) return alert(t('need_two_named_players'));
  players.forEach((p, n) => {
    p.color = COLORS[n % COLORS.length];
    p.pos = 0;
    p.immunity = 0;
    p.loseNext = false;
    p.decks = initPlayerDecks();
  });
  current = Math.floor(Math.random() * players.length);
  busy = false;
  extraTurn = false;
  try {
    sessionStorage.setItem('allOrNothingSessionAlive', '1');
    if (window.history && window.history.replaceState) {
      window.history.replaceState({ allOrNothingSessionAlive: true }, '');
    }
  } catch(e){}

  document.getElementById('screenSetup').classList.add('hidden');
  document.getElementById('screenGame').classList.remove('hidden');
  document.body.classList.add('game-active');

  buildBoard();
  buildWheelVisual();
  log(t('starting_player_draw', { player: players[current].name }));
  updateUI();
  requestAnimationFrame(fitGameToViewport);
  setTimeout(() => speak(t('now_turn', { player: players[current].name }), true), 180);
  skipIfNeeded();
}

function newGame() {
  if (confirm(t('confirm_new_game'))) {
    clearSavedGameState();
    document.body.classList.remove('game-active', 'modal-open');
    document.getElementById('screenGame').classList.add('hidden');
    document.getElementById('screenSetup').classList.remove('hidden');
    document.getElementById('modalHost').innerHTML = '';
    renderEditors();
  }
}

function goSetup() {
  document.getElementById('screenStart').classList.add('hidden');
  document.getElementById('screenSetup').classList.remove('hidden');
  if (!players.length) {
    players = [mkPlayer('', 'm', 0), mkPlayer('', 'f', 1), mkPlayer('', 'm', 2), mkPlayer('', 'f', 3)];
    renderEditors();
  }
}

function setMode(m) {
  gameMode = m;
  document.querySelectorAll('.segment .seg').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  const id = 'mode' + m.charAt(0).toUpperCase() + m.slice(1);
  const btn = document.getElementById(id);
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  }
}

function mkPlayer(name, gender, idx) {
  return {
    name,
    gender,
    color: COLORS[idx % COLORS.length],
    pos: 0,
    immunity: 0,
    loseNext: false,
    decks: initPlayerDecks()
  };
}

function addPlayer() {
  if (players.length >= 8) return alert(t('test_max_players'));
  players.push(mkPlayer('', players.length % 2 ? 'f' : 'm', players.length));
  renderEditors();
}

function removePlayer(i) {
  if (players.length <= 2) return alert(t('need_two_players'));
  players.splice(i, 1);
  players.forEach((p, n) => p.color = COLORS[n % COLORS.length]);
  renderEditors();
}

function renderEditors() {
  const h = document.getElementById('playersEditor');
  if (!h) return;
  h.innerHTML = '';
  players.forEach((p, i) => {
    let d = document.createElement('div');
    d.className = 'player-editor';
    d.innerHTML = `<input value="${esc(p.name)}" placeholder="${esc(t('player_name_placeholder', { number: i + 1 }))}" autocomplete="off" oninput="players[${i}].name=this.value"><select onchange="players[${i}].gender=this.value"><option value="m" ${p.gender === 'm' ? 'selected' : ''}>${esc(t('male'))}</option><option value="f" ${p.gender === 'f' ? 'selected' : ''}>${esc(t('female'))}</option></select><button class="remove" onclick="removePlayer(${i})">×</button>`;
    h.appendChild(d);
  });
}

function updateUI() {
  let p = players[current];
  document.getElementById('turnLabel').textContent = t('turn_of', { player: p.name });
  document.getElementById('turnStatus').textContent = t('status_line', { space: p.pos + 1, immunity: p.immunity, heat: heatName(), round: roundNumber() });
  document.getElementById('playerStrip').innerHTML = players.map((x, i) => `<div class="pchip ${i === current ? 'active' : ''}"><div class="pname"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${x.color}"></span> ${esc(x.name)}</div><div class="pmeta">${t('player_chip_meta', { pos: x.pos + 1, immunity: x.immunity })}${x.loseNext ? t('next_turn_badge') : ''}</div></div>`).join('');
  renderPawns();
  saveGameState();
}

let voiceEnabled = true;
function toggleVoice() {
  voiceEnabled = !voiceEnabled;
  const vb = document.getElementById('voiceBtn');
  if (vb) vb.textContent = voiceEnabled ? ('🔊 ' + t('voice_is_active')) : ('🔇 ' + t('voice_disabled'));
  if (window.AndroidTTS && typeof window.AndroidTTS.setEnabled === 'function') {
    window.AndroidTTS.setEnabled(voiceEnabled);
  }
  if (!voiceEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  saveGameState();
}

function speak(text, force = false) {
  if (!voiceEnabled || !text) return;
  text = String(text).trim();
  if (!text) return;

  if (window.AndroidTTS && typeof window.AndroidTTS.speak === 'function') {
    if (typeof window.AndroidTTS.setLanguage === 'function') {
      window.AndroidTTS.setLanguage(currentLang);
    }
    window.AndroidTTS.speak(text);
    return;
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const code = (currentLang === 'en') ? 'en-US' : (currentLang === 'ru') ? 'ru-RU' : 'he-IL';
      u.lang = code;
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.lang === code || v.lang.startsWith(currentLang));
      if (match) u.voice = match;
      u.rate = 1.0;
      window.speechSynthesis.speak(u);
    } catch(e) {
      console.warn('TTS speak error:', e);
    }
  }
}

function speakHebrew(text, force) {
  speak(text, force);
}

// 56 board positions
function positions() {
  const ps = [];
  for (let c = 0; c < 15; c++) ps.push([14, c]);
  for (let r = 13; r >= 0; r--) ps.push([r, 14]);
  for (let c = 13; c >= 0; c--) ps.push([0, c]);
  for (let r = 1; r <= 13; r++) ps.push([r, 0]);
  return ps;
}

const seq = [
  { k: 'start', tKey: 'start', i: '🏁' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'choose', tKey: 'choose_player_board', i: '👥' },
  { k: 'immune', tKey: 'immunity', i: '🛡️' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'extra', tKey: 'extra_turn', i: '⭐' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'lose', tKey: 'lose_turn', i: '⛔' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'back2', tKey: 'move_back_3', i: '↩️' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'forward3', tKey: 'move_forward_2', i: '⏩' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'reset', tKey: 'return_to_start', i: '🔄' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'swap', tKey: 'swap_places', i: '🔀' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'choose', tKey: 'choose_player_board', i: '👥' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'immune', tKey: 'immunity', i: '🛡️' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'extra', tKey: 'extra_turn', i: '⭐' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'lose', tKey: 'lose_turn', i: '⛔' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'forward2', tKey: 'move_forward_2', i: '⏩' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'back3board', tKey: 'move_back_3', i: '↩️' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' },
  { k: 'choose', tKey: 'choose_player_board', i: '👥' },
  { k: 'all', tKey: 'all', i: '🔥' },
  { k: 'nothing', tKey: 'nothing', i: '❓' },
  { k: 'wheel', tKey: 'wheel', i: '🎡' }
];

function buildBoard() {
  const g = document.getElementById('boardGrid');
  if (!g) return;
  g.innerHTML = '';
  const ps = positions();
  seq.forEach((s, idx) => {
    const [r, c] = ps[idx];
    const d = document.createElement('div');
    d.className = 'tile ' + s.k;
    d.style.gridRowStart = r + 1;
    d.style.gridColumnStart = c + 1;
    d.innerHTML = '<span class="ico">' + s.i + '</span><span class="lbl">' + esc(t(s.tKey)) + '</span>';
    g.appendChild(d);
  });
  renderPawns();
  fitTileTypography();
}

function renderPawns() {
  const layer = document.getElementById('markerLayer');
  if (!layer) return;
  layer.innerHTML = '';
  const ps = positions();
  const byTile = {};
  players.forEach((p, idx) => {
    byTile[p.pos] = byTile[p.pos] || [];
    byTile[p.pos].push(p);
  });

  Object.entries(byTile).forEach(([tileIdx, occupants]) => {
    const [r, c] = ps[Number(tileIdx)];
    const cell = document.createElement('div');
    cell.className = 'marker-cell';
    cell.style.gridRowStart = r + 1;
    cell.style.gridColumnStart = c + 1;

    occupants.forEach(p => {
      const dot = document.createElement('div');
      dot.className = 'player-dot';
      dot.title = p.name;
      dot.setAttribute('aria-label', p.name);
      dot.style.backgroundColor = p.color;
      dot.style.boxShadow = `0 0 0 1px rgba(0,0,0,.9),0 0 10px ${p.color},0 2px 4px rgba(0,0,0,.9)`;
      cell.appendChild(dot);
    });
    layer.appendChild(cell);
  });
}

function log(m, speech = false) {
  if (speech) speak(m);
}

function sound(freq = 440, dur = .08) {
  try {
    let a = new (window.AudioContext || window.webkitAudioContext)();
    let o = a.createOscillator(), g = a.createGain();
    o.frequency.value = freq;
    g.gain.value = .04;
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  } catch(e){}
}

function rollDice() {
  if (busy) return;
  if (entitlementState === 'LOCKED') { showPaywallModal(); return; }
  let es = document.getElementById('effectStatus');
  es.textContent = t('rolling');
  es.classList.remove('landed');
  let p = players[current];
  if (p.loseNext) {
    p.loseNext = false;
    log(t('turn_skipped', { player: p.name }));
    nextTurn();
    return;
  }
  busy = true;
  setRollEnabled(false);
  let a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
  let n = 0, iv = setInterval(() => {
    document.getElementById('die1').textContent = DICE[Math.floor(Math.random() * 6)];
    document.getElementById('die2').textContent = DICE[Math.floor(Math.random() * 6)];
    sound(240 + Math.random() * 140, .03);
    if (++n > 5) {
      clearInterval(iv);
      document.getElementById('die1').textContent = DICE[a - 1];
      document.getElementById('die2').textContent = DICE[b - 1];
      moveSteps(a + b);
    }
  }, 50);
}

function diceTotalSpeech(n) {
  return t('dice_' + n);
}

async function moveSteps(n) {
  let p = players[current];
  log(t('dice_result_tts', { player: p.name, total: diceTotalSpeech(n) }));
  for (let i = 0; i < n; i++) {
    p.pos = (p.pos + 1) % seq.length;
    renderPawns();
    await wait(85);
  }
  chainDepth = 0;
  resolveTile(p.pos);
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function setRollEnabled(v) {
  const btn = document.getElementById('rollBtn');
  if (btn) {
    btn.disabled = !v;
    btn.style.opacity = v ? '1' : '.45';
  }
}

function resolveTile(pos) {
  if (chainDepth++ > 6) {
    log(t('chain_guard'));
    endAction();
    return;
  }
  let s = seq[pos], p = players[current];
  let es = document.getElementById('effectStatus');
  es.textContent = t(s.tKey);
  es.classList.add('landed');
  log(t('player_landed_tile', { player: p.name, tile: t(s.tKey) }));
  switch(s.k) {
    case 'start': endAction(); break;
    case 'all': showHeatAllCard(); break;
    case 'nothing': showTruthCard(t('nothing')); break;
    case 'wheel': spinWheel(); break;
    case 'choose': choosePlayerModal(t('choose_player_board'), t('choose_pair_player'), 'pair'); break;
    case 'immune':
      p.immunity++;
      showInfo(t('immunity'), t('immunity_received_help'));
      break;
    case 'extra':
      extraTurn = true;
      showInfo(t('extra_turn'), t('extra_turn_after_action', { player: p.name }));
      break;
    case 'lose':
      p.loseNext = true;
      showInfo(t('lose_turn'), t('next_turn_will_skip', { player: p.name }));
      break;
    case 'back2': animateRelative(-2); break;
    case 'forward3': animateRelative(3); break;
    case 'forward2': animateRelative(2); break;
    case 'back3board': animateRelative(-3); break;
    case 'reset':
      p.pos = 0;
      renderPawns();
      showInfo(t('return_to_start'), t('returned_to_start'));
      break;
    case 'swap':
      choosePlayerModal(t('swap_places'), t('choose_swap_player'), 'swap');
      break;
    default: endAction();
  }
}

async function animateRelative(delta) {
  let p = players[current], steps = Math.abs(delta), dir = Math.sign(delta);
  for (let i = 0; i < steps; i++) {
    p.pos = (p.pos + dir + seq.length) % seq.length;
    renderPawns();
    await wait(95);
  }
  resolveTile(p.pos);
}

let currentCardDeckKey = null, currentCardSource = null, currentCardTitle = null, currentCardKind = null, currentCardRawId = null;

function replacementActorIndex(playerIndex = current) {
  const r = taskReplacementFor[playerIndex];
  return (Number.isInteger(r) && players[r]) ? r : playerIndex;
}

function consumeReplacementActor(playerIndex = current) {
  const r = replacementActorIndex(playerIndex);
  if (r !== playerIndex) delete taskReplacementFor[playerIndex];
  return r;
}

function showCard(title, textOrCardId, kind, deckKey = null, source = null) {
  let p = players[current];
  currentCardRawId = textOrCardId;
  let text = textOrCardId;
  if (typeof textOrCardId === 'string' && (textOrCardId.startsWith('all_') || textOrCardId.startsWith('nothing_') || textOrCardId.startsWith('bold_') || textOrCardId.startsWith('pair_'))) {
    text = getCardText(deckKey, textOrCardId);
  }

  if ((kind === 'all' || kind === 'bold') && replacementActorIndex(current) !== current) {
    const original = players[current];
    const actorIndex = consumeReplacementActor(current);
    const actor = players[actorIndex];
    title = t('replacement_title', { title });
    text = t('replacement_task', { actor: actor.name, original: original.name, text: text });
    log(t('replacement_notice', { actor: actor.name, original: original.name }));
  }

  currentCardDeckKey = deckKey;
  currentCardSource = source;
  currentCardTitle = title;
  currentCardKind = kind;

  speak(t('card_tts', { title, text: text.replace(/\n/g, ' ') }));
  let useImm = (p.immunity > 0 && deckKey) ? `<button class="secondary" onclick="useImmunity()">${esc(t('use_immunity'))}</button>` : '';
  modal(`<h3>${esc(title)}</h3><p>${esc(text).replace(/\n/g, '<br>')}</p><div class="choices">${useImm}<button class="primary" onclick="closeModal();endAction()">${esc(t('done_continue'))}</button></div>`);
}

function useImmunity() {
  let p = players[current];
  if (p.immunity <= 0 || !currentCardDeckKey) return;
  p.immunity--;
  updateUI();
  const card = drawUnique(currentCardDeckKey, currentCardSource, current);
  closeModal();
  if (card === null) {
    showInfo(currentCardTitle, t('no_new_card_category'));
    return;
  }
  showCard(currentCardTitle, card, currentCardKind, currentCardDeckKey, currentCardSource);
}

function showInfo(title, text) {
  speak(title + '. ' + text);
  modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><button class="primary" onclick="closeModal();endAction()">${esc(t('continue'))}</button>`);
}

function eligibleOthers(actorIdx) {
  let actor = players[actorIdx];
  if (gameMode === 'straight') return players.filter((_, idx) => idx !== actorIdx && players[idx].gender !== actor.gender);
  if (gameMode === 'gay') return players.filter((_, idx) => idx !== actorIdx && players[idx].gender === actor.gender);
  return players.filter((_, idx) => idx !== actorIdx);
}

function choosePlayerModal(title, text, action) {
  pendingChoiceAction = action;
  speak(title + '. ' + text);
  const pairAction = (action === 'pair' || action === 'wheelPair' || action === 'luckPair' || action === 'wheelBold' || action === 'luckBold' || action === 'wheelChoose');
  const taskPartnerAction = (action === 'pair' || action === 'wheelPair' || action === 'luckPair' || action === 'wheelBold' || action === 'luckBold');
  const baseIndex = taskPartnerAction ? replacementActorIndex(current) : current;
  const allowed = pairAction ? eligibleOthers(baseIndex) : players.filter((_, idx) => idx !== current);

  if (!allowed.length) {
    const fallbackMsg = (gameMode === 'straight') ? t('no_opposite_gender') : (gameMode === 'gay') ? t('no_same_gender') : t('no_other_player');
    showInfo(title, fallbackMsg);
    return;
  }

  let btns = allowed.map(target => {
    const realIndex = players.indexOf(target);
    return `<button class="choice" onclick="onPlayerChosen(${realIndex})"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${target.color}"></span> ${esc(target.name)}</button>`;
  }).join('');

  modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="choices">${btns}</div>`);
}

function onPlayerChosen(i) {
  closeModal();
  let action = pendingChoiceAction;
  pendingChoiceAction = null;

  if (action === 'pair' || action === 'wheelPair' || action === 'luckPair') {
    const actorIndex = replacementActorIndex(current);
    const actor = players[actorIndex], partner = players[i];
    const cardId = drawUnique('pair', null, actorIndex);
    if (!cardId) {
      showInfo(t('pair_task'), t('no_pair_cards_heat', { heat: heatName() }));
      return;
    }
    const cardText = getCardText('pair', cardId);
    let title = t('pair_title_heat', { heat: heatName() });
    if (actorIndex !== current) {
      title += ' · ' + t('replacement_title', { title: '' });
      consumeReplacementActor(current);
    }
    log(t('pair_received', { actor: actor.name, partner: partner.name }));
    setTimeout(() => showCard(title, t('pair_task_players', { actor: actor.name, partner: partner.name, task: cardText }), 'pair', 'pair', null), 60);
    return;
  }

  if (action === 'swap') {
    let p = players[current], q = players[i], tmp = p.pos;
    p.pos = q.pos; q.pos = tmp;
    updateUI();
    log(t('players_swapped', { player1: p.name, player2: q.name }));
    setTimeout(() => showInfo(t('swap_places'), t('players_swapped_no_trigger', { player1: p.name, player2: q.name })), 60);
    return;
  }

  if (action === 'wheelBold' || action === 'luckBold') {
    const actorIndex = replacementActorIndex(current);
    const actor = players[actorIndex], partner = players[i];
    const cardId = drawUnique('bold', null, actorIndex);
    if (!cardId) {
      showInfo(t('bold_task'), t('no_bold_cards'));
      return;
    }
    const cardText = getCardText('bold', cardId);
    let title = t('bold_title_heat', { heat: boldHeatName() });
    if (actorIndex !== current) {
      title += ' · ' + t('replacement_title', { title: '' });
      consumeReplacementActor(current);
    }
    log(t('bold_received', { actor: actor.name, partner: partner.name }));
    setTimeout(() => showCard(title, t('pair_task_players', { actor: actor.name, partner: partner.name, task: cardText }), 'bold', 'bold', null), 60);
    return;
  }
  if (action === 'chooseSkip') {
    players[i].loseNext = true;
    updateUI();
    log(t('skip_received', { player: players[i].name }));
    setTimeout(() => showInfo(t('luck'), t('player_loses_next', { player: players[i].name })), 60);
    return;
  }
  if (action === 'giveImmunity') {
    players[i].immunity++;
    if (players[current].immunity > 0) players[current].immunity--;
    updateUI();
    log(t('gift_received', { player: players[i].name }));
    setTimeout(() => showInfo(t('luck'), t('immunity_given', { player: players[i].name })), 60);
    return;
  }
  if (action === 'chooseBack2') {
    players[i].pos = (players[i].pos - 2 + seq.length) % seq.length;
    renderPawns();
    updateUI();
    setTimeout(() => showInfo(t('luck'), t('player_moved_back', { player: players[i].name, n: 2 })), 60);
    return;
  }
  if (action === 'chooseForward3') {
    players[i].pos = (players[i].pos + 3) % seq.length;
    renderPawns();
    updateUI();
    setTimeout(() => showInfo(t('luck'), t('player_moved_forward', { player: players[i].name, n: 3 })), 60);
    return;
  }

  if (action === 'wheelReplace') {
    let actor = players[current], partner = players[i];
    taskReplacementFor[current] = i;
    log(t('replacement_chosen', { actor: actor.name, partner: partner.name }));
    setTimeout(() => showInfo(t('replacement_active'), t('replacement_saved', { partner: partner.name, actor: actor.name })), 60);
    return;
  }

  if (action === 'wheelChoose') {
    const chosen = players[i];
    const outcome = ['question', 'dare', 'immunity', 'skip', 'forward', 'decide'][Math.floor(Math.random() * 6)];
    if (outcome === 'question') {
      const qId = drawPlayerNothingCard(i);
      if (!qId) { showInfo(t('choose_player'), t('no_questions')); return; }
      const qText = getCardText('nothing', qId);
      setTimeout(() => showCard(t('choose_player_question'), t('chosen_answers', { player: chosen.name, question: qText }), 'choice', null, null), 60);
      return;
    }
    if (outcome === 'dare') {
      const dId = drawPlayerAllCard(i);
      if (!dId) { showInfo(t('choose_player'), t('no_tasks')); return; }
      const dText = getCardText('all', dId);
      setTimeout(() => showCard(t('choose_player_dare_heat', { heat: heatName() }), t('chosen_performs', { player: chosen.name, task: dText }), 'choice', null, null), 60);
      return;
    }
    if (outcome === 'immunity') {
      chosen.immunity++;
      updateUI();
      setTimeout(() => showInfo(t('choose_player_bonus'), t('chosen_immunity', { player: chosen.name })), 60);
      return;
    }
    if (outcome === 'skip') {
      chosen.loseNext = true;
      updateUI();
      setTimeout(() => showInfo(t('choose_player_penalty'), t('chosen_loses_turn', { player: chosen.name })), 60);
      return;
    }
    if (outcome === 'forward') {
      chosen.pos = (chosen.pos + 3) % seq.length;
      updateUI();
      setTimeout(() => showInfo(t('choose_player_forward'), t('chosen_forward3', { player: chosen.name })), 60);
      return;
    }
    if (outcome === 'decide') {
      modal(`<h3>${esc(t('choose_player_decision'))}</h3><p>${esc(t('chosen_decides_aon', { chosen: chosen.name, current: players[current].name }))}</p><div class="choices"><button class="choice" onclick="closeModal();showHeatAllCard()">${esc(t('all'))}</button><button class="choice" onclick="closeModal();showTruthCard('${escJs(t('nothing'))}')">${esc(t('nothing'))}</button></div>`);
      return;
    }
  }

  if (action === 'luckImmunity') {
    if (players[i].immunity > 0) {
      players[i].immunity--;
      players[current].immunity++;
      updateUI();
      setTimeout(() => showInfo(t('luck'), t('stole_immunity', { player: players[i].name })), 60);
    } else {
      players[current].immunity++;
      updateUI();
      setTimeout(() => showInfo(t('luck_nothing_to_steal'), t('no_immunity_got_one', { player: players[i].name })), 60);
    }
    return;
  }
}

const usedLuckEvents = new Set();

function isLuckEventTrialSafe(key) {
  if (key === 'bonusBold' || key === 'wildCard') return false;
  const ev = LUCK_EVENTS_MAP[key];
  if (!ev) return true;
  const str = JSON.stringify(ev).toLowerCase();
  if (str.includes('bold') || str.includes('extreme') || str.includes('נועז') || str.includes('אקסטרים') || str.includes('смел') || str.includes('экстрим')) {
    return false;
  }
  return true;
}

function luckEvent() {
  const allEvents = Object.keys(LUCK_EVENTS_MAP);
  let pool = allEvents;
  if (entitlementState === 'FREE_TRIAL') {
    pool = pool.filter(k => isLuckEventTrialSafe(k));
  }
  let available = pool.filter(k => !usedLuckEvents.has(k));
  if (available.length === 0) {
    pool.forEach(k => usedLuckEvents.delete(k));
    available = pool;
  }
  let key = available[Math.floor(Math.random() * available.length)] || 'immune1';

  // Defensive entitlement safeguard: trial never receives bold or extreme
  if (entitlementState === 'FREE_TRIAL' && !isLuckEventTrialSafe(key)) {
    key = 'immune1';
  }
  usedLuckEvents.add(key);

  const ev = LUCK_EVENTS_MAP[key] || { he: { title: t('luck'), body: '' } };
  const item = ev[currentLang] || ev.he;
  const title = item.title || t('luck');
  const body = item.body || '';

  // Mechanical and interactive effects
  let p = players[current];

  // 1. PAID / OWNER mode: Bold task selection
  if (key === 'bonusBold') {
    const formattedBody = (body || t('choose_bold_heat', { heat: boldHeatName() })).replace('{heat}', boldHeatName());
    choosePlayerModal(title, formattedBody, 'luckBold');
    return;
  }

  if (key === 'pairBonus') {
    choosePlayerModal(title, body, 'luckPair');
    return;
  }

  if (key === 'truthDare') {
    speak(t('truth_dare_choose_first_tts'));
    modal(`<h3>${esc(t('truth_or_dare'))}</h3><p><b>${esc(t('truth'))}</b> = ${esc(t('truth_equals_question'))}</p><div class="choices"><button class="choice" onclick="closeModal();showTruthCard()">${esc(t('truth_question'))}</button><button class="choice" onclick="closeModal();showDareCard()">${esc(t('dare_task'))}</button></div>`);
    return;
  }

  if (key === 'bonusAll') {
    showHeatAllCard();
    return;
  }

  if (key === 'bonusNothing') {
    showTruthCard(t('nothing'));
    return;
  }

  if (key === 'allOrNothing') {
    speak(t('aon_choose_first_tts'));
    modal(`<h3>${esc(t('app_title'))}</h3><p>${esc(t('choose_before_reveal'))}</p><div class="choices"><button class="choice" onclick="closeModal();showHeatAllCard()">${esc(t('all'))}</button><button class="choice" onclick="closeModal();showTruthCard('${escJs(t('nothing'))}')">${esc(t('nothing'))}</button></div>`);
    return;
  }

  if (key === 'chooseSkip') {
    choosePlayerModal(title, body, 'chooseSkip');
    return;
  }

  if (key === 'giveImmunity') {
    choosePlayerModal(title, body, 'giveImmunity');
    return;
  }

  if (key === 'stealImmunity') {
    choosePlayerModal(title, body, 'luckImmunity');
    return;
  }

  if (key === 'swap') {
    choosePlayerModal(title, body, 'swap');
    return;
  }

  if (key === 'chooseBack2') {
    choosePlayerModal(title, body, 'chooseBack2');
    return;
  }

  if (key === 'chooseForward3') {
    choosePlayerModal(title, body, 'chooseForward3');
    return;
  }

  if (key === 'immune1' || key === 'immune2') {
    p.immunity += (key === 'immune2' ? 2 : 1);
    updateUI();
  } else if (key === 'extra' || key === 'extra1') {
    extraTurn = true;
  } else if (key === 'forward3' || key === 'forward1') {
    p.pos = (p.pos + 3) % seq.length;
    renderPawns();
  } else if (key === 'forward5' || key === 'forward2') {
    p.pos = (p.pos + 5) % seq.length;
    renderPawns();
  } else if (key === 'back2' || key === 'back1') {
    p.pos = (p.pos - 2 + seq.length) % seq.length;
    renderPawns();
  } else if (key === 'back3') {
    p.pos = (p.pos - 3 + seq.length) % seq.length;
    renderPawns();
  } else if (key === 'spinAgain') {
    speak(title + '. ' + body);
    modal(`<h3>${esc(title)}</h3><p>${esc(body)}</p><button class="primary" onclick="closeModal();spinWheel()">${esc(t('spin_again') || 'Spin')}</button>`);
    return;
  } else if (key === 'allForward1') {
    players.forEach(pl => { pl.pos = (pl.pos + 1) % seq.length; });
    renderPawns();
  } else if (key === 'allBack1') {
    players.forEach(pl => { pl.pos = (pl.pos - 1 + seq.length) % seq.length; });
    renderPawns();
  } else if (key === 'allImmunity') {
    players.forEach(pl => { pl.immunity++; });
    updateUI();
  } else if (key === 'returnStart') {
    p.pos = 0;
    renderPawns();
  } else if (key === 'doublePrize') {
    p.immunity++;
    extraTurn = true;
    updateUI();
  } else if (key === 'safeBonus') {
    if (p.loseNext) {
      p.loseNext = false;
    } else {
      p.immunity++;
    }
    updateUI();
  } else if (key === 'wildCard') {
    speak(title + '. ' + body);
    modal(`<h3>${esc(title)}</h3><p>${esc(body || t('wild_card_choose'))}</p><div class="choices"><button class="choice" onclick="closeModal();showTruthCard('${escJs(t('nothing'))}')">${esc(t('nothing'))}</button><button class="choice" onclick="closeModal();choosePlayerModal(t('bold_task'), t('choose_bold_heat', { heat: boldHeatName() }), 'luckBold')">${esc(t('bold_task'))}</button><button class="choice" onclick="closeModal();choosePlayerModal(t('pair'), t('choose_pair_player'), 'luckPair')">${esc(t('pair'))}</button></div>`);
    return;
  }

  showInfo(title, body);
}

function updateModalViewportLayout() {
  const vv = window.visualViewport;
  let maxPx = Math.floor((vv ? vv.height : window.innerHeight) * 0.45);
  if (maxPx < 140) maxPx = 140;
  document.documentElement.style.setProperty('--modal-max-height', maxPx + 'px');
  let bottomOffset = 16;
  if (vv) {
    const inset = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
    bottomOffset = Math.max(16, 16 + inset);
  }
  document.documentElement.style.setProperty('--modal-bottom-offset', bottomOffset + 'px');
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateModalViewportLayout);
  window.visualViewport.addEventListener('scroll', updateModalViewportLayout);
}

function modal(html) {
  currentModalHtml = html;
  const host = document.getElementById('modalHost');
  host.innerHTML = `<div class="modal-back"><div class="card modal">${html}</div></div>`;
  document.body.classList.add('modal-open');
  updateModalViewportLayout();
  requestAnimationFrame(updateModalViewportLayout);
  saveGameState();
}

function closeModal() {
  currentModalHtml = null;
  document.getElementById('modalHost').innerHTML = '';
  document.body.classList.remove('modal-open');
  requestAnimationFrame(fitGameToViewport);
  saveGameState();
}

function endAction() {
  busy = false;
  setRollEnabled(true);
  updateUI();
  if (extraTurn) {
    extraTurn = false;
    log(t('extra_turn_for', { player: players[current].name }));
    return;
  }
  nextTurn();
}

function nextTurn() {
  const turnId = 'turn_' + (completedTurns + 1) + '_' + current + '_' + Date.now();

  if (entitlementState === 'FREE_TRIAL') {
    if (window.AndroidLicense && typeof window.AndroidLicense.commitTrialTurn === 'function') {
      window.AndroidLicense.commitTrialTurn(turnId);
    } else {
      trialTurnsUsed++;
      trialRemainingTurns = Math.max(0, trialMaxTurns - trialTurnsUsed);
      if (trialRemainingTurns <= 0) {
        entitlementState = 'LOCKED';
      }
    }
  }

  const oldHeat = currentHeatLevel();
  completedTurns++;
  const newHeat = currentHeatLevel();
  current = (current + 1) % players.length;
  updateUI();
  updateLicenseBadge();

  if (entitlementState === 'LOCKED') {
    showPaywallModal();
    return;
  }

  if (newHeat > oldHeat) {
    log(t('heat_increased', { heat: heatName(newHeat) }), false);
    speak(t('heat_increased_tts', { heat: heatName(newHeat) }), true);
  }

  log(t('now_turn', { player: players[current].name }), false);
  speak(t('now_turn', { player: players[current].name }), true);
  skipIfNeeded();
}

function skipIfNeeded() {
  let p = players[current];
  if (p.loseNext) {
    setTimeout(() => modal(`<h3>${esc(t('lose_turn_title'))}</h3><p>${esc(t('lose_turn_body', { player: p.name }))}</p><button class="primary" onclick="players[current].loseNext=false;closeModal();log('${escJs(t('player_skipped_penalty', { player: p.name }))}');nextTurn()">${esc(t('continue'))}</button>`), 80);
  }
}

function manualSpinWheel() {
  if (!busy) {
    busy = true;
    setRollEnabled(false);
    spinWheel();
  }
}

function spinWheel() {
  const segmentCount = WHEEL_CATS.length;
  const idx = Math.floor(Math.random() * segmentCount);
  const seg = 360 / segmentCount;
  const desired = ((360 - (idx * seg)) % 360 + 360) % 360;
  const currentMod = ((wheelRotation % 360) + 360) % 360;
  const delta = 360 * 5 + ((desired - currentMod + 360) % 360);
  wheelRotation += delta;
  const disc = document.getElementById('wheelDisc');
  if (disc) disc.style.transform = `rotate(${wheelRotation}deg)`;
  sound(520, .1);
  setTimeout(() => {
    const c = WHEEL_CATS[idx];
    log(t('wheel_stopped', { category: t(c.tKey) }));
    handleWheel(c);
  }, 2380);
}

function handleWheel(c) {
  switch(c.k) {
    case 'pair':
      choosePlayerModal(t('pair'), t('choose_pair_player'), 'wheelPair');
      break;
    case 'bold':
      choosePlayerModal(t('bold_task'), t('choose_bold_heat', { heat: boldHeatName() }), 'wheelBold');
      break;
    case 'truthdare':
      speak(t('truth_dare_choose_first_tts'));
      modal(`<h3>${esc(t('truth_or_dare'))}</h3><p><b>${esc(t('truth'))}</b> = ${esc(t('truth_equals_question'))}</p><div class="choices"><button class="choice" onclick="closeModal();showTruthCard()">${esc(t('truth_question'))}</button><button class="choice" onclick="closeModal();showDareCard()">${esc(t('dare_task'))}</button></div>`);
      break;
    case 'replace':
      choosePlayerModal(t('swap'), t('choose_replacement_player'), 'wheelReplace');
      break;
    case 'choose':
      choosePlayerModal(t('choose_player'), t('choose_player_random_effect'), 'wheelChoose');
      break;
    case 'luck':
      luckEvent();
      break;
    case 'aon':
      speak(t('aon_choose_first_tts'));
      modal(`<h3>${esc(t('app_title'))}</h3><p>${esc(t('choose_before_reveal'))}</p><div class="choices"><button class="choice" onclick="closeModal();showHeatAllCard()">${esc(t('all'))}</button><button class="choice" onclick="closeModal();showTruthCard('${escJs(t('nothing'))}')">${esc(t('nothing'))}</button></div>`);
      break;
  }
}

function wheelTextHtml(t) {
  if (t.includes(' ')) {
    return t.replace(' ', '<br>');
  }
  return t;
}

function buildWheelVisual() {
  const disc = document.getElementById('wheelDisc');
  if (!disc) return;
  disc.querySelectorAll('.wheel-label').forEach(x => x.remove());
  const n = WHEEL_CATS.length, radius = 29.3;
  WHEEL_CATS.forEach((c, i) => {
    const a = i * (360 / n), rad = (a - 90) * Math.PI / 180;
    const x = 50 + radius * Math.cos(rad), y = 50 + radius * Math.sin(rad);
    const el = document.createElement('div');
    el.className = 'wheel-label';
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.style.transform = 'translate(-50%,-50%) rotate(' + a + 'deg)';
    el.innerHTML = '<span class="wheel-label-inner"><span class="wi">' + c.i + '</span><span class="wtxt">' + wheelTextHtml(t(c.tKey)) + '</span></span>';
    disc.appendChild(el);
  });
}

function fitGameToViewport() {
  const app = document.querySelector('.app');
  if (!app) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let targetW = 390;
  let targetH = 844;
  if (vw > vh && vw >= 640) {
    targetW = 960;
    targetH = 540;
  }
  const scale = Math.min(vw / targetW, vh / targetH, 1.35);
  app.style.setProperty('--app-scale', scale.toFixed(3));
}

function fitTileTypography() {
  const tiles = document.querySelectorAll('.tile .lbl');
  tiles.forEach(el => {
    const len = el.textContent.length;
    if (len > 12) el.style.fontSize = '4.5px';
    else if (len > 8) el.style.fontSize = '5.2px';
    else el.style.fontSize = '';
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function escJs(s) {
  return String(s).replace(/['\\]/g, '\\$&');
}

window.addEventListener('resize', () => requestAnimationFrame(fitGameToViewport));
window.addEventListener('orientationchange', () => setTimeout(fitGameToViewport, 120));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveGameState();
  }
});
window.addEventListener('pagehide', saveGameState);
window.addEventListener('beforeunload', saveGameState);

function initApp() {
  initEntitlement();
  initLanguagePack();
  applyTranslations();
  buildWheelVisual();
  fitGameToViewport();
  restoreSavedGameState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
window.addEventListener('load', initApp);
