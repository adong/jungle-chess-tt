#!/usr/bin/env node
/* Run the headless checks from a terminal, with the same rules and CPU files the page loads (js/rules.js, js/check.js).
     node tools/check.js                         every rule on little boards, then CPU games (20 per pairing)
     node tools/check.js 50                      the same with 50 games per pairing
     node tools/check.js --sabotage elephantrat  proves the check can fail: the elephant may catch the rat
       other sabotages: ratwater (the rat catches from the water), nojumpblock (rats don't block jumps),
       notrap (traps do nothing), owntrap (your own trap makes you 0), ownden (you may walk into your own den),
       nolimit (no draw rule: some CPU games never end), blind (NORMAL plays at random, so it stops beating EASY)
     node tools/check.js rates [n]               win rates of the kids' test bots against both levels (how EASY was tuned)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set, Error, Infinity, Int8Array, Uint8Array, Date };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/rules.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (args[0] === 'rates') {
  console.log(JSON.stringify(ctx.JC.rates(+(args[1] || 200)), null, 1));
  process.exit(0);
}
const out = ctx.JC.check({
  games: +(args.find((a) => /^\d+$/.test(a)) || 20),
  sabotage: opt('sabotage'),
  seed: opt('seed') ? +opt('seed') : undefined,
});
if (args.includes('--brief')) {
  console.log(JSON.stringify({ ok: out.ok, rules: out.rules, normalBeatsEasy: out.cpu.normalBeatsEasy, allLegal: out.cpu.allLegal, allEnded: out.cpu.allEnded, seconds: out.seconds }));
} else console.log(JSON.stringify(out, null, 1));
console.log(out.ok ? 'CHECK PASSED' : 'CHECK FAILED');
process.exitCode = out.ok ? 0 : 1;
