/**
 * updateRanking.js
 * ----------------
 * Busca o perfil de cada aluno na API pública do Monkeytype,
 * extrai o maior WPM válido e salva o ranking ordenado em data/ranking.json.
 *
 * Executar:
 *   node scripts/updateRanking.js
 *   node scripts/updateRanking.js --turma "TECI 2025/1 INT"
 *
 * Cron diário:
 *   0 3 * * * /usr/bin/node /caminho/project/scripts/updateRanking.js
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
const TURMA_DELAY_MS = 30 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
        } catch {
          reject(new Error(`JSON inválido vindo de ${url}`));
        }

      });

    }).on('error', reject);

  });
}

async function fetchProfile(username) {

  const url  = `${MONKEYTYPE_API}/users/${encodeURIComponent(username)}/profile`;
  const json = await fetchJSON(url);

  if (!json.data) {
    throw new Error(`Perfil sem campo "data" para ${username}`);
  }

  return json.data;
}

function extractBestWpm(profile) {

  const cutoff = Date.now() - NINETY_DAYS_MS;
  const timeBests = profile?.personalBests?.time;

  if (!timeBests || typeof timeBests !== 'object') {
    return null;
  }

  let best = null;

  for (const duration of Object.values(timeBests)) {

    if (!Array.isArray(duration)) continue;

    for (const entry of duration) {

      if (!entry.timestamp || entry.timestamp < cutoff) continue;
      if (typeof entry.wpm !== 'number') continue;

      if (!best || entry.wpm > best.wpm) {
        best = {
          wpm: Math.round(entry.wpm * 100) / 100,
          timestamp: entry.timestamp
        };
      }

    }
  }

  return best;
}

// ── Lógica principal ──────────────────────────────────────────────────────────

async function main() {

  console.log(`[${new Date().toISOString()}] Iniciando atualização do ranking…`);

  const turmaArgIndex = process.argv.indexOf('--turma');
  const turmaFiltro = turmaArgIndex !== -1
    ? process.argv[turmaArgIndex + 1]
    : null;

  if (turmaFiltro) {
    console.log(`🔎 Atualizando apenas a turma: ${turmaFiltro}`);
  }

  // ── ler students
  const studentsRaw = fs.readFileSync(STUDENTS_PATH, 'utf8');
  const { turmas }  = JSON.parse(studentsRaw);

  // ── ler ranking existente (para não apagar outras turmas)
  let ranking = {};

  if (fs.existsSync(RANKING_PATH)) {
    ranking = JSON.parse(fs.readFileSync(RANKING_PATH, 'utf8'));
  }

  const turmasEntries = Object.entries(turmas);

  for (let i = 0; i < turmasEntries.length; i++) {

    const [turmaName, alunos] = turmasEntries[i];

    if (turmaFiltro && turmaName !== turmaFiltro) {
      continue;
    }

    console.log(`\n📚 Turma ${turmaName} (${alunos.length} alunos)`);

    const entries = [];

    for (const aluno of alunos) {

      try {

        const profile = await fetchProfile(aluno.username);
        const best    = extractBestWpm(profile);

        if (!best) {
          console.log(`⚠ ${aluno.displayName} (${aluno.username}): sem registros válidos`);
          continue;
        }

        console.log(`✓ ${aluno.displayName} (${aluno.username}): ${best.wpm} WPM`);

        entries.push({
          displayName: aluno.displayName,
          username: aluno.username,
          wpm: best.wpm,
          timestamp: best.timestamp
        });

      } catch (err) {

        console.error(`✗ ${aluno.displayName} (${aluno.username}): ${err.message}`);

      }

    }

    // ordenar ranking
    entries.sort((a, b) => b.wpm - a.wpm);

    // atualizar apenas esta turma
    ranking[turmaName] = entries;

    if (!turmaFiltro && i < turmasEntries.length - 1) {
      console.log(`⏳ Aguardando 30 segundos antes da próxima turma...`);
      await sleep(TURMA_DELAY_MS);
    }

  }

  // salvar ranking mantendo turmas existentes
  fs.writeFileSync(
    RANKING_PATH,
    JSON.stringify(ranking, null, 2),
    'utf8'
  );

  console.log(`\n[${new Date().toISOString()}] ranking.json atualizado com sucesso.`);

}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
