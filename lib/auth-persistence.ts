const LOGIN_SCOPE_COOKIE = 'doings_login_scope'
const REMEMBER_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

export function hasLoginScopeCookie() {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some((cookie) => cookie.startsWith(`${LOGIN_SCOPE_COOKIE}=`))
}

export function setLoginScopeCookie(remember: boolean) {
  if (typeof document === 'undefined') return

  const base = `${LOGIN_SCOPE_COOKIE}=${remember ? 'remember' : 'session'}; Path=/; SameSite=Lax`
  document.cookie = remember ? `${base}; Max-Age=${REMEMBER_MAX_AGE_SECONDS}` : base
}

export function clearLoginScopeCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${LOGIN_SCOPE_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`
}
