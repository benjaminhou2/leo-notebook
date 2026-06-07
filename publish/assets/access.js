(function () {
  const sessionKey = "leo_publish_auth";
  const expiryKey = "leo_publish_auth_until";
  const twelveHours = 12 * 60 * 60 * 1000;

  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (error) {
      return false;
    }
    return true;
  }

  function safeRemove(storage, key) {
    try {
      storage.removeItem(key);
    } catch (error) {
      return;
    }
  }

  function isAuthenticated() {
    if (safeGet(sessionStorage, sessionKey) === "yes") return true;
    const expiresAt = Number(safeGet(localStorage, expiryKey) || 0);
    return expiresAt > Date.now();
  }

  function grantAccess() {
    safeSet(sessionStorage, sessionKey, "yes");
    safeSet(localStorage, expiryKey, String(Date.now() + twelveHours));
  }

  function clearAccess() {
    safeRemove(sessionStorage, sessionKey);
    safeRemove(localStorage, expiryKey);
  }

  function requireAccess(homePath) {
    if (isAuthenticated()) return true;
    window.location.replace(homePath || "./index.html");
    return false;
  }

  window.LeoAccess = {
    isAuthenticated,
    grantAccess,
    clearAccess,
    requireAccess,
  };
})();
