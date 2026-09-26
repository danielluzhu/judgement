# The Committee

A bureaucracy simulator for trivial decisions. Type in a small question and either
convene a full legislature of every model on Featherless, or hand the decision to
a single unaccountable autocrat.

## Run it

Requires Node 18 or newer. No dependencies to install.

    cp .env.example .env        # paste your Featherless API key into .env
    node server.js
    # open http://localhost:3000

Without a key the app runs in rehearsal mode with stand-in delegates, so you can
see the whole flow without spending anything.

## Democracy

Each seated model becomes a delegate named after itself, with its Hugging Face
org as its party ("Sen. Rocinante-12B (TheDrummer)"). A session runs:

1. Call to order: a random Clerk writes an official bill title and names subcommittees.
2. Hearings: every delegate gives a statement and may introduce an amendment.
3. Environmental impact study, with a risk rating out of 10.
4. Subcommittee reports: each chair issues a favorable or unfavorable finding.
5. Filibuster: one delegate holds the floor; leadership needs three-fifths for cloture.
   If cloture fails, the filibuster goes to hour nine.
6. Roll-call vote: every delegate votes on each floor amendment and the motion.
   Unparseable answers count as Present; models that don't respond are Absent.
7. Majority opinion, dissent, and a tabloid headline from the press gallery.

Every procedure except hearings and the vote can be switched off.

## Autocracy

Pick an autocrat (or leave it blank for a random model). Ministers offer
groveling advice, the autocrat issues a decree and may banish one of them, and
state media reports the news. If the autocrat fails to respond, a coup installs
a random successor.

## About "Everyone"

Featherless hosts tens of thousands of models. Seating all of them means roughly
two calls per delegate, queued through your plan's concurrency units (small
models cost 1 unit, 24-34B cost 2, 70B+ cost 4). The setup screen shows a rough
time estimate; for the full catalogue it's measured in days. Many models will be
cold and slow to wake, and some will answer in gibberish, which is part of the fun.
Use "Adjourn the session" to stop at any time; you'll still get a report.

## Files

- `server.js`: serves the page and proxies calls to Featherless. Your key never
  reaches the browser. It reads your plan's concurrency from `/v1/plan`, weights
  each call by model size, and retries on rate limits.
- `public/index.html`: the whole app.
