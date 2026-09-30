export interface JournalEntry {
  id: string;
  flowerId: string;
  date: string;
  month: number;
  mood: string;
  title: string;
  reflection: string;
  flowerName: string;
  speciesCode: string;
}

export const SAMPLE_ENTRIES: JournalEntry[] = [
  {
    id: 'entry-oct-01',
    flowerId: 'fl-oct-01',
    date: '2026-10-10T15:20:00.000Z',
    month: 10,
    mood: 'Contemplative',
    title: 'Dusk over the western ridge',
    reflection:
      'Leaves are beginning to turn golden amber. Taking a deep breath and feeling grounded.',
    flowerName: 'purple',
    speciesCode: 'OCTOBER_BELL',
  },
  {
    id: 'entry-feb-01',
    flowerId: 'fl-feb-01',
    date: '2026-02-14T11:00:00.000Z',
    month: 2,
    mood: 'Grateful',
    title: 'Warm tea with close friends',
    reflection:
      'Grateful for long conversations and shared laughter that melts the late-winter frost.',
    flowerName: 'tulip',
    speciesCode: 'FEBRUARY_TULIP',
  },
  {
    id: 'entry-sep-01',
    flowerId: 'fl-sep-01',
    date: '2026-09-08T16:45:00.000Z',
    month: 9,
    mood: 'Hopeful',
    title: 'First crisp morning of autumn',
    reflection: 'Welcoming autumn near the southern gate. New beginnings ahead.',
    flowerName: 'tulip',
    speciesCode: 'ORANGE_TULIP',
  },
  {
    id: 'entry-jun-01',
    flowerId: 'fl-jun-01',
    date: '2026-06-20T09:15:00.000Z',
    month: 6,
    mood: 'Energized',
    title: 'Midsummer Solstice',
    reflection: 'Summer sun warming the northeastern bluffs. So much vibrant energy.',
    flowerName: 'sunflower',
    speciesCode: 'SUNFLOWER',
  },
  {
    id: 'entry-may-01',
    flowerId: 'fl-may-01',
    date: '2026-05-12T14:30:00.000Z',
    month: 5,
    mood: 'Grateful',
    title: 'Milestone reached',
    reflection: 'Planted after a productive coding session. Every step counts.',
    flowerName: 'purple',
    speciesCode: 'PURPLE_BELL',
  },
  {
    id: 'entry-jan-01',
    flowerId: 'fl-jan-01',
    date: '2026-01-15T10:00:00.000Z',
    month: 1,
    mood: 'Peaceful',
    title: 'Quiet winter dawn',
    reflection: 'A quiet morning reflection in the January meadow. Calm and focused.',
    flowerName: 'pink',
    speciesCode: 'PINK_LILY',
  },
];

export function findJournalEntry(flowerId: string, journalEntryId?: string): JournalEntry | undefined {
  return SAMPLE_ENTRIES.find((entry) => entry.flowerId === flowerId &&
    (!journalEntryId || entry.id === journalEntryId))
    ?? SAMPLE_ENTRIES.find((entry) => entry.flowerId === flowerId);
}
