const results = document.querySelector('#results');
const updated = document.querySelector('#updated');
const source = document.querySelector('#source');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

function card(athlete) {
  return `<article class="card">
    <h2>${escapeHtml(athlete.name)}</h2>
    <p class="result-detail">${athlete.result ? escapeHtml(athlete.result) : 'No result listed yet'}</p>
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
    if (!response.ok) throw new Error(data.error);
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
