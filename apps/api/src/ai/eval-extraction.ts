// T-12: precision/recall of the commitment extractor against the labeled seed corpus.
// Requires a seeded DB (npm run db:seed) and ANTHROPIC_API_KEY.
import { pool, q } from '../db/index';
import { DEMO_OWNER_EMAIL, DEMO_OWNER_NAME } from '../config';
import { buildCorpus, resolveDue } from '../../seed/corpus';
import { extractThread } from './extract';

const DAY = 86_400_000;

async function main() {
  const { threads } = buildCorpus({ name: DEMO_OWNER_NAME, email: DEMO_OWNER_EMAIL });
  let tp = 0;
  let fn = 0;
  let fp = 0;
  let negFp = 0;
  const notes: string[] = [];

  for (const t of threads) {
    const { rows: msgs } = await q<{ id: string; sent_at: Date }>(
      'SELECT id, sent_at FROM messages WHERE thread_id = $1 ORDER BY sent_at',
      [t.id]
    );
    if (!msgs.length) {
      console.error(`thread ${t.id} not in DB - run db:seed first`);
      process.exit(1);
    }
    const predicted = (await extractThread(t.id)).filter((c) => c.confidence >= 0.5);
    const used = new Set<number>();
    for (const exp of t.expect) {
      const expDue = resolveDue(exp.due, new Date(msgs[exp.from_message].sent_at));
      const idx = predicted.findIndex((p, i) => {
        if (used.has(i) || p.direction !== exp.direction) return false;
        if (p.counterparty_email.toLowerCase() !== exp.counterparty_email) return false;
        if (expDue) {
          const d = p.due_iso ? Date.parse(p.due_iso) : NaN;
          if (Number.isNaN(d) || Math.abs(d - expDue.getTime()) > 3 * DAY) return false;
        }
        return true;
      });
      if (idx >= 0) {
        tp++;
        used.add(idx);
      } else {
        fn++;
        notes.push(`MISS     ${t.id}: ${exp.hint}`);
      }
    }
    const extras = predicted.filter((_, i) => !used.has(i));
    fp += extras.length;
    if (extras.length) {
      if (t.expect.length === 0) negFp += extras.length;
      notes.push(`SPURIOUS ${t.id}: ${extras.map((p) => `${p.title} [${p.direction}, ${p.confidence}]`).join(' | ')}`);
    }
    console.log(`${t.id}: expected ${t.expect.length}, predicted ${predicted.length}`);
  }

  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  console.log('\n' + notes.join('\n'));
  console.log(`\nTP ${tp}  FN ${fn}  FP ${fp}  (FP on negative threads: ${negFp})`);
  console.log(`precision ${(precision * 100).toFixed(1)}%  recall ${(recall * 100).toFixed(1)}%`);
  console.log(`AC recall>=80%: ${recall >= 0.8 ? 'PASS' : 'FAIL'}`);
  console.log(`AC spurious-on-negatives<=2: ${negFp <= 2 ? 'PASS' : 'FAIL'}`);
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
