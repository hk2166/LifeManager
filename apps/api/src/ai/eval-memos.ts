// T-20: memo classification accuracy + confirmation-threshold tuning.
// Needs ANTHROPIC_API_KEY; no DB required.
import { CLASSIFY_CONFIDENCE_MIN } from '../config';
import { utterances } from '../../seed/utterances';
import { classify, type Classification } from './classify';

async function main() {
  const results: { u: (typeof utterances)[number]; c: Classification }[] = [];
  for (const u of utterances) {
    const c = await classify(u.text);
    const ok = c.type === u.expected;
    console.log(
      `${ok ? 'ok  ' : 'MISS'} [${c.confidence.toFixed(2)}] "${u.text.slice(0, 48)}" -> ${c.type}` +
        (ok ? '' : ` (expected ${u.expected})`) +
        (u.ambiguous ? ' (ambiguous)' : '')
    );
    results.push({ u, c });
  }

  const acc = results.filter((r) => r.c.type === r.u.expected).length / results.length;
  console.log(`\ntop-1 accuracy: ${(acc * 100).toFixed(1)}%  (AC >= 85%: ${acc >= 0.85 ? 'PASS' : 'FAIL'})`);

  console.log('\nthreshold  silent%  silent-correct%  chip-rate-on-ambiguous');
  for (let t = 0.5; t <= 0.96; t += 0.05) {
    const silent = results.filter((r) => r.c.confidence >= t);
    const silentCorrect = silent.filter((r) => r.c.type === r.u.expected);
    const amb = results.filter((r) => r.u.ambiguous);
    const ambChipped = amb.filter((r) => r.c.confidence < t);
    console.log(
      `${t.toFixed(2).padEnd(10)} ${((silent.length / results.length) * 100).toFixed(0).padEnd(8)}` +
        ` ${(silent.length ? (silentCorrect.length / silent.length) * 100 : 100).toFixed(1).padEnd(16)}` +
        ` ${amb.length ? ((ambChipped.length / amb.length) * 100).toFixed(0) : '-'}%`
    );
  }

  const t = CLASSIFY_CONFIDENCE_MIN;
  const silent = results.filter((r) => r.c.confidence >= t);
  const prec = silent.length ? silent.filter((r) => r.c.type === r.u.expected).length / silent.length : 1;
  console.log(
    `\nat configured threshold ${t}: silent-routing precision ${(prec * 100).toFixed(1)}% (AC >= 95%: ${prec >= 0.95 ? 'PASS' : 'FAIL'})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
