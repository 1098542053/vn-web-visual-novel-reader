/**
 * Visual Novel Reader Engine
 * 支持 Live2D 动画、BGM、语音、逐字显示
 */
var VR = (function() {
  "use strict";

  var audioUnlocked = false;

  var lines = [];
  var lineIdx = 0;
  var isAuto = false;
  var autoTimer = null;
  var textTimer = null;
  var skipHoldTimer = null;
  var _skipActive = false;
  var _autoPendingVoice = false;

  var settings = { textSpeed: 40, autoDelay: 2000, fontSize: 20 };
  var currentType = '';
  var currentId = '';
  // Scene object management (prefab, gameobject)
  var _objects = {};
  // Fade overlay
  var _fadeOverlay = null;
  // Title overlay
  var _titleOverlay = null;
  var _titleTimer = null;
  // Dialog history for review
  var _dialogHistory = [];
  // UI hidden state (for CG appreciation)
  var _uiHidden = false;

  // ── 兼容旧版 app.js API ──
  function stop() { exitReader(); }
  function play(type, id, title) {
    unlockAudio();
    currentType = type;
    currentId = id;
    var path;
    if (type === 'main') path = '/scenario/main/' + id + '.txt';
    else if (type === 'event') path = '/scenario/Event/' + id + '.txt';
    else if (type === 'r18') path = '/scenario/R18/' + id + '.txt';
    else path = '/scenario/Normal/' + id + '.txt';
    loadScenario(path);
  }
  function onClick() { nextLine(); }

  function loadScenario(filePath) {
    if (!filePath) return;
    isAuto = false;
    _skipActive = false;
    if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
    _autoPendingVoice = false;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (textTimer) { clearInterval(textTimer); textTimer = null; }
    _dialogHistory = [];
    document.getElementById('reader-title').textContent = filePath.split('/').pop();
    fetch(filePath)
      .then(function(r) { if (!r.ok) throw Error('HTTP ' + r.status); return r.text(); })
      .then(function(text) {
        lines = text.split(/\r?\n/).filter(function(l) { return l.trim() && !l.startsWith('//'); });
        lineIdx = 0;
        showLine();
      })
      .catch(function(e) { console.error('Scenario load error:', e); });
  }

  function showLine() {
    if (lineIdx >= lines.length) { exitReader(); if (typeof window.exitReader === 'function') window.exitReader(); return; }
    if (_skipActive) { processLine(); return; }
    processLine();
  }

  function processLine() {
    var line = lines[lineIdx] || '';
    lineIdx++;
    if (!line.trim() || line.startsWith('//')) { showLine(); return; }

    if (line.indexOf(',') > 0 || /^(titleclear|bgmstop|loopsestop|mainendof|stopmovie)$/i.test(line.trim())) {
      var a = line.split(',');
      var cmd = a[0].trim().toLowerCase();

      switch (cmd) {
        case 'bg': {
          var bg = a[1];
          if (bg) {
            var img = document.getElementById('reader-bg-img');
            img.src = '/texture/BG/' + bg + '.png';
            img.style.display = 'block';
            img._bgFallbacks = 0;
            img.onerror = function() {
              this._bgFallbacks = (this._bgFallbacks || 0) + 1;
              if (this._bgFallbacks === 1) {
                // Second try: CG folder
                this.src = '/cg/' + bg + '.png';
              } else if (this._bgFallbacks === 2) {
                // Third try: HCG folder (detect evXXXXX_YY pattern)
                var m = bg.match(/^(ev\d+)_(\d+)$/);
                if (m) {
                  this.src = '/texture/HCG/' + m[1] + '/' + bg + '.png';
                } else {
                  this.style.display = 'none';
                }
              } else {
                this.style.display = 'none';
              }
            };
          }
          break;
        }
        case 'cg': {
          var cg = a[1];
          if (cg) {
            document.getElementById('reader-bg-img').src = '/cg/' + cg + '.png';
            document.getElementById('reader-bg-img').style.display = 'block';
          }
          break;
        }
        case 'bgcolor': {
          var r = parseFloat(a[1]) || 0, g = parseFloat(a[2]) || 0, b = parseFloat(a[3]) || 0;
          var el = document.getElementById('reader-bg-color');
          if (el) el.style.background = 'rgb(' + (r*255|0) + ',' + (g*255|0) + ',' + (b*255|0) + ')';
          break;
        }

        // ── Fade / ColorFade ──
        case 'fade': {
          // fade,out|in,black|white,duration
          var dir = a[1], color = a[2] || 'black', dur = (parseFloat(a[3]) || 0.5) * 1000;
          doFade(dir, color, dur);
          break;
        }
        case 'colorfade': {
          // colorfade,out|in,duration,r,g,b,1
          var dir = a[1], dur = (parseFloat(a[2]) || 0.5) * 1000;
          var r = parseFloat(a[3]) || 0, g = parseFloat(a[4]) || 0, b = parseFloat(a[5]) || 0;
          doFade(dir, 'rgb(' + (r*255|0) + ',' + (g*255|0) + ',' + (b*255|0) + ')', dur);
          break;
        }

        // ── Prefab / Object ──
        case 'prefab': {
          // prefab,NAME,templateName,x,y,sx,sy,flip,layer
          var objName = a[1], tmpl = a[2];
          if (objName && tmpl) loadPrefab(objName, tmpl, parseFloat(a[3]) || 0, parseFloat(a[4]) || 0);
          break;
        }
        case 'objectdelete': {
          var objName = a[1];
          if (objName) deleteObject(objName);
          break;
        }
        case 'gameobject': {
          // gameobject,Obj_01,x,y
          var objName = a[1], x = parseFloat(a[2]) || 0, y = parseFloat(a[3]) || 0;
          if (objName) createGameObject(objName, x, y);
          break;
        }
        case 'texture': {
          // texture,Obj_01,textureName,duration  OR  texture,Obj_01,-1,duration (hide)
          var objName = a[1], texName = a[2], dur = parseFloat(a[3]) || 0;
          if (objName && texName) setObjectTexture(objName, texName, dur);
          break;
        }

        // ── Shake / Jump ──
        case 'shake': {
          // shake,slotName,intensity,duration,count
          var slot = a[1], intensity = parseFloat(a[2]) || 10, dur = parseFloat(a[3]) || 0.05, count = parseInt(a[4]) || 1;
          doShake(slot, intensity, dur, count);
          break;
        }
        case 'jump': {
          // jump,slotName,intensity,duration,count
          var slot = a[1], intensity = parseFloat(a[2]) || 10, dur = parseFloat(a[3]) || 0.05, count = parseInt(a[4]) || 1;
          doJump(slot, intensity, dur, count);
          break;
        }
        case 'shakeall': {
          // shakeall,intensityX,intensityY,duration,interval
          var ix = parseFloat(a[1]) || 10, iy = parseFloat(a[2]) || 10;
          var dur = (parseFloat(a[3]) || 0.5) * 1000, interval = (parseFloat(a[4]) || 0.05) * 1000;
          doShakeAll(ix, iy, dur, interval);
          break;
        }

        // ── Title ──
        case 'title': {
          // title,chapterName,sectionName
          showTitle(a[1] || '', a[2] || '');
          break;
        }
        case 'titleclear': {
          hideTitle();
          break;
        }

        // ── Live2D ──
        case 'live2d': {
          var modelId = a[1], slotName = a[2], x = parseFloat(a[3]), y = parseFloat(a[4]), sx = parseFloat(a[5]), sy = parseFloat(a[6]);
          if (Live2DRenderer && Live2DRenderer.load) Live2DRenderer.load(slotName, modelId, x, y, sx, sy);
          break;
        }
        case 'live2dload': {
          // live2dload,modelId,slotName (simpler version, no pos/scale)
          var modelId = a[1], slotName = a[2];
          if (Live2DRenderer && Live2DRenderer.load) Live2DRenderer.load(slotName, modelId, 0, 0, 1, 1);
          break;
        }
        case 'live2dmotion': {
          var slotName = a[1], motionName = a[2], loopFlag = a[3] || 'off';
          if (Live2DRenderer && Live2DRenderer.motion) Live2DRenderer.motion(slotName, motionName, loopFlag);
          break;
        }
        case 'live2ddelete': {
          var slotName = a[1];
          if (Live2DRenderer && Live2DRenderer.remove) Live2DRenderer.remove(slotName);
          break;
        }
        case 'live2dmove': {
          var slotName = a[1], x = parseFloat(a[2]), y = parseFloat(a[3]), dur = parseFloat(a[4]) || 0;
          if (Live2DRenderer && Live2DRenderer.move) Live2DRenderer.move(slotName, x, y, dur);
          break;
        }

        // ── Audio ──
        case 'bgmplay': { if (a[1]) playAudio('bgm-player', '/bgm/' + a[1] + '.ogg', true); break; }
        case 'bgmstop': { stopAudio('bgm-player'); break; }
        case 'seplay': { if (a[1]) playAudio('se-player', '/se/' + a[1] + '.ogg', false); break; }
        case 'loopsestop': { stopAudio('se-player'); break; }

        case 'window': {
          document.getElementById('reader-dialog').style.display = a[1] === 'off' ? 'none' : 'block';
          break;
        }

        case 'wait': { scheduleNext((parseFloat(a[1]) || 1) * 1000); return; }

        case 'message': {
          var speaker = a[1] || '';
          var text = a.slice(2, a.length - 1).join(',');
          var faceIcon = a[a.length - 1] || '';
          displayMessage(speaker, text || '', faceIcon);
          if (isAuto) scheduleNext(calcAutoDelay(text||'') + 116);
          return;
        }
        case 'msgvoicesync': {
          var speaker = a[2] || '';
          var text = a.slice(3, a.length - 2).join(',');
          var faceIcon = a[a.length - 2] || '';
          var voiceName = a[a.length - 1] || '';
          displayMessage(speaker, text, faceIcon, voiceName);
          if (voiceName) {
            _autoPendingVoice = isAuto;
            playVoice(voiceName);
          }
          if (isAuto && !voiceName) scheduleNext(calcAutoDelay(text||'') + 116);
          return;
        }
        case 'voice': {
          if (a[1]) {
            _autoPendingVoice = isAuto;
            playVoice(a[1]);
            // Update last history entry with voice name
            if (_dialogHistory.length > 0 && !_dialogHistory[_dialogHistory.length - 1].voiceName) {
              _dialogHistory[_dialogHistory.length - 1].voiceName = a[1];
            }
          }
          if (isAuto && !a[1]) scheduleNext(calcAutoDelay((document.getElementById('dialog-text')||{}).dataset.fullText||'') + 116);
          break;
        }

        // ── Video ──
        case 'playmovie': {
          var movieName = a[1], loopFlag = a[2] || '';
          playMovie(currentId, movieName, loopFlag);
          break;
        }
        case 'stopmovie': {
          stopMovie();
          break;
        }

        case 'endof': { exitReader(); if (typeof window.exitReader === 'function') window.exitReader(); return; }
        case 'mainendof': { /* Chapter end marker - handled gracefully */ break; }
        case 'textsize': {
          var ts = parseInt(a[1]) || 20;
          var te = document.getElementById('dialog-text');
          if (te) te.style.fontSize = ts + 'px';
          break;
        }
        default: break;
      }
      showLine();
    } else {
      displayMessage('', line, '');
    }
  }

  /**
   * 将文本拆分为可逐字显示的片段，保留 HTML 标签（如 <br>）不被拆分
   */
  function splitTextPreservingTags(text) {
    if (!text) return [];
    var parts = [];
    var i = 0;
    while (i < text.length) {
      if (text[i] === '<') {
        var end = text.indexOf('>', i);
        if (end >= 0) {
          // Found an HTML tag - keep it as one unit
          parts.push(text.substring(i, end + 1));
          i = end + 1;
          continue;
        }
      }
      parts.push(text[i]);
      i++;
    }
    return parts;
  }

  function displayMessage(speaker, text, faceIcon, voiceName) {
    document.getElementById('dialog-name').textContent = speaker || '';
    var textEl = document.getElementById('dialog-text');
    textEl.innerHTML = '';
    // Normalize <br> to HTML line break for proper display
    // 将 Unicode 省略号 … 替换为三个点，因为 DOS 字体不支持该字符
    var displayText = (text || '').replace(/\u2026/g, '...');
    textEl.dataset.fullText = displayText;

    // Record in dialog history (lineIdx-1 because lineIdx already incremented in processLine)
    _dialogHistory.push({
      speaker: speaker,
      text: displayText,
      faceIcon: faceIcon || '',
      voiceName: voiceName || '',
      lineIdx: lineIdx - 1
    });

    var head = document.getElementById('dialog-headicon');
    if (faceIcon && faceIcon.startsWith('fc')) {
      head.src = '/texture/chara_icon_image/' + faceIcon + '.png';
      head.style.display = 'block';
      head.onerror = function() { this.style.display = 'none'; };
    } else { head.style.display = 'none'; }

    if (textTimer) clearInterval(textTimer);
    if (_skipActive || settings.textSpeed >= 90) {
      textEl.innerHTML = displayText;
      return;
    }

    // Split text preserving HTML tags like <br>
    var chars = splitTextPreservingTags(displayText);
    var idx = 0;
    textTimer = setInterval(function() {
      if (idx < chars.length) {
        textEl.innerHTML += chars[idx];
        idx++;
      } else {
        clearInterval(textTimer);
        textTimer = null;
      }
    }, Math.max(10, 100 - settings.textSpeed));
  }

  function playAudio(id, src, loop) {
    var el = document.getElementById(id) || (function() {
      var e = document.createElement('audio'); e.id = id; document.body.appendChild(e); return e;
    })();
    el.src = src; el.loop = !!loop; el.volume = 0.5;

    // Ensure audio context is unlocked (user gesture required)
    if (!audioUnlocked) { unlockAudio(); }

    var playPromise = el.play();
    if (playPromise) {
      playPromise.then(function() {
        // Voice-ended auto-advance for auto mode
        if (id === 'voice-player' && _autoPendingVoice) {
          _autoPendingVoice = false;
          el.addEventListener('ended', function onEnd() {
            el.removeEventListener('ended', onEnd);
            if (isAuto && !_skipActive) scheduleNext(116);
          });
        }
      }).catch(function(e) {
        console.warn('Audio blocked (' + src + '):', e.message);
        // Retry once after user gesture
        var retryHandler = function() {
          el.play().catch(function(e2) { console.warn('Audio retry failed:', e2.message); });
          document.removeEventListener('click', retryHandler);
          document.removeEventListener('touchstart', retryHandler);
        };
        document.addEventListener('click', retryHandler);
        document.addEventListener('touchstart', retryHandler);
      });
    }
  }

  function stopAudio(id) {
    var el = document.getElementById(id);
    if (el) { el.pause(); el.currentTime = 0; }
  }

  function playVoice(name) {
    if (!name) return;
    var typeDir = 'Normal';
    if (currentType === 'main') typeDir = 'main';
    else if (currentType === 'r18') typeDir = 'R18';
    else if (currentType === 'event') typeDir = 'Event';
    var candidates = [
      '/voice/' + typeDir + '/' + currentId + '/' + name + '.ogg',
      '/voice/' + typeDir + '/' + currentId + '/' + name.replace(/_(i_men|men)$/, '') + '.ogg',
      '/voice/' + name + '.ogg',
      '/voice/' + name.replace(/_(i_men|men)$/, '') + '.ogg'
    ];
    tryPath(0);
    function tryPath(idx) {
      if (idx >= candidates.length) {
        console.warn('Voice not found:', name);
        if (_autoPendingVoice) {
          _autoPendingVoice = false;
          if (isAuto && !_skipActive) scheduleNext(calcAutoDelay((document.getElementById('dialog-text')||{}).dataset.fullText||'') + 116);
        }
        return;
      }
      var xhr = new XMLHttpRequest();
      xhr.open('HEAD', candidates[idx], true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            playAudio('voice-player', candidates[idx], false);
          } else {
            tryPath(idx + 1);
          }
        }
      };
      xhr.send();
    }
  }

  function playMovie(scenarioId, movieName, loopFlag) {
    if (!movieName) return;
    var url = '/video/' + scenarioId + '/' + movieName + '.webm';
    var el = document.getElementById('movie-player');
    if (!el) {
      el = document.createElement('video');
      el.id = 'movie-player';
      el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2';
      var container = document.querySelector('.reader-bg-16-9') || document.getElementById('reader-bg');
      container.appendChild(el);
    }
    el.src = url;
    el.loop = loopFlag === 'loop';
    el.muted = false;
    el.style.display = 'block';
    el.play().catch(function(e) { console.warn('Movie play failed:', e.message); });
  }

  function stopMovie() {
    var el = document.getElementById('movie-player');
    if (el) { el.pause(); el.currentTime = 0; el.style.display = 'none'; }
  }

  function scheduleNext(delay) {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(function() { autoTimer = null; showLine(); }, delay);
  }

  // ── Audio unlock: call on first user interaction ──
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // Create a silent AudioContext to unlock audio on iOS/Chrome
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
    } catch(e) {}
    // Remove listeners after unlock
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  }

  // Install unlock listener on first user gesture
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  // ── 控制 ──
  function nextLine() {
    unlockAudio();
    if (textTimer) {
      clearInterval(textTimer); textTimer = null;
      document.getElementById('dialog-text').innerHTML = document.getElementById('dialog-text').dataset.fullText || '';
      return;
    }
    if (isAuto) {
      // Cancel current auto timer - next line will set new timing
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    }
    showLine();
  }
  function prevLine() {
    if (lineIdx <= 1) return;
    // Clean up current state
    if (textTimer) { clearInterval(textTimer); textTimer = null; }
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
    _skipActive = false;
    _autoPendingVoice = false;
    stopAudio('voice-player');
    stopMovie();
    // Reset dialog UI
    document.getElementById('dialog-name').textContent = '';
    document.getElementById('dialog-text').innerHTML = '';
    document.getElementById('dialog-text').dataset.fullText = '';
    var head = document.getElementById('dialog-headicon');
    if (head) head.style.display = 'none';
    // Search backward for the previous message/msgvoicesync/plain-text line
    var idx = lineIdx - 2;
    while (idx >= 0) {
      var line = lines[idx];
      if (!line.trim()) { idx--; continue; }
      var parts = line.split(',');
      var cmd = parts[0].trim().toLowerCase();
      if (cmd === 'message' || cmd === 'msgvoicesync' || line.indexOf(',') < 0) {
        break;
      }
      idx--;
    }
    if (idx < 0) return;
    lineIdx = idx;
    showLine();
  }
  function toggleAuto() {
    isAuto = !isAuto;
    document.getElementById('btn-auto').classList.toggle('active', isAuto);
    if (isAuto) {
      // If currently on a line with full text displayed, advance after voice or default delay
      var vp = document.getElementById('voice-player');
      if (vp && !vp.paused && !vp.ended && vp.currentTime > 0) {
        vp.addEventListener('ended', function onEnd() {
          vp.removeEventListener('ended', onEnd);
          if (isAuto && !_skipActive) scheduleNext(116);
        });
      } else {
        scheduleNext(calcAutoDelay((document.getElementById('dialog-text')||{}).dataset.fullText||'') + 116);
      }
    } else {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      _autoPendingVoice = false;
    }
  }

  // ── Calculate auto-advance delay based on displayed text byte length ──
  function byteLength(str) {
    if (!str) return 0;
    var len = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) len += 1;
      else if (c < 0x800) len += 2;
      else if (c < 0xD800 || c >= 0xE000) len += 3;
      else { i++; len += 4; }
    }
    return len;
  }
  function isPunctuationCode(c) {
    // CJK Symbols and Punctuation
    if (c >= 0x3000 && c <= 0x303F) return true;
    // Fullwidth Forms
    if (c >= 0xFF00 && c <= 0xFFEF) return true;
    // Vertical Forms
    if (c >= 0xFE10 && c <= 0xFE1F) return true;
    // CJK Compatibility Forms
    if (c >= 0xFE30 && c <= 0xFE4F) return true;
    // ASCII punctuation
    if (c >= 0x21 && c <= 0x2F) return true;
    if (c >= 0x3A && c <= 0x40) return true;
    if (c >= 0x5B && c <= 0x60) return true;
    if (c >= 0x7B && c <= 0x7E) return true;
    // Space
    if (c === 0x20) return true;
    return false;
  }
  function calcAutoDelay(str) {
    if (!str) return 1000;
    var len = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      // Skip punctuation characters
      if (isPunctuationCode(c)) continue;
      if (c < 0x80) len += 1;
      else if (c < 0x800) len += 2;
      else if (c < 0xD800 || c >= 0xE000) len += 3;
      else { i++; len += 4; }
    }
    return Math.max(1000, Math.min(len * 60, 10000));
  }

  // ════════════════════════════════════════════════════════════════
  // Fade / ColorFade helpers
  // ════════════════════════════════════════════════════════════════
  function getFadeOverlay() {
    if (!_fadeOverlay || !_fadeOverlay.parentNode) {
      _fadeOverlay = document.createElement('div');
      _fadeOverlay.id = 'fade-overlay';
      _fadeOverlay.style.cssText = 'position:absolute;inset:0;z-index:10;pointer-events:none;transition:opacity ' +
        'linear;background:#000;opacity:0;display:none';
      var container = document.querySelector('.reader-bg-16-9') || document.getElementById('reader-bg');
      if (container) container.appendChild(_fadeOverlay);
    }
    return _fadeOverlay;
  }
  function doFade(dir, color, durationMs) {
    var el = getFadeOverlay();
    if (!el) return;
    el.style.background = color === 'white' ? '#fff' : color;
    el.style.transitionDuration = durationMs + 'ms';
    el.style.display = 'block';
    if (dir === 'out') {
      el.style.opacity = '0';
      // Force reflow then start fade
      el.offsetHeight;
      el.style.opacity = '1';
    } else {
      el.style.opacity = '1';
      el.offsetHeight;
      el.style.opacity = '0';
      setTimeout(function() { el.style.display = 'none'; }, durationMs + 50);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Prefab / Object helpers
  // ════════════════════════════════════════════════════════════════
  function loadPrefab(objName, templateName, x, y) {
    // Try to load environ texture from effect/ or BG/ directory
    var img = document.getElementById('reader-bg-img');
    // Store in objects registry
    _objects[objName] = { type: 'prefab', template: templateName };
    // Try to find matching image in several directories
    var paths = [
      '/texture/effect/' + templateName + '.png',
      '/texture/BG/' + templateName + '.png',
      '/texture/' + templateName + '.png'
    ];
    tryPrefabLoad(img, paths, 0);
  }
  function tryPrefabLoad(img, paths, idx) {
    if (idx >= paths.length) return;
    // Need to use a new Image to test existence
    var test = new Image();
    test.onload = function() {
      img.src = paths[idx];
      img.style.display = 'block';
    };
    test.onerror = function() {
      tryPrefabLoad(img, paths, idx + 1);
    };
    test.src = paths[idx];
  }
  function deleteObject(objName) {
    if (!objName) return;
    delete _objects[objName];
    // If it matches BACKENV prefix, clear bg
    if (objName.indexOf('BACKENV') === 0 || objName.indexOf('Env') >= 0) {
      document.getElementById('reader-bg-img').style.display = 'none';
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Game Object helpers (gameobject + texture commands)
  // ════════════════════════════════════════════════════════════════
  function createGameObject(objName, x, y) {
    var el = document.getElementById('obj-' + objName);
    if (!el) {
      el = document.createElement('img');
      el.id = 'obj-' + objName;
      el.style.cssText = 'position:absolute;z-index:5;opacity:0;transition:opacity 0.25s linear;pointer-events:none';
      var container = document.querySelector('.reader-bg-16-9') || document.getElementById('reader-bg');
      if (container) container.appendChild(el);
    }
    el.style.left = x + 'px';
    el.style.bottom = y + 'px';
    el.style.display = 'block';
    _objects[objName] = { type: 'gameobject', el: el };
  }
  function setObjectTexture(objName, texName, duration) {
    var obj = _objects[objName];
    if (!obj) return;
    var el = obj.el;
    if (!el) {
      el = document.getElementById('obj-' + objName);
      if (!el) return;
      obj.el = el;
    }
    if (texName === '-1') {
      // Hide with fade
      el.style.opacity = '0';
      setTimeout(function() { el.style.display = 'none'; }, (duration || 0.25) * 1000 + 50);
      return;
    }
    // Search for texture in various directories
    var paths = [
      '/texture/chara_top_image/' + texName + '.png',
      '/texture/cg/' + texName + '.png',
      '/texture/' + texName + '.png'
    ];
    var tryIdx = 0;
    function tryNext() {
      if (tryIdx >= paths.length) return;
      var test = new Image();
      test.onload = function() { el.src = paths[tryIdx]; el.style.display = 'block'; el.style.opacity = '1'; };
      test.onerror = function() { tryIdx++; tryNext(); };
      test.src = paths[tryIdx];
    }
    tryNext();
  }

  // ════════════════════════════════════════════════════════════════
  // Shake / Jump helpers
  // ════════════════════════════════════════════════════════════════
  function doShake(slotName, intensity, duration, count) {
    // For Live2D shake - find the live2d canvas/slot
    var target = findLive2DSlot(slotName);
    if (!target) return;
    var origTransform = target.style.transform || '';
    var cx = 0, cy = 0;
    var shakes = 0;
    var interval = setInterval(function() {
      if (shakes >= count * 2) {
        clearInterval(interval);
        target.style.transform = origTransform;
        return;
      }
      var ox = (Math.random() * 2 - 1) * intensity;
      var oy = (Math.random() * 2 - 1) * intensity;
      target.style.transform = origTransform + ' translate(' + ox + 'px,' + oy + 'px)';
      shakes++;
    }, duration * 1000);
  }
  function doJump(slotName, intensity, duration, count) {
    var target = findLive2DSlot(slotName);
    if (!target) return;
    var origTransform = target.style.transform || '';
    var jumps = 0;
    var goingUp = true;
    var interval = setInterval(function() {
      if (jumps >= count * 2) {
        clearInterval(interval);
        target.style.transform = origTransform;
        return;
      }
      if (goingUp) {
        target.style.transform = origTransform + ' translateY(' + (-intensity) + 'px)';
      } else {
        target.style.transform = origTransform + ' translateY(0px)';
      }
      goingUp = !goingUp;
      jumps++;
    }, duration * 1000);
  }
  function doShakeAll(intensityX, intensityY, durationMs, intervalMs) {
    var container = document.querySelector('.reader-bg-16-9') || document.getElementById('reader-bg');
    if (!container) return;
    var origTransform = container.style.transform || '';
    var startTime = Date.now();
    var timer = setInterval(function() {
      var elapsed = Date.now() - startTime;
      if (elapsed >= durationMs) {
        clearInterval(timer);
        container.style.transform = origTransform;
        return;
      }
      var ox = (Math.random() * 2 - 1) * intensityX;
      var oy = (Math.random() * 2 - 1) * intensityY;
      container.style.transform = 'translate(' + ox + 'px,' + oy + 'px)';
    }, intervalMs);
  }
  function findLive2DSlot(slotName) {
    // Try to find the live2d canvas associated with this slot
    // The pixi-live2d-display renders into a canvas inside the reader-sprite or reader-area
    var spriteArea = document.getElementById('reader-sprite');
    if (spriteArea) {
      var canvas = spriteArea.querySelector('canvas');
      if (canvas) return canvas;
    }
    var area = document.getElementById('reader-area');
    if (area) {
      var canvas = area.querySelector('canvas');
      if (canvas) return canvas;
    }
    // Fallback: find any canvas in reader-bg
    var bg = document.getElementById('reader-bg');
    if (bg) {
      var canvas = bg.querySelector('canvas');
      if (canvas) return canvas;
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════
  // Title helpers
  // ════════════════════════════════════════════════════════════════
  function getTitleOverlay() {
    if (!_titleOverlay || !_titleOverlay.parentNode) {
      _titleOverlay = document.createElement('div');
      _titleOverlay.id = 'title-overlay';
      _titleOverlay.style.cssText = 'position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;background:rgba(0,0,0,0.85);opacity:0;transition:opacity 0.5s;' +
        'pointer-events:none;color:#fff;font-family:inherit;text-align:center';
      _titleOverlay.innerHTML = '<div id="title-chapter" style="font-size:1.8rem;letter-spacing:0.15em;margin-bottom:1rem;text-shadow:0 0 20px rgba(200,180,255,0.5)"></div>' +
        '<div id="title-section" style="font-size:1.2rem;letter-spacing:0.1em;opacity:0.7"></div>';
      var container = document.querySelector('.reader-bg-16-9') || document.getElementById('reader-bg');
      if (container) container.appendChild(_titleOverlay);
    }
    return _titleOverlay;
  }
  function showTitle(chapterName, sectionName) {
    var el = getTitleOverlay();
    if (!el) return;
    if (_titleTimer) { clearTimeout(_titleTimer); _titleTimer = null; }
    document.getElementById('title-chapter').textContent = chapterName || '';
    document.getElementById('title-section').textContent = sectionName || '';
    el.style.display = 'flex';
    el.offsetHeight;
    el.style.opacity = '1';
    // Auto-hide after 3 seconds
    _titleTimer = setTimeout(function() {
      el.style.opacity = '0';
      setTimeout(function() { el.style.display = 'none'; }, 600);
      _titleTimer = null;
    }, 3000);
  }
  function hideTitle() {
    var el = _titleOverlay;
    if (!el) return;
    if (_titleTimer) { clearTimeout(_titleTimer); _titleTimer = null; }
    el.style.opacity = '0';
    setTimeout(function() { el.style.display = 'none'; }, 600);
  }

  // ── Hold-to-skip: press and hold to fast forward, release to stop ──
  function initSkipHold() {
    var btn = document.getElementById('btn-skip');
    if (!btn) return;

    function beginSkip() {
      if (_skipActive) return;
      _skipActive = true;
      btn.classList.add('active');
      // Fill current text immediately
      var te = document.getElementById('dialog-text');
      if (te && te.dataset.fullText) te.innerHTML = te.dataset.fullText;
      if (textTimer) { clearInterval(textTimer); textTimer = null; }
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      // Small hold threshold then start rapid advance
      skipHoldTimer = setTimeout(function() {
        skipHoldTimer = null;
        doSkipAdvance();
      }, 200);
    }

    function doSkipAdvance() {
      if (!_skipActive) return;
      if (lineIdx >= lines.length) { endSkip(); return; }
      processLine();
      if (_skipActive) {
        skipHoldTimer = setTimeout(doSkipAdvance, 50);
      }
    }

    function endSkip() {
      if (!_skipActive && !skipHoldTimer) return;
      _skipActive = false;
      btn.classList.remove('active');
      if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
    }

    btn.addEventListener('mousedown', function(e) { e.preventDefault(); beginSkip(); });
    btn.addEventListener('mouseup', endSkip);
    btn.addEventListener('mouseleave', endSkip);
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); beginSkip(); }, {passive: false});
    btn.addEventListener('touchend', endSkip);
    btn.addEventListener('touchcancel', endSkip);
  }
  function exitReader() {
    isAuto = false;
    _skipActive = false;
    _autoPendingVoice = false;
    if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (textTimer) { clearInterval(textTimer); textTimer = null; }
    if (_titleTimer) { clearTimeout(_titleTimer); _titleTimer = null; }
    if (Live2DRenderer && Live2DRenderer.clearAll) Live2DRenderer.clearAll();
    ['bgm-player','se-player','voice-player'].forEach(function(id) {
      var e = document.getElementById(id);
      if (e) { e.pause(); e.currentTime = 0; }
    });
    stopMovie();
    // Clean up overlays
    _objects = {};
    if (_fadeOverlay && _fadeOverlay.parentNode) { _fadeOverlay.style.opacity = '0'; _fadeOverlay.style.display = 'none'; }
    if (_titleOverlay && _titleOverlay.parentNode) { _titleOverlay.style.opacity = '0'; _titleOverlay.style.display = 'none'; }
    // 清除 BG 和对话残留，避免重新进入时闪烁
    var bgImg = document.getElementById('reader-bg-img');
    if (bgImg) { bgImg.src = ''; bgImg.style.display = 'none'; }
    document.getElementById('dialog-name').textContent = '';
    document.getElementById('dialog-text').innerHTML = '';
    document.getElementById('dialog-text').dataset.fullText = '';
    // 清除 Live2D canvas 的显示
    document.querySelectorAll('.l2d-cv').forEach(function(cv) { cv.style.display = 'none'; });
  }
  function updateSettings(speed, delay, fontSize) {
    if (typeof speed === 'object') {
      var o = speed;
      if (o.textSpeed !== undefined) speed = o.textSpeed;
      if (o.autoDelay !== undefined) delay = o.autoDelay;
      if (o.fontSize !== undefined) fontSize = o.fontSize;
    }
    if (speed !== undefined) settings.textSpeed = speed;
    if (delay !== undefined) settings.autoDelay = delay;
    if (fontSize !== undefined) {
      settings.fontSize = fontSize;
      document.getElementById('dialog-text').style.fontSize = fontSize + 'px';
    }
  }

  function getHistory() {
    return _dialogHistory;
  }

  function replayVoice(voiceName) {
    if (voiceName) playVoice(voiceName);
  }

  var _uiShowHandler = null; // 用于隐藏UI后的点击恢复监听器

  function toggleUI() {
    _uiHidden = !_uiHidden;
    var el = document.getElementById('screen-reader');
    if (_uiHidden) {
      el.classList.add('reader-ui-hidden');
      // 点击任意画面重新显示 UI（延迟绑定，避免被同一个冒泡事件触发）
      _uiShowHandler = function() {
        el.classList.remove('reader-ui-hidden');
        _uiHidden = false;
        if (_uiShowHandler) {
          el.removeEventListener('click', _uiShowHandler);
          _uiShowHandler = null;
        }
      };
      setTimeout(function() { el.addEventListener('click', _uiShowHandler); }, 0);
    } else {
      el.classList.remove('reader-ui-hidden');
      if (_uiShowHandler) {
        el.removeEventListener('click', _uiShowHandler);
        _uiShowHandler = null;
      }
    }
  }

  function isUiHidden() { return _uiHidden; }

  function jumpToLine(idx) {
    if (idx < 0 || idx >= lines.length) return;
    // Remove history entries at or after jump point to prevent duplicates
    _dialogHistory = _dialogHistory.filter(function(entry) { return entry.lineIdx < idx; });
    // Clean up current state
    if (textTimer) { clearInterval(textTimer); textTimer = null; }
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
    _skipActive = false;
    _autoPendingVoice = false;
    stopAudio('voice-player');
    stopMovie();
    // Reset dialog UI
    document.getElementById('dialog-name').textContent = '';
    document.getElementById('dialog-text').innerHTML = '';
    document.getElementById('dialog-text').dataset.fullText = '';
    var head = document.getElementById('dialog-headicon');
    if (head) head.style.display = 'none';
    // Jump to line
    lineIdx = idx;
    showLine();
  }

  return {
    loadScenario: loadScenario, nextLine: nextLine, prevLine: prevLine,
    toggleAuto: toggleAuto, exitReader: exitReader,
    getSettings: function() { return settings; }, updateSettings: updateSettings,
    stop: stop, play: play, onClick: onClick,
    initSkipHold: initSkipHold,
    getHistory: getHistory,
    replayVoice: replayVoice,
    jumpToLine: jumpToLine,
    toggleUI: toggleUI,
    isUiHidden: isUiHidden
  };
})();

window.VR = VR;
window.reader = VR;

// Init hold-to-skip on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { VR.initSkipHold(); });
} else {
  VR.initSkipHold();
}
