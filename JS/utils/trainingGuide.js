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

export const GUIDE_STEPS = [
  {
    id: 'home',
    title: '自宅ネットワーク',
    description: 'ONU->ルータ->PC を配置し、PC のブラウザ接続が OK になることを確認する。',
    isDone: (_store, flags) => flags.homeOK,
    isDoing: (store) => hasAnyEdge(store?.home?.edges)
  },
  {
    id: 'company',
    title: '会社ネットワーク',
    description: 'ONU->ルータ->PC/WEB を配置し、社内の通信経路を確認する。',
    isDone: (_store, flags) => flags.companyOK,
    isDoing: (store) => hasAnyEdge(store?.company?.edges)
  },
  {
    id: 'ftp',
    title: 'FTP 接続確認',
    description: 'FTP サーバを追加し、PC の FTP アプリで接続が OK になることを確認する。',
    isDone: (_store, flags) => flags.ftpOK,
    isDoing: (_store, flags) => flags.companyOK
  }
];

const EXPLANATION_STATES = [
  {
    id: 'home',
    when: (flags) => !flags.homeOK,
    statusLabel: '自宅ネットワーク: 未完了',
    title: '自宅ネットワークの構成途中です',
    lines: (summary) => [
      '自宅ネットワークは ONU->ルータ->PC が揃うとブラウザ接続が OK になる設計です。',
      `現在の進行度は ${summary.completed}/${summary.total} です。`,
      `次に確認したい内容は「${summary.nextTask}」です。`
    ]
  },
  {
    id: 'company',
    when: (flags) => flags.homeOK && !flags.companyOK,
    statusLabel: '会社ネットワーク: 未完了',
    title: '会社ネットワーク構築フェーズです',
    lines: (summary) => [
      '自宅ネットワークは完了しています。',
      '会社ネットワークは ONU->ルータ->PC/WEB の構成で社内通信が成立する設計です。',
      `現在の進行度は ${summary.completed}/${summary.total} です。次は「${summary.nextTask}」を確認します。`
    ]
  },
  {
    id: 'ftp',
    when: (flags) => flags.homeOK && flags.companyOK && !flags.ftpOK,
    statusLabel: 'FTP 接続: 未確認',
    title: 'FTP 接続の確認フェーズです',
    lines: (summary) => [
      '自宅/会社ネットワークは完了しています。',
      'FTP サーバを追加し、PC 側の FTP アプリが接続可能になると完了扱いになります。',
      `現在の進行度は ${summary.completed}/${summary.total} です。`
    ]
  },
  {
    id: 'done',
    when: (flags) => flags.homeOK && flags.companyOK && flags.ftpOK,
    statusLabel: '全ステップ完了',
    title: '学習フローは完了しています',
    lines: (summary) => [
      '全てのネットワーク構成が完了しています。',
      '拠点ごとの構成差や通信の流れを地図から比較できます。',
      `進行度は ${summary.completed}/${summary.total} です。`
    ]
  }
];

const buildTrainingExplanation = (flags, summary) => {
  const found = EXPLANATION_STATES.find((state) => state.when(flags)) || EXPLANATION_STATES[0];
  return {
    id: found.id,
    statusLabel: found.statusLabel,
    title: found.title,
    lines: found.lines(summary)
  };
};

export const buildTrainingGuide = (store) => {
  const flags = getStatusFlags(store);
  const steps = GUIDE_STEPS.map((step) => {
    const done = step.isDone(store, flags);
    const doing = !done && step.isDoing(store, flags);
    const badge = badgeFrom(done, doing);
    return {
      ...step,
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
    explanation: buildTrainingExplanation(flags, summary)
  };
};
