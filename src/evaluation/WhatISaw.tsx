import React from 'react';
import type { GroundingReport } from '../../evaluation/contracts';

export function WhatISaw({ report, language }: { report: GroundingReport; language: string }) {
  const ko = language === 'ko';
  const inventory = report.inventory;
  const reliable = report.status === 'HIGH' || report.status === 'MEDIUM';
  const statuses = { HIGH: ko ? '영상 내용 확인됨' : 'Content checked', MEDIUM: ko ? '주요 내용 확인 · 일부 불확실' : 'Main content checked · some uncertainty', LOW: ko ? '확인 부족 · 점수 없음' : 'Limited understanding · no rating', FAILED: ko ? '영상 확인 실패 · 점수 없음' : 'Could not verify footage · no rating' };
  const labels = { strongestMoment: ko ? '가장 눈에 띄는 순간' : 'Strongest moment', weakestSection: ko ? '덜 전달되는 부분' : 'Least informative section', repetition: ko ? '반복되는 내용' : 'Repeated content', payoff: ko ? '결과 또는 결말' : 'Payoff', onScreenText: ko ? '화면 속 문구' : 'On-screen text', speech: ko ? '말하는 내용' : 'Speech', audioBehavior: ko ? '음악과 효과음' : 'Music and sound effects' };
  return <section aria-label={ko ? '영상 관찰 내용' : 'What I Saw'} className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-indigo-700">{ko ? '선택한 타깃 분야' : 'TARGET NICHE'}: {report.targetNiche}</p><h3 className="text-lg font-bold text-slate-900 mt-1">{ko ? '영상에서 확인한 내용' : 'WHAT I SAW'}</h3></div><span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${reliable ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-800'}`}>{statuses[report.status]}</span></div>
    {!reliable && <p className="text-sm text-amber-800">{ko ? '아래는 아직 충분히 확인되지 않은 관찰입니다. 잘못 이해한 부분이 있을 수 있어 최종 점수를 생성하지 않았습니다.' : 'These observations are not sufficiently verified and may contain mistakes. No final rating was generated.'}</p>}
    {inventory && <><p className="font-semibold text-slate-900">{inventory.mainSubject}</p><p className="text-sm leading-6 text-slate-600">{inventory.structure}</p><ol className="list-decimal pl-5 text-sm leading-6 space-y-2 text-slate-700">{inventory.majorProgression.map(id => {
      const scene = inventory.scenes.find(s => s.id === id);
      const label = id === inventory.openingSceneId && id === inventory.endingSceneId ? (ko ? '처음부터 끝까지' : 'Opening through ending') : id === inventory.openingSceneId ? (ko ? '시작' : 'Opening') : id === inventory.endingSceneId ? (ko ? '마지막' : 'Ending') : '';
      return scene && <li key={id}>{label && <strong>{label}: </strong>}{scene.description}</li>;
    })}</ol><dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm leading-6">{Object.entries(inventory.elements).map(([key, item]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><dt className="font-semibold text-slate-800">{labels[key as keyof typeof labels]}</dt><dd className="text-slate-600">{item.state !== 'observed' && <span className="font-medium">{item.state === 'unclear' ? (ko ? '확인 불가: ' : 'Unclear: ') : (ko ? '관찰되지 않음: ' : 'Not observed: ')}</span>}{item.description}</dd></div>)}</dl></>}
    {(report.issues.length > 0 || inventory?.limitations.length) && <ul className="list-disc pl-5 text-sm leading-6 text-amber-800">{[...new Set([...report.issues, ...(inventory?.limitations || [])])].map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
    <p className="text-sm text-slate-500">{ko ? '업로드한 영상에서 추출한 화면과 가능한 음성 전사를 확인했습니다. 화면 사이의 짧은 동작이나 음악은 확인하지 못할 수 있습니다.' : 'Checked against images from your upload and available speech transcription. Brief actions between images and music may remain unverified.'}</p>
  </section>;
}
