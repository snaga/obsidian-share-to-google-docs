// 💖 Google APIの認証情報を格納する型の定義 💖
export interface GoogleAuthTokens {
  accessToken: string;
  refreshToken: string;
  scope: string;
  tokenType: string;
  expiryDate: number;
}

// 💖 プラグイン全体の設定を格納する型の定義 💖
export interface PluginSettings {
  googleAuthTokens: GoogleAuthTokens | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
}
