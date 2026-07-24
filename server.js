import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const port = process.env.PORT || 3000;
const sourceUrl = 'https://www.tntsports.co.uk/swimming/commonwealth-games-2026-swimming/2026/calendar-results.shtml';
const netsportUrl = 'https://netsport.eurosport.io/';
const taxonomyId = 'f07fac85-c65b-4ae7-b34e-30e8fd347a38';
const scheduleDates = ['2026-07-24', '2026-07-25', '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29'];
const persistedQuery = 'b367c2578b314815f61f33d3edd97a19b02540ce2d4a2b43baceb3130e835088';
let calendarCache = { expiresAt: 0, cardsByDate: null };
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
const apRaceProgramme = {
  'Matthew Richards': [
    ['27 Jul', 'Morning', "Men's 100m Freestyle", 'Heats'], ['27 Jul', 'Evening', "Men's 100m Freestyle", 'Semi-Final'], ['28 Jul', 'Evening', "Men's 100m Freestyle", 'Final'], ['29 Jul', 'Morning', "Men's 200m Freestyle", 'Heats'], ['29 Jul', 'Evening', "Men's 200m Freestyle", 'Final']
  ],
  'Adam Ramsay-Peaty': [
    ['24 Jul', 'Morning', "Men's 100m Breaststroke", 'Heats'], ['24 Jul', 'Evening', "Men's 100m Breaststroke", 'Semi-Final'], ['25 Jul', 'Evening', "Men's 100m Breaststroke", 'Final'], ['26 Jul', 'Morning', "Men's 50m Breaststroke", 'Heats'], ['26 Jul', 'Evening', "Men's 50m Breaststroke", 'Semi-Final'], ['27 Jul', 'Evening', "Men's 50m Breaststroke", 'Final'], ['28 Jul', 'Morning', 'Mixed 4 x 100m Medley Relay', 'Heats'], ['28 Jul', 'Evening', 'Mixed 4 x 100m Medley Relay', 'Final'], ['29 Jul', 'Morning', "Men's 4 x 100m Medley Relay", 'Heats'], ['29 Jul', 'Evening', "Men's 4 x 100m Medley Relay", 'Final']
  ],
  'Lauren Cox': [
    ['25 Jul', 'Morning', "Women's 100m Backstroke", 'Heats'], ['25 Jul', 'Evening', "Women's 100m Backstroke", 'Semi-Final'], ['26 Jul', 'Evening', "Women's 100m Backstroke", 'Final'], ['27 Jul', 'Morning', "Women's 50m Backstroke", 'Heats'], ['27 Jul', 'Evening', "Women's 50m Backstroke", 'Semi-Final'], ['28 Jul', 'Morning', 'Mixed 4 x 100m Medley Relay', 'Heats'], ['28 Jul', 'Evening', 'Mixed 4 x 100m Medley Relay', 'Final'], ['28 Jul', 'Evening', "Women's 50m Backstroke", 'Final'], ['29 Jul', 'Morning', "Women's 4 x 100m Medley Relay", 'Heats'], ['29 Jul', 'Evening', "Women's 4 x 100m Medley Relay", 'Final']
  ],
  'Luke Greenbank': [
    ['26 Jul', 'Morning', "Men's 200m Backstroke", 'Heats'], ['26 Jul', 'Evening', "Men's 200m Backstroke", 'Final'], ['27 Jul', 'Morning', "Men's 200m Butterfly", 'Heats'], ['27 Jul', 'Evening', "Men's 200m Butterfly", 'Final']
  ],
  'Filip Nowacki': [
    ['24 Jul', 'Morning', "Men's 100m Breaststroke", 'Heats'], ['24 Jul', 'Evening', "Men's 100m Breaststroke", 'Semi-Final'], ['25 Jul', 'Evening', "Men's 100m Breaststroke", 'Final'], ['26 Jul', 'Morning', "Men's 50m Breaststroke", 'Heats'], ['26 Jul', 'Evening', "Men's 50m Breaststroke", 'Semi-Final'], ['27 Jul', 'Evening', "Men's 50m Breaststroke", 'Final'], ['28 Jul', 'Morning', "Men's 200m Breaststroke", 'Heats'], ['28 Jul', 'Evening', "Men's 200m Breaststroke", 'Final']
  ]
};
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function clean(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function findTntTime(pageText, event, phase) {
  // TNT varies the order of event, gender and round (for example,
  // "100m Breaststroke / Men / Heat 1" or "Women / 100m Backstroke / Heat 1").
  const gender = event.match(/^(Men's|Women's|Mixed)\s+/)?.[1]?.replace("'s", '') || 'Mixed';
  const eventName = event.replace(/^(Men's|Women's|Mixed)\s+/, '');
  const eventPattern = escapeRegExp(eventName).replace(/\\ x /g, '\\s*x\\s*');
  const genderPattern = escapeRegExp(gender);
  const phasePattern = phase === 'Heats'
    ? 'Heat(?:s)?(?:\\s+\\d+)?'
    : phase === 'Semi-Final'
      ? 'Semi[- ]?Final'
      : 'Final';
  const eventMatches = pageText.matchAll(new RegExp(eventPattern, 'gi'));
  for (const match of eventMatches) {
    const window = pageText.slice(Math.max(0, match.index - 180), match.index + eventName.length + 300);
    if (!new RegExp(genderPattern, 'i').test(window) || !new RegExp(phasePattern, 'i').test(window)) continue;
    const time = window.match(/Starts\s+at\s+(\d{1,2}:\d{2})/i)?.[1];
    if (time) return time;
  }
  return null;
}

function normalise(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function eventCardFor(cards, event, phase) {
  const gender = event.match(/^(Men's|Women's|Mixed)\s+/)?.[1]?.replace("'s", '') || 'Mixed';
  const eventName = event.replace(/^(Men's|Women's|Mixed)\s+/, '');
  const phaseName = phase === 'Heats' ? 'heat' : normalise(phase);
  return cards.find((card) => {
    const title = normalise(card.title);
    return title.includes(normalise(eventName)) && title.includes(normalise(gender)) && title.includes(phaseName);
  }) || null;
}

function scheduleApiUrl(date, after) {
  const variables = {
    taxonomyId, genderNetsportId: null, seasonNetsportId: null,
    filters: [{ id: date, type: 'CALENDAR' }],
    first: 100, after, last: null, before: null, matchCardHeaderContext: 'DEFAULT'
  };
  const url = new URL(netsportUrl);
  url.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: persistedQuery } }));
  url.searchParams.set('operationName', 'scoreCenterCalendarResultsByTaxonomyIdQuery');
  url.searchParams.set('variables', JSON.stringify(variables));
  return url;
}

