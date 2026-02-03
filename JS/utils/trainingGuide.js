import { INSTRUCTION_TEXT } from '../content/instructions.js';
import { renderLines, renderTemplate } from './instructionEngine.js';

const hasAnyEdge = (edges) => edges && Object.values(edges).some(Boolean);

const badgeFrom = (done, doing) => {
  if (done) {
    return { state: 'done', label: '完了' };
  }
  if (doing) {
    return { state: 'doing', label: '進行中' };
  }
  return { state: 'todo', label: '未着手' };
};

const getFtpOK = (store) =>
  !!store?.company?.status?.ftpReachable || !!store?.company?.edges?.routerFtp;

const getStatusFlags = (store) => {
  const homeOK = !!store?.summary?.homeOK;
  const companyOK = !!store?.summary?.companyOK;
  const ftpOK = getFtpOK(store);
  return { homeOK, companyOK, ftpOK };
};

const TRAINING_STEP_RULES = {
  home: {
    isDone: (_store, flags) => flags.homeOK,
    isDoing: (store) => hasAnyEdge(store?.home?.edges)
  },
  company: {
    isDone: (_store, flags) => flags.companyOK,
    isDoing: (store) => hasAnyEdge(store?.company?.edges)
  },
  ftp: {
    isDone: (_store, flags) => flags.ftpOK,
    isDoing: (_store, flags) => flags.companyOK
  }
};

const TRAINING_STATE_RULES = {
  homePending: (flags) => !flags.homeOK,
  companyPending: (flags) => flags.homeOK && !flags.companyOK,
  ftpPending: (flags) => flags.homeOK && flags.companyOK && !flags.ftpOK,
  done: (flags) => flags.homeOK && flags.companyOK && flags.ftpOK
};

const resolveTrainingState = (flags, summary) => {
  const found = INSTRUCTION_TEXT.training.explanations.find((item) => {
    const matcher = TRAINING_STATE_RULES[item.when];
    return typeof matcher === 'function' ? matcher(flags) : false;
  }) || INSTRUCTION_TEXT.training.explanations[0];

  const context = { summary };
  return {
    id: found.id,
    statusLabel: renderTemplate(found.statusLabel, context),
    title: found.title,
    lines: renderLines(found.lines, context)
  };
};

export const buildTrainingGuide = (store) => {
  const flags = getStatusFlags(store);

  const steps = INSTRUCTION_TEXT.training.steps.map((def) => {
    const rules = TRAINING_STEP_RULES[def.id] || {};
    const done = typeof rules.isDone === 'function' ? rules.isDone(store, flags) : false;
    const doing = !done && (typeof rules.isDoing === 'function' ? rules.isDoing(store, flags) : false);
    const badge = badgeFrom(done, doing);
    return {
      ...def,
      state: badge.state,
      label: badge.label
    };
  });

  const completed = steps.filter((step) => step.state === 'done').length;
  const next = steps.find((step) => step.state !== 'done') || null;
  const nextTask = next ? next.title : 'すべて完了';
  const nextDetail = next ? next.description : '全てのステップが完了しました。';

  const summary = {
    completed,
    total: steps.length,
    nextTask,
    nextDetail
  };

  return {
    steps,
    summary,
    explanation: resolveTrainingState(flags, summary)
  };
};
