// Cheap pre-filter: threads where every message is from an automated sender
// can't contain a two-way human commitment, so skip them before the LLM.
// Real inboxes are mostly this - it turns hundreds of LLM calls into dozens.

const AUTOMATED_LOCALPARTS = [
  'no-reply', 'noreply', 'no_reply', 'donotreply', 'do-not-reply',
  'mailer', 'mailers', 'mail', 'mailer-daemon', 'bounce', 'bounces',
  'notification', 'notifications', 'notify', 'alerts', 'alert',
  'newsletter', 'news', 'digest', 'updates', 'update',
  'marketing', 'promo', 'promotions', 'offers', 'deals',
  'info', 'hello', 'team', 'support', 'help', 'contact', 'care',
  'receipts', 'billing', 'invoice', 'invoices', 'statements',
  'account', 'accounts', 'security', 'auth', 'verify',
  'jobs', 'careers', 'talent', 'recruiting', 'campus', 'events',
  'community', 'social', 'reply', 'automated', 'system', 'noreply-',
];

const AUTOMATED_DOMAIN_HINTS = [
  'mail.', 'email.', 'mailer.', 'e.', 'em.', 'news.', 'marketing.',
  'notifications.', 'notify.', 'reply.', 'bounce.', 'send.', 'sg.',
];

export function isAutomatedSender(email: string): boolean {
  const addr = email.trim().toLowerCase();
  const at = addr.indexOf('@');
  if (at < 0) return false;
  const local = addr.slice(0, at);
  const domain = addr.slice(at + 1);
  if (AUTOMATED_LOCALPARTS.some((p) => local === p || local.startsWith(p + '+') || local.startsWith(p + '.') || local.startsWith(p + '-'))) {
    return true;
  }
  // subdomain senders like mailers.goindigo.in, em.adobe.com are blast infra
  if (AUTOMATED_DOMAIN_HINTS.some((h) => domain.startsWith(h))) return true;
  return false;
}