async function fetchDayCards(date) {
  let after = null;
  const cards = [];
  do {
    const response = await fetch(scheduleApiUrl(date, after), {
      headers: { domain: 'www.tntsports.co.uk', origin: 'https://www.tntsports.co.uk', 'premium-country-code': 'GB' }
    });
    if (!response.ok) throw new Error(`TNT schedule API returned ${response.status}`);
    const data = await response.json();
    const matchCards = data?.data?.scoreCenterCalendarResultsByTaxonomyId?.matchCards;
    cards.push(...(matchCards?.edges || []).map((edge) => edge.node));
    after = matchCards?.pageInfo?.hasNextPage ? matchCards.pageInfo.endCursor : null;
  } while (after);
  return cards;
}

async function getCalendarCards() {
  if (calendarCache.cardsByDate && calendarCache.expiresAt > Date.now()) return calendarCache.cardsByDate;
  const entries = await Promise.all(scheduleDates.map(async (date) => [date, await fetchDayCards(date)]));
  calendarCache = { cardsByDate: Object.fromEntries(entries), expiresAt: Date.now() + 60_000 };
  return calendarCache.cardsByDate;
}

async function getResults() {
  const cardsByDate = await getCalendarCards();
  return athleteGroups.map((group) => ({
    name: group.name,
    athletes: group.athletes.map((athlete) => {
      const races = (apRaceProgramme[athlete.name] || []).map(([date, session, event, phase]) => ({
        date, session, event, phase,
        time: eventCardFor(cardsByDate[`2026-07-${date.slice(0, 2)}`] || [], event, phase)?.timeOnlyInfo?.match(/\d{1,2}:\d{2}/)?.[0] || null,
        result: null
      }));
      return { name: athlete.name, races };
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
