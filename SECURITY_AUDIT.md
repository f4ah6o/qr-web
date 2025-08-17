# QRコードスキャナー アプリケーション セキュリティ監査レポート

## 監査日
2025年8月17日

## 概要
このレポートは、QRコードスキャナーアプリケーションのソースコードを対象としたセキュリティ監査の結果をまとめたものです。いくつかのセキュリティリスクが特定され、その改善策を提案します。

## 総括

### 評価できる点
- **依存関係:** `pnpm audit` による検査の結果、プロジェクトの依存関係に既知の脆弱性はありませんでした。
- **デプロイプロセス:** GitHub Actionsのデプロイワークフローは、最小権限の原則に従っており、安全に構成されています。
- **プライバシー設計:** 全ての処理がクライアントサイドで完結し、ユーザーデータが外部サーバーに送信されない設計は、プライバシー保護の観点から非常に優れています。
- **CSPの導入:** Content Security Policy (CSP) が導入されており、セキュリティに対する意識がみられます。

### 主な懸念事項
アプリケーションには、特にクロスサイトスクリプティング (XSS) に関連する複数のセキュリティリスクが存在します。これらの脆弱性を悪用されると、ユーザーのブラウザ上で意図しないスクリプトが実行される可能性があります。

---

## 確認された脆弱性と改善策

### 1. 【高リスク】DOM-based Cross-Site Scripting (XSS)

- **脆弱性の説明:**
  QRコードから読み取ったデータを検証せずに、`innerHTML` を使用して直接DOMに書き込んでいる箇所が複数存在します (`onScanSuccess`, `updateHistoryUI` メソッド内)。これにより、`javascript:alert('XSS')` のような悪意のある `javascript:` URI を含むQRコードをスキャンした場合、ユーザーがリンクをクリックすると任意のスクリプトが実行されてしまいます。

- **影響:**
  - 悪意のあるスクリプトの実行
  - セッション情報や個人情報漏洩のリスク

- **改善策:**
  1.  **`innerHTML` の使用を避ける:** 動的にテキストを挿入する場合は、原則として `textContent` を使用します。これにより、文字列はHTMLとして解釈されず、スクリプトの実行を防ぎます。
  2.  **URLの厳密な検証:** `<a>` タグの `href` 属性に値を設定する前に、必ずURLのプロトコルを検証してください。`URL` オブジェクトなどを用いて、プロトコルが `http:` または `https:` であることを確認し、それ以外のスキーム（`javascript:`, `data:` など）は許可しないようにします。

    ```typescript
    // 修正例
    function isValidHttpUrl(str) {
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (_) {
        return false;  
      }
    }

    if (qrType === 'URL' && isValidHttpUrl(result)) {
      const link = document.createElement('a');
      link.href = result;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = result;
      // ... resultElement.innerHTML の代わりに link を append する
    } else {
      resultElement.textContent = result;
    }
    ```

### 2. 【中リスク】不十分な Content Security Policy (CSP)

- **脆弱性の説明:**
  `index.html` で定義されているCSPに `'unsafe-inline'` が含まれています。これはインラインの `<script>` タグや `onclick` 属性の実行を許可するため、XSS攻撃に対する防御策としてのCSPの効果を著しく低下させます。

- **原因:**
  `updateHistoryUI` メソッド内で、`onclick` 属性を持つHTML文字列を動的に生成しているため。

- **改善策:**
  1.  **インラインイベントハンドラの排除:** `onclick` 属性の使用をやめ、`document.createElement` でDOM要素を生成した後に `element.addEventListener('click', ...)` を使ってイベントリスナーを登録するようにコードをリファクタリングします。
  2.  **CSPの強化:** 上記のリファクタリング完了後、`index.html` のCSPから `'unsafe-inline'` を削除します。

### 3. 【中リスク】Subresource Integrity (SRI) の欠如

- **脆弱性の説明:**
  `index.html` でCDN (`cdn.tailwindcss.com`) からスクリプトを読み込んでいますが、`<script>` タグに `integrity` 属性がありません。もしCDNが侵害された場合、改ざんされた悪意のあるスクリプトがユーザーのブラウザで実行されるリスクがあります。

- **改善策:**
  - CDNから提供されている `integrity` ハッシュ値を `<script>` タグに追加します。

    ```html
    <!-- 修正例 -->
    <script src="https://cdn.tailwindcss.com" integrity="sha384-..."></script>
    ```
    *(注: `sha384-...` の部分は、使用しているライブラリのバージョンに対応する正しいハッシュ値に置き換える必要があります)*

### 4. 【低リスク】開発サーバーのホスト設定

- **脆弱性の説明:**
  `vite.config.ts` の開発サーバーホストが `'0.0.0.0'` に設定されています。これにより、開発サーバーがローカルネットワーク上のすべてのインターフェースで待ち受け状態となり、意図せず外部からアクセス可能になる可能性があります。

- **改善策:**
  - 開発中のセキュリティを向上させるため、特別な理由がない限り、ホスト設定を `'localhost'` に変更することを推奨します。

    ```typescript
    // vite.config.ts
    server: {
      host: 'localhost', // '0.0.0.0' から変更
      port: 5176,
    },
    ```

## 結論
このアプリケーションはプライバシーを重視した良い設計がされていますが、深刻なXSS脆弱性が存在します。上記で提案した改善策、特に **XSS対策を最優先で実施する** ことを強く推奨します。
