/**
 * server.js
 * ---------
 * Servidor Express que serve o ranking gerado pelo script updateRanking.js.
 * Nunca chama a API externa em tempo real — lê apenas o snapshot local.
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3007;

// ── Caminhos ──────────────────────────────────────────────────────────────────
const RANKING_PATH = path.join(__dirname, 'data', 'ranking.json');
const PUBLIC_PATH  = path.join(__dirname, 'public');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Lê e parseia o ranking.json.
 * Retorna objeto vazio se o arquivo ainda não existir.
 */
function readRanking() {
  if (!fs.existsSync(RANKING_PATH)) return {};
  return JSON.parse(fs.readFileSync(RANKING_PATH, 'utf8'));
}

// ── Rotas da API ──────────────────────────────────────────────────────────────

/**
 * GET /api/turmas
 * Retorna a lista de nomes de turmas disponíveis no ranking atual.
 */
app.get('/api/turmas', (req, res) => {
  try {
    const ranking = readRanking();
    const turmas  = Object.keys(ranking);
    res.json({ turmas });
  } catch (err) {
    console.error('Erro ao ler ranking:', err.message);
    res.status(500).json({ error: 'Erro interno ao ler ranking.' });
  }
});

/**
 * GET /api/ranking/:turma
 * Retorna o ranking (array ordenado por WPM desc) de uma turma específica.
 */
app.get('/api/ranking/:turma', (req, res) => {
  try {
    const ranking = readRanking();
    const turma   = req.params.turma;

    if (!ranking[turma]) {
      return res.status(404).json({ error: `Turma "${turma}" não encontrada.` });
    }

    res.json({ turma, ranking: ranking[turma] });
  } catch (err) {
    console.error('Erro ao ler ranking:', err.message);
    res.status(500).json({ error: 'Erro interno ao ler ranking.' });
  }
});

// ── Frontend estático ─────────────────────────────────────────────────────────
app.use(express.static(PUBLIC_PATH));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Ranking disponível em http://localhost:${PORT}/api/turmas`);
});
