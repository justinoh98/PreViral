import { ANALYZER_VERSION, type CapabilityReport } from './contracts';

export type RuntimeCapabilities = {
  audioDecode: boolean;
  ocr: boolean;
  localSemantics: boolean;
  remoteSemantics: boolean;
};

export function capabilityReport(capabilities: RuntimeCapabilities): CapabilityReport[] {
  return [
    { id: 'visual_measurements', version: ANALYZER_VERSION, state: 'available', mode: 'required', provenance: 'measured_local', limitations: ['Pixel measurements do not determine creative meaning.'] },
    { id: 'audio_measurements', version: ANALYZER_VERSION, state: capabilities.audioDecode ? 'available' : 'unavailable', mode: 'optional', provenance: 'measured_local', limitations: capabilities.audioDecode ? ['Level changes do not identify speech, music, or intent.'] : ['This browser could not decode the audio track.'] },
    { id: 'ocr', version: 'ocr-interface-v1', state: capabilities.ocr ? 'available' : 'unavailable', mode: 'optional', provenance: 'ocr_local', limitations: capabilities.ocr ? ['Low-confidence wording remains unknown.'] : ['Local OCR is not configured in Phase 2.'] },
    { id: 'local_semantics', version: 'semantic-interface-v1', state: capabilities.localSemantics ? 'available' : 'unavailable', mode: 'optional', provenance: 'semantic_local', limitations: ['Semantic integration is deferred to Phase 3.'] },
    { id: 'remote_semantics', version: 'remote-semantic-interface-v1', state: capabilities.remoteSemantics ? 'available' : 'unavailable', mode: 'experimental', provenance: 'semantic_remote', limitations: ['Remote semantics are optional development tooling and are not part of the public local foundation.'] },
  ];
}
