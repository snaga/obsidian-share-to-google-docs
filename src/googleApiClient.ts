import { Notice } from 'obsidian';
import { google, drive_v3 } from 'googleapis';
import { getOAuth2Client } from './auth';
import MyPlugin from './main';

// 💖 Google DriveにファイルをアップロードしてGoogle Docsに変換する関数 💖
export async function uploadAndConvertToGoogleDocs(
  plugin: MyPlugin,
  fileName: string,
  markdownContent: string
): Promise<void> {
  const notice = new Notice('Google Docsへエクスポート中...🚀', 0);

    try {
        const oAuth2Client = await getOAuth2Client(plugin);
        const drive = google.drive({ version: 'v3', auth: oAuth2Client });

        // --- Step 1: MarkdownファイルをGoogle Driveにアップロード ---
        const uploadResponse = await drive.files.create({
            requestBody: {
                name: `${fileName}.md`,
                mimeType: 'text/markdown',
            },
            media: {
                mimeType: 'text/markdown',
                body: markdownContent,
            },
        });

        const fileId = uploadResponse.data.id;
        if (!fileId) {
            throw new Error('ファイルのアップロードに失敗しました。');
        }

        // --- Step 2: アップロードしたファイルをGoogle Docs形式に変換コピー ---
        const copyResponse = await drive.files.copy({
            fileId: fileId,
            requestBody: {
                name: fileName,
                mimeType: 'application/vnd.google-apps.document',
            },
        });

        const docUrl = `https://docs.google.com/document/d/${copyResponse.data.id}/edit`;
        notice.setMessage(`やったね！Google Docsへのエクスポートが完了しました！✨`);

        // --- Step 3: 元のMarkdownファイルをゴミ箱に移動 ---
        await drive.files.update({
            fileId: fileId,
            requestBody: {
                trashed: true,
            },
        });

        // --- Step 4: 作成されたドキュメントをブラウザで開く ---
        window.open(docUrl, '_blank');

    } catch (error) {
        console.error('Google Docsへのエクスポート中にエラー発生:', error);
        notice.setMessage(`エクスポートに失敗しました...。`);
    }
}
