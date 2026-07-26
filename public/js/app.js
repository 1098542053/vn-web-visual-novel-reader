/**
 * App Router & Navigation v3
 * Added: readerBack, review panel, i18n (zh-TW/zh-CN/ja)
 */

var _previousScreen = 'title';
var _lastNonReaderScreen = 'title'; // 记录进入 reader 前的最后一个非 reader 页面名

function navigateTo(screen, params) {
  // 进入 reader 前记录是从哪个页面来的
  if (screen !== 'reader') {
    _lastNonReaderScreen = screen;
  }
  if (screen === 'reader') {
    _previousScreen = _lastNonReaderScreen;
  }
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  if (screen !== 'reader') reader.stop();

  switch (screen) {
    case 'title':
      document.getElementById('screen-title').classList.add('active');
      break;
    case 'characters':
      document.getElementById('screen-characters').classList.add('active');
      loadCharacters();
      break;
    case 'char-select':
      document.getElementById('screen-char-select').classList.add('active');
      if (params) showCharSelect(params.charId, params.charName, params.motion);
      break;
    case 'main-story':
      document.getElementById('screen-story-list').classList.add('active');
      document.getElementById('story-list-title').textContent = t('mainStory.title');
      loadMainStory();
      break;
    case 'events':
      document.getElementById('screen-events').classList.add('active');
      loadEvents();
      break;
    case 'gallery':
      document.getElementById('screen-gallery').classList.add('active');
      loadGallery();
      break;
    case 'l2d-gallery':
      document.getElementById('screen-l2d-gallery').classList.add('active');
      loadL2DGallery();
      break;
    case 'event-chapters':
      document.getElementById('screen-story-list').classList.add('active');
      document.getElementById('story-list-title').textContent = (params && params.title) ? params.title : t('events.chapters');
      loadEventChapters(params ? params.eventId : null);
      break;
    case 'reader':
      document.getElementById('screen-reader').classList.add('active');
      if (params) reader.play(params.type, params.id, params.title);
      break;
    case 'settings':
      document.getElementById('screen-settings').classList.add('active');
      break;
    default:
      document.getElementById('screen-title').classList.add('active');
  }
}

// ─── Reader Back ──────────────────────────────────────────────────────
function readerBack() {
  reader.stop();
  navigateTo(_previousScreen);
}

// ─── Review Panel ─────────────────────────────────────────────────────
function toggleReview() {
  var overlay = document.getElementById('review-overlay');
  if (!overlay) return;
  if (overlay.classList.contains('active')) {
    overlay.classList.remove('active');
    return;
  }
  // Populate review content (newest first)
  var content = document.getElementById('review-content');
  var history = reader.getHistory ? reader.getHistory() : [];
  if (history.length === 0) {
    content.innerHTML = '<div class="review-item" style="text-align:center;color:var(--text-dim);padding:2rem">' + t('review.empty') + '</div>';
  } else {
    // Reverse to show newest first
    var reversed = history.slice().reverse();
    content.innerHTML = reversed.map(function(entry) {
      var headHtml = entry.faceIcon && entry.faceIcon.startsWith('fc')
        ? '<div class="review-item-head"><img class="review-item-headicon" src="/texture/chara_icon_image/' + entry.faceIcon + '.png" onerror="this.parentElement.style.display=\'none\'"></div>'
        : '<div class="review-item-head" style="display:none"></div>';
      var speakerHtml = entry.speaker ? '<div class="review-item-speaker">' + escapeHtml(entry.speaker) + '</div>' : '';
      var voiceHtml = entry.voiceName
        ? '<button class="review-item-voice-btn" data-voice="' + entry.voiceName + '" onclick="event.stopPropagation();reader.replayVoice(\'' + entry.voiceName + '\')">▶</button>'
        : '';
      return '<div class="review-item" data-line-idx="' + entry.lineIdx + '">' +
        headHtml +
        '<div class="review-item-body">' + speakerHtml + '<div class="review-item-text">' + escapeHtml(entry.text) + '</div></div>' +
        voiceHtml +
        '</div>';
    }).join('');
    // Scroll to top (newest first)
    content.scrollTop = 0;
  }
  overlay.classList.add('active');
}

