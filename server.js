/**
 * server.js
 * ---------
 * Servidor Express com:
 * - API pública de ranking
 * - API administrativa protegida por x-admin-key
 * - Endpoint para atualizar ranking manualmente
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3007;

// 🔐 CHAVE ADMIN (MUDE ISSO)
const ADMIN_KEY = 'MINHA_CHAVE_SUPER_SECRETA_123';

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
  const key = req.headers['x-admin-key'];
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
  } catch (err) {
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
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler ranking.' });
  }
});

// ────────────────────────────────────────────────
// 🔐 API ADMIN
// ────────────────────────────────────────────────

// Listar estudantes
app.get('/api/admin/students', checkAdmin, (req, res) => {
  const students = readJSON(STUDENTS_PATH);
  res.json(students);
});

// Adicionar estudante
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

// Remover estudante
app.delete('/api/admin/students', checkAdmin, (req, res) => {
  const { turma, username } = req.body;

  const students = readJSON(STUDENTS_PATH);

  if (!students.turmas[turma]) {
    return res.status(404).json({ error: 'Turma não encontrada.' });
  }

  students.turmas[turma] = students.turmas[turma].filter(
    s => s.username !== username
  );

  writeJSON(STUDENTS_PATH, students);

  res.json({ success: true });
});

// Atualizar ranking manualmente
app.post('/api/admin/update-ranking', checkAdmin, (req, res) => {
  exec('node scripts/updateRanking.js', (error, stdout, stderr) => {
    if (error) {
      console.error(stderr);
      return res.status(500).json({ error: 'Erro ao atualizar ranking.' });
    }

    console.log(stdout);
    res.json({ success: true });
  });
});

// ── Start ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
