### 💖 Share to Google Docs プラグイン 💖
### 設計資料 ver. ギャル
---

#### アーキテクチャ（全体像ってこと！）

このプラグインは、みんなのPCの中だけで動く**クライアントサイド**ってやつだよ。うちら専用のサーバーとかは特にいらない、身軽なスタイル！
`googleapis`みたいな重いライブラリは使わずに、Obsidianに元から入ってる`fetch`っていう機能を使って、直接GoogleのAPIと通信するから、めっちゃ軽量でイケてる！

**処理フロー図（処理の流れを図にしてみた！）**

```mermaid
graph TD
    subgraph "Obsidianプラグイン (うちらのテリトリー)"
        A[ユーザーのアクション<br>(アイコンをポチる)] --> B{メインコントローラー<br>(司令塔)};
        B --> C[Obsidian API担当<br>(ファイルの中身ちょーだい！)];
        C --> D{ファイルの中身GET};
        B --> E{Google認証してるかチェック};
        E -- してない --> F[Google OAuth担当<br>(fetchで直接通信！)];
        E -- してる --> G[Google API担当<br>(fetchで直接通信！)];
        F --> H[ブラウザで認証してきて！];
        H --> I[認証OKの連絡待ち<br>(PC内で待機)];
        I --> F;
        F -- 認証成功！ --> J[トークンを保存];
        J --> B;
        G -- ファイルの中身わたす --> K[Drive API:<br>ファイルアップロード＆変換];
        K -- ドキュメントのURLをGET --> G;
        G -- 成功！ --> M[UI担当<br>(うまくいったよ！って通知)];
        G -- 失敗... --> N[エラー担当<br>(失敗しちゃった...って通知)];
    end

    subgraph "外部サービス (Googleさんにおまかせ)"
        H <--> GoogleAuthServer[Google 認証サーバー];
        F <--> GoogleTokenEndpoint[Google トークンエンドポイント];
        K <--> GoogleDriveAPI[Google Drive API];
    end

    style GoogleAuthServer fill:#f9f,stroke:#333,stroke-width:2px
    style GoogleTokenEndpoint fill:#f9f,stroke:#333,stroke-width:2px
    style GoogleDriveAPI fill:#f9f,stroke:#333,stroke-width:2px
```

1.  ユーザーがObsidianのリボンアイコンとかをポチってエクスポート開始！
2.  プラグインがまず「Googleアカウントと連携してる？」って確認する。
3.  **してない場合**: OAuth認証スタート！ブラウザでGoogleの同意画面を開いて、ユーザーに許可してもらって、認証コードをGETする。
4.  GETした認証コードを使って、`fetch`でGoogleのトークンエンドポイントに直接リクエストを送り、大事なトークン（アクセストークンとリフレッシュトークン）をGETして保存する。
5.  **してる場合**: ObsidianのAPIを使って、今開いてるファイルの中身をGET！
6.  `fetch`でGoogle Drive APIに直接リクエストを送り、Markdownファイルの中身をGoogleドキュメント形式に変換しながらアップロードする。
7.  うまくいったら成功通知、ダメだったら失敗通知をユーザーに出すって流れ！

---

#### コンポーネント（部品の紹介！）

プラグインは、役割ごとにいくつかの部品に分けて作ると分かりやすいから、そうする！

*   **UIコンポーネント (`settings.ts`)**
    *   **担当**: ユーザーに見えるところ全部！
    *   **できること**:
        *   エクスポート用のリボンアイコンを追加して、クリックされたら動くようにする。
        *   コマンドパレットにも「Share to Google Docs」ってコマンドを登録する。
        *   設定画面を作って、GoogleのClient ID/Secretを**パスワード形式で安全に**入力させたり、アカウント連携の状態を見せたり、連携解除ボタンを置いたりする。
        *   処理中は「エクスポート中...」みたいに進捗がわかる通知を出し、処理が終わったら結果（成功/失敗）を同じ通知で教える。

*   **メインコントローラー (`main.ts`)**
    *   **担当**: プラグイン全体の司令塔！超えらい！
    *   **できること**:
        *   プラグインの起動（`onload`）と終了（`onunload`）処理。
        *   プラグインの名前や説明などの情報を`manifest.json`で管理する。
        *   UIからの「これやって！」っていうお願いを、他の担当に振り分ける。
        *   エクスポート処理全体の流れを管理する。

*   **Google OAuthハンドラー (`auth.ts`)**
    *   **担当**: めんどいGoogle認証を`fetch`でクールにこなすイケてるやつ！
    *   **できること**:
        *   Googleの認証画面のURLを作る。
        *   認証が終わった連絡を受け取るために、PC内で一時的にサーバーを立てる。
        *   `fetch`を使って、Googleのトークンエンドポイントに直接`POST`リクエストを送り、認証コードをアクセストークンとリフレッシュトークンに交換する。
        *   GETしたトークンをちゃんと保存・管理する。
        *   アクセストークンの有効期限が切れたら、`fetch`でこっそり新しいのをGETする。

*   **Google APIクライアント (`googleApiClient.ts`)**
    *   **担当**: `fetch`でGoogleのAPIを叩きまくる実行部隊！
    *   **できること**:
        *   `fetch`を使って、Google Drive APIに「ファイル上げるからGoogleドキュメントにしてね！」ってお願いを送る。
        *   お願いする時に、ちゃんと認証トークンをヘッダーに付けて「うちら、許可もらってます！」ってアピールする。
        *   APIからの返事を解読して、できたドキュメントのURLとか必要な情報を抜き出す。

