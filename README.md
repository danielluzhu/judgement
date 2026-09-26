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
org as its party ("Sen. Rocinante-12B (TheDrummer)"). Two things are fixed for
the life of a model:

- Its **disposition** (Traditionalist, Fiscal hawk, Maximalist, Contrarian,
  Radical, Diplomat, ...) is hashed from the model id, so the same model argues
  from the same instincts in every session. Each later prompt carries the
  delegate's own record from earlier phases, so it stays consistent while its
  reasoning gets more informed.
- Its **caucus** is its model lineage (Llama, Qwen, Mistral, Gemma, DeepSeek,
  ...). Models descended from the same base confer and tend to vote together.

A session runs:

1. Call to order: a random Clerk writes an official bill title and names subcommittees.
2. Hearings: every delegate declares FOR, AGAINST, or AMEND. Delegates who want
   changes propose a concrete substitute: tacos instead of the burrito, add a
   drink, skip lunch entirely. The sidebar tracks who stands where, and the
   Clerk reads trends by caucus and by disposition into the record.
3. Questions for the petitioner: a few delegates from different caucuses and
   positions put a question to you directly. The session pauses until you answer
   or decline. The delegate then replies to your answer and may press a
   follow-up, and a rival from another caucus interjects. Your testimony is
   distributed to every later phase.
   If the motion costs money (the Clerk decides), the first question is always
   "who is paying?", and an appropriations debate follows in which delegates
   argue about it. They never agree; the bill is charged by plurality to
   whoever gets the most blame, and the enrolled text says so.
4. Caucus meetings: each lineage with two or more members elects a whip who
   sets a caucus line and merges the members' ideas into one joint substitute.
5. Environmental impact study, with a risk rating out of 10.
6. Subcommittee reports: each chair issues a favorable or unfavorable finding.
7. Filibuster: one delegate holds the floor; leadership needs three-fifths for cloture.
8. Roll-call vote: every delegate chooses the original motion, one of up to
   three substitutes on the floor, or none of the above, and votes on riders.
   If "none" outvotes everything the motion fails; otherwise the plurality
   version wins, so you may end up with something you did not ask for.
9. Enactment: the Clerk writes the enrolled text, i.e. exactly what you now get.
10. Majority opinion, dissent, and a tabloid headline from the press gallery.

The report shows "what you asked for" against "what you got", the vote on each
version, every caucus's trend and line, whether caucuses held together, and the
questions you were asked.

Every procedure except hearings, the vote, and enactment can be switched off.

## Autocracy

Pick an autocrat (or leave it blank for a random model). The autocrat may
interrogate you first, ministers offer groveling advice, and the autocrat
issues a decree: yes, no, or something else entirely ("you shall have soup").
It may banish a minister, and state media reports the news. If the autocrat fails to respond, a coup installs
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
