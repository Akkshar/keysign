/**
 * Illustrative data only. Nothing here comes from a backend tick or a file on
 * disk; it exists so the History view can show the shape of a session log
 * before one is summarised from data/sessions/*.jsonl.
 */

export interface IllustrativeSession {
  id: string;
  /** Relative day label, deliberately vague: "Today", "Yesterday". */
  when: string;
  /** What happened, in one plain sentence. No numbers that could read as measured. */
  note: string;
  /** Which head the note belongs to, or 'session' for a plain start/stop. */
  head: 'session' | 'identity' | 'state' | 'threat';
}

export const illustrativeSessions: IllustrativeSession[] = [
  { id: 'i-1', when: 'Today, afternoon', note: 'Typed for most of an hour; rhythm stayed close to baseline.', head: 'session' },
  { id: 'i-2', when: 'Today, morning', note: 'Load rose during a long stretch of edits, then settled.', head: 'state' },
  { id: 'i-3', when: 'Yesterday', note: 'Someone else took the keyboard mid-sentence; identity went to unknown.', head: 'identity' },
  { id: 'i-4', when: 'Two days ago', note: 'A sustained deviation raised one silent alert; it cleared within the minute.', head: 'threat' },
  { id: 'i-5', when: 'Three days ago', note: 'Short session, nothing to note.', head: 'session' },
];
