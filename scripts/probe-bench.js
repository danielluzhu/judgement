#!/usr/bin/env node
// Find the models that actually answer, and answer quickly.
//
// The Featherless catalogue is tens of thousands of models, and a large share of them
// are base models, merges with broken chat templates, or reasoning models that spend
// their whole token budget thinking. Seated at random they simply never reply, and the
// chamber fills with absentees. This probes candidates and writes the ones that work to
// data/bench.json, which the app uses for "warm models only".
//
//   node scripts/probe-bench.js            # probe 300 candidates
//   node scripts/probe-bench.js 600 8      # probe 600, 8 at a time
//
// The server must be running.

const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:3000';
const LIMIT = Number(process.argv[2]) || 300;
const CONC = Number(process.argv[3]) || 6;
const CAP_MS = Number(process.env.CAP_MS) || 12000;

// Orgs whose models are widely used, and therefore usually already loaded.
const WARM_ORGS = /^(mistralai|qwen|nousresearch|google|microsoft|teknium|openchat|huggingfaceh4|upstage|sao10k|thedrummer|anthracite-org|cognitivecomputations|gryphe|undi95|nvidia|allenai|internlm|tiiuae|nexusflow|princeton-nlp|abacusai|steelskull|eva-unit-01|nothingiisreal|marinaraspaghetti|weyaxi|jondurbin|wizardlmteam|latitudegames|meta-llama|deepseek-ai|01-ai|openbmb|ibm-granite|mlabonne|failspy|crestf411|sophosympatheia)\//;
const BIG = /\b(2[0-9]|[3-9][0-9]|[1-9][0-9]{2})(\.\d)?b\b/i;          // 20B+ costs more concurrency and wakes slower
const UNSUITABLE = /base|math|code|coder|vision|embed|rerank|guard|r1-distill|qwq|reasoning|storywriter|-pt$/i;

async function main() {
  const res = await fetch(`${BASE}/api/models`);
  const { models } = await res.json();
  if (!models || !models.length) {
    console.error('No models from /api/models. Is the server running, and is FEATHERLESS_API_KEY set?');
    process.exit(1);
  }
  const ids = models.map((m) => m.id);
  const candidates = ids.filter((m) => WARM_ORGS.test(m.toLowerCase()) && !BIG.test(m) && !UNSUITABLE.test(m));
  const sample = candidates.sort(() => Math.random() - 0.5).slice(0, LIMIT);
  console.log(`${ids.length} models on the plan; ${candidates.length} plausible; probing ${sample.length} at ${CONC} at a time.`);

  const good = [];
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (next < sample.length) {
      const model = sample[next++];
      const started = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), CAP_MS);
      try {
        const r = await fetch(`${BASE}/api/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
          body: JSON.stringify({
            model,
            prompt: 'You are a delegate in a committee. The motion: "Should I get a burrito for lunch?"\nGive one short sentence for the record, then a final line exactly:\nPOSITION: FOR',
            max_tokens: 70,
          }),
        });
        const j = await r.json();
        const ms = Date.now() - started;
        // The app can cope with a missing POSITION line (the delegate falls back to its
        // disposition), so the bar here is simply: it said something, and said it in time.
        if (!j.error && j.text && j.text.trim().length > 8) {
          good.push({ model, ms, formatted: /POSITION\s*:/i.test(j.text) });
        }
      } catch { /* timed out or refused: not bench material */ }
      finally { clearTimeout(timer); }
      if (++done % 25 === 0) console.log(`  ${done}/${sample.length} probed, ${good.length} usable`);
    }
  }));

  good.sort((a, b) => a.ms - b.ms);
  const out = path.join(__dirname, '..', 'data', 'bench.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    generatedAt: new Date().toISOString(),
    probed: sample.length,
    capMs: CAP_MS,
    models: good.map((g) => g.model),
    detail: good,
  }, null, 1));

  const formatted = good.filter((g) => g.formatted).length;
  console.log(`\n${good.length}/${sample.length} answered within ${CAP_MS / 1000}s (${formatted} in the exact format).`);
  if (good.length) {
    console.log(`fastest ${good[0].ms}ms, median ${good[Math.floor(good.length / 2)].ms}ms, slowest ${good[good.length - 1].ms}ms`);
  }
  console.log(`Written to ${out}. Restart is not needed; the app reloads it.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
