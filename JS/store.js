/* =========================================================
 *  AppStore (localStorage / sessionStorage ユーティリティ)
 *  - スキーマ例:
 *    {
 *      v: number,                    // スキーマバージョン
 *      updatedAt: string,            // 最終保存ISO時刻
 *      home?:   { reach?: any },     // 任意: ホーム側メタ
 *      company?:{ reach?: any },     // 任意: 会社側メタ
 *      summary?:{                    // サマリ（UI表示用など）
 *        homeOK?: boolean,
 *        companyOK?: boolean
 *      }
 *    }
 *
 *  - 公開API:
 *      AppStore.get(): object|null
 *      AppStore.patch(mutator: (draft) => draft|void): object   // 既存に差分適用
 *      AppStore.clear(): void                                   // 本体削除
 *      AppStore.readSummary(): {homeOK:boolean, companyOK:boolean}
 *      AppStore.saveDraft(scope:string, data:object): object    // 一時保存(sessionStorage)
 *      AppStore.loadDraft(scope:string): object|null
 *      AppStore.clearDraft(scope:string): void
 *
 *  - 想定用途:
 *      - localStorage: 永続設定・状態
 *      - sessionStorage: 入力途中の下書き(Draft)
 * ========================================================= */

(function (global) {
    'use strict';

    /** localStorageに保存するキー。アプリ全体で一意にする */
    const KEY = 'app:network:saves:default';

    /** スキーマバージョン。破壊的変更時にインクリメント */
    const V = 1;

    /**
     * 文字列を安全にJSON.parseする。
     * 失敗時はnullを返すことで呼び出し側の分岐を単純化。
     */
    const safeParse = (raw) => {
        try { return JSON.parse(raw); } catch { return null; }
    };

    /**
     * 現在の保存値を取得。
     * - KEYが未保存ならnull
     * - バージョン不一致でもnull（古い形式は読み飛ばす方針）
     */
    function get() {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const obj = safeParse(raw);
        return obj && obj.v === V ? obj : null;
    }

    /**
     * 値をそのまま保存。
     * - バリデーションは呼び出し側で担保する前提
     */
    function set(val) {
        localStorage.setItem(KEY, JSON.stringify(val));
    }

    /**
     * オブジェクトのディープコピー。
     * - structuredClone があれば使用
     * - なければ JSON 経由のフォールバック
     */
    function deepClone(obj) {
        if (typeof structuredClone === 'function') return structuredClone(obj);
        return safeParse(JSON.stringify(obj));
    }

    /**
     * 既存値に対して変更を加えて保存。
     * - 既存が無ければ { v:V } から開始
     * - mutator には編集可能なドラフトを渡す
     * - mutator が値を返さなければドラフトをそのまま使用
     * - v と updatedAt はここで強制的に上書き
     */
    function patch(mutator) {
        const cur = get() || { v: V };              // 既存ロード or 雛形
        const base = deepClone(cur) || { v: V };    // 編集用ドラフト
        const next = mutator ? (mutator(base) || base) : base;
        next.v = V;                                  // バージョン付与
        next.updatedAt = new Date().toISOString();  // 監査用タイムスタンプ
        set(next);
        return next;
    }

    /** 保存値を削除。初期化やユーザーリセットに使用 */
    function clear() {
        localStorage.removeItem(KEY);
    }

    /**
     * UIでの軽量確認用サマリを返す。
     * - 未保存時でも常に boolean を返すため分岐が単純
     */
    function readSummary() {
        const s = get();
        return {
            homeOK: !!s?.summary?.homeOK,
            companyOK: !!s?.summary?.companyOK
        };
    }

    // ---- Draft APIs (作業中は sessionStorage に保存: タブ単位で揮発) ----

    /** Draft用のキー接頭辞。スコープで名前空間を切る */
    const DRAFT_PREFIX = 'app:network:session:';

    /**
     * 下書きを保存。
     * - scope: 画面IDやフォーム名などの論理スコープ
     * - data: 任意の部分オブジェクト
     * - v/updatedAt を自動付与
     */
    function saveDraft(scope, data) {
        const payload = { v: V, updatedAt: new Date().toISOString(), ...data };
        sessionStorage.setItem(DRAFT_PREFIX + scope, JSON.stringify(payload));
        return payload;
    }

    /**
     * 下書きをロード。
     * - 取得不可や破損時は null
     * - バージョンチェックは任意。必要ならここで s.v===V を追加
     */
    function loadDraft(scope) {
        const raw = sessionStorage.getItem(DRAFT_PREFIX + scope);
        return raw ? safeParse(raw) : null;
    }

    /** 下書きを削除。送信完了やキャンセル時に使用 */
    function clearDraft(scope) {
        sessionStorage.removeItem(DRAFT_PREFIX + scope);
    }

    // ---- 公開インターフェース ----
    global.AppStore = {
        KEY, V,
        get, set, patch, clear,
        readSummary,
        saveDraft, loadDraft, clearDraft
    };

})(window);
