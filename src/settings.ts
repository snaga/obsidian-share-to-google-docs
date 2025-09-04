import { App, PluginSettingTab, Setting } from 'obsidian';
import { PluginSettings } from './types';
import MyPlugin from './main';
import { handleAuth, handleLogout } from './auth';

// 💖 設定画面のUIを定義するクラス 💖
export class MyPluginSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // ✨ 設定画面の表示内容をここに書く ✨
  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Share to Google Docs の設定' });

    // --- Google API クライアント情報の設定 ---
    new Setting(containerEl)
      .setName('Google Client ID')
      .setDesc('Google Cloud Consoleで取得したClient IDを入力してね！')
      .addText(text => {
        text
          .setPlaceholder('Client ID を入力')
          .setValue(this.plugin.settings.googleClientId ?? '')
          .onChange(async value => {
            this.plugin.settings.googleClientId = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });

    new Setting(containerEl)
      .setName('Google Client Secret')
      .setDesc('Google Cloud Consoleで取得したClient Secretを入力してね！')
      .addText(text => {
        text
          .setPlaceholder('Client Secret を入力')
          .setValue(this.plugin.settings.googleClientSecret ?? '')
          .onChange(async value => {
            this.plugin.settings.googleClientSecret = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });

    // --- Googleアカウント連携の状態表示と操作 ---
    const authStatusEl = containerEl.createDiv();
    this.updateAuthStatus(authStatusEl);
  }

  // ✨ 認証状態の表示を更新する ✨
  private updateAuthStatus(containerEl: HTMLElement): void {
    containerEl.empty();

    new Setting(containerEl)
      .setName('Googleアカウント連携')
      .setDesc(
        this.plugin.settings.googleAuthTokens
          ? 'Googleアカウントと連携済みです！いえい！✌️'
          : 'まだGoogleアカウントと連携していません。'
      )
      .addButton(button => {
        if (this.plugin.settings.googleAuthTokens) {
          button.setButtonText('ログアウト').onClick(async () => {
            await handleLogout(this.plugin);
            this.updateAuthStatus(containerEl); // 表示を更新
          });
        } else {
          button.setButtonText('Googleと連携').onClick(async () => {
            await handleAuth(this.plugin);
            this.updateAuthStatus(containerEl); // 表示を更新
          });
        }
      });
  }
}
