### 💖 Share to Google Docs プラグイン 💖
### 設計資料 ver. ギャル
---

#### アーキテクチャ（全体像ってこと！）

このプラグインは、みんなのPCの中だけで動く**クライアントサイド**ってやつだよ。うちら専用のサーバーとかは特にいらない、身軽なスタイル！
やってることは大きく分けて、Obsidianの中でやる処理と、GoogleのAPIっていう外部のサービスと通信する処理の2つ！

**処理フロー図（処理の流れを図にしてみた！）**

```mermaid
graph TD
    subgraph "Obsidianプラグイン (うちらのテリトリー)"
        A[ユーザーのアクション<br>(アイコンをポチる)] --> B{メインコントローラー<br>(司令塔)};
        B --> C[Obsidian API担当<br>(ファイルの中身ちょーだい！)];
        C --> D{ファイルの中身GET};
        B --> E{Google認証してるかチェック};
        E -- してない --> F[Google OAuth担当];
        E -- してる --> G[Google API担当];
        F --> H[ブラウザで認証してきて！];
        H --> I[認証OKの連絡待ち<br>(PC内で待機)];
        I --> F;
        F -- 認証成功！ --> J[トークンを保存];
        J --> B;
        G -- ファイルの中身わたす --> K[Drive API:<br>`.md`ファイルとしてアップロード];
        K -- ファイルIDをGET --> G;
        G -- ファイルIDわたす --> L[Drive API:<br>Googleドキュメントに変換コピー！];
        L -- ドキュメントのURLをGET --> G;
        G -- 成功！ --> M[UI担当<br>(うまくいったよ！って通知)];
        G -- 失敗... --> N[エラー担当<br>(失敗しちゃった...って通知)];
    end

    subgraph "外部サービス (Googleさんにおまかせ)"
        H <--> GoogleAuthServer[Google 認証サーバー];
        K <--> GoogleDriveAPI[Google Drive API];
        L <--> GoogleDriveAPI;
    end

    style GoogleAuthServer fill:#f9f,stroke:#333,stroke-width:2px
    style GoogleDriveAPI fill:#f9f,stroke:#333,stroke-width:2px
```

1.  ユーザーがObsidianのリボンアイコンとかをポチってエクスポート開始！
2.  プラグインがまず「Googleアカウントと連携してる？」って確認する。
3.  **してない場合**: OAuth認証スタート！ブラウザでGoogleの同意画面を開いて、ユーザーに許可してもらって、認証トークンっていう大事な鍵をGETして保存する。
4.  **してる場合**: ObsidianのAPIを使って、今開いてるファイルの中身をGET！
5.  Google Drive APIを使って、GETした中身をまず`.md`ファイルとしてアップロード。
6.  次に、そのファイルのIDを使って「これ、Googleドキュメントにして！」ってお願いする。
7.  うまくいったら成功通知、ダメだったら失敗通知をユーザーに出すって流れ！

---

#### コンポーネント（部品の紹介！）

プラグインは、役割ごとにいくつかの部品に分けて作ると分かりやすいから、そうする！

*   **UIコンポーネント (`settings.ts`)**
    *   **担当**: ユーザーに見えるところ全部！
    *   **できること**:
        *   エクスポート用のリボンアイコンを追加して、クリックされたら動くようにする。
        *   コマンドパレットにも「エクスポート」ってコマンドを登録する。
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
    *   **担当**: めんどいGoogle認証を全部やってくれるイケてるやつ！
    *   **できること**:
        *   Googleの認証画面のURLを作る。
        *   認証が終わった連絡を受け取るために、PC内で一時的にサーバーを立てる。
        *   認証コードをアクセストークンとリフレッシュトークンっていう鍵に交換する。
        *   GETしたトークンをちゃんと保存・管理する。
        *   アクセストークンの有効期限が切れたら、ユーザーにバレないように裏でこっそり新しいのをGETする。

*   **Google APIクライアント (`googleApiClient.ts`)**
    *   **担当**: 実際にGoogleのAPIを叩く実行部隊！
    *   **できること**:
        *   Google Drive APIに「ファイル上げるね！」「変換してね！」ってお願いを送る。
        *   お願いする時に、ちゃんと認証トークンを付けて「うちら、許可もらってます！」ってアピールする。
        *   APIからの返事を解読して、できたドキュメントのURLとか必要な情報を抜き出す。
        *   アップロードした用済みの`.md`ファイルは、ゴミ箱にポイする。

*   **Obsidian APIクライアント (`obsidianHelper.ts`)**
    *   **担当**: Obsidianとのやりとり専門！
    *   **できること**:
        *   今開いてるファイルの名前と中身をGETする。
        *   プラグインの設定データを読んだり書いたりする。

---

#### インターフェース (Web API)

うちらが使う外部のWeb APIはこれだけ！

*   **Google OAuth 2.0 API**
    *   **目的**: ユーザー認証して、APIを叩くためのトークンをGETする。
    *   **スコープ（お願いする権限）**:
        *   `https://www.googleapis.com/auth/drive.file`: Google Driveにファイル作ったりアクセスしたりするための最小限の権限だけもらう！

*   **Google Drive API v3**
    *   **目的**: Markdownファイルをアップして、Googleドキュメントに変身させる。
    *   **エンドポイント**:
        *   `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
            *   **用途**: Markdownファイルの中身をGoogle Driveにアップするために使う。
        *   `POST https://www.googleapis.com/drive/v3/files/{fileId}/copy`
            *   **用途**: アップした`.md`ファイルをGoogleドキュメント形式に変換するために使う。
        *   `PATCH https://www.googleapis.com/drive/v3/files/{fileId}`
            *   **用途**: 用済みになった`.md`ファイルをゴミ箱に移動するために使う。

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
| **トークン更新エラー** | 接続が切れちゃった時                         | 「Googleとの接続が切れちゃったみたい。もう一回ログインしてくれると嬉しいな！」 |
| **APIリクエストエラー**  | ファイルのアップロードとかに失敗した時       | 「Google Docsへのエクスポートに失敗したよ。APIエラーだって。」 |
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