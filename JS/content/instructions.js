export const INSTRUCTION_TEXT = {
  home: {
    states: [
      {
        id: 'no-router',
        title: 'ルータを置いて WAN/LAN の入口を作る',
        statusLabel: 'WAN: {status.wan} / LAN: {status.lan}',
        lines: [
          'ゴール: 光→ONU→ルータの線を作り、WAN を OK にする。',
          '操作: 右の「機器パレット」からルータを 1 台置く。置くとすぐ WAN が OK になる。',
          'チェック: 「モニター」で WAN が OK になっているか確認する。'
        ],
        nextAction: '「機器パレット」からルータを 1 台置き、モニターで WAN が OK か確認します。'
      },
      {
        id: 'router-only',
        title: '端末を置いてブラウザ接続を確認する',
        statusLabel: 'WAN: {status.wan} / LAN: {status.lan}',
        lines: [
          'ゴール: LAN を OK にし、端末でブラウザ接続できる状態にする。',
          '操作: PC を追加し、デスクトップからブラウザを開いて 192.168.1.1 にアクセスする。',
          '補足: 192.168.1.1 に入るとルータ設定画面に進めます。'
        ],
        nextAction: 'PC を 1 台追加し、ブラウザで 192.168.1.1 にアクセスしてみましょう。'
      },
      {
        id: 'lan-ready',
        title: '通信経路ができたので設定を仕上げる',
        statusLabel: 'WAN: {status.wan} / LAN: {status.lan}',
        lines: [
          '光→ONU→ルータ→端末の経路は完成しています。',
          '残りの設定: {pendingText}。PC のブラウザで 192.168.1.1 を開き、設定を保存します。',
          '「変更を保存」を押すとステップのバッジが完了に変わります。'
        ],
        nextAction: 'PC から 192.168.1.1 にアクセスし、残りの設定を保存します。'
      },
      {
        id: 'home-done',
        title: '自宅ネットワークの接続確認が完了',
        statusLabel: 'WAN: {status.wan} / LAN: {status.lan}',
        lines: [
          '光→ONU→ルータ→端末の接続とルータ設定が完了しました。',
          '端末を増やして複数接続のイメージを確認したり、設定値を変えて復習できます。',
          '自宅ネットワークは外部公開を行わない想定です。'
        ],
        nextAction: '端末を増やして複数接続を確認するか、ブラウザで再度 192.168.1.1 に入り復習します。'
      }
    ],
    steps: [
      {
        id: 'wan',
        label: 'ONU → ルータをつなぐ',
        detailWhenDone: 'ルータを配置済み。WAN は OK です。',
        detailWhenTodo: '機器パレットからルータを 1 台置いて WAN を OK にします。'
      },
      {
        id: 'lan',
        label: 'PC/端末をつなぎ LAN を確認',
        detailWhenDone: 'LAN 側に端末があります。PC を置くと接続確認がしやすいです。',
        detailWhenTodo: 'PC を 1 台置いて LAN を OK にし、ブラウザ接続を確認します。'
      },
      {
        id: 'credentials',
        label: 'ログイン ID / パスワードを更新',
        detailWhenDone: '管理用の ID / パスワードは保存済みです。',
        detailWhenTodo: 'ルータ設定画面で ID / パスワードを決めて「変更を保存」を押します。'
      },
      {
        id: 'wifi',
        label: 'SSID と暗号化キーを決める',
        detailWhenDone: 'Wi-Fi 設定は更新済みです。',
        detailWhenTodo: 'SSID / 暗号化キーを入力して保存するとバッジが完了に変わります。'
      }
    ]
  },
  company: {
    states: [
      {
        id: 'no-router',
        title: 'ルータを置いて社内ネットワークを開始する',
        statusLabel: 'WAN: {status.wan} / サーバ: {status.servers} / FTP: {status.ftp}',
        lines: [
          'ゴール: 光→ONU→ルータを接続し、WAN を OK にする。',
          '操作: 「機器パレット」からルータを 1 台置く。置くと WAN が OK になる。',
          '補足: サーバは PC に OS/アプリを載せて構成するイメージです。'
        ],
        nextAction: '「ルータ」を追加して WAN を OK にします。'
      },
      {
        id: 'no-pc',
        title: 'PC を置いて社内サーバの準備をする',
        statusLabel: 'WAN: {status.wan} / サーバ: {status.servers} / FTP: {status.ftp}',
        lines: [
          'ゴール: LAN を通し、サーバ用にできる PC を用意する。',
          '操作: PC を追加し、ルータと線がつながることを確認する。',
          'ヒント: 会社HPプレビューは WEB サーバ導入後に表示されます。'
        ],
        nextAction: 'PC を追加して LAN を通します。'
      },
      {
        id: 'no-server-pc',
        title: 'PC をサーバ用に切り替える',
        statusLabel: 'WAN: {status.wan} / サーバ: {status.servers} / FTP: {status.ftp}',
        lines: [
          'ゴール: サーバ用 PC を 1 台以上用意する。',
          '操作: PC を選択し、「サーバ用」ボタンを押して用途を切り替える。',
          '注意: サーバアプリは「サーバ用」の PC でのみ導入できます。'
        ],
        nextAction: 'PC をサーバ用に切り替えます。'
      },
      {
        id: 'no-apps',
        title: 'サーバ用 PC にアプリを入れて役割を作る',
        statusLabel: 'WAN: {status.wan} / サーバ: {status.servers} / FTP: {status.ftp}',
        lines: [
          'ゴール: サーバ用 PC に必要なアプリを入れて役割を持たせる。',
          '操作: サーバ用 PC を選択し、WEB / FTP / DNS から必要なものを入れる。',
          '必須: WEB サーバを入れると会社 HP プレビューが出るようになります。'
        ],
        nextAction: 'サーバアプリを導入して役割を作ります。'
      },
      {
        id: 'no-web',
        title: 'WEB サーバアプリを入れて公開準備をする',
        statusLabel: 'WAN: {status.wan} / サーバ: {status.servers} / FTP: {status.ftp}',
        lines: [
          'ゴール: WEB サーバを入れてプレビューを表示可能にする。',
          '操作: サーバ用 PC で WEB サーバアプリを入れる。',
          '補足: FTP や DNS は WEB 導入後に追加できます。'
        ],
        nextAction: 'WEB サーバアプリを入れます。'
      },
      {
        id: 'no-ftp',
        title: 'FTP サーバアプリを入れてアップロードを確認する',
        statusLabel: 'WAN: {status.wan} / FTP: {status.ftp}',
        lines: [
          'ゴール: FTP で HTML をアップロードできる状態にする。',
          '操作: サーバ用 PC に FTP サーバアプリを入れる。',
          '操作(クライアント側): 仕事用 PC を 1 台置き、そこから FTP でアップロードする想定。',
          '確認: アップロード後、プレビュー枠に内容が表示される。'
        ],
        nextAction: 'FTP サーバアプリを入れてアップロードを試します。'
      },
      {
        id: 'no-upload',
        title: 'HTML をアップロードしてプレビューを表示する',
        statusLabel: 'WAN: {status.wan} / FTP: {status.ftp}',
        lines: [
          'ゴール: プレビュー枠に HTML を表示させる。',
          '前提: 仕事用 PC を 1 台配置し、「仕事用」のままにしておく。',
          '操作: 仕事用 PC から用意済み HTML を FTP でアップロードし、プレビューに割り当てる。',
          'ヒント: プリセットを使うとすぐに動作確認できます。'
        ],
        nextAction: 'HTML をアップロードし、プレビューに割り当てます。'
      },
      {
        id: 'company-done',
        title: '会社ネットワークの確認が完了',
        statusLabel: 'WAN: {status.wan} / FTP: {status.ftp}',
        lines: [
          '社内ネットワークの構成が完成し、プレビューも表示できます。',
          'DNS サーバアプリを入れると名前解決の役割も体験できます。',
          'サーバアプリの組み合わせを変えて挙動の違いを確認することもできます。'
        ],
        nextAction: '必要に応じてサーバアプリの組み合わせを変えて挙動を確認します。'
      }
    ],
    steps: [
      {
        id: 'wan',
        label: 'ルータを置いて WAN を通す',
        detailWhenDone: 'WAN は OK です。ONU の横にルータが配置されています。',
        detailWhenTodo: 'ルータを 1 台置くと WAN が OK になります。'
      },
      {
        id: 'lan',
        label: 'PC を置いて LAN を作る',
        detailWhenDone: 'LAN 側に PC が {lanClientCount} 台あります。用途切り替えができます。',
        detailWhenTodo: 'PC を追加して LAN を通します。'
      },
      {
        id: 'server-role',
        label: 'PC をサーバ用に切り替える',
        detailWhenDone: 'サーバ用 PC が準備できています。',
        detailWhenTodo: 'PC を選択して「サーバ用」を押します。'
      },
      {
        id: 'web-app',
        label: 'WEB サーバアプリを入れる',
        detailWhenDone: 'WEB サーバ導入済みです。',
        detailWhenTodo: 'サーバ用 PC で WEB アプリを入れるとプレビューの準備が整います。'
      },
      {
        id: 'ftp-app',
        label: 'FTP サーバアプリを入れる',
        detailWhenDone: 'FTP サーバ導入済みです。',
        detailWhenTodo: 'アップロード用に FTP アプリを入れます。'
      },
      {
        id: 'upload',
        label: 'HTML をアップロードして割り当て',
        detailWhenDone: '仕事用 PC からアップロード済み。プレビューに割り当て済みです。',
        detailWhenTodo: '仕事用 PC を 1 台置き、その PC から FTP で HTML をアップロードして割り当てます。'
      },
      {
        id: 'dns',
        label: 'DNS サーバアプリを入れる（任意）',
        optional: true,
        detailWhenDone: 'DNS サーバも有効です。名前解決の役割を確認できます。',
        detailWhenTodo: '任意: DNS アプリを入れると名前解決の役割を足せます。'
      }
    ]
  },
  training: {
    steps: [
      {
        id: 'home',
        title: '自宅ネットワーク',
        description: 'ONU->ルータ->PC を配置し、PC のブラウザ接続が OK になることを確認する。'
      },
      {
        id: 'company',
        title: '会社ネットワーク',
        description: 'ONU->ルータ->PC を配置し、PC をサーバ用に切り替えて社内の通信経路を確認する。'
      },
      {
        id: 'ftp',
        title: 'FTP 接続確認',
        description: 'サーバ用 PC に FTP サーバアプリを入れ、接続が OK になることを確認する。'
      }
    ],
    explanations: [
      {
        id: 'home',
        when: 'homePending',
        statusLabel: '自宅ネットワーク: 未完了',
        title: '自宅ネットワークの構成途中です',
        lines: [
          'ゴール: ONU→ルータ→PC が揃うとブラウザ接続が OK になります。',
          '進行度 {summary.completed}/{summary.total}。まず自宅ネットワークを完了させましょう。',
          '次にやること: 「{summary.nextTask}」。'
        ]
      },
      {
        id: 'company',
        when: 'companyPending',
        statusLabel: '会社ネットワーク: 未完了',
        title: '会社ネットワーク構築フェーズです',
        lines: [
          '自宅ネットワークは完了しました。',
          '会社ネットワークでは PC をサーバ用に切り替え、必要なアプリを入れて社内通信を作ります。',
          '進行度 {summary.completed}/{summary.total}。次にやること: 「{summary.nextTask}」。'
        ]
      },
      {
        id: 'ftp',
        when: 'ftpPending',
        statusLabel: 'FTP 接続: 未確認',
        title: 'FTP 接続の確認フェーズです',
        lines: [
          '自宅/会社ネットワークは完了しています。',
          'サーバ用 PC に FTP サーバアプリを入れ、接続 OK になれば完了です。',
          '進行度 {summary.completed}/{summary.total}。'
        ]
      },
      {
        id: 'done',
        when: 'done',
        statusLabel: '全ステップ完了',
        title: '学習フローは完了しています',
        lines: [
          '全てのネットワーク構成が完了しています。',
          '拠点ごとの構成差や通信の流れを地図から比較できます。',
          '進行度 {summary.completed}/{summary.total}。復習や再配置で理解を深めましょう。'
        ]
      }
    ]
  }
};
