/**
 * Trello pipeline extractor — fetches all boards, lists, and cards from Trello API
 * and saves the full pipeline structure for dashboard unification.
 *
 * Run from repo root: node mi_spa_bi_system/scripts/trello-extract-pipeline.js
 * Requires .env with API_TRELLO_KEY and TRELLO_TOKEN.
 */

const fs = require('fs');
const path = require('path');

// Load .env from workspace root (try cwd first, then relative to script)
function loadEnv() {
  const envPath = fs.existsSync(path.join(process.cwd(), '.env'))
    ? path.join(process.cwd(), '.env')
    : path.join(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env (expected API_TRELLO_KEY, TRELLO_TOKEN). Tried:', envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const k = m[1].trim().replace(/\r/g, '');
      const v = m[2].trim().replace(/^["']|["']$/g, '').replace(/\r/g, '');
      process.env[k] = v;
    }
  });
}

loadEnv();
const key = process.env.API_TRELLO_KEY;
const token = process.env.TRELLO_TOKEN;
if (!key || !token) {
  console.error('Set API_TRELLO_KEY and TRELLO_TOKEN in .env');
  process.exit(1);
}

const BASE = 'https://api.trello.com/1';

async function get(url) {
  const u = url.includes('?') ? `${url}&key=${key}&token=${token}` : `${url}?key=${key}&token=${token}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Trello API ${r.status}: ${r.statusText} — ${url}`);
  return r.json();
}

async function main() {
  console.log('Fetching Trello boards...');
  const boards = await get(`${BASE}/members/me/boards?filter=open&fields=name,url,id,desc`);
  console.log(`Found ${boards.length} board(s).`);

  const pipeline = { boards: [], summary: {} };

  for (const board of boards) {
    const boardData = {
      id: board.id,
      name: board.name,
      url: board.url,
      desc: board.desc || '',
      lists: [],
      cardsByList: {},
      totalCards: 0,
    };

    const lists = await get(`${BASE}/boards/${board.id}/lists?fields=name,id,pos`);
    boardData.lists = lists.sort((a, b) => (a.pos || 0) - (b.pos || 0));

    const cards = await get(`${BASE}/boards/${board.id}/cards?fields=name,id,idList,desc,due,labels,idMembers,shortLink`);
    for (const list of boardData.lists) {
      boardData.cardsByList[list.name] = cards.filter((c) => c.idList === list.id).map((c) => ({
        id: c.id,
        shortLink: c.shortLink,
        name: c.name,
        desc: (c.desc || '').slice(0, 200),
        due: c.due || null,
        labels: (c.labels || []).map((l) => l.name || l.color),
      }));
      boardData.totalCards += boardData.cardsByList[list.name].length;
    }

    pipeline.boards.push(boardData);
    pipeline.summary[board.name] = {
      lists: boardData.lists.map((l) => l.name),
      totalCards: boardData.totalCards,
    };
  }

  const outDir = path.join(__dirname, '../dashboard/public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'trello-pipeline-export.json');
  fs.writeFileSync(outFile, JSON.stringify(pipeline, null, 2), 'utf8');
  console.log('Written:', outFile);

  // Also write a markdown report for README/unification doc
  const md = [];
  md.push('# Trello pipeline export — para unificar en el dashboard\n');
  md.push(`Exportado: ${new Date().toISOString()}\n`);
  for (const b of pipeline.boards) {
    md.push(`## Board: ${b.name}`);
    md.push(`- URL: ${b.url}`);
    md.push(`- Listas (columnas del pipeline), en orden:\n`);
    b.lists.forEach((list, i) => {
      const count = (b.cardsByList[list.name] || []).length;
      md.push(`${i + 1}. **${list.name}** (${count} cards)`);
    });
    md.push('');
    md.push('### Cards por lista (resumen)');
    for (const list of b.lists) {
      const cards = b.cardsByList[list.name] || [];
      md.push(`\n#### ${list.name}`);
      cards.slice(0, 20).forEach((c) => {
        md.push(`- ${c.name}${c.due ? ` (due: ${c.due})` : ''} ${c.labels?.length ? `[${c.labels.join(', ')}]` : ''}`);
      });
      if (cards.length > 20) md.push(`- ... y ${cards.length - 20} más`);
    }
    md.push('\n---\n');
  }
  const mdPath = path.join(__dirname, 'TRELLO-PIPELINE-EXPORT.md');
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');
  console.log('Report:', mdPath);

  return pipeline;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
