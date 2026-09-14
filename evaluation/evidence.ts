const PREFIX = {
  frame: 'FRAME',
  measurement: 'MEASUREMENT',
  shot: 'SHOT',
  repeat: 'REPEAT',
  opening: 'OPENING',
  ending: 'ENDING',
  audio_window: 'AUDIO_WINDOW',
  audio_silence: 'AUDIO_SILENCE',
  audio_change: 'AUDIO_CHANGE',
} as const;

export type EvidenceIdKind = keyof typeof PREFIX;

const millis = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Evidence time must be a finite non-negative number.');
  return String(Math.round(seconds * 1000)).padStart(6, '0');
};

export function evidenceId(kind: EvidenceIdKind, index: number, startSec: number, endSec?: number, sourceFingerprint?: string): string {
  if (!Number.isInteger(index) || index < 1) throw new Error('Evidence index must be a positive integer.');
  if (endSec !== undefined && endSec < startSec) throw new Error('Evidence end time cannot precede its start time.');
  const fingerprintToken = sourceFingerprint?.replace(/^sha256-/, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  return [PREFIX[kind], String(index).padStart(4, '0'), millis(startSec), ...(endSec === undefined ? [] : [millis(endSec)]), ...(fingerprintToken ? [fingerprintToken] : [])].join('_');
}
