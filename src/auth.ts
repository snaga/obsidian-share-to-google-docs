import { Notice, requestUrl } from 'obsidian';
import * as http from 'http';
import MyPlugin from './main';
import { GoogleAuthTokens } from './types';

// --- ✨ イケてる定数たち ✨ ---
const REDIRECT_URI = 'http://localhost:3000/callback';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// 💖 認証フローを開始するイケてる関数 💖
export async function handleAuth(plugin: MyPlugin): Promise<void> {
  const { googleClientId, googleClientSecret } = plugin.settings;

  if (!googleClientId || !googleClientSecret) {
    new Notice('Client IDとClient Secretを先に設定してね！');
    return;
  }

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.append('client_id', googleClientId);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', GOOGLE_DRIVE_SCOPE);
  authUrl.searchParams.append('access_type', 'offline');
  authUrl.searchParams.append('prompt', 'consent');

  // 認証URLをブラウザで開く
  window.open(authUrl.toString(), '_blank');

  // --- ローカルサーバーを起動してコールバックを待つ ---
  const server = http
    .createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        if (req.url?.startsWith('/callback')) {
          const url = new URL(req.url, 'http://localhost:3000');
          const code = url.searchParams.get('code');

          if (code) {
            // --- ここから fetch でトークンを取得！ ---
            const response = await requestUrl({
              method: 'POST',
              url: GOOGLE_TOKEN_URL,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                code,
                client_id: googleClientId,
                client_secret: googleClientSecret,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
              }).toString(),
            });

            const tokens = response.json;

            // トークンを保存する
            plugin.settings.googleAuthTokens = {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              scope: tokens.scope,
              tokenType: tokens.token_type,
              expiryDate: Date.now() + tokens.expires_in * 1000,
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

// 💖 アクセストークンを取得/更新する関数 💖
export async function getAccessToken(plugin: MyPlugin): Promise<string | null> {
  const { googleClientId, googleClientSecret, googleAuthTokens } = plugin.settings;

  if (!googleAuthTokens) {
    new Notice('Googleアカウントと連携していません。');
    return null;
  }

  // トークンの有効期限が切れてたら裏でこっそり更新する
  if (Date.now() > googleAuthTokens.expiryDate) {
    if (!googleClientId || !googleClientSecret || !googleAuthTokens.refreshToken) {
      new Notice('トークンの更新に必要な情報がありません。再ログインしてください。');
      await handleLogout(plugin);
      return null;
    }

    try {
      new Notice('Googleの認証トークンを更新中...🤫');
      const response = await requestUrl({
        method: 'POST',
        url: GOOGLE_TOKEN_URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: googleAuthTokens.refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      const newTokens = response.json;
      const updatedTokens: GoogleAuthTokens = {
        ...googleAuthTokens,
        accessToken: newTokens.access_token,
        scope: newTokens.scope,
        tokenType: newTokens.token_type,
        expiryDate: Date.now() + newTokens.expires_in * 1000,
      };

      plugin.settings.googleAuthTokens = updatedTokens;
      await plugin.saveSettings();
      new Notice('トークンを更新しました！');
      return updatedTokens.accessToken;
    } catch (error) {
      console.error('トークン更新エラー:', error);
      new Notice('トークンの更新に失敗しました。再ログインしてください。');
      await handleLogout(plugin);
      return null;
    }
  }

  return googleAuthTokens.accessToken;
}
