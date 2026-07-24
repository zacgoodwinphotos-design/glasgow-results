const results = document.querySelector('#results');
const updated = document.querySelector('#updated');
const source = document.querySelector('#source');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

function raceIsLive(race) {
  if (['FINISHED', 'OFFICIAL', 'CANCELLED', 'POSTPONED'].includes(race.status)) return false;
  if (!race.startsAt) return race.status === 'LIVE';
  const startTime = Date.parse(race.startsAt);
  const now = Date.now();
  const endTime = race.endsAt ? Date.parse(race.endsAt) : startTime + 45 * 60 * 1000;
  return now >= startTime && now < endTime;
}

function isToday(raceDate) {
  const today = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'Europe/London' }).format(new Date());
  return today === raceDate;
}

function resultMarkup(result) {
  const finishTime = String(result).match(/(?:\d+:)?\d{1,2}\.\d{2}/)?.[0];
  if (!finishTime) return `<span class="race-result">Result: ${escapeHtml(result)}</span>`;
  const detail = String(result).replace(finishTime, '').replace(/\s*·\s*$/, '').trim();
  return `${detail ? `<span class="result-summary">${escapeHtml(detail)}</span>` : ''}
    <strong class="finish-time">${escapeHtml(finishTime)}</strong>`;
}

function raceRow(race) {
  const live = raceIsLive(race);
  return `<li class="${[live && 'race--live', race.result && 'race--result'].filter(Boolean).join(' ')}">
    <span class="race-date">${escapeHtml(race.session)}</span>
    <span class="race-event">${escapeHtml(race.event)} · ${escapeHtml(race.phase)}</span>
    <strong class="race-time">${live ? '<span class="live-dot" aria-hidden="true"></span>Live' : race.time ? escapeHtml(race.time) : 'Time awaiting official schedule'}</strong>
    ${race.result ? resultMarkup(race.result) : ''}
  </li>`;
}

function card(athlete) {
  const days = new Map();
  athlete.races?.forEach((race) => days.set(race.date, [...(days.get(race.date) || []), race]));
  const races = days.size
    ? `<div class="race-days">${[...days.entries()].map(([date, dayRaces]) => {
      const open = isToday(date) || dayRaces.some(raceIsLive);
      return `<details class="race-day"${open ? ' open' : ''}>
        <summary><span>${escapeHtml(date)}</span><span>${dayRaces.length} ${dayRaces.length === 1 ? 'event' : 'events'}</span></summary>
        <ul class="race-list">${dayRaces.map(raceRow).join('')}</ul>
      </details>`;
    }).join('')}</div>`
    : '';
  return `<article class="card">
    <h2>${escapeHtml(athlete.name)}</h2>
    ${races || '<p class="result-detail">No scheduled races listed yet</p>'}
  </article>`;
}

function group(section) {
  const slug = section.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const isSprintWithTheStars = section.name === 'Sprint With The Stars';
  const isAPRace = section.name === 'AP Race';
  const heading = isSprintWithTheStars
    ? `<h2 class="group-title group-title--logo" id="${slug}"><img class="group-logo" src="/assets/swts-logo.png" alt="Sprint With The Stars" /></h2>`
    : isAPRace
      ? `<h2 class="group-title group-title--logo" id="${slug}"><img class="group-logo group-logo--ap-race" src="/assets/ap-race-logo.png" alt="AP Race" /></h2>`
    : `<h2 class="group-title" id="${slug}">${escapeHtml(section.name)}</h2>`;
  return `<section class="group group--${slug}" aria-labelledby="${slug}">
    ${heading}
    <div class="results">${section.athletes.map(card).join('')}</div>
  </section>`;
}

async function loadResults() {
  try {
    const response = await fetch('/api/results');
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error);
    if (!Array.isArray(data.groups)) {
      throw new Error('The server is running an older version. Restart it, then refresh this page.');
    }
    results.innerHTML = data.groups.map(group).join('');
    updated.textContent = `Checked ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.updatedAt))}`;
    source.href = data.sourceUrl;
  } catch (error) {
    results.innerHTML = `<p class="status error">${error.message || 'Unable to load results. Please try again shortly.'}</p>`;
  }
}

loadResults();
setInterval(loadResults, 60_000);
