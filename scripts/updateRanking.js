/**
 * updateRanking.js
 * ----------------
 * Busca o perfil de cada aluno na API pública do Monkeytype,
 * extrai o maior WPM válido dos últimos 90 dias e salva
 * o ranking ordenado em data/ranking.json.
 *
 * Execute manualmente:  node scripts/updateRanking.js
 * Via cron diário:      0 3 * * * /usr/bin/node /caminho/project/scripts/updateRanking.js
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ── Caminhos ──────────────────────────────────────────────────────────────────
const STUDENTS_PATH = path.join(__dirname, '..', 'data', 'students.json');
const RANKING_PATH  = path.join(__dirname, '..', 'data', 'ranking.json');

// ── Constantes ────────────────────────────────────────────────────────────────
const MONKEYTYPE_API = 'https://api.monkeytype.com';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Faz uma requisição GET simples e retorna o corpo como objeto JS.
 * Usa o módulo nativo `https` para não precisar de dependências extras.
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} para ${url}`));
        }
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`JSON inválido vindo de ${url}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Busca o perfil público de um usuário no Monkeytype.
 * Retorna o objeto `data` da resposta ou lança erro.
 */
async function fetchProfile(username) {
  const url  = `${MONKEYTYPE_API}/users/${encodeURIComponent(username)}/profile`;
  const json = await fetchJSON(url);
  if (!json.data) throw new Error(`Perfil sem campo "data" para ${username}`);
  return json.data;
}

/**
 * Extrai o maior WPM dentre todos os personalBests.time
 * que possuam timestamp dentro dos últimos 90 dias.
 *
 * Retorna { wpm, timestamp } ou null se nenhum registro válido existir.
 */
function extractBestWpm(profile) {
  const cutoff      = Date.now() - NINETY_DAYS_MS;
  const timeBests   = profile?.personalBests?.time;

  if (!timeBests || typeof timeBests !== 'object') return null;

  let best = null;

  // timeBests é um objeto cujas chaves são as durações: "15", "30", "60", "120", …
  for (const duration of Object.values(timeBests)) {
    if (!Array.isArray(duration)) continue;

    for (const entry of duration) {
      // Ignora registros fora da janela de 90 dias
      // if (!entry.timestamp || entry.timestamp < cutoff) continue;
      if (typeof entry.wpm !== 'number')                continue;

      if (!best || entry.wpm > best.wpm) {
        best = { wpm: Math.round(entry.wpm * 100) / 100, timestamp: entry.timestamp };
      }
    }
  }

  return best;
}

// ── Lógica principal ──────────────────────────────────────────────────────────

async function main() {
  console.log(`[${new Date().toISOString()}] Iniciando atualização do ranking…`);

  // 1. Lê a lista de alunos
  const studentsRaw = fs.readFileSync(STUDENTS_PATH, 'utf8');
  const { turmas }  = JSON.parse(studentsRaw);

  const ranking = {};

  // 2. Processa cada turma
  for (const [turmaName, alunos] of Object.entries(turmas)) {
    console.log(`  Turma ${turmaName} (${alunos.length} alunos)`);
    const entries = [];

    // 3. Processa cada aluno da turma
    for (const aluno of alunos) {
      try {
        const profile = await fetchProfile(aluno.username);
        const best    = extractBestWpm(profile);

        if (!best) {
          console.log(`    ⚠  ${aluno.displayName} (${aluno.username}): sem registros válidos nos últimos 90 dias`);
          continue;
        }

        console.log(`    ✓  ${aluno.displayName} (${aluno.username}): ${best.wpm} WPM`);
        entries.push({
          displayName: aluno.displayName,
          username:    aluno.username,
          wpm:         best.wpm,
          timestamp:   best.timestamp,
        });
      } catch (err) {
        // Não quebra o script; apenas registra o erro e segue
        console.error(`    ✗  ${aluno.displayName} (${aluno.username}): ${err.message}`);
      }
    }

    // 4. Ordena por WPM decrescente
    entries.sort((a, b) => b.wpm - a.wpm);
    ranking[turmaName] = entries;
  }

  // 5. Salva o snapshot
  fs.writeFileSync(RANKING_PATH, JSON.stringify(ranking, null, 2), 'utf8');
  console.log(`[${new Date().toISOString()}] ranking.json atualizado com sucesso em ${RANKING_PATH}`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
