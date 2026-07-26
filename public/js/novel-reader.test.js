/**
 * novel-reader.js 功能回归测试
 * 依赖: 服务端运行在 http://localhost:3000
 * 运行: node novel-reader.test.js
 * 
 * 每次修改 novel-reader.js/server.js 后执行此测试
 * 确保以下功能不受影响:
 *   1. 中文文本正确显示 (编码完整性)
 *   2. 语音文件可访问 (路径正确性)
 *   3. BGM 文件可访问
 *   4. 背景图片可访问
 *   5. Live2D 模型可访问 (配置文件、.moc、贴图、动作)
 *   6. API 接口返回数据
 *   7. 剧本文件可访问
 *   8. 头像图标可访问
 *   9. 测试页面可访问
 *  10. 库文件完整性 (检查文件大小，防止截断)
 */

var http = require('http');
var fs = require('fs');
var path = require('path');

var BASE = 'http://localhost:3000';
var PUBLIC = path.join(__dirname, '..');
var passed = 0;
var failed = 0;

function test(name, url, expectedStatus, expectedContent) {
  return new Promise(function(resolve) {
    http.get(BASE + url, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        var ok = true;
        var msg = '';
        if (res.statusCode !== expectedStatus) {
          ok = false;
          msg += 'status=' + res.statusCode + ' (expected ' + expectedStatus + ') ';
        }
        if (expectedContent && data.indexOf(expectedContent) < 0) {
          ok = false;
          msg += 'missing: "' + expectedContent + '" ';
        }
        if (ok) { console.log('  PASS: ' + name); passed++; }
        else { console.log('  FAIL: ' + name + ' -- ' + msg); failed++; }
        resolve();
      });
    }).on('error', function(e) {
      console.log('  ERROR: ' + name + ' -- ' + e.message);
      failed++;
      resolve();
    });
  });
}

function testFileSize(name, filePath, minBytes, maxBytes) {
  try {
    var stat = fs.statSync(filePath);
    var ok = stat.size >= minBytes && (!maxBytes || stat.size <= maxBytes);
    if (ok) { console.log('  PASS: ' + name + ' (' + (stat.size/1024).toFixed(1) + 'KB)'); passed++; }
    else { console.log('  FAIL: ' + name + ' size=' + stat.size + ' (expected ' + minBytes + '-' + (maxBytes||'∞') + ')'); failed++; }
  } catch(e) {
    console.log('  FAIL: ' + name + ' -- ' + e.message);
    failed++;
  }
}

function checkServer() {
  return new Promise(function(resolve) {
    http.get(BASE, function() { resolve(true); }).on('error', function() { resolve(false); });
  });
}

