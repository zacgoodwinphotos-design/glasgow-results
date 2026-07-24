# Glasgow 2026 athlete results

A small live dashboard that reads the official Glasgow 2026 swimming schedule, start-list and results feeds and displays results for AP Race and Sprint With The Stars athletes.

## Glasgow results token

The official Glasgow results API requires a short-lived bearer token. If you have approved server API access, configure it as `GLASGOW_RESULTS_TOKEN` in the environment where the server runs. Keep it out of the codebase. When direct access is unavailable, the dashboard remains available and shows results that have been confirmed from the official results pages.

Run it with Node 18+:

```sh
node server.js
```

Then open `http://localhost:3000`. The dashboard refreshes every minute. Collector updates are retained in the server's memory until it restarts.

## Optional Safari collector (no API key)

`official-results-collector.applescript` reads the visible public result table in Safari and sends confirmed AP Race and Sprint With The Stars individual-event results to the dashboard every minute. It needs Safari's **Develop → Allow JavaScript from Apple Events** option enabled. Keep Safari and your Mac running while it collects.

Set the same private `COLLECTOR_SECRET` value in Render's Environment settings (or in your local Terminal before starting the server), then run the collector in a second Terminal window:

```sh
osascript official-results-collector.applescript https://your-dashboard.onrender.com your-private-collector-secret
```

The collector only posts a result once it is visible on Glasgow's official page. It does not access or store Glasgow API tokens, cookies, or credentials. Relay events are not included yet because their official event codes have not been confirmed.
