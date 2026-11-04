// Тренувальні дні Романа: три різні дні на тиждень.
// Кожен день поділено на блоки; у блоці перелічено вправи, з яких зазвичай обирає.
// Порядок у блоці: спершу найтиповіші.

export type Block = { title: string; ids: string[] };
export type DayTemplate = {
  id: string;
  /** Коротко, для мітки: «День 1» */
  short: string;
  /** Що в цей день основне */
  name: string;
  color: string;
  blocks: Block[];
};

const TRICEPS: Block = {
  title: 'Трицепс',
  ids: ['rope-pushdown', 'pushdown', 'overhead-ext', 'skull', 'db-overhead', 'triceps-machine', 'dips-machine', 'close-grip', 'kickback', 'bench-dips'],
};
const BICEPS: Block = {
  title: 'Біцепс',
  ids: ['bb-curl', 'ez-curl', 'db-curl', 'hammer', 'preacher', 'incline-curl', 'machine-curl', 'cable-curl', 'concentration'],
};
const MID_DELT: Block = {
  title: 'Середня дельта',
  ids: ['lateral', 'cable-lateral', 'machine-lateral', 'upright-row'],
};

/** Додаткове, що відмічається просто галочкою, без вправ і підходів */
export const extras = [
  { id: 'abs', label: 'Прес' },
  { id: 'neck', label: 'Шия' },
  { id: 'forearms', label: 'Передпліччя' },
  { id: 'lowerback', label: 'Поперек' },
];
export const extraLabel = (id: string) => extras.find((e) => e.id === id)?.label ?? id;

export const dayTemplates: DayTemplate[] = [
  {
    id: 'd1',
    short: 'День 1',
    name: 'Верх грудей + ширина спини',
    color: '#F2C230',
    blocks: [
      { title: 'Верх грудей', ids: ['incline', 'incline-db', 'smith-incline', 'incline-machine', 'incline-flyes', 'crossover-low', 'pec-deck'] },
      { title: 'Ширина спини', ids: ['lat-pulldown', 'pullup', 'lat-narrow', 'lat-reverse', 'lat-single', 'hammer-pulldown', 'machine-pullover', 'assisted-pullup', 'chinup', 'straight-pulldown', 'db-row'] },
      TRICEPS,
      BICEPS,
      MID_DELT,
    ],
  },
  {
    id: 'd2',
    short: 'День 2',
    name: 'Ноги + плечі',
    color: '#E5483B',
    blocks: [
      {
        title: 'Ноги',
        ids: ['squat', 'leg-press', 'hack-squat', 'smith-squat', 'rdl', 'leg-ext', 'leg-curl', 'leg-curl-seated', 'leg-curl-lying', 'bulgarian', 'lunges', 'smith-lunges', 'front-squat', 'goblet-squat', 'leg-press-narrow', 'step-up', 'sumo-deadlift', 'adductor', 'abductor', 'hip-thrust', 'glute-machine', 'cable-kickback'],
      },
      { title: 'Ікри', ids: ['calf-raise', 'calf-seated', 'calf-leg-press'] },
      { title: 'Передня дельта', ids: ['ohp', 'db-press', 'shoulder-press', 'smith-ohp', 'arnold', 'front-raise'] },
      MID_DELT,
      { title: 'Задня дельта', ids: ['reverse-pec', 'rear-delt', 'face-pull', 'cable-rear'] },
    ],
  },
  {
    id: 'd3',
    short: 'День 3',
    name: 'Низ грудей + глибина спини',
    color: '#3D7FE0',
    blocks: [
      { title: 'Низ грудей', ids: ['bench', 'decline', 'dips', 'chest-press', 'hammer-chest', 'smith-bench', 'db-bench', 'crossover', 'pec-deck', 'flyes', 'db-pullover', 'pushups'] },
      { title: 'Глибина спини і трапеція', ids: ['bb-row', 't-bar-row', 'cable-row', 'hammer-row', 'machine-row', 'chest-row', 'cable-row-wide', 'db-row', 'deadlift', 'bb-shrug', 'db-shrug'] },
      TRICEPS,
      BICEPS,
      MID_DELT,
    ],
  },
];

/** Для днів, що не схожі на жоден із трьох */
export const freeDay: DayTemplate = {
  id: 'free',
  short: 'Інше',
  name: 'Вільне тренування',
  color: '#8E99A6',
  blocks: [],
};

export const templateById = (id: string): DayTemplate => dayTemplates.find((t) => t.id === id) ?? freeDay;

/** Вгадує тип дня за вправами: який шаблон містить найбільше з них (без спільних блоків) */
export function guessTemplate(exerciseIds: string[]): string {
  let best = 'free';
  let bestScore = 0;
  for (const t of dayTemplates) {
    const own = new Set(t.blocks.slice(0, 2).flatMap((b) => b.ids));
    const score = exerciseIds.filter((id) => own.has(id)).length;
    if (score > bestScore) {
      best = t.id;
      bestScore = score;
    }
  }
  return best;
}
