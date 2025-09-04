import { Notice } from 'obsidian';
import { google } from 'googleapis';
import * as http from 'http';
import MyPlugin from './main';

// 💖 認証フローを開始するイケてる関数 💖
export async function handleAuth(plugin: MyPlugin): Promise<void> {
  const { googleClientId, googleClientSecret } = plugin.settings;

  if (!googleClientId || !googleClientSecret) {
    new Notice('Client IDとClient Secretを先に設定してね！');
    return;
  }

  const oAuth2Client = new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    'http://localhost:3000/callback' // リダイレクトURI
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent', // これで毎回リフレッシュトークンがもらえる
  });

  // 認証URLをブラウザで開く
  window.open(authUrl, '_blank');

  // --- ローカルサーバーを起動してコールバックを待つ ---
  const server = http
    .createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        if (req.url?.startsWith('/callback')) {
          const url = new URL(req.url, 'http://localhost:3000');
          const code = url.searchParams.get('code');

          if (code) {
            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);

            // トークンを保存する
            plugin.settings.googleAuthTokens = {
              accessToken: tokens.access_token!,
              refreshToken: tokens.refresh_token!,
              scope: tokens.scope!,
              tokenType: tokens.token_type!,
              expiryDate: tokens.expiry_date!,
            };
            await plugin.saveSettings();

            new Notice('Googleアカウントとの連携に成功しました！✨');
            res.end('<h1>認証成功！</h1><p>このウィンドウは閉じてOKです。</p>');
          } else {
            throw new Error('認証コードが見つかりませんでした。');
          }
        }
      } catch (error) {
        console.error('認証エラー:', error);
        new Notice('認証に失敗しました...。');
        res.end('<h1>認証失敗...</h1><p>ウィンドウを閉じて、もう一度試してみてください。</p>');
      } finally {
        server.close();
      }
    })
    .listen(3000);
}

// 💖 ログアウト処理 💖
export async function handleLogout(plugin: MyPlugin): Promise<void> {
  plugin.settings.googleAuthTokens = null;
  await plugin.saveSettings();
  new Notice('ログアウトしました！');
}

// 💖 OAuth2クライアントを取得する（トークン更新もここでやる） 💖
export async function getOAuth2Client(plugin: MyPlugin): Promise<any> {
  const { googleClientId, googleClientSecret, googleAuthTokens } = plugin.settings;

  if (!googleClientId || !googleClientSecret || !googleAuthTokens) {
    throw new Error('プラグインがGoogleアカウントと連携されていません。');
  }

  const oAuth2Client = new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    'http://localhost:3000/callback'
  );

  oAuth2Client.setCredentials({
    access_token: googleAuthTokens.accessToken,
    refresh_token: googleAuthTokens.refreshToken,
    scope: googleAuthTokens.scope,
    token_type: googleAuthTokens.tokenType,
    expiry_date: googleAuthTokens.expiryDate,
  });

  // トークンの有効期限が切れてたら裏でこっそり更新する
  if (new Date().getTime() > googleAuthTokens.expiryDate) {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    plugin.settings.googleAuthTokens = {
      accessToken: credentials.access_token!,
      refreshToken: googleAuthTokens.refreshToken, // リフレッシュトークンは変わらない場合がある
      scope: credentials.scope!,
      tokenType: credentials.token_type!,
      expiryDate: credentials.expiry_date!,
    };
    await plugin.saveSettings();
    oAuth2Client.setCredentials(credentials);
  }

  return oAuth2Client;
}
