// Exact creator selections are audience context, never evidence about a video's contents.
export const TARGET_NICHES = ['Photography', 'Toys & Hobbies', 'Music & Movie', 'Tech & Gadgets', 'Fitness & Sports', 'Food & Recipe Prep', 'Fashion & Lifestyle', 'Education & Informatives', 'Travel & Aesthetic Vlogs', 'Business & Entrepreneurship'] as const;
export type TargetNiche = typeof TARGET_NICHES[number];
export function isTargetNiche(value: unknown): value is TargetNiche {
  return typeof value === 'string' && (TARGET_NICHES as readonly string[]).includes(value);
}
export const NICHE_CONTEXT: Record<TargetNiche, string> = {
  Photography: 'Consider interest in the photographic subject, image, composition, lighting or process ONLY where observed. Do not assume a tutorial or final photograph exists.',
  'Toys & Hobbies': 'Consider appeal to people interested in the actual toy, model, collection or hobby activity. Do not assume a build, unboxing or transformation exists.',
  'Music & Movie': 'Consider the observed performance, scene, edit or commentary. Interpret only speech actually transcribed; music and sound quality remain unknown without direct audio evidence.',
  'Tech & Gadgets': 'Consider whether the observed device, demonstration, comparison or information communicates value. Never assume an unseen test or result.',
  'Fitness & Sports': 'Consider the actual movement, challenge, event or instruction and its clarity to this audience. Do not invent a fitness result.',
  'Food & Recipe Prep': 'Consider the actual dish, ingredients and preparation stages shown. Judge existing food visuals and progression, not an assumed recipe sequence.',
  'Fashion & Lifestyle': 'Consider the actual styling, routine, comparison or lifestyle moment. Do not require a transformation or infer product claims.',
  'Education & Informatives': 'Consider the observed idea, demonstration or explanation and what the viewer learns. Do not infer a lesson from the category alone.',
  'Travel & Aesthetic Vlogs': 'Consider the observed place, experience and atmosphere. Intentional stillness can sustain attention through beauty, tension or emotion.',
  'Business & Entrepreneurship': 'Consider the actual insight, process, experience or result communicated. Never invent success metrics or a business lesson.',
};
