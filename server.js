const express = require('express');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SD = {
  normal: path.join(DATA_DIR, 'Scenario', 'Normal'),
  r18: path.join(DATA_DIR, 'Scenario', 'R18'),
  event: path.join(DATA_DIR, 'Scenario', 'Event'),
  main: path.join(DATA_DIR, 'Scenario', 'main'),
};
const SET = path.join(DATA_DIR, 'Setting');
const BGM = path.join(DATA_DIR, 'Sound', 'BGM');
const FONT_SRC = path.join(__dirname, 'public', 'fonts', 'PerfectDOSVGA437.ttf');
const FONT_DST = path.join(__dirname, 'public', 'fonts', 'PerfectDOSVGA437.ttf');

app.use(express.static(path.join(__dirname, 'public')));
// Serve npm packages for client-side use
app.use('/npm/pixi.js', express.static(path.join(__dirname, 'node_modules', 'pixi.js', 'dist', 'browser')));
app.use('/npm/pixi-live2d-display', express.static(path.join(__dirname, 'node_modules', 'pixi-live2d-display', 'dist')));
// Serve texture images (BG, HCG, chara icons, etc.)
app.use('/texture', express.static(path.join(DATA_DIR, 'Texture2D')));
// Serve Live2D textures (for static img fallback)
app.use('/live2d', express.static(path.join(DATA_DIR, 'Live2D')));
// Serve voice audio files
app.use('/voice', express.static(path.join(DATA_DIR, 'Sound', 'Voice')));
app.use('/bgm', express.static(path.join(DATA_DIR, 'Sound', 'BGM')));
app.use('/se', express.static(path.join(DATA_DIR, 'Sound', 'seVoice')));
app.use('/video', express.static(path.join(DATA_DIR, 'Video')));
app.use('/scenario', express.static(path.join(DATA_DIR, 'Scenario')));

// 鈹€鈹€鈹€ Live2D model file proxy 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// Handles .moc.bytes / .mtn.bytes -> .moc / .mtn transparently
// Uses wildcard path to support multi-segment texture paths like model.2048/texture_00.png
var L2D_ROOT = path.join(DATA_DIR, 'Live2D');

app.get('/live2d-model/:modelId/*', function(req, res) {
  var modelDir = path.join(L2D_ROOT, req.params.modelId);
  var filePath = req.params[0]; // The wildcard capture group

  if (!filePath) {
    return res.status(404).json({ error: 'No file specified' });
  }

  var ext = path.extname(filePath).toLowerCase();

  // For PNG textures: try exact path, then fallback to model root
  if (ext === '.png') {
    var exactPath = path.join(modelDir, filePath);
    if (fs.existsSync(exactPath)) {
      return res.sendFile(exactPath);
    }
    // Fallback: texture_00.png in model root
    var rootPng = path.join(modelDir, path.basename(filePath));
    if (fs.existsSync(rootPng)) {
      return res.sendFile(rootPng);
    }
    return res.status(404).json({ error: 'Texture not found', file: filePath });
  }

  // For .json, .moc, .mtn, etc: try exact, then with .bytes, then with regex replacement
  var candidates = [
    path.join(modelDir, filePath),
    path.join(modelDir, filePath + '.bytes'),
    path.join(modelDir, filePath.replace(/\.(moc|mtn|physics|pose)$/, '.$1.bytes'))
  ];

  // Remove duplicates
  var seen = {};
  var unique = [];
  candidates.forEach(function(p) {
    if (!seen[p]) { seen[p] = true; unique.push(p); }
  });

  // Try each candidate
  for (var i = 0; i < unique.length; i++) {
    var p = unique[i];
    if (fs.existsSync(p)) {
      var mimeExt = path.extname(p).toLowerCase();
      if (mimeExt === '.bytes') {
        var base = path.basename(p, '.bytes');
        mimeExt = path.extname(base) || '.bytes';
      }
      var mimeTypes = {
        '.moc': 'application/octet-stream',
        '.mtn': 'application/octet-stream',
        '.png': 'image/png',
        '.json': 'application/json'
      };
      res.type(mimeTypes[mimeExt] || 'application/octet-stream');
      return res.sendFile(p);
    }
  }

  res.status(404).json({ error: 'Live2D file not found', file: filePath });
});

// Read utf-8 text file
function readText(p) {
  const raw = fs.readFileSync(p);
  return iconv.decode(raw, 'utf-8');
}

// Split lines
function getLines(p) {
  return readText(p).split(/\r?\n/).filter(function(l) { return l.trim(); });
}