*   **Obsidian APIクライアント (`obsidianHelper.ts`)**
    *   **担当**: Obsidianとのやりとり専門！
    *   **できること**:
        *   今開いてるファイルの名前と中身をGETする。
        *   プラグインの設定データを読んだり書いたりする。

---

#### インターフェース (Web API)

うちらが直接`fetch`で叩くAPIはこれ！

*   **Google OAuth 2.0**
    *   **目的**: ユーザー認証して、APIを叩くためのトークンをGETする。
    *   **認可エンドポイント (ブラウザで開く)**: `https://accounts.google.com/o/oauth2/v2/auth`
    *   **トークンエンドポイント (fetchで叩く)**: `POST https://oauth2.googleapis.com/token`
        *   **用途**: 認可コードやリフレッシュトークンをアクセストークンに交換する。
        *   **リクエストボディ**: `client_id`, `client_secret`, `code` or `refresh_token`, `grant_type`, `redirect_uri`
    *   **スコープ（お願いする権限）**:
        *   `https://www.googleapis.com/auth/drive.file`: Google Driveにファイル作ったりアクセスしたりするための最小限の権限だけもらう！

*   **Google Drive API v3**
    *   **目的**: Markdownファイルをアップして、Googleドキュメントに変身させる。
    *   **エンドポイント**: `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
        *   **用途**: Markdownファイルの中身を、Googleドキュメント形式に変換しながら直接アップロードする。
        *   **リクエストヘッダー**: `Authorization: Bearer <アクセストークン>`
        *   **リクエストボディ (multipart/related)**:
            *   **パート1 (JSON)**: ファイルのメタデータ。`name`（ファイル名）と`mimeType: 'application/vnd.google-apps.document'`を指定する。
            *   **パート2 (Markdown)**: ファイルの中身そのもの。`Content-Type: text/markdown`で送る。

---

#### データモデル（保存するデータの話）

うちらが保存しなきゃいけないデータは、これ！Obsidianの機能で安全に設定ファイルに保存するよ。

*   **`PluginSettings` オブジェクト**
    *   **`googleAuthTokens`**: (Nullable) 認証トークンが入る箱。認証してない時は`null`。
        *   **`accessToken`**: (string) APIを叩く時に使う鍵。有効期限は短め。
        *   **`refreshToken`**: (string) `accessToken`が古くなった時に、新しいのをGETするための鍵。
        *   **`scope`**: (string) 許可された権限スコープ。
        *   **`tokenType`**: (string) トークンの種類。ふつうは "Bearer"。
        *   **`expiryDate`**: (number) `accessToken`の有効期限が切れる時間。
    *   **`googleClientId`**: (Nullable<string>) ユーザーが設定するGoogleのClient ID。
    *   **`googleClientSecret`**: (Nullable<string>) ユーザーが設定するGoogleのClient Secret。

---

#### エラーハンドリング（もし失敗しちゃったら）

もしエラーが起きちゃっても、ユーザーが「え、何事！？」ってならないように、Obsidianの`Notice`機能で分かりやすくメッセージを出すよ！

| エラーの種類         | 具体的な状況                                 | ユーザーへのメッセージ（例）                               |
| -------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| **認証エラー**       | ユーザーが認証をやめちゃった時               | 「Googleアカウントの認証に失敗しちゃった＞＜ また試してみて！」 |
| **トークン更新エラー** | 接続が切れちゃった時                         | 「トークンの更新に失敗しました。再ログインしてください。」 |
| **APIリクエストエラー**  | ファイルのアップロードとかに失敗した時       | 「エクスポート失敗: <APIからのエラーメッセージ>」 |
| **ネットワークエラー** | ネットに繋がってない時                       | 「ネットに繋がってないかも？接続を確認してもう一回やってみて！」 |
| **ファイル読み取りエラー** | どのファイルか分かんない時                   | 「どのファイルをエクスポートする？ファイルを開いて教えて！」 |

---
### 🚀 将来の拡張アイディア 🚀

---

#### 認証方式のイケてる化計画: 認証サーバーの導入

今の「デスクトップアプリ」方式だと、ユーザーにGoogle Cloud Consoleで難しい設定をさせなきゃいけなくて、マジでイケてない。
将来的には、うちらが用意した**認証用の中継サーバー**を挟む「Webアプリ」方式に変えたい！

*   **メリット**: ユーザーはボタンをポチるだけで認証完了！神的なUX（ユーザー体験）を実現できる！
*   **デメリット**: うちらがサーバーを作って、管理しなきゃいけない。あとGoogleの審査も必要になるかも。
*   **将来のフロー図**:
    ```mermaid
    sequenceDiagram
        participant User as ユーザー
        participant Plugin as Obsidianプラグイン
        participant AuthServer as うちらの認証サーバー
        participant Google as Google

        User->>Plugin: 「Googleと連携」をポチッ！
        Plugin->>AuthServer: 認証お願い！ (ユーザーをリダイレクト)
        AuthServer->>Google: うちらのIDとSecretで認証させて！ (ユーザーをリダイレクト)
        Google-->>User: ログインと同意を求める
        User->>Google: ログインして「許可」をポチッ！
        Google-->>AuthServer: 認証OKの「コード」を渡す
        AuthServer->>Google: さっきのコードをID/Secretと一緒に送るね！
        Google-->>AuthServer: OK！じゃあこれが「アクセストークン」だよ！
        AuthServer-->>Plugin: ユーザーの「アクセストークン」を返す
        Plugin->>User: 連携完了！✨
    ```