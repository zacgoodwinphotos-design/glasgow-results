const results = document.querySelector('#results');
const updated = document.querySelector('#updated');
const source = document.querySelector('#source');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

function card(result) {
  return `<article class="card">
    <p class="event">${escapeHtml(result.event)}</p>
    <h2>${escapeHtml(result.athlete)}</h2>
    <div class="match"><span>vs ${escapeHtml(result.opponent)}</span><strong>${escapeHtml(result.score)}</strong></div>
  </article>`;
}

async function loadResults() {
  try {
    const response = await fetch('/api/results');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    results.innerHTML = data.results.length
      ? data.results.map(card).join('')
      : '<p class="status">No results are currently listed for these athletes.</p>';
    updated.textContent = `Checked ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.updatedAt))}`;
    source.href = data.sourceUrl;
  } catch (error) {
    results.innerHTML = `<p class="status error">${error.message || 'Unable to load results. Please try again shortly.'}</p>`;
  }
}

loadResults();
