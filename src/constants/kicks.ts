export const KICK_TYPES = ['driven', 'curler', 'knuckleball', 'chip'] as const;
export type KickType = (typeof KICK_TYPES)[number];

export const KICK_EMOJI: Record<KickType, string> = {
  driven: '🚀',
  curler: '🌀',
  knuckleball: '⚡',
  chip: '🪂',
};

export const POSITIONS = ['forward', 'midfielder', 'defender', 'goalkeeper', 'any'] as const;
export type Position = (typeof POSITIONS)[number];

export const LEVELS = ['beginner', 'club', 'academy'] as const;
export type Level = (typeof LEVELS)[number];

export const WEAKNESSES = ['power', 'accuracy', 'curve', 'consistency'] as const;
export type Weakness = (typeof WEAKNESSES)[number];

export const GOALS = ['make_team', 'score_more', 'set_pieces', 'go_pro'] as const;
export type Goal = (typeof GOALS)[number];

export const TRAIN_FREQ = ['rarely', 'weekly', 'few_times', 'daily'] as const;
export type TrainFrequency = (typeof TRAIN_FREQ)[number];
