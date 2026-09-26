# The Committee

A bureaucracy simulator for trivial decisions. Type in a small question and either
convene a full legislature of every model on Featherless, or hand the decision to
a single unaccountable autocrat.

## Run it

Requires Node 18 or newer. No dependencies to install.

    cp .env.example .env        # paste your Featherless API key into .env
    node server.js
    # open http://localhost:3000

Then, once, to find the models that answer quickly (see The verified bench below):

    npm run probe

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
5. Horse-trading: delegates who declared AGAINST may have named a price for
   their support. The Majority Leader sees the list and decides which prices the
   bill can afford, bounded by your conditions. Bought delegates switch to FOR
   and give their word. At the vote, some of them keep it.
6. Environmental impact study, with a risk rating out of 10.
7. Subcommittee reports: each chair issues a favorable or unfavorable finding.
8. Ruling of the Parliamentarian: every substitute on the floor is checked
   against the conditions you attached, costed, and ruled in order or struck.
9. Filibuster: one delegate holds the floor; leadership needs three-fifths for cloture.
10. Roll-call vote: every delegate chooses the original motion, one of the
    surviving substitutes, or none of the above, and votes on riders.
    If "none" outvotes everything the motion fails; otherwise the plurality
    version wins, so you may end up with something you did not ask for.
11. Enactment: the Clerk writes the enrolled text, i.e. exactly what you now get.
12. Majority opinion, dissent, and a tabloid headline from the press gallery.

The session ends with a verdict card that sets **what you asked for** against
**what you got**, side by side, with the conditions you attached, the vote, who
was charged for it, which riders survived, and how many votes were bought.
Below it the full report gives the vote on each version, every caucus's trend
and line, whether caucuses held together, the Parliamentarian's rulings, and the
questions you were asked.

Every procedure except hearings, the vote, and enactment can be switched off.

## Conditions on the motion

Under the motion box is an optional panel of conditions, which is where the
Committee stops being a toy:

- **Budget ceiling** — nothing costing more may be adopted.
- **Required vendor** — anything sourced elsewhere is out of order.
- **Procurement process** — three written quotes, an approved supplier list,
  whatever you like; it has to be followed.
- **Deadline** — nothing slower may be adopted.
- **Non-negotiable** — one condition that cannot be traded away.

Delegates are told about them at the hearing and are supposed to respect them.
They will not always. That is what the Parliamentarian is for: each substitute
is costed and ruled on, and anything that breaks a condition is struck from the
floor before the vote, with the reason read into the record. Set a $15 ceiling
and watch how much of the chamber's best work turns out to be illegal.

The autocrat is told your conditions too, and is under no obligation whatsoever.

## Sharing a session

Every finished session can be published to a link that carries the whole
thing — each caucus meeting, every exchange with the petitioner, the
Parliamentarian's rulings, the roll call, and the result. Press **Share this
session** on the report.

Sessions are stored as one JSON file per session under `data/sessions/`, which
is gitignored. Nothing is stored as HTML: a shared transcript is re-rendered and
re-escaped in the reader's browser, so a session cannot inject markup into the
page. Links unfurl with the bill title and what the petitioner actually got.

## Autocracy

Pick an autocrat (or leave it blank for a random model). The autocrat may
interrogate you first, ministers offer groveling advice, and the autocrat
issues a decree: yes, no, or something else entirely ("you shall have soup").
It may banish a minister, and state media reports the news. If the autocrat fails to respond, a coup installs
a random successor.

## Time, and why delegates go quiet

A session is expected to finish inside a fixed time. The setup screen sets the hour at
which the Committee rises — three minutes by default — and the chamber is scheduled
against it: every phase is given a share of whatever time remains, weighted by how much
work it is and capped by what it could actually use, so time saved early flows to the
phases that follow. The roll call is protected; whatever else is cut, the chamber votes.
Your own thinking time does not count: the clock stops while a delegate is waiting for
you to answer a question.

A delegate that has not replied when its phase runs out is simply not heard from. That
is not hidden. Unresponsive delegates are ringed in the chamber diagram, listed in a
sidebar panel with a count and the phases they missed, badged in the standings, and
named in the final report. A model that goes quiet in the hearing and again at the roll
call is visibly a repeat offender.

### The verified bench

Seating delegates uniformly at random is the honest reading of "every model on
Featherless", and it is also slow: measured against this catalogue, a random long-tail
model answers in about 16 seconds where a widely used one takes about 6. Worse, a large
share of the catalogue never answers usefully at all — base models with no chat
template, merges whose template is broken, reasoning models that spend the whole token
budget thinking. Seated at random, half the chamber can end up silent.

So there is a bench. `npm run probe` asks a few hundred plausible models to state a
position, keeps the ones that reply in time, and writes them to `data/bench.json`
fastest first:

    node server.js                 # in one terminal
    npm run probe                  # in another; takes a few minutes
    npm run probe 600 8            # probe more, more at a time

With **Seat only well-known, already-warm models** ticked the chamber is drawn from that
bench, and a session comfortably fits the three minutes. Untick it to seat the whole
catalogue and accept that the session will be long and the absentee list will be
substantial. The estimate under the motion box tells you which of those you are choosing.

The bench is specific to your plan and goes stale as models come and go, so it is not
committed. Without it the app falls back to picking warm-looking models by organisation.

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
  each call by model size, and retries on rate limits. It also stores and serves
  shared sessions (`POST /api/share`, `GET /s/:id`).
- `public/index.html`: the whole app.
- `scripts/probe-bench.js`: probes the catalogue for models that actually answer and
  writes `data/bench.json`. Run it with `npm run probe`.
- `data/sessions/`: shared session transcripts, one JSON file each. Gitignored.
- `data/bench.json`: the verified bench. Gitignored; regenerate per plan.
