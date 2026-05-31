const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./designs.db');

function generateShareId() {
  return crypto.randomBytes(6).toString('hex');
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS designs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sweepAngle REAL NOT NULL,
    wingSpan REAL NOT NULL,
    centerOfGravity REAL NOT NULL,
    paperFold TEXT NOT NULL DEFAULT 'dart',
    paperWeight INTEGER NOT NULL DEFAULT 80,
    liftToDragRatio REAL NOT NULL,
    stability REAL NOT NULL,
    bestDistance REAL NOT NULL,
    shareId TEXT UNIQUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    startDate DATETIME NOT NULL,
    endDate DATETIME NOT NULL,
    maxWeight INTEGER DEFAULT 120,
    minWeight INTEGER DEFAULT 60,
    isActive BOOLEAN DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS competition_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competitionId INTEGER NOT NULL,
    designId INTEGER NOT NULL,
    playerName TEXT NOT NULL,
    distance REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (competitionId) REFERENCES competitions(id),
    FOREIGN KEY (designId) REFERENCES designs(id)
  )`);

  const checkColumn = (table, column, callback) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
      if (err) {
        callback(err);
        return;
      }
      const hasColumn = rows.some(row => row.name === column);
      callback(null, hasColumn);
    });
  };

  checkColumn('designs', 'paperFold', (err, has) => {
    if (!has) {
      db.run(`ALTER TABLE designs ADD COLUMN paperFold TEXT NOT NULL DEFAULT 'dart'`);
    }
  });
  checkColumn('designs', 'paperWeight', (err, has) => {
    if (!has) {
      db.run(`ALTER TABLE designs ADD COLUMN paperWeight INTEGER NOT NULL DEFAULT 80`);
    }
  });
  checkColumn('designs', 'shareId', (err, has) => {
    if (!has) {
      db.run(`ALTER TABLE designs ADD COLUMN shareId TEXT UNIQUE`);
    }
  });
});

app.post('/api/designs', (req, res) => {
  const { name, sweepAngle, wingSpan, centerOfGravity, paperFold, paperWeight, liftToDragRatio, stability, bestDistance } = req.body;
  const shareId = generateShareId();
  
  const stmt = db.prepare(`INSERT INTO designs 
    (name, sweepAngle, wingSpan, centerOfGravity, paperFold, paperWeight, liftToDragRatio, stability, bestDistance, shareId) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  stmt.run(name, sweepAngle, wingSpan, centerOfGravity, paperFold || 'dart', paperWeight || 80, liftToDragRatio, stability, bestDistance, shareId, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, shareId, message: '设计保存成功' });
  });
  stmt.finalize();
});

app.get('/api/designs', (req, res) => {
  const limit = req.query.limit || 20;
  db.all('SELECT * FROM designs ORDER BY bestDistance DESC LIMIT ?', [limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/designs/share/:shareId', (req, res) => {
  db.get('SELECT * FROM designs WHERE shareId = ?', [req.params.shareId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '设计不存在' });
      return;
    }
    res.json(row);
  });
});

app.get('/api/designs/:id', (req, res) => {
  db.get('SELECT * FROM designs WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

app.delete('/api/designs/:id', (req, res) => {
  db.run('DELETE FROM designs WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: '设计删除成功' });
  });
});

app.post('/api/competitions', (req, res) => {
  const { name, description, startDate, endDate, maxWeight, minWeight } = req.body;
  const stmt = db.prepare(`INSERT INTO competitions 
    (name, description, startDate, endDate, maxWeight, minWeight) 
    VALUES (?, ?, ?, ?, ?, ?)`);
  
  stmt.run(name, description || '', startDate, endDate, maxWeight || 120, minWeight || 60, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: '比赛创建成功' });
  });
  stmt.finalize();
});

app.get('/api/competitions', (req, res) => {
  db.all('SELECT * FROM competitions ORDER BY createdAt DESC LIMIT 10', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/competitions/:id/entries', (req, res) => {
  const { designId, playerName, distance } = req.body;
  const competitionId = req.params.id;
  
  const stmt = db.prepare(`INSERT INTO competition_entries 
    (competitionId, designId, playerName, distance) 
    VALUES (?, ?, ?, ?)`);
  
  stmt.run(competitionId, designId, playerName, distance, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: '参赛成功' });
  });
  stmt.finalize();
});

app.get('/api/competitions/:id/leaderboard', (req, res) => {
  const limit = req.query.limit || 50;
  db.all(`
    SELECT ce.*, d.name as designName, d.paperFold, d.paperWeight
    FROM competition_entries ce
    JOIN designs d ON ce.designId = d.id
    WHERE ce.competitionId = ?
    ORDER BY ce.distance DESC
    LIMIT ?
  `, [req.params.id, limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API端点就绪`);
});