export interface ApiEnv {
  DB: D1Database
  BUCKET: R2Bucket
  APP_URL: string
  GIT_SHA?: string
  BETTER_AUTH_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  OWNER_GITHUB_ID?: string
}
