// store.js
// ==========================================================
// AppStore（ブラウザ向け汎用ストレージユーティリティ）
// - 本体保存先 : localStorage（1キー=1JSONのスナップショット）
// - 下書き保存 : sessionStorage（タブ単位で揮発）
// - バージョンゲート・擬似アトミックpatch・保存時刻付与
// - 同一タブ更新通知 : window に CustomEvent 'appstore:updated' を発火
// - 他タブ同期       : 'storage' イベントをフックして同イベントを再発火
//
// 期待スキーマ（例）:
// {
//   v: number,                 // スキーマ版
//   updatedAt: string,         // ISO8601 で最終保存時刻
//   home?:    { reach?: any }, // 自宅側メタ（任意）
//   company?: { reach?: any }, // 会社側メタ（任意）
//   summary?: { homeOK?: boolean, companyOK?: boolean } // UI用サマリ
// }
//
// 公開API：
//   AppStore.configure(opts)  … キー名やバージョンの上書き
//   AppStore.get()            … オブジェクト取得（版不一致は null）
//   AppStore.set(val)         … そのまま保存（要バリデーション）
//   AppStore.patch(mutator)   … 既存値に差分適用して保存（v/updatedAtを強制更新）
//   AppStore.clear()          … localStorage の該当キーを削除
//   AppStore.readSummary()    … {homeOK, companyOK} を boolean で返却
//   AppStore.saveDraft(scope,data) / loadDraft / clearDraft … 下書き操作
//   AppStore.onUpdate(cb)     … 同一タブ更新を購読（解除関数を返す）
//
// 注意:
// - localStorage は文字列のみ。必ず JSON.stringify / parse で往復する
// - 個人情報や秘匿情報は保存しない（XSS等で読み出され得る）
// - 大容量や検索が必要なら IndexedDB を検討
// - 同一タブの setItem() では 'storage' は発火しないため CustomEvent を自前で発火
// ==========================================================
(function (global) {
    'use strict';

    /** 同一タブ向けの更新イベント名 */
    const EVT_UPDATED = 'appstore:updated';

    /** 既定オプション（必要に応じて configure で上書き可） */
    const defaults = {
        key: 'app:network:saves:default',     // localStorage キー
        version: 1,                            // スキーマ版
        draftsPrefix: 'app:network:session:'   // sessionStorage の接頭辞
    };

    /** 実際に使用するオプション（ランタイムで可変） */
    const opts = { ...defaults };

    // ---- 内部ユーティリティ ----
    /** 例外を握りつぶして JSON.parse。失敗時は null。 */
    const safeParse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

    /** ディープコピー。structuredClone があれば優先使用。 */
    const deepClone = (obj) => {
        if (typeof structuredClone === 'function') return structuredClone(obj);
        return safeParse(JSON.stringify(obj));
    };

    /** ISO8601 現在時刻 */
    const nowISO = () => new Date().toISOString();

    /** 同一タブの購読者向けに更新イベントを投げる */
    function emitUpdated(detail) {
        try {
            const ev = new CustomEvent(EVT_UPDATED, { detail });
            global.dispatchEvent(ev);
        } catch { /* 古いブラウザでは無視 */ }
    }

    // ---- コアI/O ----
    /** 保存値を取得（スキーマ版一致のみ有効） */
    function get() {
        const raw = localStorage.getItem(opts.key);
        if (!raw) return null;
        const obj = safeParse(raw);
        return obj && obj.v === opts.version ? obj : null;
    }

    /** 値をそのまま保存（エラー時は例外をスロー） */
    function set(val) {
        try {
            localStorage.setItem(opts.key, JSON.stringify(val));
            emitUpdated({ type: 'set', key: opts.key });
        } catch (e) {
            console.error('[AppStore] set 失敗:', e);
            throw e;
        }
    }

    /** 既存値へ差分適用して保存（v/updatedAt を強制更新） */
    function patch(mutator) {
        const cur = get() || { v: opts.version };
        const base = deepClone(cur) || { v: opts.version };
        const next = mutator ? (mutator(base) || base) : base;
        next.v = opts.version;
        next.updatedAt = nowISO();
        set(next);
        return next;
    }

    /** クリア（初期化） */
    function clear() {
        localStorage.removeItem(opts.key);
        emitUpdated({ type: 'clear', key: opts.key });
    }

    /** UI用の軽量サマリ */
    function readSummary() {
        const s = get();
        return {
            homeOK: !!s?.summary?.homeOK,
            companyOK: !!s?.summary?.companyOK
        };
    }

    // ---- 下書き（sessionStorage） ----
    const draftKey = (scope) => opts.draftsPrefix + String(scope || 'default');

    /** 下書き保存（タブ範囲） */
    function saveDraft(scope, data) {
        const payload = { v: opts.version, updatedAt: nowISO(), ...data };
        sessionStorage.setItem(draftKey(scope), JSON.stringify(payload));
        return payload;
    }

    /** 下書き読込 */
    function loadDraft(scope) {
        const raw = sessionStorage.getItem(draftKey(scope));
        return raw ? safeParse(raw) : null;
    }

    /** 下書き削除 */
    function clearDraft(scope) {
        sessionStorage.removeItem(draftKey(scope));
    }

    // ---- 同一タブ購読API ----
    /**
     * 更新イベント購読。解除関数を返す。
     * @param {(detail:any)=>void} cb
     * @returns {() => void}
     */
    function onUpdate(cb) {
        if (typeof cb !== 'function') return () => { };
        const handler = (e) => cb(e.detail);
        global.addEventListener(EVT_UPDATED, handler);
        return () => global.removeEventListener(EVT_UPDATED, handler);
    }

    // ---- 他タブ同期（storage） ----
    global.addEventListener('storage', (e) => {
        if (e.key === opts.key) {
            // 他タブで変更 → 同一タブ購読者へも伝搬
            emitUpdated({ type: 'storage', key: opts.key });
        }
    });

    // ---- 設定反映 ----
    /**
     * ランタイム設定（キー名・バージョン等）を上書き。
     * @param {{key?:string, version?:number, draftsPrefix?:string}} cfg
     */
    function configure(cfg = {}) {
        if (cfg.key) opts.key = String(cfg.key);
        if (Number.isInteger(cfg.version)) opts.version = cfg.version | 0;
        if (cfg.draftsPrefix) opts.draftsPrefix = String(cfg.draftsPrefix);
    }

    // ---- 公開インターフェース ----
    const api = {
        // 設定
        configure,
        // 参照用（読み取り専用）
        get KEY() { return opts.key; },
        get V() { return opts.version; },
        // 本体I/O
        get, set, patch, clear, readSummary,
        // ドラフト
        saveDraft, loadDraft, clearDraft,
        // イベント
        onUpdate,
        EVT_UPDATED
    };

    global.AppStore = api;
})(window);
