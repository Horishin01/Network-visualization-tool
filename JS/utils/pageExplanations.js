const resolveExplanation = (states, data) => {
  const found = states.find((item) => item.when(data)) || states[0];
  return {
    id: found.id,
    title: found.title,
    statusLabel: typeof found.statusLabel === 'function' ? found.statusLabel(data) : found.statusLabel,
    lines: typeof found.lines === 'function' ? found.lines(data) : found.lines,
    nextAction: typeof found.nextAction === 'function' ? found.nextAction(data) : found.nextAction,
    steps: typeof found.steps === 'function' ? found.steps(data) : found.steps
  };
};

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
  if (typeof fallback !== 'undefined') {
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

const buildHomeSteps = (data) => hydrateSteps([
  {
    id: 'wan',
    label: 'ONU → ルータをつなぐ',
    done: data.hasRouter,
    detail: data.hasRouter
      ? 'ルータを配置済み。WAN は OK です。'
      : '機器パレットからルータを 1 台置いて WAN を OK にします。'
  },
  {
    id: 'lan',
    label: 'PC/端末をつなぎ LAN を確認',
    done: data.hasClient,
    detail: data.hasClient
      ? 'LAN 側に端末があります。PC を置くと接続確認がしやすいです。'
      : 'PC を 1 台置いて LAN を OK にし、ブラウザ接続を確認します。'
  },
  {
    id: 'credentials',
    label: 'ログイン ID / パスワードを更新',
    done: data.credentialsDone,
    detail: data.credentialsDone
      ? '管理用の ID / パスワードは保存済みです。'
      : 'ルータ設定画面で ID / パスワードを決めて「変更を保存」を押します。'
  },
  {
    id: 'wifi',
    label: 'SSID と暗号化キーを決める',
    done: data.wifiDone,
    detail: data.wifiDone
      ? 'Wi-Fi 設定は更新済みです。'
      : 'SSID / 暗号化キーを入力して保存するとバッジが完了に変わります。'
  }
]);

const buildCompanySteps = (data) => hydrateSteps([
  {
    id: 'wan',
    label: 'ルータを置いて WAN を通す',
    done: data.hasRouter,
    detail: data.hasRouter
      ? 'WAN は OK です。ONU の横にルータが配置されています。'
      : 'ルータを 1 台置くと WAN が OK になります。'
  },
  {
    id: 'lan',
    label: 'PC を置いて LAN を作る',
    done: data.hasPc,
    detail: data.hasPc
      ? `LAN 側に PC が ${data.lanClients ?? 1} 台あります。用途切り替えができます。`
      : 'PC を追加して LAN を通します。'
  },
  {
    id: 'server-role',
    label: 'PC をサーバ用に切り替える',
    done: data.hasServerPc,
    detail: data.hasServerPc
      ? 'サーバ用 PC が準備できています。'
      : 'PC を選択して「サーバ用」を押します。'
  },
  {
    id: 'web-app',
    label: 'WEB サーバアプリを入れる',
    done: data.hasWebServer,
    detail: data.hasWebServer
      ? 'WEB サーバ導入済みです。'
      : 'サーバ用 PC で WEB アプリを入れるとプレビューの準備が整います。'
  },
  {
    id: 'ftp-app',
    label: 'FTP サーバアプリを入れる',
    done: data.hasFtpServer,
    detail: data.hasFtpServer
      ? 'FTP サーバ導入済みです。'
      : 'アップロード用に FTP アプリを入れます。'
  },
  {
    id: 'upload',
    label: 'HTML をアップロードして割り当て',
    done: data.ftpEnabled && !!data.activeUpload,
    detail: data.ftpEnabled
      ? (data.activeUpload
        ? 'プレビューに HTML を割り当て済みです。'
        : '用意済み HTML を FTP でアップロードして割り当てます。')
      : 'FTP サーバを入れるとアップロードが有効になります。'
  },
  {
    id: 'dns',
    label: 'DNS サーバアプリを入れる（任意）',
    done: data.hasDnsServer,
    optional: true,
    detail: data.hasDnsServer
      ? 'DNS サーバも有効です。名前解決の役割を確認できます。'
      : '任意: DNS アプリを入れると名前解決の役割を足せます。'
  }
]);

const HOME_EXPLANATIONS = [
  {
    id: 'no-router',
    when: (data) => !data.hasRouter,
    title: 'ルータを置いて WAN/LAN の入口を作る',
    statusLabel: (data) => `WAN: ${data.status.wan} / LAN: ${data.status.lan}`,
    lines: () => [
      'ONU の位置を確認し、外部回線が入る場所を意識します。',
      '機器パレットから「ルータ」を 1 台置くと WAN が OK になります。',
      '画面左のステップは進行に合わせて更新されます。'
    ]
  },
  {
    id: 'router-only',
    when: (data) => data.hasRouter && !data.hasClient,
    title: '端末を置いてブラウザ接続を確認する',
    statusLabel: (data) => `WAN: ${data.status.wan} / LAN: ${data.status.lan}`,
    lines: () => [
      'ルータの設置は完了しています。',
      '次は PC など端末を置いて LAN を OK にし、ブラウザ接続を確認します。',
      'ルータをクリックすると設定画面が開き、ログイン情報の変更も体験できます。'
    ]
  },
  {
    id: 'lan-ready',
    when: (data) => data.hasRouter && data.hasClient && !data.routerTutorialDone,
    title: '通信経路ができたので設定を仕上げる',
    statusLabel: (data) => `WAN: ${data.status.wan} / LAN: ${data.status.lan}`,
    lines: (data) => {
      const pending = [];
      if (!data.credentialsDone) {
        pending.push('ログインID/パスワード変更');
      }
      if (!data.wifiDone) {
        pending.push('SSID/暗号化キー更新');
      }
      const pendingText = pending.length ? pending.join(' / ') : 'なし';
      return [
        'ONU→ルータ→端末の流れができました。',
        `残りの設定: ${pendingText}。ルータを選択すると設定画面が開きます。`,
        '設定を保存するとステップのバッジが完了に変わります。'
      ];
    }
  },
  {
    id: 'home-done',
    when: (data) => data.hasRouter && data.hasClient && data.routerTutorialDone,
    title: '自宅ネットワークの接続確認が完了',
    statusLabel: (data) => `WAN: ${data.status.wan} / LAN: ${data.status.lan}`,
    lines: () => [
      'ONU→ルータ→端末の経路とルータ設定が完了しました。',
      '端末を追加して複数接続のイメージを掴んだり、設定値を変更して復習できます。',
      '自宅ネットワークは外部公開を行わない想定です。',
      'ルータ設定画面ではいつでも ID/パスワードや SSID の変更手順を復習できます。'
    ]
  }
];

const COMPANY_EXPLANATIONS = [
  {
    id: 'no-router',
    when: (data) => !data.hasRouter,
    title: 'ルータを置いて社内ネットワークを開始する',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers} / FTP: ${data.status.ftp}`,
    lines: () => [
      'ONU の位置を確認し、外部回線が入る場所を意識します。',
      '社内サーバは PC に OS を入れ、アプリを導入して構成するイメージです。',
      '機器パレットから「ルータ」を 1 台置いて WAN を OK にします。',
      'ステップ表に沿って進めると状況が自動で更新されます。'
    ]
  },
  {
    id: 'no-pc',
    when: (data) => data.hasRouter && !data.hasPc,
    title: 'PC を置いて社内サーバの準備をする',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers} / FTP: ${data.status.ftp}`,
    lines: () => [
      'ルータの設置は完了しています。',
      'PC を追加して LAN を作り、サーバ用に切り替える準備をします。',
      '「会社HPプレビュー」枠は WEB サーバ導入後に表示されます。'
    ]
  },
  {
    id: 'no-server-pc',
    when: (data) => data.hasRouter && data.hasPc && !data.hasServerPc,
    title: 'PC をサーバ用に切り替える',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers} / FTP: ${data.status.ftp}`,
    lines: () => [
      'PC の配置が完了しました。',
      'PC を選択して用途を「サーバ用」に切り替えます。',
      'サーバアプリは「サーバ用」に切り替えた PC でのみ導入できます。'
    ]
  },
  {
    id: 'no-apps',
    when: (data) => data.hasRouter && data.hasPc && data.hasServerPc && !data.hasServer,
    title: 'サーバ用 PC にアプリを入れて役割を作る',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers} / FTP: ${data.status.ftp}`,
    lines: () => [
      'サーバ用 PC の準備が完了しました。',
      'PC を選択して WEB/FTP/DNS のサーバアプリを入れていきます。',
      '最低でも WEB サーバを入れるとプレビューが表示されます。'
    ]
  },
  {
    id: 'no-web',
    when: (data) => data.hasRouter && data.hasPc && data.hasServer && !data.hasWebServer,
    title: 'WEB サーバアプリを入れて公開準備をする',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers} / FTP: ${data.status.ftp}`,
    lines: () => [
      'サーバアプリの導入が進んでいます。',
      'サーバ用 PC に WEB サーバアプリを入れると会社 HP プレビューが表示されます。',
      'FTP や DNS は WEB 導入後に追加できます。'
    ]
  },
  {
    id: 'no-ftp',
    when: (data) => data.hasRouter && data.hasPc && data.hasWebServer && !data.hasFtpServer,
    title: 'FTP サーバアプリを入れてアップロードを確認する',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: () => [
      'WEB サーバアプリの導入が完了しました。',
      'サーバ用 PC に FTP サーバアプリを入れると用意された HTML をアップロードできます。',
      'アップロードするとプレビュー枠に内容が表示されます。'
    ]
  },
  {
    id: 'no-upload',
    when: (data) => data.hasRouter && data.hasPc && data.hasWebServer && data.hasFtpServer && !data.activeUpload,
    title: 'HTML をアップロードしてプレビューを表示する',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: () => [
      'FTP サーバが有効になりました。',
      '用意済みの HTML を FTP でアップロードし、プレビューに割り当てます。',
      'プリセットから選ぶとすぐに動作確認ができます。'
    ]
  },
  {
    id: 'company-done',
    when: (data) => data.hasRouter && data.hasPc && data.hasWebServer && data.hasFtpServer && data.activeUpload,
    title: '会社ネットワークの確認が完了',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: () => [
      '社内ネットワークの構成が完成しました。',
      '会社 HP のプレビュー枠で画面遷移の流れを確認できます。',
      'DNS サーバアプリを入れると名前解決の役割も体験できます。',
      'サーバアプリの組み合わせを変えて挙動の違いを確認することもできます。'
    ]
  }
];

export const buildHomeExplanation = (data) => {
  const base = resolveExplanation(HOME_EXPLANATIONS, data);
  const steps = buildHomeSteps(data);
  const nextAction = nextActionFromSteps(steps, base.nextAction);
  return { ...base, steps, nextAction };
};

export const buildCompanyExplanation = (data) => {
  const base = resolveExplanation(COMPANY_EXPLANATIONS, data);
  const steps = buildCompanySteps(data);
  const nextAction = nextActionFromSteps(steps, base.nextAction);
  return { ...base, steps, nextAction };
};
