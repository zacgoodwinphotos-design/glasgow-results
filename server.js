import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const port = process.env.PORT || 3000;
const sourceUrl = 'https://www.tntsports.co.uk/swimming/commonwealth-games-2026-swimming/2026/calendar-results.shtml';
const athleteGroups = [
  {
    name: 'AP Race',
    athletes: [
      { name: 'Matthew Richards', aliases: ['Matthew Richards'] },
      { name: 'Adam Ramsay-Peaty', aliases: ['Adam Ramsay-Peaty', 'Adam Peaty'] },
      { name: 'Lauren Cox', aliases: ['Lauren Cox'] },
      { name: 'Luke Greenbank', aliases: ['Luke Greenbank'] },
      { name: 'Filip Nowacki', aliases: ['Filip Nowacki'] }
    ]
  },
  {
    name: 'Sprint With The Stars',
    athletes: [
      { name: 'Noe Ponti', aliases: ['Noe Ponti'] },
      { name: 'Abbie Wood', aliases: ['Abbie Wood'] },
      { name: 'Ollie Morgan', aliases: ['Ollie Morgan', 'Oliver Morgan'] },
      { name: 'Angharad Evans', aliases: ['Angharad Evans'] }
    ]
  }
];
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function clean(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getResults() {
  const response = await fetch(sourceUrl, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; ResultsDashboard/1.0)' } });
  if (!response.ok) throw new Error(`TNT Sports returned ${response.status}`);
  const page = await response.text();

  const links = (page.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []).map(clean);
  return athleteGroups.map((group) => ({
    name: group.name,
    athletes: group.athletes.map((athlete) => {
      const result = links.find((text) => athlete.aliases.some((alias) => text.includes(alias)) && text.length > athlete.aliases[0].length);
      return { name: athlete.name, result: result || null };
    })
  }));
}

createServer(async (request, response) => {
  if (request.url === '/api/results') {
    try {
      const body = JSON.stringify({ groups: await getResults(), updatedAt: new Date().toISOString(), sourceUrl });
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
}).listen(port, '0.0.0.0', () => console.log(`Results dashboard running at http://localhost:${port}`));