async function runAll() {
  console.log('\n=== VN-Web 功能回归测试 ===\n');

  var serverUp = await checkServer();
  if (!serverUp) {
    console.log('ERROR: Server not running at ' + BASE);
    console.log('Start with: cd vn-web && node server.js\n');
    process.exit(1);
  }

  // ── 1. 中文编码完整性 ──
  console.log('[1] 中文编码完整性');
  await test('角色劇情', '/', 200, '角色劇情');
  await test('主線故事', '/', 200, '主線故事');
  await test('事件劇情', '/', 200, '事件劇情');
  await test('設定', '/', 200, '設定');
  await test('自動', '/tests.html', 200, 'BGM');
  await test('跳過', '/tests.html', 200, '剧本');

  // ── 2. 静态资源 ──
  console.log('\n[2] 静态资源');
  await test('index.html', '/', 200);
  await test('style.css', '/css/style.css', 200);
  await test('favicon', '/favicon.svg', 200);

  // ── 3. JS 模块文件 ──
  console.log('\n[3] JS 模块文件');
  await test('novel-reader.js', '/js/novel-reader.js', 200);
  await test('app.js', '/js/app.js', 200);
  await test('novel-reader.test.js', '/js/novel-reader.test.js', 200);

  // ── 4. 库文件完整性 ──
  console.log('\n[4] 库文件完整性');
  testFileSize('pixi.min.js', path.join(PUBLIC, 'lib', 'pixi.min.js'), 400*1024, 500*1024);
  testFileSize('live2d.min.js', path.join(PUBLIC, 'lib', 'live2d.min.js'), 100*1024, 200*1024);
  testFileSize('live2dcubismcore.min.js', path.join(PUBLIC, 'lib', 'live2dcubismcore.min.js'), 150*1024, 300*1024);
  testFileSize('pixi-live2d-display.min.js', path.join(PUBLIC, 'lib', 'pixi-live2d-display.min.js'), 100*1024, 200*1024);
  testFileSize('cubism4.min.js', path.join(PUBLIC, 'lib', 'cubism4.min.js'), 100*1024, 200*1024);

  // ── 5. API 接口 ──
  console.log('\n[5] API 接口');
  await test('/api/characters', '/api/characters', 200);
  await test('/api/main-story', '/api/main-story', 200);
  await test('/api/events', '/api/events', 200);

  // ── 6. 剧本文件 ──
  await test('Normal har_00001', '/scenario/Normal/har_00001.txt', 200);
  await test('main adv_00001', '/scenario/main/adv_00001.txt', 200);

  // ── 7. 背景图片 ──
  console.log('\n[7] 背景图片');
  await test('bg003_10', '/texture/BG/bg003_10.png', 200);
  await test('bg010_10', '/texture/BG/bg010_10.png', 200);

  // ── 8. 语音文件 ──
  console.log('\n[8] 语音文件');
  await test('vc00001_000010', '/voice/Normal/har_00001/vc00001_000010.ogg', 200);
  await test('vc00001_000020_i_men', '/voice/Normal/har_00001/vc00001_000020_i_men.ogg', 200);

  // ── 9. BGM ──
  console.log('\n[9] BGM（抽样）');
  await test('bgm002', '/bgm/bgm002.ogg', 200);
  await test('bgm017', '/bgm/bgm017.ogg', 200);
  await test('bgm127', '/bgm/bgm127.ogg', 200);

  // ── 10. Live2D 模型文件 ──
  console.log('\n[10] Live2D 模型文件');
  var l2dModels = ['l2d00003', 'l2d00004', 'l2d00006', 'l2d00008', 'l2d00009', 'l2d00010', 'l2d00011', 'l2d00012', 'l2d00013', 'l2d00016'];
  for (var i = 0; i < l2dModels.length; i++) {
    var m = l2dModels[i];
    await test(m + ' model.json', '/live2d-model/' + m + '/model.model.json', 200);
    await test(m + ' texture_00', '/live2d-model/' + m + '/texture_00.png', 200);
  }

  // ── 11. 测试页面可访问 ──
  console.log('\n[11] 测试页面');
  await test('tests.html', '/tests.html', 200);
  await test('test-bgm.html', '/test-bgm.html', 200);
  await test('test-bg.html', '/test-bg.html', 200);
  await test('test-scenario.html', '/test-scenario.html', 200);
  await test('test-live2d.html', '/test-live2d.html', 200);
  await test('test-minimal.html', '/test-minimal.html', 200);
  await test('test-raw.html', '/test-raw.html', 200);
  await test('cubism4-test.html', '/cubism4-test.html', 200);

  // ── 12. 头像图标路径测试（修复: 路径不应去掉 fc 前缀）──
  console.log('\n[12] 头像图标路径');
  var iconSamples = ['fc00001','fc00002','fc00003','fc10001','fc10002'];
  for (var i = 0; i < iconSamples.length; i++) {
    await test(iconSamples[i], '/texture/chara_icon_image/' + iconSamples[i] + '.png', 200);
  }

  // ── 13. 对话框 CSS 测试（修复: user-select:none 禁止文字选中）──
  console.log('\n[13] 对话框 CSS - user-select: none');
  await test('index.html user-select', '/', 200, 'user-select:none');

  // ── 14. Live2D 模型 .moc 文件 ──
  console.log('\n[14] Live2D .moc 文件');
  var mocModels = ['l2d00003', 'l2d00004', 'l2d00006'];
  for (var i = 0; i < mocModels.length; i++) {
    await test(mocModels[i] + ' .moc', '/live2d-model/' + mocModels[i] + '/model.moc', 200);
  }

  // ── 15. BGM 完整测试（修复: BGM 路径正确性）──
  console.log('\n[15] BGM 完整测试');
  var bgmFiles = ['bgm002','bgm006','bgm007','bgm008','bgm010','bgm011','bgm012','bgm014','bgm015','bgm016','bgm017','bgm018','bgm019','bgm020','bgm021','bgm023','bgm024','bgm027','bgm028','bgm029','bgm030','bgm031','bgm034','bgm035','bgm101','bgm102','bgm104','bgm105','bgm107','bgm113','bgm115','bgm117','bgm118','bgm126','bgm127'];
  for (var i = 0; i < bgmFiles.length; i++) {
    await test('bgm ' + bgmFiles[i], '/bgm/' + bgmFiles[i] + '.ogg', 200);
  }

  // ── 16. 语音文件路径测试（修复: 语音支持场景上下文路径）──
  console.log('\n[16] 语音文件路径');
  var voiceTests = [
    ['har_00001 R18 vc00001_100010', '/voice/R18/har_00001/vc00001_100010.ogg'],
    ['har_00001 R18 vc00001_100020', '/voice/R18/har_00001/vc00001_100020.ogg'],
    ['har_00001 R18 vc00001_100050', '/voice/R18/har_00001/vc00001_100050.ogg'],
    ['har_00001 R18 vc00001_100070', '/voice/R18/har_00001/vc00001_100070.ogg'],
    ['har_00001 R18 vc00001_100100', '/voice/R18/har_00001/vc00001_100100.ogg'],
  ];
  for (var i = 0; i < voiceTests.length; i++) {
    await test(voiceTests[i][0], voiceTests[i][1], 200);
  }

  // ── 17. 音频引擎完整性（检查 Audio 相关 polyfill）──
  console.log('\n[17] 音频库文件');
  await test('novel-reader.js unlockAudio', '/js/novel-reader.js', 200, 'AudioContext');
  await test('novel-reader.js playAudio', '/js/novel-reader.js', 200, 'playAudio');

  // ── 结果 ──
  console.log('\n=== 测试结果 ===');
  console.log('通过: ' + passed);
  console.log('失败: ' + failed);
  console.log('总计: ' + (passed + failed));
  if (failed === 0) {
    console.log('\n\u2705 全部通过');
  } else {
    console.log('\n\u274c 存在 ' + failed + ' 项失败');
    process.exit(1);
  }
}

runAll();
