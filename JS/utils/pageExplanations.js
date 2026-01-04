const resolveExplanation = (states, data) => {
  const found = states.find((item) => item.when(data)) || states[0];
  return {
    id: found.id,
    title: found.title,
    statusLabel: typeof found.statusLabel === 'function' ? found.statusLabel(data) : found.statusLabel,
    lines: typeof found.lines === 'function' ? found.lines(data) : found.lines
  };
};

const HOME_EXPLANATIONS = [
  {
    id: 'no-router',
    when: (data) => !data.hasRouter,
    title: 'ルータを配置してWAN/LANの流れを作る',
    statusLabel: (data) => `WAN: ${data.status.wan} / LAN: ${data.status.lan}`,
    lines: (data) => [
      'ONU の位置を確認し、外部回線が入る場所を意識します。',
      '機器パレットから「ルータ」を追加すると WAN が OK になります。',
      `現在の状態は WAN: ${data.status.wan} / LAN: ${data.status.lan} です。`
    ]
  },
  {
    id: 'router-only',
    when: (data) => data.hasRouter && !data.hasPc,
    title: 'PC を追加してブラウザ接続を確認する',
    statusLabel: (data) => `WAN: ${data.status.wan} / LAN: ${data.status.lan}`,
    lines: (data) => [
      'ルータの設置は完了しています。',
      '機器パレットから「PC」を追加し、ブラウザ接続が OK になることを確認します。',
      `現在の状態は WAN: ${data.status.wan} / LAN: ${data.status.lan} です。`
    ]
  },
  {
    id: 'home-done',
    when: (data) => data.hasRouter && data.hasPc,
    title: '自宅ネットワークの接続確認が完了',
    statusLabel: (data) => `WAN: ${data.status.wan} / LAN: ${data.status.lan}`,
    lines: (data) => [
      'ONU->ルータ->PC の構成が完成しました。',
      '追加端末を配置して、複数端末接続のイメージを確認できます。',
      `現在の状態は WAN: ${data.status.wan} / LAN: ${data.status.lan} です。`
    ]
  }
];

const COMPANY_EXPLANATIONS = [
  {
    id: 'no-router',
    when: (data) => !data.hasRouter,
    title: 'ルータを配置して社内ネットワークを開始する',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers}`,
    lines: (data) => [
      'ONU の位置を確認し、外部回線が入る場所を意識します。',
      '機器パレットから「ルータ」を追加して WAN を OK にします。',
      `現在の状態は WAN: ${data.status.wan} / サーバ: ${data.status.servers} です。`
    ]
  },
  {
    id: 'no-server',
    when: (data) => data.hasRouter && !data.hasServer,
    title: '社内サーバを配置して役割を整理する',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers}`,
    lines: (data) => [
      'ルータの設置は完了しています。',
      'WEB/FTP/DNS のサーバを追加し、社内側の構成を作ります。',
      `現在の状態は WAN: ${data.status.wan} / サーバ: ${data.status.servers} です。`
    ]
  },
  {
    id: 'no-pc',
    when: (data) => data.hasRouter && data.hasServer && !data.hasPc,
    title: '操作用 PC を追加して確認手順を進める',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: (data) => [
      'サーバの配置が完了しました。',
      '機器パレットから「PC」を追加して操作端末を用意します。',
      `現在の状態は WAN: ${data.status.wan} / FTP: ${data.status.ftp} です。`
    ]
  },
  {
    id: 'no-ftp-server',
    when: (data) => data.hasRouter && data.hasPc && !data.ftpServer,
    title: 'FTP サーバを追加して通信経路を確認する',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: (data) => [
      'PC の配置が完了しました。',
      'FTP サーバを追加し、社内通信の流れを確認します。',
      `現在の状態は WAN: ${data.status.wan} / FTP: ${data.status.ftp} です。`
    ]
  },
  {
    id: 'ftp-app',
    when: (data) => data.hasRouter && data.hasPc && data.ftpServer && !data.ftpInstalled,
    title: 'FTP アプリを導入して接続確認する',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: (data) => [
      'FTP サーバの配置が完了しました。',
      'PC を選択して「FTPアプリを入れる」を実行します。',
      `現在の状態は WAN: ${data.status.wan} / FTP: ${data.status.ftp} です。`
    ]
  },
  {
    id: 'company-done',
    when: (data) => data.hasRouter && data.hasPc && data.ftpServer && data.ftpInstalled,
    title: '会社ネットワークの確認が完了',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: (data) => [
      '社内ネットワークの構成が完成しました。',
      '会社 HP のプレビュー枠で画面遷移の流れを確認できます。',
      `現在の状態は WAN: ${data.status.wan} / FTP: ${data.status.ftp} です。`
    ]
  }
];

export const buildHomeExplanation = (data) => resolveExplanation(HOME_EXPLANATIONS, data);

export const buildCompanyExplanation = (data) => resolveExplanation(COMPANY_EXPLANATIONS, data);
