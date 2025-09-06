import { Notice, requestUrl } from 'obsidian';
import { getAccessToken } from './auth';
import MyPlugin from './main';

// 💖 MarkdownをGoogle Docsに一発で変換＆アップロードする関数 💖
export async function uploadAndConvertToGoogleDocs(
  plugin: MyPlugin,
  fileName: string,
  markdownContent: string
): Promise<void> {
  const notice = new Notice('Google Docsへエクスポート中...🚀', 0);

  try {
    const accessToken = await getAccessToken(plugin);
    if (!accessToken) {
      notice.setMessage('認証エラー！Googleアカウントと連携し直してね。');
      return;
    }

    // --- multipart/related形式のボディを組み立てる ---
    // この形式、まじ卍じゃない？
    const boundary = `----ObsidianToGoogleDocsBoundary${Date.now().toString(16)}`;
    const metadata = {
      name: fileName,
      mimeType: 'application/vnd.google-apps.document',
    };

    let requestBody = `--${boundary}\r\n`;
    requestBody += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
    requestBody += `${JSON.stringify(metadata)}\r\n\r\n`;
    requestBody += `--${boundary}\r\n`;
    requestBody += 'Content-Type: text/markdown\r\n\r\n';
    requestBody += `${markdownContent}\r\n`;
    requestBody += `--${boundary}--`;

    // --- fetchでGoogle Drive APIを直接叩く！ ---
    const response = await requestUrl({
      method: 'POST',
      url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        Authorization: `Bearer ${accessToken}`,
      },
      body: requestBody,
    });

    const createdFile = response.json;
    if (!createdFile || !createdFile.id) {
      throw new Error('Google Docsの作成に失敗しました。');
    }

    const docUrl = `https://docs.google.com/document/d/${createdFile.id}/edit`;
    notice.setMessage('やったね！Google Docsへのエクスポートが完了しました！✨');

    // --- 作成されたドキュメントをブラウザで開く ---
    window.open(docUrl, '_blank');
  } catch (error) {
    console.error('Google Docsへのエクスポート中にエラー発生:', error);
    // APIからのエラーレスポンスを解析して、分かりやすいメッセージにしちゃう
    let errorMessage = '不明なエラーが発生しました。';
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.headers) {
      try {
        const errorResponse = JSON.parse(await error.text());
        if (errorResponse.error?.message) {
          errorMessage = errorResponse.error.message;
        }
      } catch (e) {
        // JSONじゃなかったら、そのまま表示
        errorMessage = await error.text();
      }
    }
    console.error('APIからのエラー内容:', errorMessage);
    notice.setMessage(`エクスポート失敗: ${errorMessage}`);
  }
}