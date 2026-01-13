import { INSTRUCTION_TEXT } from '../content/instructions.js';
import { renderLines, renderTemplate } from './instructionEngine.js';

const hydrateSteps = (rawSteps) => {
  if (!Array.isArray(rawSteps)) {
    return [];
  }
  const firstRequiredTodo = rawSteps.findIndex((step) => !step.done && !step.optional);
  const firstAnyTodo = rawSteps.findIndex((step) => !step.done);
  const activeIndex = firstRequiredTodo >= 0 ? firstRequiredTodo : firstAnyTodo;

  return rawSteps.map((step, index) => ({
    id: step.id,
    label: step.label,
    detail: step.detail || '',
    optional: !!step.optional,
    state: step.done ? 'done' : (index === activeIndex ? 'doing' : 'todo')
  }));
};

const nextActionFromSteps = (steps, fallback) => {
  if (typeof fallback !== 'undefined' && fallback !== null) {
    return fallback;
  }
  const active = steps.find((step) => step.state === 'doing');
  if (active) {
    return active.detail || `${active.label}を進めてください。`;
  }
  if (steps.length) {
    return `${steps[steps.length - 1].label}まで完了しました。復習や追加配置を試してください。`;
  }
  return '';
};

const buildStepsFromDefinitions = (definitions, doneMap, context) => {
  const raw = definitions.map((def) => {
    const done = !!doneMap[def.id];
    const detailTemplate = done ? def.detailWhenDone : def.detailWhenTodo;
    return {
      id: def.id,
      label: def.label,
      optional: !!def.optional,
      done,
      detail: renderTemplate(detailTemplate || '', context)
    };
  });
  return hydrateSteps(raw);
};

const resolveState = (states, predicates, data, context) => {
  const found = states.find((state) => {
    const matcher = predicates[state.id];
    return typeof matcher === 'function' ? matcher(data) : false;
  }) || states[0];

  const statusLabel = renderTemplate(found.statusLabel, context);
  const lines = renderLines(found.lines, context);
  const nextAction = found.nextAction ? renderTemplate(found.nextAction, context) : undefined;

  return { id: found.id, title: found.title, statusLabel, lines, nextAction };
};

const HOME_PREDICATES = {
  'no-router': (data) => !data.hasRouter,
  'router-only': (data) => data.hasRouter && !data.hasClient,
  'lan-ready': (data) => data.hasRouter && data.hasClient && !data.routerTutorialDone,
  'home-done': (data) => data.hasRouter && data.hasClient && data.routerTutorialDone
};

const COMPANY_PREDICATES = {
  'no-router': (data) => !data.hasRouter,
  'no-pc': (data) => data.hasRouter && !data.hasPc,
  'no-server-pc': (data) => data.hasRouter && data.hasPc && !data.hasServerPc,
  'no-apps': (data) => data.hasRouter && data.hasPc && data.hasServerPc && !data.hasServer,
  'no-web': (data) => data.hasRouter && data.hasPc && data.hasServer && !data.hasWebServer,
  'no-ftp': (data) => data.hasRouter && data.hasPc && data.hasWebServer && !data.hasFtpServer,
  'no-upload': (data) => data.hasRouter && data.hasPc && data.hasWebServer && data.hasFtpServer && !data.activeUpload,
  'company-done': (data) => data.hasRouter && data.hasPc && data.hasWebServer && data.hasFtpServer && !!data.activeUpload
};

export const buildHomeExplanation = (data) => {
  const pending = [];
  if (!data.credentialsDone) {
    pending.push('ログインID/パスワード変更');
  }
  if (!data.wifiDone) {
    pending.push('SSID/暗号化キー更新');
  }
  const pendingText = pending.length ? pending.join(' / ') : 'なし';

  const context = {
    status: data.status,
    pendingText
  };
  const doneMap = {
    wan: data.hasRouter,
    lan: data.hasClient,
    credentials: data.credentialsDone,
    wifi: data.wifiDone
  };

  const steps = buildStepsFromDefinitions(INSTRUCTION_TEXT.home.steps, doneMap, context);
  const base = resolveState(INSTRUCTION_TEXT.home.states, HOME_PREDICATES, data, context);
  const nextAction = nextActionFromSteps(steps, base.nextAction);
  return { ...base, steps, nextAction };
};

export const buildCompanyExplanation = (data) => {
  const context = {
    status: data.status,
    lanClientCount: data.lanClients ?? 0
  };
  const doneMap = {
    wan: data.hasRouter,
    lan: data.hasPc,
    'server-role': data.hasServerPc,
    'web-app': data.hasWebServer,
    'ftp-app': data.hasFtpServer,
    upload: data.ftpEnabled && !!data.activeUpload,
    dns: data.hasDnsServer
  };

  const steps = buildStepsFromDefinitions(INSTRUCTION_TEXT.company.steps, doneMap, context);
  const base = resolveState(INSTRUCTION_TEXT.company.states, COMPANY_PREDICATES, data, context);
  const nextAction = nextActionFromSteps(steps, base.nextAction);
  return { ...base, steps, nextAction };
};
