import { Plugin } from 'obsidian';
import { PluginSettings } from './types';
import { MyPluginSettingTab } from './settings';
import { getActiveFile } from './obsidianHelper';
import { uploadAndConvertToGoogleDocs } from './googleApiClient';

// 💖 デフォルト設定 💖
const DEFAULT_SETTINGS: PluginSettings = {
  googleAuthTokens: null,
  googleClientId: null,
  googleClientSecret: null,
};

// 💖 プラグイン本体のクラス！司令塔！ 💖
export default class MyPlugin extends Plugin {
  settings: PluginSettings;

  // ✨ プラグインが起動したときの処理 ✨
  async onload() {
    // 設定を読み込む
    await this.loadSettings();

    // 設定画面を追加する
    this.addSettingTab(new MyPluginSettingTab(this.app, this));

    // リボンにアイコンを追加する
    this.addRibbonIcon(
      'upload-cloud', // アイコンの名前 (lucide.dev で探せる)
      'Export to Google Docs',
      (evt: MouseEvent) => {
        this.exportToGoogleDocs();
      }
    );

    // コマンドパレットにコマンドを追加する
    this.addCommand({
      id: 'export-to-google-docs',
      name: 'Export to Google Docs',
      callback: () => {
        this.exportToGoogleDocs();
      },
    });
  }

  // ✨ エクスポート処理の本体 ✨
  async exportToGoogleDocs() {
    // 認証情報のチェック
    if (!this.settings.googleAuthTokens) {
      new Notification('Googleアカウントと連携してください。');
      return;
    }

    // アクティブなファイルを取得
    const activeFile = getActiveFile(this.app);
    if (!activeFile) return;

    const fileName = activeFile.basename;
    const markdownContent = await this.app.vault.read(activeFile);

    // Google Driveにアップロードして変換
    await uploadAndConvertToGoogleDocs(this, fileName, markdownContent);
  }

  // ✨ プラグインが終了するときの処理 ✨
  onunload() {}

  // ✨ 設定を読み込む ✨
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  // ✨ 設定を保存する ✨
  async saveSettings() {
    await this.saveData(this.settings);
  }
}