// Simple CSV split
function splitCSV(line) {
  var r = [], c = '', q = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { q = !q; }
    else if (ch === ',' && !q) { r.push(c.trim()); c = ''; }
    else { c += ch; }
  }
  r.push(c.trim());
  return r;
}

// API: Characters
app.get('/api/characters', function(req, res) {
  try {
    var lines = getLines(path.join(SET, 'List.txt'));
    var chars = lines.map(function(line) {
      var parts = line.split(',');
      return {
        id: parts[0],
        type: parseInt(parts[1]) || 0,
        name: parts[2] || '',
        rarity: parseInt(parts[3]) || 0,
        motion: parts[4] || ''
      };
    });
    res.json(chars);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// API: Main story
app.get('/api/main-story', function(req, res) {
  try {
    var lines = getLines(path.join(SET, 'mainList.txt'));
    var chapters = lines.map(function(line) {
      var parts = line.split(',');
      var ch = (parts[1] || '').split('\t');
      return {
        id: parts[0],
        chapter: ch[0] || '',
        section: ch[1] || ''
      };
    });
    res.json(chapters);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// API: Events
app.get('/api/events', function(req, res) {
  try {
    res.json(getLines(path.join(SET, 'eventList.txt')));
  } catch(e) { res.status(500).json({error: e.message}); }
});

// API: Event chapters
app.get('/api/event-chapters/:eid', function(req, res) {
  try {
    var fp = path.join(SET, 'event', req.params.eid + '.txt');
    if (!fs.existsSync(fp)) return res.status(404).json({error:'Not found'});
    var chs = getLines(fp).map(function(l) {
      var p = l.split(',');
      return {title: p[0], id: p[1]};
    });
    res.json(chs);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// API: Parse scenario
app.get('/api/scenario/:type/:id', function(req, res) {
  try {
    var dir = SD[req.params.type];
    if (!dir) return res.status(400).json({error:'Bad type: '+req.params.type});
    var fp = path.join(dir, req.params.id + '.txt');
    if (!fs.existsSync(fp)) return res.status(404).json({error:'Not found'});
    var lines = getLines(fp);
    var cmds = lines.map(function(l) {
      var p = splitCSV(l);
      return {type: p[0], args: p.slice(1)};
    });
    res.json({id: req.params.id, type: req.params.type, commands: cmds, total: cmds.length});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// API: Scenario file list
app.get('/api/scenario-files/:type', function(req, res) {
  try {
    var dir = SD[req.params.type];
    if (!dir) return res.status(400).json({error:'Bad type'});
    if (!fs.existsSync(dir)) return res.json([]);
    var files = fs.readdirSync(dir).filter(function(f) { return f.endsWith('.txt'); }).map(function(f) { return f.replace('.txt',''); });
    res.json(files);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// API: List video scenarios (directories that contain .webm files)
app.get('/api/video-scenarios', function(req, res) {
  try {
    var videoDir = path.join(DATA_DIR, 'Video');
    if (!fs.existsSync(videoDir)) return res.json([]);
    var dirs = fs.readdirSync(videoDir).filter(function(f) {
      return fs.statSync(path.join(videoDir, f)).isDirectory();
    }).sort();
    // For each dir, list available .webm files
    var result = dirs.map(function(d) {
      var files = fs.readdirSync(path.join(videoDir, d)).filter(function(f) { return f.endsWith('.webm'); }).sort();
      return { scenario: d, videos: files };
    });
    res.json(result);
  } catch(e) { res.status(500).json({error: e.message}); }
});

// API: Gallery (回忆画廊)
// Build character name lookup from List.txt
var _charNames = null;
function getCharNameMap() {
  if (_charNames) return _charNames;
  _charNames = {};
  try {
    var lines = getLines(path.join(SET, 'List.txt'));
    lines.forEach(function(line) {
      var parts = line.split(',');
      var id = parts[0] || '';
      var m = id.match(/^ut(\d+)$/);
      if (m) _charNames[m[1]] = parts[2] || '';
    });
  } catch(e) {}
  return _charNames;
}

app.get('/api/gallery', function(req, res) {
  try {
    var page = parseInt(req.query.page) || 1;
    var perPage = parseInt(req.query.perPage) || 20;
    if (page < 1) page = 1;
    if (perPage < 1) perPage = 20;

    var r18Dir = path.join(DATA_DIR, 'Texture2D', 'image_unit_harem_r18');
    if (!fs.existsSync(r18Dir)) return res.json({ folders: [], total: 0, page: 1, totalPages: 0 });

    var files = fs.readdirSync(r18Dir).filter(function(f) {
      return f.match(/^harem_(\d+)\.png$/);
    });

    var charNames = getCharNameMap();
    var allFolders = [];

    files.forEach(function(f) {
      var m = f.match(/^harem_(\d+)\.png$/);
      var num = m[1];

      var hcgDir = path.join(DATA_DIR, 'Texture2D', 'HCG', 'ev' + num);
      var videoDir = path.join(DATA_DIR, 'Video', 'har_' + num);
      var hasHCG = fs.existsSync(hcgDir);
      var hasVideo = fs.existsSync(videoDir);

      if (!hasHCG && !hasVideo) return;

      var folder = {
        num: num,
        characterName: charNames[num] || '',
        thumb: '/texture/image_unit_harem_r18/harem_' + num + '.png',
        type: 'hcg',
        folderName: 'ev' + num,
        files: []
      };

      if (hasVideo) {
        var webmFiles = fs.readdirSync(videoDir).filter(function(vf) {
          return vf.endsWith('.webm');
        }).sort();
        if (webmFiles.length > 0) {
          folder.type = 'video';
          folder.folderName = 'har_' + num;
          folder.files = webmFiles;
        }
      }

      if (hasHCG && folder.type !== 'video') {
        var hcgFiles = fs.readdirSync(hcgDir).filter(function(hf) {
          return hf.match(/\.png$/i);
        }).sort();
        if (hcgFiles.length > 0) {
          folder.files = hcgFiles;
        } else {
          return; // HCG dir exists but no png files
        }
      }

      allFolders.push(folder);
    });

    // Sort by numeric num ascending
    allFolders.sort(function(a, b) {
      var na = parseInt(a.num, 10);
      var nb = parseInt(b.num, 10);
      return na - nb;
    });

    var total = allFolders.length;
    var totalPages = Math.ceil(total / perPage);
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * perPage;
    var pageFolders = allFolders.slice(start, start + perPage);

    res.json({
      folders: pageFolders,
      total: total,
      page: page,
      perPage: perPage,
      totalPages: totalPages
    });
  } catch(e) { res.status(500).json({error: e.message}); }
});

// API: Live2D Model Gallery
app.get('/api/live2d-gallery', function(req, res) {
  try {
    var l2dRoot = path.join(DATA_DIR, 'Live2D');
    if (!fs.existsSync(l2dRoot)) return res.json({ models: [] });

    var dirs = fs.readdirSync(l2dRoot).filter(function(d) {
      return d.match(/^l2d\d+/) && fs.statSync(path.join(l2dRoot, d)).isDirectory();
    }).sort();

    var charNames = getCharNameMap();
    var models = [];

    dirs.forEach(function(dir) {
      var m = dir.match(/^l2d(\d+)/);
      if (!m) return;
      var num = m[1];

      var dirPath = path.join(l2dRoot, dir);
      var hasModel = fs.existsSync(path.join(dirPath, 'model.model.json')) ||
                     fs.existsSync(path.join(dirPath, 'model3.json'));

      if (!hasModel) return; // Skip folders without valid model files

      var faceIcon = 'fc' + num;
      var iconPath = path.join(DATA_DIR, 'Texture2D', 'chara_icon_image', faceIcon + '.png');
      var hasIcon = fs.existsSync(iconPath);

      // Scan motion files
      var motions = fs.readdirSync(dirPath).filter(function(f) {
        return f.match(/\.mtn\.bytes$/);
      }).map(function(f) {
        return f.replace(/\.mtn\.bytes$/, '');
      }).sort();

      models.push({
        modelId: dir,
        num: num,
        characterName: charNames[num] || '',
        faceIcon: hasIcon ? '/texture/chara_icon_image/' + faceIcon + '.png' : null,
        motions: motions
      });
    });

    // Sort by numeric num ascending
    models.sort(function(a, b) {
      return parseInt(a.num, 10) - parseInt(b.num, 10);
    });

    res.json({ models: models, total: models.length });
  } catch(e) { res.status(500).json({error: e.message}); }
});

// Copy font
function ensureFont() {
  var d = path.dirname(FONT_DST);
  if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true});
  if (fs.existsSync(FONT_SRC) && !fs.existsSync(FONT_DST)) {
    fs.copyFileSync(FONT_SRC, FONT_DST);
    console.log('Font copied');
  }
}

ensureFont();
app.listen(PORT, '0.0.0.0', function() {
  console.log('VN-Web running on http://0.0.0.0:' + PORT);
  console.log('Data: ' + DATA_DIR);
});

