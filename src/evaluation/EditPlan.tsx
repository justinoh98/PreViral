import React, { useState } from 'react';
import { Copy, Check, Zap, Scissors, MessageCircle, CheckCircle2 } from 'lucide-react';
import type { Feedback, VideoInventory } from '../../evaluation/contracts';
function CopyButton({ text, label = '', dark = false }: { text: string; label?: string; dark?: boolean }) {
  const [state, setState] = useState('');
  return <button type="button" aria-label={label || 'Copy text'} onClick={async () => { try { await navigator.clipboard.writeText(text); setState('Copied'); } catch { setState('Select text to copy'); } }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border p-3 text-sm font-bold ${dark ? 'border-slate-600 bg-slate-700 text-white' : 'border-gray-200 bg-white text-slate-700 shadow-sm'}`}>{state === 'Copied' ? <Check size={18}/> : <Copy size={18}/>} {state || label}</button>;
}
export function EditPlan({ plan, language, inventory, editTypes = {} }: { plan: Feedback; language: string; inventory?: VideoInventory | null; editTypes?: Record<string, string> }) {
  const ko = language === 'ko';
  const shot = (id: string) => inventory?.scenes.find(s => s.id === id);
  const packageText = [plan.caption, ...plan.captionHooks, plan.valueCTA, plan.cliffhangerCTA, plan.commentQuestion, plan.hashtags.join(' ')].filter(Boolean).join('\n\n');
  const panel = 'rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm space-y-6';
  return <div className="space-y-8 text-slate-800 text-base leading-relaxed">
    <section className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 text-white space-y-6">
      <Zap className="text-amber-400 bg-indigo-900 rounded-xl p-2" size={44}/>
      <h3 className="text-2xl font-bold">{ko ? '바로 복사하는 화면 문구' : 'Copy-Ready On-Screen Text'}</h3>
      <div><span className="inline-block rounded border border-amber-400/40 bg-amber-400/20 px-3 py-1 text-sm font-bold text-amber-300">{ko ? '화면 문구 편집 가이드' : 'CAPTION BREAKDOWN GUIDANCE'}</span><p className="mt-3 text-slate-300">{ko ? '각 장면에는 A안을 우선 추천합니다. B와 C는 대안이며, 한 번에 하나만 사용하세요.' : 'Use Option A as the recommended wording for each shot. Options B and C are alternatives—choose one, then follow the placement guidance.'}</p></div>
      {!plan.textPlaybook?.length && <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-300">{ko ? '이 평가에는 장면별 문구 제안이 포함되어 있지 않습니다.' : 'This evaluation contains no shot-by-shot wording suggestions.'}</div>}
      {(plan.textPlaybook ?? []).map((row, i) => <article key={i} className="rounded-3xl border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4"><span className="rounded-xl bg-amber-400 px-3 py-1 font-bold text-slate-950">{ko ? `장면 ${i+1}` : (shot(row.sceneId)?.section || `Shot ${i+1}`).toUpperCase()}</span><h4 className="font-bold uppercase text-indigo-300">{row.stage}</h4></div>
        <p className="text-sm text-slate-400">{shot(row.sceneId)?.description}</p>
        {([['OPTION A (DIRECT VALUE) · BEST PICK', row.direct, 'text-amber-300'], ['OPTION B (CURIOSITY GAP)', row.curiosity, 'text-indigo-300'], ['OPTION C (STORY / BOLD STANCE)', row.story, 'text-blue-300']] as const).map(([label, copy, color]) => <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-5"><div><p className={`text-sm font-bold ${color}`}>{label}</p><p className="mt-1 font-semibold select-text">“{copy}”</p></div><CopyButton text={copy} dark/></div>)}
        <div className="rounded-2xl border border-indigo-900 bg-indigo-950/60 p-5"><h5 className="font-bold text-amber-300">{ko ? '화면 배치 가이드' : 'On-Screen Placement Guidance:'}</h5><p className="mt-2 text-indigo-200">{row.guidance}</p></div>
      </article>)}
    </section>
    <section className={panel}>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-5"><Scissors className="shrink-0 text-indigo-600"/><h3 className="text-2xl font-bold text-slate-900">{ko ? '실행 가능한 편집 가이드 & 수정' : 'Actionable Editing Guidelines & Fixes'}</h3><span className="ml-auto rounded-full bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700">{plan.edits.length} {ko ? '수정 제안' : 'Suggested Edits'}</span></div>
      <p className="text-slate-500">{ko ? '현재 영상에서 무엇을 바꾸고 어떤 문구를 쓸지 확인하세요.' : 'Specific changes to your existing footage, with the exact words to use.'}</p>
      {plan.edits.map(edit => <article key={edit.id} className="rounded-3xl border border-gray-100 bg-slate-50 p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center gap-3"><span className="rounded-xl border bg-white px-3 py-2 font-bold text-indigo-600">{shot(edit.targetSceneId)?.section.toUpperCase()}</span><span className={`rounded px-2 py-1 text-xs font-bold ${edit.priority === 'must_fix' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>{edit.priority === 'must_fix' ? 'CRITICAL · MUST FIX' : edit.priority === 'optional' ? 'OPTIONAL' : 'SHOULD IMPROVE'}</span><strong>{({ hook: ko ? '훅 수정' : 'HOOK FIX', pacing: ko ? '페이싱 수정' : 'PACING FIX', payoff: ko ? '결말 수정' : 'PAYOFF FIX', safezone: ko ? '화면 수정' : 'VISUAL FIX', cut: ko ? '편집 수정' : 'EDIT FIX' } as Record<string, string>)[editTypes[edit.id]] || (ko ? '편집 수정' : 'EDIT FIX')}</strong></div>
        <p className="font-semibold text-slate-700">{edit.problem}</p>
        <p className="text-sm text-slate-500">{shot(edit.targetSceneId)?.description}</p>
        <div className="flex gap-2 text-green-700"><CheckCircle2 className="mt-1 shrink-0" size={20}/><div className="font-semibold">{ko ? '해결: ' : 'Solution: '}{edit.editThis}<p className="mt-2">{edit.useThis}</p></div></div>
        {edit.copy && <div className="rounded-xl border bg-white p-4 space-y-2">{edit.copyBefore && <p className="text-slate-500">{ko ? '기존: ' : 'REPLACE: '}“{edit.copyBefore}”</p>}<p className="font-semibold text-indigo-700">{edit.copyBefore ? (ko ? '변경: ' : 'WITH: ') : (ko ? '추천 문구: ' : 'USE THIS TEXT: ')}“{edit.copy}”</p><CopyButton text={edit.copy}/></div>}
        <p className="text-sm text-slate-500">{edit.why}</p>
        {edit.footage === 'reshoot' && <p className="font-bold text-amber-700">{ko ? '새 촬영 필요' : 'IF YOU CAN RESHOOT'}</p>}
        <CopyButton text={[edit.editThis, edit.useThis, edit.copy].filter(Boolean).join('\n')} label={ko ? '수정안 복사' : 'Copy Fix'}/>
      </article>)}
      {!!plan.keep.length && <div className="rounded-2xl bg-emerald-50 p-4"><h4 className="font-bold text-green-800">KEEP</h4>{plan.keep.map((item,i) => <p key={i} className="mt-2 text-sm">{item.instruction}</p>)}</div>}
      {!!plan.reeditPlan.length && <div><h4 className="font-bold">{ko ? '추천 재편집 순서' : 'RECOMMENDED RE-EDIT'}</h4><ol className="mt-3 list-decimal pl-5 space-y-3 text-sm">{plan.reeditPlan.map((item,i) => <li key={i}>{item.instruction}</li>)}</ol></div>}
    </section>
    <section className={panel}>
      <h3 className="flex items-center gap-3 text-2xl font-bold"><MessageCircle className="text-indigo-600"/>{ko ? '캡션 & CTA 성장 옵티마이저' : 'Caption & CTA Growth Optimizer'}</h3>
      {!!plan.captionHooks.length && <div className="rounded-3xl bg-slate-50 p-5 space-y-3"><h4 className="font-bold text-slate-700">{ko ? '추천 화면 훅 문구' : 'RECOMMENDED ON-SCREEN TEXT HOOKS'}</h4>{plan.captionHooks.map((copy,i) => <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4"><p className="font-semibold">“{copy}”</p><CopyButton text={copy}/></div>)}</div>}
      {!!plan.caption && <div className="rounded-2xl bg-slate-50 p-5"><h4 className="font-bold">{ko ? '추천 게시 캡션' : 'SUGGESTED CAPTION'}</h4><p className="my-3 whitespace-pre-wrap">{plan.caption}</p><CopyButton text={plan.caption}/></div>}
      {[plan.valueCTA,plan.cliffhangerCTA,plan.commentQuestion].some(Boolean) && <div className="rounded-3xl bg-slate-50 p-5 space-y-3"><h4 className="font-bold text-slate-700">ACTIVE CALL-TO-ACTIONS (CTAS)</h4>{[['VALUE-BASED CTA',plan.valueCTA,'text-green-700'],['CLIFFHANGER CTA',plan.cliffhangerCTA,'text-indigo-600'],['COMMENT QUESTION',plan.commentQuestion,'text-blue-600']].filter(([,copy]) => copy).map(([label,copy,color]) => <div key={label} className="rounded-2xl border bg-white p-4"><h5 className={`text-sm font-bold ${color}`}>{label}</h5><p className="my-2 font-semibold">{copy}</p><CopyButton text={copy}/></div>)}</div>}
      <div className="rounded-3xl bg-slate-50 p-5 space-y-4"><h4 className="font-bold text-slate-700">{ko ? '# 추천 해시태그' : '# Recommended Hashtags'}</h4><div className="flex flex-wrap gap-2">{plan.hashtags.map(tag => <span key={tag} className="rounded-xl border bg-white px-3 py-2 font-bold text-indigo-700 select-text">{tag}</span>)}</div><CopyButton text={packageText} label={ko ? '전체 패키지 복사' : 'Copy Complete Package'}/></div>
    </section>
  </div>;
}
