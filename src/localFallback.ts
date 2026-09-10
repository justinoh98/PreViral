export function createLocalCaptions(topic: string, niche: string, language: string) {
  const subject = topic.trim() || niche.trim() || (language === 'ko' ? '이 콘텐츠' : 'this idea');
  return language === 'ko'
    ? { hooks: [`${subject}, 결과가 이렇게 달라졌습니다`, `${subject}에서 대부분 놓치는 한 가지`, `평범했던 ${subject}를 이렇게 바꿨습니다`], valueCTA: '나중에 다시 볼 수 있게 저장해 두세요.', cliffhangerCTA: '다음에는 이 결과를 더 깔끔하게 만드는 방법을 보여드릴게요.', commentBaitQuestion: '여러분이라면 어떤 부분을 먼저 바꾸시겠어요?', hashtags: ['#릴스제작', '#숏폼콘텐츠', '#영상편집', '#콘텐츠전략', '#크리에이터팁'] }
    : { hooks: [`Here’s how ${subject} turned out`, `The one thing most people miss about ${subject}`, `I changed ordinary ${subject} into this`], valueCTA: 'Save this so you can use it on your next edit.', cliffhangerCTA: 'Next, I’ll show you how to make this result look even cleaner.', commentBaitQuestion: 'What would you change first?', hashtags: ['#reelsediting', '#shortformvideo', '#contentcreator', '#visualstorytelling', '#creatortips'] };
}