// Click handler for review avatar — confirm then jump to line
document.addEventListener('click', function(e) {
  var head = e.target.closest('.review-item-head, .review-item-headicon');
  if (head) {
    var item = head.closest('.review-item[data-line-idx]');
    if (item) {
      var idx = parseInt(item.getAttribute('data-line-idx'));
      if (!isNaN(idx) && reader.jumpToLine && confirm(t('review.jumpConfirm'))) {
        var overlay = document.getElementById('review-overlay');
        if (overlay) overlay.classList.remove('active');
        reader.jumpToLine(idx);
      }
    }
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── i18n System ──────────────────────────────────────────────────────
var _lang = localStorage.getItem('vn-lang') || 'zh-TW';

var TRANSLATIONS = {
  'zh-TW': {
    'title.characters': '角色劇情',
    'title.mainStory': '主線故事',
    'title.events': '事件劇情',
    'title.settings': '設定',
    'reader.back': '← 返回',
    'reader.loading': '讀取中...',
    'reader.review': '📋 回顧',
    'reader.auto': '自動',
    'reader.skip': '跳過',
    'reader.next': '▼ 下一句',
    'review.title': '對話回顧',
    'review.close': '關閉',
    'review.empty': '尚無對話記錄',
    'review.jumpConfirm': '是否跳轉到該行？',
    'settings.textSpeed': '文字速度',
    'settings.autoDelay': '自動模式延迟',
    'settings.fontSize': '字體大小',
    'settings.language': '語言',
    'settings.aspectRatio': '畫面比例',
    'settings.dialogOpacity': '對話框透明度',
    'settings.reset': '重置設定',
    'settings.resetBtn': '恢復預設',
    'settings.resetConfirm': '確定要重置所有設定嗎？',
    'settings.fast': '快',
    'settings.medium': '中等',
    'settings.slow': '慢',
    'mainStory.title': '主線故事章節',
    'events.chapters': '事件章節',
    'characters.title': '角色列表',
    'characters.search': '搜尋角色...',
    'characters.empty': '無符合條件的角色',
    'characters.loading': '載入中...',
    'characters.error': '載入失敗',
    'events.title': '事件劇情',
    'events.empty': '無事件數據',
    'events.view': '查看章節 →',
    'gallery.title': '回憶畫廊',
    'gallery.empty': '暫無內容',
    'mainStory.empty': '無主線故事數據',
    'storyList.title': '章節列表',
    'select.normal': 'Normal',
    'select.r18': 'R18/CG',
    'common.loading': '載入中...',
    'common.error': '載入失敗',
    'common.empty': '無數據'
  },
  'zh-CN': {
    'title.characters': '角色剧情',
    'title.mainStory': '主线故事',
    'title.events': '事件剧情',
    'title.settings': '设置',
    'reader.back': '← 返回',
    'reader.loading': '读取中...',
    'reader.review': '📋 回顾',
    'reader.auto': '自动',
    'reader.skip': '跳过',
    'reader.next': '▼ 下一句',
    'review.title': '对话回顾',
    'review.close': '关闭',
    'review.empty': '暂无对话记录',
    'review.jumpConfirm': '是否跳转到该行？',
    'settings.textSpeed': '文字速度',
    'settings.autoDelay': '自动模式延迟',
    'settings.fontSize': '字体大小',
    'settings.language': '语言',
    'settings.aspectRatio': '画面比例',
    'settings.dialogOpacity': '对话框透明度',
    'settings.reset': '重置设置',
    'settings.resetBtn': '恢复默认',
    'settings.resetConfirm': '确定要重置所有设置吗？',
    'settings.fast': '快',
    'settings.medium': '中等',
    'settings.slow': '慢',
    'mainStory.title': '主线故事章节',
    'events.chapters': '事件章节',
    'characters.title': '角色列表',
    'characters.search': '搜索角色...',
    'characters.empty': '无符合条件的角色',
    'characters.loading': '加载中...',
    'characters.error': '加载失败',
    'events.title': '事件剧情',
    'events.empty': '无事件数据',
    'events.view': '查看章节 →',
    'gallery.title': '回忆画廊',
    'gallery.empty': '暂无内容',
    'mainStory.empty': '无主线故事数据',
    'storyList.title': '章节列表',
    'select.normal': 'Normal',
    'select.r18': 'R18/CG',
    'common.loading': '加载中...',
    'common.error': '加载失败',
    'common.empty': '无数据'
  },
  'ja': {
    'title.characters': 'キャラ劇情',
    'title.mainStory': 'メインストーリー',
    'title.events': 'イベント',
    'title.settings': '設定',
    'reader.back': '← 戻る',
    'reader.loading': '読込中...',
    'reader.review': '📋 レビュー',
    'reader.auto': '自動',
    'reader.skip': 'スキップ',
    'reader.next': '▼ 次の文',
    'review.title': '会話レビュー',
    'review.close': '閉じる',
    'review.empty': '会話記録がありません',
    'review.jumpConfirm': 'この行にジャンプしますか？',
    'settings.textSpeed': '文字速度',
    'settings.autoDelay': '自動モード遅延',
    'settings.fontSize': 'フォントサイズ',
    'settings.language': '言語',
    'settings.aspectRatio': '画面比率',
    'settings.dialogOpacity': 'ダイアログ透明度',
    'settings.reset': '設定リセット',
    'settings.resetBtn': 'デフォルトに戻す',
    'settings.resetConfirm': '全ての設定をリセットしますか？',
    'settings.fast': '速い',
    'settings.medium': '普通',
    'settings.slow': '遅い',
    'mainStory.title': 'メインストーリー章',
    'events.chapters': 'イベント章',
    'characters.title': 'キャラ一覧',
    'characters.search': 'キャラ検索...',
    'characters.empty': '該当キャラなし',
    'characters.loading': '読込中...',
    'characters.error': '読込失敗',
    'events.title': 'イベント',
    'events.empty': 'イベントデータなし',
    'events.view': '章を表示 →',
    'gallery.title': '思い出ギャラリー',
    'gallery.empty': 'コンテンツがありません',
    'mainStory.empty': 'メインストーリーデータなし',
    'storyList.title': '章一覧',
    'select.normal': 'Normal',
    'select.r18': 'R18/CG',
    'common.loading': '読込中...',
    'common.error': '読込失敗',
    'common.empty': 'データなし'
  }
};

function t(key) {
  return (TRANSLATIONS[_lang] && TRANSLATIONS[_lang][key]) || TRANSLATIONS['zh-TW'][key] || key;
}

function setLanguage(lang) {
  _lang = lang;
  localStorage.setItem('vn-lang', lang);
  applyTranslations();
  // Update dynamic elements
  var titleEl = document.getElementById('story-list-title');
  if (titleEl && document.getElementById('screen-story-list').classList.contains('active')) {
    var activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
      if (activeScreen.id === 'screen-story-list' && titleEl.textContent) {
        // Keep the title as-is (set by navigateTo)
      }
    }
  }
  // Update setting labels that are not data-i18n
  var speedLabel = document.getElementById('text-speed-label');
  if (speedLabel) {
    var speed = parseInt(document.getElementById('text-speed').value);
    speedLabel.textContent = speed <= 20 ? t('settings.fast') : speed <= 50 ? t('settings.medium') : t('settings.slow');
  }
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  // Update placeholder attributes
  var searchInput = document.getElementById('char-search');
  if (searchInput) searchInput.placeholder = t('characters.search');
}

// ─── Character List ───────────────────────────────────────────────────
async function loadCharacters() {
  var grid = document.getElementById('char-grid');
  grid.innerHTML = '<div class="loading">' + t('characters.loading') + '</div>';

  try {
    var res = await fetch('/api/characters');
    var chars = await res.json();
    window._allChars = chars;
    renderCharacters(chars);
  } catch (e) {
    grid.innerHTML = '<div class="error">' + t('characters.error') + '：' + e.message + '</div>';
  }
}

function renderCharacters(chars) {
  var grid = document.getElementById('char-grid');
  var search = (document.getElementById('char-search').value || '').toLowerCase();
  var checkedStars = document.querySelectorAll('#filter-stars input:checked');
  var activeStars = Array.from(checkedStars).map(function(cb) { return parseInt(cb.value); });

  var filtered = chars.filter(function(c) {
    if (!activeStars.includes(c.rarity)) return false;
    if (search && !c.name.toLowerCase().includes(search)) return false;
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty">' + t('characters.empty') + '</div>';
    return;
  }

  grid.innerHTML = filtered.map(function(c) {
    var stars = '★'.repeat(c.rarity);
    var hasCG = c.motion !== '无';
    var imgUrl = '/texture/ButtonUi/' + c.id + '.png';
    return '<div class="char-card" onclick="onCharClick(\'' + c.id + '\',\'' + c.name.replace(/'/g,"\\'") + '\',\'' + c.motion + '\')">' +
      '<img class="char-card-img" src="' + imgUrl + '" onerror="this.style.display=\'none\'" />' +
      '<div class="char-card-info">' +
      '<div class="char-card-name">' + c.name + '</div>' +
      '<div class="char-card-rarity">' + stars + '</div>' +
      (hasCG ? '<span class="char-card-type">CG</span>' : '') +
      '</div></div>';
  }).join('');
}

function filterCharacters() {
  if (window._allChars) renderCharacters(window._allChars);
}

// ─── Character Click → Select Panel ────────────────────────────────────
function onCharClick(charId, charName, motion) {
  var picId = charId.substring(2, 7);
  var hasCG = motion !== '无';

  if (!hasCG) {
    openReader('normal', 'har_' + picId, charName + ' - Normal');
    return;
  }

  navigateTo('char-select', { charId: charId, charName: charName, motion: motion });
}

function showCharSelect(charId, charName, motion) {
  var panel = document.getElementById('char-select-panel');
  var picId = charId.substring(2, 7);

  document.getElementById('select-char-name').textContent = charName;

  var normalBtn = document.getElementById('btn-select-normal');
  var normalImg = normalBtn.querySelector('.select-btn-img');
  normalImg.src = '/texture/image_unit_harem/harem_' + picId + '.png';
  normalImg.onerror = function() { this.style.display = 'none'; };
  normalBtn.onclick = function() {
    openReader('normal', 'har_' + picId, charName + ' - Normal');
  };
  normalBtn.querySelector('.select-btn-label').textContent = t('select.normal');

  var cgBtn = document.getElementById('btn-select-cg');
  if (motion !== '无') {
    cgBtn.style.display = 'flex';
    var cgImg = cgBtn.querySelector('.select-btn-img');
    cgImg.src = '/texture/image_unit_harem_r18/harem_' + picId + '.png';
    cgImg.onerror = function() { this.style.display = 'none'; };
    cgBtn.onclick = function() {
      openReader('r18', 'har_' + picId, charName + ' - R18');
    };
    cgBtn.querySelector('.select-btn-label').textContent = t('select.r18');
  } else {
    cgBtn.style.display = 'none';
  }
}

// ─── Main Story ────────────────────────────────────────────────────────
async function loadMainStory() {
  var list = document.getElementById('story-list');
  list.innerHTML = '<div class="loading">' + t('common.loading') + '</div>';

  try {
    var res = await fetch('/api/main-story');
    var chapters = await res.json();

    if (!chapters || chapters.length === 0) {
      list.innerHTML = '<div class="empty">' + t('mainStory.empty') + '</div>';
      return;
    }

    list.innerHTML = chapters.map(function(ch) {
      var chapTxt = ch.chapter || '';
      var secTxt = ch.section || '';
      return '<div class="story-item" onclick="openReader(\'main\',\'' + ch.id + '\')">' +
        '<div class="story-item-id">' + ch.id + '</div>' +
        '<div class="story-item-title">' + chapTxt + '</div>' +
        (secTxt ? '<div class="story-item-sub">' + secTxt + '</div>' : '') +
        '</div>';
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="error">' + t('common.error') + '：' + e.message + '</div>';
  }
}

// ─── Events ────────────────────────────────────────────────────────────
async function loadEvents() {
  var grid = document.getElementById('event-grid');
  grid.innerHTML = '<div class="loading">' + t('common.loading') + '</div>';

  try {
    var res = await fetch('/api/events');
    var events = await res.json();

    if (!events || events.length === 0) {
      grid.innerHTML = '<div class="empty">' + t('events.empty') + '</div>';
      return;
    }

    grid.innerHTML = events.map(function(eId) {
      return '<div class="event-card" onclick="navigateTo(\'event-chapters\',{eventId:\'' + eId + '\'})">' +
        '<div class="event-card-id">' + eId + '</div>' +
        '<div class="event-card-title">' + t('events.view') + '</div></div>';
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div class="error">' + t('common.error') + '：' + e.message + '</div>';
  }
}

// ─── Event Chapters ────────────────────────────────────────────────────
async function loadEventChapters(eventId) {
  var list = document.getElementById('story-list');
  list.innerHTML = '<div class="loading">' + t('common.loading') + '</div>';

  if (!eventId) { list.innerHTML = '<div class="empty">' + t('common.empty') + '</div>'; return; }

  try {
    var res = await fetch('/api/event-chapters/' + eventId);
    var chapters = await res.json();

    if (!chapters || chapters.length === 0) {
      list.innerHTML = '<div class="empty">' + t('events.empty') + '</div>';
      return;
    }

    list.innerHTML = chapters.map(function(ch) {
      return '<div class="story-item" onclick="openReader(\'event\',\'' + ch.id + '\',\'' + ch.title.replace(/'/g,"\\'") + '\')">' +
        '<div class="story-item-title">' + ch.title + '</div>' +
        '<div class="story-item-id">' + ch.id + '</div></div>';
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="error">' + t('common.error') + '：' + e.message + '</div>';
  }
}

// ─── Reader ────────────────────────────────────────────────────────────
function openReader(type, id, title) {
  navigateTo('reader', { type: type, id: id, title: title || id });
}

function exitReader() {
  reader.stop();
  navigateTo('title');
}

function toggleAuto() { reader.toggleAuto(); }
function nextLine() { reader.nextLine(); }
function prevLine() { reader.prevLine(); }

// ─── Settings ──────────────────────────────────────────────────────────
// ─── Settings Persistence ─────────────────────────────────────────────
var _defaultSettings = {
  textSpeed: 40, autoDelay: 2000, fontSize: 20,
  aspectRatio: '16:9', dialogOpacity: 100
};

function loadSettings() {
  try {
    var saved = JSON.parse(localStorage.getItem('vn-settings') || '{}');
    return Object.assign({}, _defaultSettings, saved);
  } catch(e) { return Object.assign({}, _defaultSettings); }
}

function saveSettings(s) {
  localStorage.setItem('vn-settings', JSON.stringify(s));
}

function updateSettings() {
  var s = loadSettings();
  s.textSpeed = parseInt(document.getElementById('text-speed').value);
  s.autoDelay = parseInt(document.getElementById('auto-delay').value);
  s.fontSize = parseInt(document.getElementById('font-size').value);

  var ratioEl = document.querySelector('input[name="aspect-ratio"]:checked');
  if (ratioEl) s.aspectRatio = ratioEl.value;

  s.dialogOpacity = parseInt(document.getElementById('dialog-opacity').value);

  saveSettings(s);
  applySettings(s);
}

function applySettings(s) {
  if (!s) s = loadSettings();
  // Text speed label
  document.getElementById('text-speed-label').textContent =
    s.textSpeed <= 20 ? t('settings.fast') : s.textSpeed <= 50 ? t('settings.medium') : t('settings.slow');
  document.getElementById('auto-delay-label').textContent = (s.autoDelay / 1000).toFixed(1) + 's';
  document.getElementById('font-size-label').textContent = s.fontSize + 'px';
  document.getElementById('dialog-opacity-label').textContent = s.dialogOpacity + '%';

  // Apply to reader engine
  reader.updateSettings(s.textSpeed, s.autoDelay, s.fontSize);

  // Apply aspect ratio to reader background container
  var bg = document.getElementById('reader-bg').querySelector('.reader-bg-16-9');
  if (bg) {
    if (s.aspectRatio === '4:3') {
      bg.style.maxWidth = 'calc(100vh * 4 / 3)';
      bg.style.maxHeight = 'calc(100vw * 3 / 4)';
    } else {
      bg.style.maxWidth = 'calc(100vh * 16 / 9)';
      bg.style.maxHeight = 'calc(100vw * 9 / 16)';
    }
  }

  // Apply dialog opacity
  var dialog = document.getElementById('reader-dialog');
  if (dialog) {
    var alpha = (s.dialogOpacity / 100).toFixed(2);
    dialog.style.background = 'linear-gradient(to top, rgba(10,10,18,' + alpha + ') 0%, rgba(10,10,18,' + (alpha - 0.05) + ') 100%)';
  }
}

function resetSettings() {
  if (!confirm(t('settings.resetConfirm'))) return;
  saveSettings(_defaultSettings);
  // Reset UI controls
  document.getElementById('text-speed').value = _defaultSettings.textSpeed;
  document.getElementById('auto-delay').value = _defaultSettings.autoDelay;
  document.getElementById('font-size').value = _defaultSettings.fontSize;
  document.getElementById('dialog-opacity').value = _defaultSettings.dialogOpacity;
  var ratioRadio = document.querySelector('input[name="aspect-ratio"][value="' + _defaultSettings.aspectRatio + '"]');
  if (ratioRadio) ratioRadio.checked = true;
  applySettings(_defaultSettings);
}

// ─── Gallery (回忆画廊) ────────────────────────────────────────────────
var _galleryCache = null;
var _galleryPage = 1;
var _galleryPerPage = 20;

var _cgFolderIdx = -1;
var _cgFileIdx = 0;
var _cgHideTimer = null;
var _cgIsDimmed = false;

async function loadGallery() {
  var grid = document.getElementById('gallery-grid');
  var pager = document.getElementById('gallery-pager');
  grid.innerHTML = '<div class="loading">' + t('common.loading') + '</div>';
  pager.innerHTML = '';

  try {
    var first = await fetch('/api/gallery?page=1&perPage=' + _galleryPerPage);
    var meta = await first.json();

    if (!meta.folders || meta.folders.length === 0) {
      grid.innerHTML = '<div class="empty">' + t('gallery.empty') + '</div>';
      return;
    }

    var allFolders = [];
    for (var p = 1; p <= meta.totalPages; p++) {
      var r = await fetch('/api/gallery?page=' + p + '&perPage=' + _galleryPerPage);
      var d = await r.json();
      allFolders = allFolders.concat(d.folders);
    }
    _galleryCache = allFolders;

    renderGalleryPage(_galleryPage);
  } catch (e) {
    grid.innerHTML = '<div class="error">' + t('common.error') + '：' + e.message + '</div>';
  }
}

function renderGalleryPage(page) {
  var grid = document.getElementById('gallery-grid');
  var pager = document.getElementById('gallery-pager');
  if (!_galleryCache || _galleryCache.length === 0) return;

  var total = _galleryCache.length;
  var totalPages = Math.ceil(total / _galleryPerPage);
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  _galleryPage = page;

  var start = (page - 1) * _galleryPerPage;
  var pageItems = _galleryCache.slice(start, start + _galleryPerPage);

  var ar = document.querySelector('input[name="aspect-ratio"]:checked');
  var ratio = ar ? ar.value : '4:3';

  grid.innerHTML = pageItems.map(function(f, i) {
    var globalIdx = start + i;
    return '<div class="gallery-thumb" onclick="openCG(' + globalIdx + ', 0)">' +
      '<img class="thumb-img" src="' + f.thumb + '" style="aspect-ratio:' + ratio + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'">' +
      '<span class="c-badge">' + (f.type === 'video' ? 'VIDEO' : 'CG') + '</span>' +
      '<div class="thumb-name">' + esc(f.characterName || '') + '</div>' +
      '</div>';
  }).join('');

  var ph = '';
  ph += '<button class="pager-btn" onclick="gotoGalleryPage(1)"' + (page <= 1 ? ' disabled' : '') + '>«</button>';
  ph += '<button class="pager-btn" onclick="gotoGalleryPage(' + (page - 1) + ')"' + (page <= 1 ? ' disabled' : '') + '>‹</button>';
  ph += '<span class="pager-info">' + page + ' / ' + totalPages + '</span>';
  ph += '<button class="pager-btn" onclick="gotoGalleryPage(' + (page + 1) + ')"' + (page >= totalPages ? ' disabled' : '') + '>›</button>';
  ph += '<button class="pager-btn" onclick="gotoGalleryPage(' + totalPages + ')"' + (page >= totalPages ? ' disabled' : '') + '>»</button>';
  pager.innerHTML = ph;
}

function gotoGalleryPage(page) {
  if (!_galleryCache) return;
  var totalPages = Math.ceil(_galleryCache.length / _galleryPerPage);
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  renderGalleryPage(page);
}

function esc(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── CG Viewer ────────────────────────────────────────────────────────

function openCG(folderIdx, fileIdx) {
  if (!_galleryCache || folderIdx < 0 || folderIdx >= _galleryCache.length) return;

  closeCG(true);

  _cgFolderIdx = folderIdx;
  _cgFileIdx = fileIdx;

  var folder = _galleryCache[folderIdx];
  var fileList = folder.files || [];
  if (fileIdx < 0) fileIdx = 0;
  if (fileIdx >= fileList.length) fileIdx = fileList.length - 1;
  _cgFileIdx = fileIdx;

  var viewer = document.getElementById('cg-viewer');
  var slideTrack = document.getElementById('cg-slide-track');

  updateCGSlide(folder, fileIdx);
  updateCGInfo(folder, fileIdx);

  viewer.style.display = 'flex';
  slideTrack.style.transform = 'translateX(0)';

  resetCGHideTimer();
  document.addEventListener('keydown', _cgKeyHandler);
}

function updateCGSlide(folder, fileIdx) {
  var fileList = folder.files || [];
  if (fileIdx < 0 || fileIdx >= fileList.length) return;
  var fileName = fileList[fileIdx];

  var imgEl = document.getElementById('cg-image');
  var videoEl = document.getElementById('cg-video');
  var slideEl_inner = document.getElementById('cg-slide-inner');

  imgEl.style.display = 'none';
  videoEl.style.display = 'none';
  videoEl.pause();
  videoEl.removeAttribute('src');

  // Toggle HCG 4:3 class: HCG images constrained to 4:3, videos fill freely
  slideEl_inner.classList.toggle('hcg', folder.type === 'hcg');

  if (folder.type === 'video') {
    videoEl.src = '/video/' + folder.folderName + '/' + fileName;
    videoEl.style.display = 'block';
    videoEl.play().catch(function() {});
  } else {
    imgEl.src = '/texture/HCG/' + folder.folderName + '/' + fileName;
    imgEl.style.display = 'block';
  }
}

function updateCGInfo(folder, fileIdx) {
  var fileList = folder.files || [];
  var total = fileList.length;

  document.getElementById('cg-char-name').textContent = folder.characterName || '';
  document.getElementById('cg-counter').textContent = (fileIdx + 1) + ' / ' + total;

  var dotsEl = document.getElementById('cg-dots');
  dotsEl.innerHTML = '';
  for (var i = 0; i < total; i++) {
    var dot = document.createElement('span');
    dot.className = 'cg-dot' + (i === fileIdx ? ' active' : '');
    dot.setAttribute('data-idx', i);
    dot.addEventListener('click', function(e) {
      e.stopPropagation();
      var idx = parseInt(this.getAttribute('data-idx'));
      jumpCGInFolder(idx);
    });
    dotsEl.appendChild(dot);
  }
}

function jumpCGInFolder(fileIdx) {
  if (_cgFolderIdx < 0 || !_galleryCache) return;
  var folder = _galleryCache[_cgFolderIdx];
  var fileList = folder.files || [];
  if (fileIdx < 0) fileIdx = 0;
  if (fileIdx >= fileList.length) fileIdx = fileList.length - 1;
  if (fileIdx === _cgFileIdx) return;

  var dir = fileIdx > _cgFileIdx ? -1 : 1;
  var w = window.innerWidth * 0.95;
  var slideTrack = document.getElementById('cg-slide-track');

  slideTrack.style.transition = 'transform .35s cubic-bezier(.25,.46,.45,.94)';
  slideTrack.style.transform = 'translateX(' + (dir * w) + 'px)';

  setTimeout(function() {
    slideTrack.style.transition = 'none';
    slideTrack.style.transform = 'translateX(' + (-dir * w) + 'px)';

    _cgFileIdx = fileIdx;
    updateCGSlide(folder, fileIdx);
    updateCGInfo(folder, fileIdx);

    slideTrack.offsetHeight;
    slideTrack.style.transition = 'transform .35s cubic-bezier(.25,.46,.45,.94)';
    slideTrack.style.transform = 'translateX(0)';
  }, 380);

  resetCGHideTimer();
}

function prevCG() {
  if (_cgFolderIdx < 0 || !_galleryCache) return;
  var folder = _galleryCache[_cgFolderIdx];
  var fileList = folder.files || [];

  if (_cgFileIdx > 0) {
    jumpCGInFolder(_cgFileIdx - 1);
  } else {
    var prevIdx = _cgFolderIdx - 1;
    if (prevIdx < 0) prevIdx = _galleryCache.length - 1;
    var prevFolder = _galleryCache[prevIdx];
    var lastFileIdx = (prevFolder.files || []).length - 1;
    if (lastFileIdx < 0) lastFileIdx = 0;

    var w = window.innerWidth * 0.95;
    var slideTrack = document.getElementById('cg-slide-track');
    slideTrack.style.transition = 'transform .35s cubic-bezier(.25,.46,.45,.94)';
    slideTrack.style.transform = 'translateX(' + w + 'px)';

    setTimeout(function() {
      slideTrack.style.transition = 'none';
      slideTrack.style.transform = 'translateX(-' + w + 'px)';

      _cgFolderIdx = prevIdx;
      _cgFileIdx = lastFileIdx;
      updateCGSlide(prevFolder, lastFileIdx);
      updateCGInfo(prevFolder, lastFileIdx);

      slideTrack.offsetHeight;
      slideTrack.style.transition = 'transform .35s cubic-bezier(.25,.46,.45,.94)';
      slideTrack.style.transform = 'translateX(0)';
    }, 380);

    resetCGHideTimer();
  }
}

function nextCG() {
  if (_cgFolderIdx < 0 || !_galleryCache) return;
  var folder = _galleryCache[_cgFolderIdx];
  var fileList = folder.files || [];

  if (_cgFileIdx < fileList.length - 1) {
    jumpCGInFolder(_cgFileIdx + 1);
  } else {
    var nextIdx = _cgFolderIdx + 1;
    if (nextIdx >= _galleryCache.length) nextIdx = 0;
    var nextFolder = _galleryCache[nextIdx];

    var w = window.innerWidth * 0.95;
    var slideTrack = document.getElementById('cg-slide-track');
    slideTrack.style.transition = 'transform .35s cubic-bezier(.25,.46,.45,.94)';
    slideTrack.style.transform = 'translateX(-' + w + 'px)';

    setTimeout(function() {
      slideTrack.style.transition = 'none';
      slideTrack.style.transform = 'translateX(' + w + 'px)';

      _cgFolderIdx = nextIdx;
      _cgFileIdx = 0;
      updateCGSlide(nextFolder, 0);
      updateCGInfo(nextFolder, 0);

      slideTrack.offsetHeight;
      slideTrack.style.transition = 'transform .35s cubic-bezier(.25,.46,.45,.94)';
      slideTrack.style.transform = 'translateX(0)';
    }, 380);

    resetCGHideTimer();
  }
}

function closeCG(silent) {
  if (_cgHideTimer) { clearTimeout(_cgHideTimer); _cgHideTimer = null; }
  document.removeEventListener('keydown', _cgKeyHandler);

  if (!silent) {
    document.getElementById('cg-viewer').style.display = 'none';
  }

  var slideTrack = document.getElementById('cg-slide-track');
  slideTrack.style.transition = 'none';
  slideTrack.style.transform = 'translateX(0)';

  var videoEl = document.getElementById('cg-video');
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.style.display = 'none';

  document.getElementById('cg-image').style.display = 'none';

  _cgFolderIdx = -1;
  _cgFileIdx = 0;
  _cgIsDimmed = false;
}

function resetCGHideTimer() {
  if (_cgHideTimer) { clearTimeout(_cgHideTimer); _cgHideTimer = null; }

  var info = document.getElementById('cg-info');
  info.classList.remove('dim');
  info.style.opacity = '1';
  _cgIsDimmed = false;

  var uiEls = document.querySelectorAll('.cg-nav, .cg-close-btn');
  uiEls.forEach(function(n) { n.style.opacity = '1'; n.style.pointerEvents = 'auto'; });

  // Stage 1: 116ms → dim (semi-transparent, ~18% opacity)
  _cgHideTimer = setTimeout(function() {
    if (!_cgIsDimmed) {
      info.classList.add('dim');
      _cgIsDimmed = true;
    }
    uiEls.forEach(function(n) { n.style.opacity = '0.15'; n.style.pointerEvents = 'auto'; });

    // Stage 2: 1000ms more → 80% transparent (20% opacity, stays visible)
    _cgHideTimer = setTimeout(function() {
      uiEls.forEach(function(n) { n.style.opacity = '0.2'; });
      info.style.opacity = '0.2';
    }, 1000);
  }, 116);

  var viewer = document.getElementById('cg-viewer');
  viewer.onmousemove = function() {
    info.classList.remove('dim');
    info.style.opacity = '1';
    uiEls.forEach(function(n) { n.style.opacity = '1'; n.style.pointerEvents = 'auto'; });
    _cgIsDimmed = false;
    if (_cgHideTimer) { clearTimeout(_cgHideTimer); _cgHideTimer = null; }
    _cgHideTimer = setTimeout(function() {
      info.classList.add('dim');
      _cgIsDimmed = true;
      uiEls.forEach(function(n) { n.style.opacity = '0.15'; n.style.pointerEvents = 'auto'; });
      _cgHideTimer = setTimeout(function() {
        uiEls.forEach(function(n) { n.style.opacity = '0.2'; });
        info.style.opacity = '0.2';
      }, 1000);
    }, 116);
  };
}

function _cgKeyHandler(e) {
  switch (e.key) {
    case 'ArrowLeft': e.preventDefault(); prevCG(); break;
    case 'ArrowRight': e.preventDefault(); nextCG(); break;
    case 'Escape': e.preventDefault(); closeCG(); break;
  }
}

// ─── L2D Gallery (模型画廊) ───────────────────────────────────────────
var _l2dModels = [];
var _l2dIndex = -1;
var _l2dApp = null;
var _l2dModel = null;
var _l2dLoading = false;
var _l2dHideTimer = null;
var _l2dPage = 1;
var _l2dPerPage = 40;

async function loadL2DGallery() {
  var grid = document.getElementById('l2d-grid');
  var pager = document.getElementById('l2d-pager');
  grid.innerHTML = '<div class="loading">' + t('common.loading') + '</div>';
  pager.innerHTML = '';

  try {
    var res = await fetch('/api/live2d-gallery');
    var data = await res.json();
    var models = data.models || [];

    if (models.length === 0) {
      grid.innerHTML = '<div class="empty">暂无模型数据</div>';
      return;
    }

    _l2dModels = models;
    _l2dPage = 1;
    renderL2DGrid();
  } catch (e) {
    grid.innerHTML = '<div class="error">' + t('common.error') + '：' + e.message + '</div>';
  }
}

function renderL2DGrid() {
  var grid = document.getElementById('l2d-grid');
  var pager = document.getElementById('l2d-pager');
  if (!_l2dModels || _l2dModels.length === 0) {
    grid.innerHTML = '<div class="empty">暂无模型数据</div>';
    if (pager) pager.innerHTML = '';
    return;
  }

  var total = _l2dModels.length;
  var totalPages = Math.ceil(total / _l2dPerPage);
  if (_l2dPage < 1) _l2dPage = 1;
  if (_l2dPage > totalPages) _l2dPage = totalPages;

  var start = (_l2dPage - 1) * _l2dPerPage;
  var pageItems = _l2dModels.slice(start, start + _l2dPerPage);

  grid.innerHTML = pageItems.map(function(m, i) {
    var globalIdx = start + i;
    var icon = m.faceIcon || '';
    return '<div class="l2d-thumb" onclick="openL2DViewer(' + globalIdx + ')">' +
      (icon ? '<img src="' + icon + '" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="l2d-thumb-placeholder"></div>') +
      '<div class="l2d-name">' + esc(m.characterName || '') + '</div>' +
      '<div class="l2d-id">' + m.modelId + '</div>' +
      '</div>';
  }).join('');

  // Pagination
  var ph = '';
  ph += '<button class="pager-btn" onclick="gotoL2DPage(1)"' + (_l2dPage <= 1 ? ' disabled' : '') + '>«</button>';
  ph += '<button class="pager-btn" onclick="gotoL2DPage(' + (_l2dPage - 1) + ')"' + (_l2dPage <= 1 ? ' disabled' : '') + '>‹</button>';
  ph += '<span class="pager-info">' + _l2dPage + ' / ' + totalPages + '</span>';
  ph += '<button class="pager-btn" onclick="gotoL2DPage(' + (_l2dPage + 1) + ')"' + (_l2dPage >= totalPages ? ' disabled' : '') + '>›</button>';
  ph += '<button class="pager-btn" onclick="gotoL2DPage(' + totalPages + ')"' + (_l2dPage >= totalPages ? ' disabled' : '') + '>»</button>';
  pager.innerHTML = ph;
}

function gotoL2DPage(page) {
  if (!_l2dModels || !_l2dModels.length) return;
  var totalPages = Math.ceil(_l2dModels.length / _l2dPerPage);
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  _l2dPage = page;
  renderL2DGrid();
}

function openL2DViewer(idx) {
  if (!_l2dModels.length || idx < 0 || idx >= _l2dModels.length) return;

  // Close any existing model
  closeL2DModel();

  _l2dIndex = idx;
  var model = _l2dModels[idx];

  var viewer = document.getElementById('l2d-viewer');
  viewer.style.display = 'flex';

  // Update info
  document.getElementById('l2d-char-name').textContent = model.characterName || model.modelId;
  document.getElementById('l2d-counter').textContent = (idx + 1) + ' / ' + _l2dModels.length;

  // Build motion buttons
  renderL2DMotions(model);

  // Show loading
  var loadingEl = document.getElementById('l2d-loading');
  loadingEl.style.opacity = '1';

  // Load model
  loadL2DModel(model.modelId);

  // Setup auto-hide
  resetL2DHideTimer();

  // Keyboard
  document.addEventListener('keydown', _l2dKeyHandler);
}

function renderL2DMotions(model) {
  var container = document.getElementById('l2d-motions');
  var motions = model.motions || [];

  if (motions.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<button class="l2d-motion-btn active" data-motion="loop">loop</button>' +
    motions.map(function(m) {
      return '<button class="l2d-motion-btn" data-motion="' + esc(m) + '">' + esc(m) + '</button>';
    }).join('');

  // Click handler for motion buttons
  container.querySelectorAll('.l2d-motion-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var motionName = this.getAttribute('data-motion');
      // Deactivate all, activate this one
      container.querySelectorAll('.l2d-motion-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      triggerL2DMotion(motionName);
      resetL2DHideTimer();
    });
  });
}

function triggerL2DMotion(motionName) {
  if (!_l2dModel) return;
  _l2dModel.motion(motionName).catch(function() {});
}

function loadL2DModel(modelId) {
  if (_l2dLoading) return;
  _l2dLoading = true;

  var wrap = document.getElementById('l2d-canvas-wrap');
  var loadingEl = document.getElementById('l2d-loading');

  // closeL2DModel should have cleaned up, but guard just in case
  if (_l2dApp) {
    try {
      _l2dApp.stage.removeChildren();
      _l2dApp.renderer.destroy(true);
      _l2dApp.destroy(true, {children: true, texture: true});
    } catch(e) {}
    _l2dApp = null;
    _l2dModel = null;
  }

  // Always create a fresh canvas to guarantee a new WebGL context
  var oldCanvas = document.getElementById('l2d-canvas');
  if (oldCanvas && oldCanvas.parentNode) oldCanvas.parentNode.removeChild(oldCanvas);

  var canvas = document.createElement('canvas');
  canvas.id = 'l2d-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  wrap.insertBefore(canvas, loadingEl);

  var w = wrap.clientWidth || window.innerWidth * 0.95;
  var h = wrap.clientHeight || window.innerHeight * 0.9;
  if (w < 10 || h < 10) { w = 800; h = 600; }

  try {
    var app = new PIXI.Application({
      view: canvas,
      width: w,
      height: h,
      backgroundColor: 0x111122,
      transparent: false,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });
    _l2dApp = app;

    var modelUrl = '/live2d-model/' + modelId + '/model.model.json';

    PIXI.live2d.Live2DModel.from(modelUrl, { idleMotionGroup: "loop" }).then(function(m) {
      _l2dModel = m;
      m.autoUpdate = true;

      // Center the model
      m.anchor.set(0.5, 0.5);
      m.position.set(app.screen.width / 2, app.screen.height / 2);

      // Scale to fit canvas height
      var modelH = m.height || (m.internalModel ? m.internalModel.originalHeight : 2);
      if (modelH > 0) {
        var fitScale = (app.screen.height * 0.85) / modelH;
        m.scale.set(fitScale);
      }

      app.stage.addChild(m);

      // Enable mouse tracking
      m.autoInteract = true;
      if (app.renderer.plugins.interaction) {
        m.registerInteraction(app.renderer.plugins.interaction);
      }

      // Start idle motion
      m.motion("loop").catch(function() {});

      // Hide loading
      loadingEl.style.opacity = '0';
      _l2dLoading = false;

      // Activate loop button by default
      var loopBtn = document.querySelector('.l2d-motion-btn[data-motion="loop"]');
      if (loopBtn) loopBtn.classList.add('active');

    }).catch(function(err) {
      loadingEl.textContent = '加载失败: ' + err.message;
      _l2dLoading = false;
    });
  } catch(e) {
    loadingEl.textContent = '初始化失败: ' + e.message;
    _l2dLoading = false;
  }
}

function prevL2D() {
  if (!_l2dModels.length || _l2dIndex < 0) return;
  var prev = (_l2dIndex - 1 + _l2dModels.length) % _l2dModels.length;
  openL2DViewer(prev);
}

function nextL2D() {
  if (!_l2dModels.length || _l2dIndex < 0) return;
  var next = (_l2dIndex + 1) % _l2dModels.length;
  openL2DViewer(next);
}

function closeL2D() {
  document.getElementById('l2d-viewer').style.display = 'none';
  closeL2DModel();
  document.removeEventListener('keydown', _l2dKeyHandler);
  if (_l2dHideTimer) { clearTimeout(_l2dHideTimer); _l2dHideTimer = null; }
  _l2dIndex = -1;
}

function closeL2DModel() {
  // 完全销毁 PIXI Application，释放 WebGL 上下文
  if (_l2dApp) {
    try {
      _l2dApp.stage.removeChildren();
      _l2dApp.renderer.destroy(true);
      _l2dApp.destroy(true, {children: true, texture: true});
    } catch(e) {}
    _l2dApp = null;
    _l2dModel = null;
  }
  // 移除 canvas 元素
  var oldCanvas = document.getElementById('l2d-canvas');
  if (oldCanvas && oldCanvas.parentNode) {
    oldCanvas.parentNode.removeChild(oldCanvas);
  }
  _l2dLoading = false;
  var loadingEl = document.getElementById('l2d-loading');
  if (loadingEl) {
    loadingEl.textContent = '載入中...';
    loadingEl.style.opacity = '1';
  }
}

function resetL2DHideTimer() {
  if (_l2dHideTimer) { clearTimeout(_l2dHideTimer); _l2dHideTimer = null; }

  var info = document.getElementById('l2d-info');
  var motions = document.getElementById('l2d-motions');
  info.classList.remove('dim');
  motions.classList.remove('dim');
  info.style.opacity = '1';
  motions.style.opacity = '1';

  var uiEls = document.querySelectorAll('.l2d-nav, .l2d-close-btn');
  uiEls.forEach(function(n) { n.style.opacity = '1'; n.style.pointerEvents = 'auto'; });

  _l2dHideTimer = setTimeout(function() {
    info.classList.add('dim');
    motions.classList.add('dim');
    uiEls.forEach(function(n) { n.style.opacity = '0.15'; n.style.pointerEvents = 'auto'; });

    _l2dHideTimer = setTimeout(function() {
      uiEls.forEach(function(n) { n.style.opacity = '0.2'; });
      info.style.opacity = '0.2';
      motions.style.opacity = '0.2';
    }, 1000);
  }, 116);

  var viewer = document.getElementById('l2d-viewer');
  viewer.onmousemove = function() {
    info.classList.remove('dim');
    motions.classList.remove('dim');
    info.style.opacity = '1';
    motions.style.opacity = '1';
    uiEls.forEach(function(n) { n.style.opacity = '1'; n.style.pointerEvents = 'auto'; });
    if (_l2dHideTimer) { clearTimeout(_l2dHideTimer); _l2dHideTimer = null; }
    _l2dHideTimer = setTimeout(function() {
      info.classList.add('dim');
      motions.classList.add('dim');
      uiEls.forEach(function(n) { n.style.opacity = '0.15'; n.style.pointerEvents = 'auto'; });
      _l2dHideTimer = setTimeout(function() {
        uiEls.forEach(function(n) { n.style.opacity = '0.2'; });
        info.style.opacity = '0.2';
        motions.style.opacity = '0.2';
      }, 1000);
    }, 116);
  };
}

function _l2dKeyHandler(e) {
  switch (e.key) {
    case 'ArrowLeft': e.preventDefault(); prevL2D(); break;
    case 'ArrowRight': e.preventDefault(); nextL2D(); break;
    case 'Escape': e.preventDefault(); closeL2D(); break;
  }
}

// ─── Keyboard ──────────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (!document.getElementById('screen-reader').classList.contains('active')) return;

  switch (e.key) {
    case ' ':
      e.preventDefault(); reader.toggleUI(); break;
    case 'Enter': e.preventDefault(); reader.onClick(); break;
    case 'ArrowDown': e.preventDefault(); reader.nextLine(); break;
    case 'ArrowUp': e.preventDefault(); reader.prevLine(); break;
    case 'a': case 'A': reader.toggleAuto(); break;
    case 'Escape': readerBack(); break;
  }
});

// ─── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('.reader-dialog').addEventListener('click', function(e) {
    if (e.target.closest('.reader-controls')) return;
    reader.onClick();
  });
  // Apply saved language
  applyTranslations();
  // Set radio button to saved language
  var radio = document.querySelector('input[name="lang"][value="' + _lang + '"]');
  if (radio) radio.checked = true;
  // Load saved settings and apply
  var saved = loadSettings();
  document.getElementById('text-speed').value = saved.textSpeed;
  document.getElementById('auto-delay').value = saved.autoDelay;
  document.getElementById('font-size').value = saved.fontSize;
  document.getElementById('dialog-opacity').value = saved.dialogOpacity;
  var ratioRadio = document.querySelector('input[name="aspect-ratio"][value="' + saved.aspectRatio + '"]');
  if (ratioRadio) ratioRadio.checked = true;
  applySettings(saved);
});