// T-20: labeled memo utterances. ambiguous=true means a confirmation chip is the
// preferred outcome - silent misroutes are scored against non-ambiguous ones only.
import type { ItemType } from 'shared';

export interface Utterance {
  text: string;
  expected: ItemType;
  ambiguous: boolean;
}

export const utterances: Utterance[] = [
  // commitments
  { text: 'I told Priya I would send her the updated deck by Thursday', expected: 'commitment', ambiguous: false },
  { text: 'I owe Marcus feedback on the budget sheet by Friday', expected: 'commitment', ambiguous: false },
  { text: 'Dana said she would confirm the kitchen availability tomorrow', expected: 'commitment', ambiguous: false },
  { text: 'Tell Ben I will make the Sarah intro tomorrow morning', expected: 'commitment', ambiguous: false },
  { text: 'Jordan owes me the floor plan, chase him Wednesday if it has not shown up', expected: 'commitment', ambiguous: true },
  { text: 'I promised grandma I would call her this Sunday', expected: 'commitment', ambiguous: false },
  // reminders
  { text: 'Remind me to take my medication at 9 PM tonight', expected: 'reminder', ambiguous: false },
  { text: 'Remind me tomorrow morning to renew the car insurance', expected: 'reminder', ambiguous: false },
  { text: 'Remind me to check in for the flight at 3', expected: 'reminder', ambiguous: false },
  { text: 'Do not let me forget that mom’s anniversary gift needs ordering by Wednesday', expected: 'reminder', ambiguous: true },
  // tasks
  { text: 'Fix the intro slide of the offsite deck', expected: 'task', ambiguous: false },
  { text: 'Draft the Q3 pipeline summary for Sam', expected: 'task', ambiguous: true },
  { text: 'Clean up the landing page hero copy', expected: 'task', ambiguous: false },
  { text: 'Book a meeting room for board prep', expected: 'task', ambiguous: false },
  { text: 'Follow up with the insurance agent about the new rate', expected: 'task', ambiguous: false },
  // events
  { text: 'Dentist appointment Tuesday September 8th at 3:30', expected: 'event', ambiguous: false },
  { text: 'Dinner with Nina next Friday at 8 PM at the new ramen place', expected: 'event', ambiguous: false },
  { text: 'Block Thursday 10 AM for the offsite planning sync', expected: 'event', ambiguous: false },
  { text: 'Coffee with Sam Okafor Monday at 9', expected: 'event', ambiguous: false },
  // shopping
  { text: 'Pick up triple A batteries and a phone charger', expected: 'shopping', ambiguous: false },
  { text: 'Buy espresso beans on the way home', expected: 'shopping', ambiguous: false },
  { text: 'Get the espresso machine for mom and dad’s anniversary', expected: 'shopping', ambiguous: true },
  { text: 'Add oat milk and eggs to the grocery list', expected: 'shopping', ambiguous: false },
  { text: 'Pick up the dry cleaning tomorrow', expected: 'shopping', ambiguous: true },
  // notes
  { text: 'The wifi password at the coworking space is sunflower42', expected: 'note', ambiguous: false },
  { text: 'Idea: open the demo with the waiting-on tracker, it lands hardest', expected: 'note', ambiguous: false },
  { text: 'The venue parking entrance is on 5th street behind the loading dock', expected: 'note', ambiguous: false },
  { text: 'Brightline’s rate is 28 per head, confirmed', expected: 'note', ambiguous: false },
  // deliberately murky
  { text: 'Call the dentist', expected: 'task', ambiguous: true },
  { text: 'Priya’s birthday is October 12', expected: 'note', ambiguous: true },
];
