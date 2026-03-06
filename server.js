/**
 * server.js
 * ---------
 * Servidor Express com:
 * - API pública de ranking
 * - API administrativa protegida por x-admin-key
 * - Endpoint para atualizar ranking manualmente
 * - Streaming de logs para atualização de ranking
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3007;

// 🔐 CHAVE ADMIN
const ADMIN_KEY = 'Ditto';

// ── Caminhos ─────────────────────────────────────
const RANKING_PATH = path.join(__dirname, 'data', 'ranking.json');
const STUDENTS_PATH = path.join(__dirname, 'data', 'students.json');
const PUBLIC_PATH = path.join(__dirname, 'public');

// ── Middlewares ──────────────────────────────────
app.use(express.json());
app.use(express.static(PUBLIC_PATH));

// ── Helpers ──────────────────────────────────────
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function checkAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;

  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  next();
}

// ────────────────────────────────────────────────
// 🔓 API PÚBLICA
// ────────────────────────────────────────────────

app.get('/api/turmas', (req, res) => {
  try {
    const ranking = readJSON(RANKING_PATH);
    res.json({ turmas: Object.keys(ranking) });
  } catch {
    res.status(500).json({ error: 'Erro ao ler ranking.' });
  }
});

app.get('/api/ranking/:turma', (req, res) => {
  try {
    const ranking = readJSON(RANKING_PATH);
    const turma = req.params.turma;

    if (!ranking[turma]) {
      return res.status(404).json({ error: 'Turma não encontrada.' });
    }

    res.json({ turma, ranking: ranking[turma] });

  } catch {
    res.status(500).json({ error: 'Erro ao ler ranking.' });
  }
});

// ────────────────────────────────────────────────
// 🔐 API ADMIN
// ────────────────────────────────────────────────

// listar turmas do students.json
app.get('/api/admin/turmas', (req, res) => {

  try {

    const students = readJSON(STUDENTS_PATH);

    if (!students.turmas) {
      return res.json({ turmas: [] });
    }

    res.json({
      turmas: Object.keys(students.turmas)
    });

  } catch {

    res.status(500).json({ error: 'Erro ao ler students.json' });

  }

});

// listar estudantes
app.get('/api/admin/students', checkAdmin, (req, res) => {
  res.json(readJSON(STUDENTS_PATH));
});

// adicionar estudante
app.post('/api/admin/students', checkAdmin, (req, res) => {

  const { turma, username, displayName } = req.body;

  if (!turma || !username || !displayName) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  const students = readJSON(STUDENTS_PATH);

  if (!students.turmas[turma]) {
    students.turmas[turma] = [];
  }

  students.turmas[turma].push({ username, displayName });

  writeJSON(STUDENTS_PATH, students);

  res.json({ success: true });
});

// remover estudante
app.delete('/api/admin/students', checkAdmin, (req, res) => {

  const { turma, username } = req.body;
  const students = readJSON(STUDENTS_PATH);

  if (!students.turmas[turma]) {
    return res.status(404).json({ error: 'Turma não encontrada.' });
  }

  students.turmas[turma] = students.turmas[turma].filter(
    s => s.username !== username
  );

  if (students.turmas[turma].length === 0) {
    delete students.turmas[turma];
  }

  writeJSON(STUDENTS_PATH, students);

  res.json({ success: true });

});

// ────────────────────────────────────────────────
// Atualizar ranking com logs em tempo real
// ────────────────────────────────────────────────

app.get('/api/admin/update-ranking-stream', (req, res) => {

  const key = req.headers['x-admin-key'] || req.query.key;
  const turma = req.query.turma;

  if (key !== ADMIN_KEY) {
    return res.status(401).end('Não autorizado');
  }

  if (!turma) {
    return res.status(400).end('Turma não informada');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const child = spawn('node', [
    'scripts/updateRanking.js',
    '--turma',
    turma
  ]);

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');

    lines.forEach(line => {
      if (line.trim()) {
        res.write(`data: ${line}\n\n`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');

    lines.forEach(line => {
      if (line.trim()) {
        res.write(`data: ERRO: ${line}\n\n`);
      }
    });
  });

  child.on('close', (code) => {
    res.write(`data: Processo finalizado (code ${code})\n\n`);
    res.end();
  });

});

// ── Start ───────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
