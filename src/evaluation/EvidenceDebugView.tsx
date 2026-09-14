import React from 'react';
import type { EvidenceAnalysis, Frame } from '../../evaluation/contracts';
import { buildEvidenceDebugSnapshot } from '../evaluation/evidenceDebug';

export const EvidenceDebugView: React.FC<{ fingerprint: string; evidence: EvidenceAnalysis; frames: Frame[] }> = ({ fingerprint, evidence, frames }) => (
  <details className="mt-5 rounded-xl border border-slate-300 bg-slate-950 p-4 text-xs text-slate-100">
    <summary className="cursor-pointer font-bold">Local evidence debug</summary>
    <p className="mt-2 text-slate-300">Measurements are evidence candidates only. They do not assign creative scores or semantic penalties.</p>
    <pre className="mt-3 max-h-[36rem] overflow-auto whitespace-pre-wrap break-all font-mono leading-5">
      {JSON.stringify(buildEvidenceDebugSnapshot(fingerprint, evidence, frames), null, 2)}
    </pre>
  </details>
);
