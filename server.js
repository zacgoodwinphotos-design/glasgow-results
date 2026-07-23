import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const port = process.env.PORT || 3000;
const sourceUrl = 'https://www.tntsports.co.uk/commonwealth-games/2026/score-center.shtml';
const athletes = ['Shannon McIlroy', 'Gary Kelly'];
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function clean(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseResult(text, athlete) {
  const opponentAndScore = text.replace(athlete, '').trim();
  // TNT currently writes fixtures as "Athlete 2 0 Opponent".
  const scoreFirst = opponentAndScore.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(.*)$/);
  if (scoreFirst) return { opponent: scoreFirst[3], score: `${scoreFirst[1]} – ${scoreFirst[2]}` };
  const match = opponentAndScore.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
  return match ? { opponent: match[1], score: `${match[2]} – ${match[3]}` } : { opponent: opponentAndScore || '—', score: '—' };
}

async function getResults() {
  const response = await fetch(sourceUrl, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; ResultsDashboard/1.0)' } });
  if (!response.ok) throw new Error(`TNT Sports returned ${response.status}`);
  const page = await response.text();

  return athletes.flatMap((athlete) => {
    // Fixtures are linked on the score centre. Limiting parsing to links avoids names from navigation and scripts.
    const fragment = (page.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []).map(clean)
      .find((text) => text.includes(athlete) && /\d+(?:\.\d+)?\s+\d+(?:\.\d+)?/.test(text));
    if (!fragment) return [];
    const { opponent, score } = parseResult(fragment, athlete);
    return [{ athlete, opponent, score, event: "Bowls · Men's Singles · Group B" }];
  });
}

createServer(async (request, response) => {
  if (request.url === '/api/results') {
    try {
      const body = JSON.stringify({ results: await getResults(), updatedAt: new Date().toISOString(), sourceUrl });
      response.writeHead(200, { 'content-type': 'application/json' }).end(body);
    } catch (error) {
      response.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Could not retrieve the latest results.', detail: error.message }));
    }
    return;
  }
  const pathname = request.url === '/' ? '/index.html' : request.url;
  if (!pathname.startsWith('/') || pathname.includes('..')) return response.writeHead(404).end();
  try {
    const file = await readFile(join('public', pathname));
    response.writeHead(200, { 'content-type': mimeTypes[extname(pathname)] || 'application/octet-stream' }).end(file);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, () => console.log(`Results dashboard running at http://localhost:${port}`));
