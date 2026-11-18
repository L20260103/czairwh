/**
 * 登录开关。现在是关的：anon 和登录用户都能读写同一份数据。
 *
 * 要改成必须登录，三处一起做：
 * 1. 在 Supabase 执行 supabase/authenticated-only.sql（收紧策略的唯一位置）
 * 2. 把下面的 AUTH_REQUIRED 改为 true
 * 3. 用 src/components/AuthGate.tsx 包住 App，并在里面接上邮箱密码登录
 */
export const AUTH_REQUIRED = false;
