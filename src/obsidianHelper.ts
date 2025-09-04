import { App, Notice, TFile } from 'obsidian';

// 💖 現在アクティブなファイルを取得する関数 💖
export function getActiveFile(app: App): TFile | null {
  const file = app.workspace.getActiveFile();
  if (!file) {
    new Notice('エクスポートするファイルが開かれていません。');
    return null;
  }
  return file;
}
