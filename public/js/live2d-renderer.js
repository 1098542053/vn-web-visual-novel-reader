/**
 * Live2D Renderer - 基于 pixi-live2d-display
 * 使用测试页面（test-live2d.html）已验证的加载逻辑
 * 支持 Cubism 2.1 (moc) 和 Cubism 4 (MOC3)
 * 支持位置/缩放/动画播放
 */
if (typeof PIXI === "undefined" || !PIXI.live2d) {
  console.warn("Live2D: pixi-live2d-display not loaded, skipping");
  var Live2DRenderer = { load: function(){}, motion: function(){}, move: function(){}, remove: function(){}, clearAll: function(){} };
} else {
var Live2DRenderer = (function() {
  "use strict";

  var SLOT_MAP = { "Live2D_01": "sprite-01", "Live2D_02": "sprite-02", "Live2D_03": "sprite-03" };
  var apps = {};    // slotName -> PIXI.Application
  var models = {};  // slotName -> Live2DModel
  var loadGen = {}; // slotName -> generation counter (防止异步回调覆盖) 

  // 剧本 Y 坐标偏移（加在场景坐标上，让模型整体下移）
  // 场景 y=-470 时模型贴顶，加偏移后可以调到合适位置
  var POS_Y_OFFSET = 470;

  /** 获取插槽对应的 DOM 元素 ID */
  function getSlotEid(slotName) {
    return SLOT_MAP[slotName];
  }

  /** 获取或创建插槽画布 */
  function getOrCreateCanvas(eid) {
    var box = document.getElementById('reader-sprite');
    if (!box) return null;
    var cv = box.querySelector(".l2d-cv[data-slot=\"" + eid + "\"]");
    if (!cv) {
      cv = document.createElement("canvas");
      cv.className = "l2d-cv";
      cv.setAttribute("data-slot", eid);
      cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
      box.appendChild(cv);
    }
    cv.style.display = "block";
    return cv;
  }

  /**
   * 加载 Live2D 模型到指定插槽
   * 使用 test-live2d.html 验证过的 PIXI.live2d.Live2DModel.from() 方式
   */
  function load(slotName, modelId, x, y, sx, sy) {
    var eid = getSlotEid(slotName);
    if (!eid) return;

    // 递增加载世代，防止异步回调覆盖后续加载的模型
    if (!loadGen[slotName]) loadGen[slotName] = 0;
    var gen = ++loadGen[slotName];

    // 先移除外层显示的元素（sprite-layer），避免旧贴图闪烁
    var spriteEl = document.getElementById(eid);
    if (spriteEl) spriteEl.style.display = 'none';

    // 先移除该插槽已有内容
    remove(slotName);

    var cv = getOrCreateCanvas(eid);
    if (!cv) return;

    // 模型加载期间隐藏 canvas，避免旧 WebGL 内容闪烁
    cv.style.opacity = '0';

    var parent = cv.parentNode;
    var logicalW = parent.clientWidth;
    var logicalH = parent.clientHeight;
    if (logicalW < 10 || logicalH < 10) return;

    try {
      var app = new PIXI.Application({
        view: cv,
        width: logicalW,
        height: logicalH,
        backgroundColor: 0x000000,
        transparent: true,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });
      apps[slotName] = app;

      var modelUrl = '/live2d-model/' + modelId + '/model.model.json';
      console.log('Live2D: loading model', modelId, '(gen', gen + ')');

      // 设置 idleMotionGroup="loop" 让 Cubism4 的循环动画正常工作
      // Cubism4 默认空闲组是 "Idle"（大写），但我们的模型动画组是 "loop"/"joy"/"anger" 等
      PIXI.live2d.Live2DModel.from(modelUrl, { idleMotionGroup: "loop" }).then(function(m) {
        // 检查是否仍是当前世代，防止旧回调覆盖新模型
        if (loadGen[slotName] !== gen) {
          console.log('Live2D: discarding stale load gen', gen, 'current:', loadGen[slotName]);
          try { m.destroy(); } catch(e) {}
          return;
        }
        models[slotName] = m;
        m.autoUpdate = true; // 启用自动更新，否则 motion 不会推进

        // 位置: 插槽坐标映射（相对于实际 canvas 尺寸）
        var py = typeof y === 'number' ? toStageY(y + POS_Y_OFFSET, app.screen.height) : app.screen.height / 2;
        var px = typeof x === 'number' ? toStageX(x, app.screen.width) : app.screen.width / 2;
        m.anchor.set(0.5, 0.5);
        m.position.set(px, py);

        // 缩放: 适配画布高度
        var modelH = m.height || (m.internalModel ? m.internalModel.originalHeight : 2);
        var fitScale = (app.screen.height * 0.85) / modelH;
        m.scale.set(fitScale);

        app.stage.addChild(m);

        // 启用鼠标追踪（眼睛/头部跟随鼠标移动）
        m.autoInteract = true;
        if (app.renderer.plugins.interaction) {
          m.registerInteraction(app.renderer.plugins.interaction);
        }

        // 模型加载完成，恢复 canvas 显示
        cv.style.opacity = '1';

        // 自动播放 idle 循环动画
        m.motion("loop").catch(function() {});
        console.log('Live2D: model loaded', modelId, 'scale', fitScale.toFixed(3));
      }).catch(function(err) {
        // 加载失败也恢复 canvas，避免永久隐藏
        cv.style.opacity = '1';
        // 如果不是因为已被新加载废弃导致的错误，才记录
        if (loadGen[slotName] === gen) {
          console.warn('Live2D: model load failed', modelId, err.message);
        }
      });
    } catch(e) {
      console.warn('Live2D: app create failed', e.message);
    }
  }

  /** 播放动画 */
  function motion(slotName, motionName, loopFlag) {
    var m = models[slotName];
    if (!m) return;
    if (loopFlag === "on" || loopFlag === true) {
      m.motion(motionName, { loop: true }).catch(function() {});
    } else {
      m.motion(motionName).catch(function() {});
    }
  }

  /** 移动模型位置 */
  function moveSlot(slotName, x, y, duration) {
    var m = models[slotName];
    if (!m) return;
    var app = apps[slotName];
    var canvasW = app ? app.screen.width : 1600;
    var canvasH = app ? app.screen.height : 900;
    var px = typeof x === 'number' ? toStageX(x, canvasW) : m.position.x;
    var py = typeof y === 'number' ? toStageY(y + POS_Y_OFFSET, canvasH) : m.position.y;
    m.position.set(px, py);
  }

  /** 移除插槽模型 */
  function remove(slotName) {
    var m = models[slotName];
    if (m) {
      try { m.destroy(); } catch(e) {}
      delete models[slotName];
    }
    var app = apps[slotName];
    if (app) {
      try { app.destroy(true, {children: true}); } catch(e) {}
      delete apps[slotName];
    }
    var eid = getSlotEid(slotName);
    if (eid) {
      var cv = document.querySelector(".l2d-cv[data-slot=\"" + eid + "\"]");
      if (cv) cv.style.display = "none";
    }
  }

  /** 清除所有插槽 */
  function clearAll() {
    for (var sn in SLOT_MAP) remove(sn);
  }

  /** 回退: 模型加载失败时不显示纹理贴图（避免显示原始纹理图集造成混乱） */
  function fallbackToStatic(eid, modelId) {
    // 静默失败，不显示纹理贴图
  }

  // 坐标转换: 剧本坐标 -> PIXI 舞台坐标（相对于实际 canvas 尺寸）
  function toStageX(ux, canvasW) { return (ux + 800) / 1600 * (canvasW || 1600); }
  function toStageY(uy, canvasH) { return (uy + 500) / 1000 * (canvasH || 900); }

  return {
    load: load,
    motion: motion,
    move: moveSlot,
    remove: remove,
    clearAll: clearAll
  };
})();
}
window.PIXI = PIXI;
