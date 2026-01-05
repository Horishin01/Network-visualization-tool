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
      'ルータ設定画面でログインID/パスワード変更とSSID/暗号化キー変更を体験できます。',
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
      '自宅ネットワークは外部公開を行わない想定です。',
      'ルータ設定画面でログインID/パスワード変更とSSID/暗号化キー変更の練習が可能です。',
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
      '社内サーバは PC に OS を入れ、アプリを導入して構成するイメージです。',
      '機器パレットから「ルータ」を追加して WAN を OK にします。',
      `現在の状態は WAN: ${data.status.wan} / サーバ: ${data.status.servers} です。`
    ]
  },
  {
    id: 'no-pc',
    when: (data) => data.hasRouter && !data.hasPc,
    title: 'PC を追加して社内サーバの準備をする',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers}`,
    lines: (data) => [
      'ルータの設置は完了しています。',
      '機器パレットから「PC」を追加し、OS の上にサーバアプリを入れる準備をします。',
      `現在の状態は WAN: ${data.status.wan} / サーバ: ${data.status.servers} です。`
    ]
  },
  {
    id: 'no-server-pc',
    when: (data) => data.hasRouter && data.hasPc && !data.hasServerPc,
    title: 'PC をサーバ用に切り替える',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers}`,
    lines: (data) => [
      'PC の配置が完了しました。',
      'PC を選択して用途を「サーバ用」に切り替えます。',
      `現在の状態は WAN: ${data.status.wan} / サーバ: ${data.status.servers} です。`
    ]
  },
  {
    id: 'no-apps',
    when: (data) => data.hasRouter && data.hasPc && data.hasServerPc && !data.hasServer,
    title: 'サーバ用 PC にアプリを入れて役割を作る',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers}`,
    lines: (data) => [
      'サーバ用 PC の準備が完了しました。',
      'PC を選択して WEB/FTP/DNS のサーバアプリを入れていきます。',
      `現在の状態は WAN: ${data.status.wan} / サーバ: ${data.status.servers} です。`
    ]
  },
  {
    id: 'no-web',
    when: (data) => data.hasRouter && data.hasPc && data.hasServer && !data.hasWebServer,
    title: 'WEB サーバアプリを入れて公開準備をする',
    statusLabel: (data) => `WAN: ${data.status.wan} / サーバ: ${data.status.servers}`,
    lines: (data) => [
      'サーバアプリの導入が進んでいます。',
      'サーバ用 PC に WEB サーバアプリを入れると会社 HP プレビューが表示されます。',
      `現在の状態は WAN: ${data.status.wan} / サーバ: ${data.status.servers} です。`
    ]
  },
  {
    id: 'no-ftp',
    when: (data) => data.hasRouter && data.hasPc && data.hasWebServer && !data.hasFtpServer,
    title: 'FTP サーバアプリを入れてアップロードを確認する',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: (data) => [
      'WEB サーバアプリの導入が完了しました。',
      'サーバ用 PC に FTP サーバアプリを入れると用意された HTML をアップロードできます。',
      `現在の状態は WAN: ${data.status.wan} / FTP: ${data.status.ftp} です。`
    ]
  },
  {
    id: 'company-done',
    when: (data) => data.hasRouter && data.hasPc && data.hasWebServer && data.hasFtpServer,
    title: '会社ネットワークの確認が完了',
    statusLabel: (data) => `WAN: ${data.status.wan} / FTP: ${data.status.ftp}`,
    lines: (data) => [
      '社内ネットワークの構成が完成しました。',
      '会社 HP のプレビュー枠で画面遷移の流れを確認できます。',
      'DNS サーバアプリを入れると名前解決の役割も体験できます。',
      `現在の状態は WAN: ${data.status.wan} / FTP: ${data.status.ftp} です。`
    ]
  }
];

export const buildHomeExplanation = (data) => resolveExplanation(HOME_EXPLANATIONS, data);

export const buildCompanyExplanation = (data) => resolveExplanation(COMPANY_EXPLANATIONS, data);
