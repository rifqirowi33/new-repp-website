export class CookieManager {
  get(name) {
    const match = document.cookie.match('(?:^|; )' + name.replace(/[-.]/g, '\\$&') + '=([^;]*)');
    return match ? decodeURIComponent(match[1]) : null;
  }

  set(name, value, durationDays = 365) {
    const exp = new Date(Date.now() + durationDays * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
  }

  delete(name) {
    this.set(name, '', -1);
  }
}