import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const port = process.env.PORT || 3000;
const sourceUrl = 'https://www.glasgow2026.com/results/detailed/#/athletic-sports-schedule/SWM/*';
const officialApiUrl = 'https://crs-cg2026-api.glasgow2026.com/api/v2';
const officialApiToken = process.env.GLASGOW_RESULTS_TOKEN;
const collectorSecret = process.env.COLLECTOR_SECRET;
let resultsCache = { expiresAt: 0, groups: null };
const collectedOfficialResults = new Map();
const confirmedOfficialResults = {
  'adamramsaypeaty|mens100mbreaststroke|heats': {
    result: 'Rank 1 · 59.46 · Qualified for Semi-Final',
    startsAt: '2026-07-24T11:54:00+01:00',
    status: 'OFFICIAL'
  },
  'filipnowacki|mens100mbreaststroke|heats': {
    result: 'Rank 1 · 59.93 · Qualified for Semi-Final',
    startsAt: '2026-07-24T12:02:49+01:00',
    status: 'OFFICIAL'
  }
};
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
const sprintWithTheStarsProgramme = {
  'Ollie Morgan': [
    ['24 Jul', 'Morning', "Men's 50m Backstroke", 'Heats'], ['25 Jul', 'Evening', "Men's 50m Backstroke", 'Final'],
    ['26 Jul', 'Morning', "Men's 200m Backstroke", 'Heats'], ['26 Jul', 'Evening', "Men's 200m Backstroke", 'Final'],
    ['28 Jul', 'Morning', "Men's 100m Backstroke", 'Heats'], ['28 Jul', 'Evening', "Men's 100m Backstroke", 'Semi-Final'], ['29 Jul', 'Evening', "Men's 100m Backstroke", 'Final']
  ],
  'Abbie Wood': [
    ['28 Jul', 'Morning', "Women's 200m Individual Medley", 'Heats'], ['28 Jul', 'Evening', "Women's 200m Individual Medley", 'Final'],
    ['29 Jul', 'Morning', "Women's 200m Breaststroke", 'Heats'], ['29 Jul', 'Evening', "Women's 200m Breaststroke", 'Final']
  ],
  'Angharad Evans': [
    ['25 Jul', 'Morning', "Women's 100m Breaststroke", 'Heats'], ['25 Jul', 'Evening', "Women's 100m Breaststroke", 'Semi-Final'], ['26 Jul', 'Evening', "Women's 100m Breaststroke", 'Final'],
    ['29 Jul', 'Morning', "Women's 200m Breaststroke", 'Heats'], ['29 Jul', 'Evening', "Women's 200m Breaststroke", 'Final']
  ]
};
const athleteProgramme = { ...apRaceProgramme, ...sprintWithTheStarsProgramme };
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function normalise(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function raceKey(athleteName, event, phase) {
  return [athleteName, event, phase].map(normalise).join('|');
}

const trackedRaceKeys = new Set(Object.entries(athleteProgramme).flatMap(([athleteName, races]) =>
  races.map(([, , event, phase]) => raceKey(athleteName, event, phase))
));

const publishedScheduleTimes = Object.fromEntries([
  ['Adam Ramsay-Peaty', "Men's 100m Breaststroke", 'Semi-Final', '2026-07-24T20:31:00+01:00'],
  ['Adam Ramsay-Peaty', "Men's 100m Breaststroke", 'Final', '2026-07-25T21:04:00+01:00'],
  ['Adam Ramsay-Peaty', "Men's 50m Breaststroke", 'Heats', '2026-07-26T10:59:00+01:00'],
  ['Adam Ramsay-Peaty', "Men's 50m Breaststroke", 'Semi-Final', '2026-07-26T19:57:00+01:00'],
  ['Adam Ramsay-Peaty', "Men's 50m Breaststroke", 'Final', '2026-07-27T20:07:00+01:00'],
  ['Adam Ramsay-Peaty', 'Mixed 4 x 100m Medley Relay', 'Heats', '2026-07-28T12:31:00+01:00'],
  ['Adam Ramsay-Peaty', 'Mixed 4 x 100m Medley Relay', 'Final', '2026-07-28T21:42:00+01:00'],
  ['Adam Ramsay-Peaty', "Men's 4 x 100m Medley Relay", 'Heats', '2026-07-29T11:52:00+01:00'],
  ['Adam Ramsay-Peaty', "Men's 4 x 100m Medley Relay", 'Final', '2026-07-29T21:31:00+01:00'],

  ['Filip Nowacki', "Men's 100m Breaststroke", 'Semi-Final', '2026-07-24T20:31:00+01:00'],
  ['Filip Nowacki', "Men's 100m Breaststroke", 'Final', '2026-07-25T21:04:00+01:00'],
  ['Filip Nowacki', "Men's 50m Breaststroke", 'Heats', '2026-07-26T10:59:00+01:00'],
  ['Filip Nowacki', "Men's 50m Breaststroke", 'Semi-Final', '2026-07-26T19:57:00+01:00'],
  ['Filip Nowacki', "Men's 50m Breaststroke", 'Final', '2026-07-27T20:07:00+01:00'],
  ['Filip Nowacki', "Men's 200m Breaststroke", 'Heats', '2026-07-28T11:36:00+01:00'],
  ['Filip Nowacki', "Men's 200m Breaststroke", 'Final', '2026-07-28T20:42:00+01:00'],

  ['Lauren Cox', "Women's 100m Backstroke", 'Heats', '2026-07-25T11:09:00+01:00'],
  ['Lauren Cox', "Women's 100m Backstroke", 'Semi-Final', '2026-07-25T19:16:00+01:00'],
  ['Lauren Cox', "Women's 100m Backstroke", 'Final', '2026-07-26T20:20:00+01:00'],
  ['Lauren Cox', "Women's 50m Backstroke", 'Heats', '2026-07-27T10:57:00+01:00'],
  ['Lauren Cox', "Women's 50m Backstroke", 'Semi-Final', '2026-07-27T20:28:00+01:00'],
  ['Lauren Cox', 'Mixed 4 x 100m Medley Relay', 'Heats', '2026-07-28T12:31:00+01:00'],
  ['Lauren Cox', 'Mixed 4 x 100m Medley Relay', 'Final', '2026-07-28T21:42:00+01:00'],
  ['Lauren Cox', "Women's 50m Backstroke", 'Final', '2026-07-28T20:36:00+01:00'],
  ['Lauren Cox', "Women's 4 x 100m Medley Relay", 'Heats', '2026-07-29T11:40:00+01:00'],
  ['Lauren Cox', "Women's 4 x 100m Medley Relay", 'Final', '2026-07-29T21:20:00+01:00'],

  ['Luke Greenbank', "Men's 200m Backstroke", 'Heats', '2026-07-26T11:36:00+01:00'],
  ['Luke Greenbank', "Men's 200m Backstroke", 'Final', '2026-07-26T20:27:00+01:00'],
  ['Luke Greenbank', "Men's 200m Butterfly", 'Heats', '2026-07-27T10:30:00+01:00'],
  ['Luke Greenbank', "Men's 200m Butterfly", 'Final', '2026-07-27T21:14:00+01:00'],

  ['Matthew Richards', "Men's 100m Freestyle", 'Heats', '2026-07-27T11:09:00+01:00'],
  ['Matthew Richards', "Men's 100m Freestyle", 'Semi-Final', '2026-07-27T19:17:00+01:00'],
  ['Matthew Richards', "Men's 100m Freestyle", 'Final', '2026-07-28T19:18:00+01:00'],
  ['Matthew Richards', "Men's 200m Freestyle", 'Heats', '2026-07-29T10:42:00+01:00'],
  ['Matthew Richards', "Men's 200m Freestyle", 'Final', '2026-07-29T19:21:00+01:00'],

  ['Ollie Morgan', "Men's 50m Backstroke", 'Heats', '2026-07-24T11:26:00+01:00'],
  ['Ollie Morgan', "Men's 50m Backstroke", 'Final', '2026-07-25T19:49:00+01:00'],
  ['Ollie Morgan', "Men's 200m Backstroke", 'Heats', '2026-07-26T11:36:00+01:00'],
  ['Ollie Morgan', "Men's 200m Backstroke", 'Final', '2026-07-26T20:27:00+01:00'],
  ['Ollie Morgan', "Men's 100m Backstroke", 'Heats', '2026-07-28T12:11:00+01:00'],
  ['Ollie Morgan', "Men's 100m Backstroke", 'Semi-Final', '2026-07-28T21:03:00+01:00'],
  ['Ollie Morgan', "Men's 100m Backstroke", 'Final', '2026-07-29T19:07:00+01:00'],

  ['Abbie Wood', "Women's 200m Individual Medley", 'Heats', '2026-07-28T10:43:00+01:00'],
  ['Abbie Wood', "Women's 200m Individual Medley", 'Final', '2026-07-28T19:39:00+01:00'],
  ['Abbie Wood', "Women's 200m Breaststroke", 'Heats', '2026-07-29T10:30:00+01:00'],
  ['Abbie Wood', "Women's 200m Breaststroke", 'Final', '2026-07-29T19:13:00+01:00'],

  ['Angharad Evans', "Women's 100m Breaststroke", 'Heats', '2026-07-25T11:36:00+01:00'],
  ['Angharad Evans', "Women's 100m Breaststroke", 'Semi-Final', '2026-07-25T20:55:00+01:00'],
  ['Angharad Evans', "Women's 100m Breaststroke", 'Final', '2026-07-26T19:20:00+01:00'],
  ['Angharad Evans', "Women's 200m Breaststroke", 'Heats', '2026-07-29T10:30:00+01:00'],
  ['Angharad Evans', "Women's 200m Breaststroke", 'Final', '2026-07-29T19:13:00+01:00']
].map(([athlete, event, phase, startsAt]) => [raceKey(athlete, event, phase), { startsAt, status: 'SCHEDULED' }]));

function officialUrl(path, parameters) {
  const url = new URL(`${officialApiUrl}${path}`);
  url.search = new URLSearchParams({ competitionCode: 'CG2026', disciplineCode: 'SWM', languageCode: 'ENG', ...parameters });
  return url;
}

async function officialFetch(path, parameters = {}) {
  if (!officialApiToken) {
    throw new Error('Glasgow results access token is not configured on this server');
  }
  // The public Glasgow feed is normally requested by its website. Supplying the
  // same ordinary browser context avoids some hosting providers receiving a
  // generic 403 response for a bare server-to-server request.
  const response = await fetch(officialUrl(path, parameters), {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-GB,en;q=0.9',
      authorization: `Bearer ${officialApiToken}`,
      origin: 'https://www.glasgow2026.com',
      referer: 'https://www.glasgow2026.com/results/detailed/',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Safari/605.1.15'
    },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Glasgow 2026 results API returned ${response.status}`);
  const body = await response.json();
  if (body.ResponseCode !== 200 || !Array.isArray(body.Data)) throw new Error('Glasgow 2026 returned an unexpected results response');
  return body.Data;
}

function officialEventFor(schedule, event, phase) {
  const wantedEvent = normalise(event);
  const wantedPhase = phase === 'Heats' ? 'heats' : normalise(phase);
  return schedule.find((entry) => normalise(entry.EventDescription) === wantedEvent
    && normalise(entry.PhasePrintDescription || entry.PhaseDescription).includes(wantedPhase)) || null;
}

function athleteNames(resultRow) {
  return (resultRow.Composition?.Athlete || []).flatMap((athlete) => {
    const description = athlete.Description || {};
    return [
      `${description.GivenName || ''} ${description.FamilyName || ''}`,
      description.TVName,
      description.PrintName
    ];
  });
}

function rowForAthlete(resultRows, athlete) {
  return resultRows.find((row) => athleteNames(row).some((name) =>
    athlete.aliases.some((alias) => normalise(name) === normalise(alias))
  )) || null;
}

function resultText(row) {
  if (!row || !row.Result) return null;
  return row.Rank ? `Rank ${row.Rank} · ${row.Result}` : row.Result;
}

function timeOnly(dateTime) {
  const time = String(dateTime || '').match(/T(\d{2}:\d{2})/);
  return time?.[1] || null;
}

async function resultRowsForEvent(scheduleEntry) {
  if (!scheduleEntry) return [];
  try {
    return await officialFetch('/results', {
      genderCode: scheduleEntry.GenderCode,
      eventCode: scheduleEntry.EventCode,
      phaseCode: scheduleEntry.PhaseCode
    });
  } catch {
    // Timings remain available from the schedule even when a start list/result has not yet been published.
    return [];
  }
}

async function getOfficialResults() {
  const schedule = await officialFetch('/schedules/startList');
  const plannedRaces = athleteGroups.flatMap((group) => group.athletes.flatMap((athlete) =>
    (athleteProgramme[athlete.name] || []).map(([date, session, event, phase]) => ({ athlete, date, session, event, phase }))
  ));
  const entries = new Map();
  for (const race of plannedRaces) {
    const entry = officialEventFor(schedule, race.event, race.phase);
    if (entry) entries.set(entry.Code, entry);
  }
  const rowsByEntry = new Map(await Promise.all([...entries.values()].map(async (entry) => [
    entry.Code, await resultRowsForEvent(entry)
  ])));
  const groups = athleteGroups.map((group) => ({
    name: group.name,
    athletes: group.athletes.map((athlete) => {
      const races = (athleteProgramme[athlete.name] || []).map(([date, session, event, phase]) => {
        const entry = officialEventFor(schedule, event, phase);
        const athleteRow = rowForAthlete(rowsByEntry.get(entry?.Code) || [], athlete);
        const startsAt = athleteRow?.DateEvent || entry?.ActualStartDate || entry?.StartDate || null;
        return {
          date, session: entry?.Session?.SessionTypeDescription || session, event, phase,
          time: timeOnly(startsAt), result: resultText(athleteRow),
          status: athleteRow?.ResultStatus || athleteRow?.ScheduleStatus || entry?.ResultStatus || entry?.ScheduleStatus || null,
          startsAt,
          endsAt: entry?.ActualEndDate || entry?.EndDate || null
        };
      });
      return { name: athlete.name, races };
    })
  }));
  return groups;
}

function getFallbackResults() {
  return athleteGroups.map((group) => ({
    name: group.name,
    athletes: group.athletes.map((athlete) => ({
      name: athlete.name,
      races: (athleteProgramme[athlete.name] || []).map(([date, session, event, phase]) => {
        const key = raceKey(athlete.name, event, phase);
        const confirmed = collectedOfficialResults.get(key) || confirmedOfficialResults[key] || publishedScheduleTimes[key];
        return {
          date,
          session,
          event,
          phase,
          time: timeOnly(confirmed?.startsAt),
          result: confirmed?.result || null,
          status: confirmed?.status || 'SCHEDULED',
          startsAt: confirmed?.startsAt || null,
          endsAt: null
        };
      })
    }))
  }));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20_000) reject(new Error('Request body is too large'));
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function getResults() {
  if (resultsCache.groups && resultsCache.expiresAt > Date.now()) return resultsCache.groups;
  let groups;
  try {
    groups = await getOfficialResults();
  } catch (error) {
    console.warn('Using confirmed official results fallback:', error.message);
    groups = getFallbackResults();
  }
  resultsCache = { groups, expiresAt: Date.now() + 60_000 };
  return groups;
}

createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/api/collector-results') {
    try {
      if (!collectorSecret || request.headers['x-collector-secret'] !== collectorSecret) {
        response.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Unauthorised collector' }));
        return;
      }
      const incoming = JSON.parse(await readRequestBody(request));
      const key = raceKey(incoming.athleteName, incoming.event, incoming.phase);
      if (!trackedRaceKeys.has(key) || typeof incoming.result !== 'string' || !incoming.result.trim()) {
        response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Invalid collector result' }));
        return;
      }
      collectedOfficialResults.set(key, {
        result: incoming.result.trim(),
        startsAt: incoming.startsAt || null,
        status: 'OFFICIAL',
        sourceUrl: incoming.sourceUrl || null
      });
      resultsCache.expiresAt = 0;
      response.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ saved: true }));
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: error.message || 'Invalid collector request' }));
    }
    return;
  }
  if (request.url === '/api/results') {
    try {
      const body = JSON.stringify({ groups: await getResults(), updatedAt: new Date().toISOString(), sourceUrl });
      response.writeHead(200, { 'content-type': 'application/json' }).end(body);
    } catch (error) {
      console.error('Glasgow 2026 results request failed:', error);
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
