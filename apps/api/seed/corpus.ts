// Demo inbox: one coherent story (planning a company offsite + personal life),
// with labeled ground truth co-located so T-12's eval reads the same file.

export interface SeedPerson {
  name: string;
  email: string;
}

// due spec is relative to the message's sent time; weekday = next occurrence after sent
export interface DueSpec {
  weekday?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  days_after_sent?: number;
}

export interface ExpectedCommitment {
  direction: 'owed_by_me' | 'owed_to_me';
  counterparty_email: string;
  hint: string;
  due: DueSpec | null; // null = don't score the due date
  from_message: number; // index into thread.messages of the promise
}

export interface SeedMessage {
  from: SeedPerson | 'owner';
  days_ago: number;
  hour: number;
  body: string;
}

export interface SeedThread {
  id: string;
  subject: string;
  messages: SeedMessage[];
  expect: ExpectedCommitment[]; // empty = negative example
}

export interface SeedEvent {
  id: string;
  title: string;
  days_from_now: number;
  hour: number;
  duration_min: number;
  attendees: SeedPerson[];
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function resolveDue(spec: DueSpec | null | undefined, sentAt: Date): Date | null {
  if (!spec) return null;
  const d = new Date(sentAt);
  d.setHours(18, 0, 0, 0);
  if (spec.days_after_sent != null) {
    d.setDate(d.getDate() + spec.days_after_sent);
    return d;
  }
  if (spec.weekday) {
    const target = WEEKDAYS.indexOf(spec.weekday);
    let delta = (target - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return d;
  }
  return null;
}

export const priya: SeedPerson = { name: 'Priya Sharma', email: 'priya@northbeam.io' };
export const marcus: SeedPerson = { name: 'Marcus Chen', email: 'marcus@northbeam.io' };
export const alexR: SeedPerson = { name: 'Alex Rivera', email: 'alex@northbeam.io' };
export const dana: SeedPerson = { name: 'Dana Whitfield', email: 'dana@brightlinecatering.com' };
export const jordan: SeedPerson = { name: 'Jordan Field', email: 'jordan@loftspaces.co' };
export const sam: SeedPerson = { name: 'Sam Okafor', email: 'sam.okafor@vantagevc.com' };
export const ben: SeedPerson = { name: 'Ben Tran', email: 'ben@fig.dev' };
export const sarah: SeedPerson = { name: 'Sarah Liu', email: 'sarah.liu@corely.app' };
export const nina: SeedPerson = { name: 'Nina Patel', email: 'nina@heyroam.com' };
export const mom: SeedPerson = { name: 'Asha', email: 'asha.k@gmail.com' };
export const finance: SeedPerson = { name: 'Northbeam Finance', email: 'receipts@northbeam.io' };
export const acme: SeedPerson = { name: 'Acme Insurance', email: 'notifications@acmeinsure.com' };
export const dental: SeedPerson = { name: 'Mehta Dental', email: 'frontdesk@mehtadental.com' };
export const slice: SeedPerson = { name: 'The Slice', email: 'hello@theslice.media' };
export const devweekly: SeedPerson = { name: 'DevWeekly', email: 'digest@devweekly.io' };

export function buildCorpus(owner: SeedPerson): { threads: SeedThread[]; events: SeedEvent[] } {
  const threads: SeedThread[] = [
    // ---- commitments the owner made (owed_by_me) ----
    {
      id: 't-offsite-deck',
      subject: 'Offsite deck - latest version?',
      messages: [
        {
          from: priya,
          days_ago: 2,
          hour: 9,
          body: 'Hey! Leadership wants to preview the offsite deck before the sync. Do you have a version I can share, or is it still in pieces?',
        },
        {
          from: 'owner',
          days_ago: 2,
          hour: 11,
          body: 'Still tightening the budget slides. I will send you the revised deck by Thursday, promise. Wanted the venue numbers from Marcus in there first.',
        },
        {
          from: priya,
          days_ago: 2,
          hour: 12,
          body: 'Thursday works. Thanks!\n\nOn Wed, Priya Sharma wrote:\n> Do you have a version I can share?',
        },
      ],
      expect: [
        {
          direction: 'owed_by_me',
          counterparty_email: priya.email,
          hint: 'send revised offsite deck to Priya',
          due: { weekday: 'thursday' },
          from_message: 1,
        },
      ],
    },
    {
      id: 't-catering-contract',
      subject: 'Brightline contract - redlines',
      messages: [
        {
          from: dana,
          days_ago: 3,
          hour: 10,
          body: 'Contract attached. If your team has edits, could you get them back to us soon? Kitchen scheduling closes out two weeks ahead.',
        },
        {
          from: 'owner',
          days_ago: 3,
          hour: 15,
          body: 'Got it, thanks Dana. I will get you our redlines by Friday - only expecting small changes around the headcount clause.',
        },
      ],
      expect: [
        {
          direction: 'owed_by_me',
          counterparty_email: dana.email,
          hint: 'send contract redlines to Dana',
          due: { weekday: 'friday' },
          from_message: 1,
        },
      ],
    },
    {
      id: 't-intro-ben-sarah',
      subject: 'Intro to someone at Corely?',
      messages: [
        {
          from: ben,
          days_ago: 1,
          hour: 16,
          body: 'You mentioned you know Sarah Liu at Corely - we are exploring a plugin for their platform and an intro would be huge.',
        },
        {
          from: 'owner',
          days_ago: 1,
          hour: 18,
          body: 'Happy to. I will intro you to Sarah this week - let me ping her first so it is a warm double opt-in.',
        },
      ],
      expect: [
        {
          direction: 'owed_by_me',
          counterparty_email: ben.email,
          hint: 'intro Ben to Sarah Liu',
          due: null,
          from_message: 1,
        },
      ],
    },
    {
      id: 't-budget-sheet',
      subject: 'Offsite budget sheet',
      messages: [
        {
          from: marcus,
          days_ago: 4,
          hour: 13,
          body: 'Dropped the offsite budget into the shared sheet. Can you sanity-check the travel line? I think I am double counting the airport transfers.',
        },
        {
          from: 'owner',
          days_ago: 4,
          hour: 17,
          body: 'On it - I will review the budget sheet by end of week and leave comments inline.',
        },
      ],
      expect: [
        {
          direction: 'owed_by_me',
          counterparty_email: marcus.email,
          hint: 'review Marcus budget sheet',
          due: { weekday: 'friday' },
          from_message: 1,
        },
      ],
    },
    {
      id: 't-anniversary-gift',
      subject: 'Dad and my anniversary',
      messages: [
        {
          from: mom,
          days_ago: 2,
          hour: 19,
          body: 'Our anniversary is coming up on the 10th. Your dad keeps hinting about that espresso machine. Are you organizing something with your sister?',
        },
        {
          from: 'owner',
          days_ago: 2,
          hour: 21,
          body: 'Yes! I will order the gift by Wednesday so it arrives in time. Do not let him buy it for himself in the meantime.',
        },
      ],
      expect: [
        {
          direction: 'owed_by_me',
          counterparty_email: mom.email,
          hint: 'order anniversary gift',
          due: { weekday: 'wednesday' },
          from_message: 1,
        },
      ],
    },
    {
      id: 't-expense-report',
      subject: 'August expense reports due',
      messages: [
        {
          from: finance,
          days_ago: 1,
          hour: 9,
          body: 'Reminder: August expense reports are due. Please submit before month-end close.',
        },
        {
          from: 'owner',
          days_ago: 1,
          hour: 10,
          body: 'Will do - I will file mine by Monday.',
        },
      ],
      expect: [
        {
          direction: 'owed_by_me',
          counterparty_email: finance.email,
          hint: 'file August expense report',
          due: { weekday: 'monday' },
          from_message: 1,
        },
      ],
    },

    // ---- things others owe the owner (owed_to_me) ----
    {
      id: 't-venue-quotes',
      subject: 'Venue quotes for the offsite',
      messages: [
        {
          from: 'owner',
          days_ago: 9,
          hour: 10,
          body: 'Can you pull together venue quotes for the offsite? Ideally three options with capacity for 40, somewhere near the waterfront.',
        },
        {
          from: marcus,
          days_ago: 8,
          hour: 12,
          body: 'Yep, already talking to two places. I will have three quotes to you by Friday.',
        },
        {
          from: 'owner',
          days_ago: 3,
          hour: 9,
          body: 'Any update on the quotes? Deck needs the numbers this week.',
        },
      ],
      expect: [
        {
          direction: 'owed_to_me',
          counterparty_email: marcus.email,
          hint: 'Marcus owes three venue quotes',
          due: { weekday: 'friday' },
          from_message: 1,
        },
      ],
    },
    {
      id: 't-floorplan',
      subject: 'Loft Spaces - floor plan and AV',
      messages: [
        {
          from: 'owner',
          days_ago: 5,
          hour: 11,
          body: 'Great touring the space yesterday. Could you send over the floor plan and the AV spec sheet so we can plan breakouts?',
        },
        {
          from: jordan,
          days_ago: 5,
          hour: 14,
          body: 'Glad you liked it! I will send the floor plan and AV specs by Tuesday - our ops manager is back then.',
        },
      ],
      expect: [
        {
          direction: 'owed_to_me',
          counterparty_email: jordan.email,
          hint: 'Jordan owes floor plan and AV specs',
          due: { weekday: 'tuesday' },
          from_message: 1,
        },
      ],
    },
    {
      id: 't-kitchen-confirm',
      subject: 'Re: Sept 14 - can Brightline do it?',
      messages: [
        {
          from: 'owner',
          days_ago: 3,
          hour: 12,
          body: 'One more thing - can you confirm Brightline can actually staff the 14th? Do not want to sign and then find out the kitchen is double-booked.',
        },
        {
          from: dana,
          days_ago: 3,
          hour: 13,
          body: 'Fair question. I will confirm availability with the kitchen team tomorrow and get back to you.',
        },
      ],
      expect: [
        {
          direction: 'owed_to_me',
          counterparty_email: dana.email,
          hint: 'Dana owes kitchen availability confirmation',
          due: { days_after_sent: 1 },
          from_message: 1,
        },
      ],
    },
    {
      id: 't-landing-feedback',
      subject: 'Landing page v2',
      messages: [
        {
          from: 'owner',
          days_ago: 4,
          hour: 15,
          body: 'New landing page draft is up on staging. Would love your eyes on the hero copy especially.',
        },
        {
          from: alexR,
          days_ago: 4,
          hour: 16,
          body: 'Nice, opening it now. I will send you written feedback by tomorrow.',
        },
      ],
      expect: [
        {
          direction: 'owed_to_me',
          counterparty_email: alexR.email,
          hint: 'Alex owes landing page feedback',
          due: { days_after_sent: 1 },
          from_message: 1,
        },
      ],
    },
    {
      id: 't-birthday-dinner',
      subject: 'Dinner for my birthday!',
      messages: [
        {
          from: nina,
          days_ago: 2,
          hour: 20,
          body: 'Doing a small dinner for my birthday next week. I will send you the restaurant options tonight so you can vote. Bring your appetite.',
        },
        {
          from: 'owner',
          days_ago: 2,
          hour: 21,
          body: 'Yes! Counting on those options.',
        },
      ],
      expect: [
        {
          direction: 'owed_to_me',
          counterparty_email: nina.email,
          hint: 'Nina owes restaurant options',
          due: { days_after_sent: 0 },
          from_message: 0,
        },
      ],
    },

    // ---- the buried decision (memory beat, no commitments) ----
    {
      id: 't-catering-decision',
      subject: 'Catering for the offsite - decision time',
      messages: [
        {
          from: 'owner',
          days_ago: 74,
          hour: 10,
          body: 'We need to pick a caterer this week. Finalists: Brightline at 28 per head, Verdura at 41, Golden Wok trays at 19 but no service staff.',
        },
        {
          from: priya,
          days_ago: 74,
          hour: 11,
          body: 'Verdura is lovely but 41 blows the budget. Golden Wok means someone on our team runs food all day. Brightline was great at the spring mixer.',
        },
        {
          from: marcus,
          days_ago: 73,
          hour: 9,
          body: 'Agree. Brightline also handles dietary restrictions in-house, which saved us last time.',
        },
        {
          from: 'owner',
          days_ago: 73,
          hour: 10,
          body: 'Decided then - we are going with Brightline Catering at 28 per head for the offsite. Closing the loop with the other two.',
        },
      ],
      expect: [],
    },

    // ---- anticipation + appointment signals (negatives for the extractor) ----
    {
      id: 't-insurance-renewal',
      subject: 'Your auto policy renews September 15',
      messages: [
        {
          from: acme,
          days_ago: 6,
          hour: 8,
          body: 'Your auto policy 84-C122 renews automatically on September 15. Your rate is changing from 118 to 131 per month. No action is needed if your payment method is current.',
        },
      ],
      expect: [],
    },
    {
      id: 't-dentist-reminder',
      subject: 'Appointment reminder - Sep 8',
      messages: [
        {
          from: dental,
          days_ago: 4,
          hour: 9,
          body: 'This is a reminder of your cleaning appointment on Tuesday, September 8 at 3:30 PM with Dr. Mehta. Reply C to confirm.',
        },
      ],
      expect: [],
    },

    // ---- soft-language and noise negatives ----
    {
      id: 't-sam-softtalk',
      subject: 'Catching up',
      messages: [
        {
          from: sam,
          days_ago: 6,
          hour: 17,
          body: 'Great running into you at the summit. Would be fun to catch up properly sometime. I will take a look at the memo you mentioned when things calm down over here.',
        },
      ],
      expect: [],
    },
    {
      id: 't-board-deflect',
      subject: 'Q3 numbers for board pack',
      messages: [
        {
          from: sam,
          days_ago: 5,
          hour: 10,
          body: 'For the board pack - can you send the updated Q3 pipeline numbers?',
        },
        {
          from: 'owner',
          days_ago: 5,
          hour: 11,
          body: 'Priya owns the pipeline report now - looping her in here, she has the latest.',
        },
      ],
      expect: [],
    },
    {
      id: 't-thanks',
      subject: 'Re: yesterday',
      messages: [
        {
          from: priya,
          days_ago: 5,
          hour: 8,
          body: 'Thanks again for jumping on that customer call yesterday - really appreciated it.',
        },
      ],
      expect: [],
    },
    {
      id: 't-venue-brochure',
      subject: 'FYI - venue brochure',
      messages: [
        {
          from: marcus,
          days_ago: 7,
          hour: 15,
          body: 'Forwarding the Harborview brochure for reference. No action needed, quotes thread has the real numbers.',
        },
      ],
      expect: [],
    },
    {
      id: 't-slice-promo',
      subject: 'Do not forget to renew - 20% off ends Friday',
      messages: [
        {
          from: slice,
          days_ago: 3,
          hour: 7,
          body: 'Your Slice membership lapses soon! Renew by Friday for 20% off. This deal will not come back.',
        },
      ],
      expect: [],
    },
    {
      id: 't-devweekly',
      subject: 'DevWeekly #412',
      messages: [
        {
          from: devweekly,
          days_ago: 1,
          hour: 6,
          body: 'This week: Postgres 18 beta notes, a deep dive on structured outputs, and why your retries are lying to you.',
        },
      ],
      expect: [],
    },
    {
      id: 't-standup-notes',
      subject: 'Standup notes - Wed',
      messages: [
        {
          from: alexR,
          days_ago: 2,
          hour: 10,
          body: 'Notes from standup: shipping the billing fix today, design review moved to Thursday, offsite planning is on track.',
        },
      ],
      expect: [],
    },
  ];

  const events: SeedEvent[] = [
    {
      id: 'ev-offsite-sync',
      title: 'Offsite planning sync',
      days_from_now: 1,
      hour: 10,
      duration_min: 30,
      attendees: [priya],
    },
    { id: 'ev-marcus-1on1', title: '1:1 Marcus', days_from_now: 3, hour: 14, duration_min: 30, attendees: [marcus] },
    { id: 'ev-board-prep', title: 'Board prep review', days_from_now: 5, hour: 9, duration_min: 60, attendees: [sam] },
    { id: 'ev-nina-dinner', title: "Nina's birthday dinner", days_from_now: 6, hour: 19, duration_min: 120, attendees: [nina] },
    { id: 'ev-dentist', title: 'Dentist - Dr. Mehta', days_from_now: 11, hour: 15, duration_min: 45, attendees: [] },
  ];

  return { threads, events };
}
