/* Cuentas locales: se guardan solo en este navegador (localStorage), sin servidor.
   La contraseña nunca se guarda: se guarda un hash PBKDF2-SHA256 con sal aleatoria.
   Esto separa las cuentas de quienes comparten un dispositivo, pero no protege frente a
   alguien con acceso técnico al navegador. */
(function () {
  "use strict";

  const USERS_KEY = "panel-macro:usuarios";
  const SESSION_KEY = "panel-macro:sesion";
  const SELECTION_PREFIX = "panel-macro:personalizado:";
  const ITERATIONS = 210000;
  const MIN_PASSWORD = 8;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  class AccountError extends Error {}

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new AccountError("No se pudo guardar: este navegador bloquea el almacenamiento local (por ejemplo, en modo privado).");
    }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* almacenamiento no disponible */ }
  }

  const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
  const randomHex = (bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));
  const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

  async function derive(password, saltHex, iterations) {
    if (!window.crypto || !crypto.subtle) {
      throw new AccountError("Este navegador no permite crear cuentas seguras en esta página (se necesita una conexión HTTPS).");
    }
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations }, key, 256);
    return toHex(bits);
  }

  function sameHash(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  const users = () => read(USERS_KEY, []);
  const publicUser = (u) => (u ? { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt } : null);

  function checkPassword(password) {
    if (String(password || "").length < MIN_PASSWORD) {
      throw new AccountError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    }
  }

  async function create({ name, email, password }) {
    name = String(name || "").trim();
    email = normalizeEmail(email);
    if (!name) throw new AccountError("Escribe tu nombre.");
    if (!EMAIL_RE.test(email)) throw new AccountError("Escribe un correo electrónico válido, por ejemplo nombre@correo.cl.");
    checkPassword(password);
    const list = users();
    if (list.some((u) => u.email === email)) {
      throw new AccountError("Ya existe una cuenta con ese correo en este dispositivo. Inicia sesión.");
    }
    const salt = randomHex(16);
    const user = {
      id: crypto.randomUUID ? crypto.randomUUID() : randomHex(16),
      name,
      email,
      salt,
      iterations: ITERATIONS,
      hash: await derive(password, salt, ITERATIONS),
      createdAt: new Date().toISOString(),
    };
    list.push(user);
    write(USERS_KEY, list);
    write(SESSION_KEY, user.id);
    return publicUser(user);
  }

  async function login(email, password) {
    email = normalizeEmail(email);
    if (!email || !password) throw new AccountError("Escribe tu correo y tu contraseña.");
    const user = users().find((u) => u.email === email);
    if (!user) throw new AccountError("El correo o la contraseña no son correctos.");
    const hash = await derive(String(password), user.salt, user.iterations);
    if (!sameHash(hash, user.hash)) throw new AccountError("El correo o la contraseña no son correctos.");
    write(SESSION_KEY, user.id);
    return publicUser(user);
  }

  function current() {
    const id = read(SESSION_KEY, null);
    return publicUser(users().find((u) => u.id === id));
  }

  function logout() {
    remove(SESSION_KEY);
  }

  async function verify(user, password) {
    const hash = await derive(String(password || ""), user.salt, user.iterations);
    if (!sameHash(hash, user.hash)) throw new AccountError("La contraseña actual no es correcta.");
  }

  async function changePassword(currentPassword, newPassword) {
    const me = current();
    if (!me) throw new AccountError("Inicia sesión para cambiar la contraseña.");
    const list = users();
    const user = list.find((u) => u.id === me.id);
    await verify(user, currentPassword);
    checkPassword(newPassword);
    user.salt = randomHex(16);
    user.iterations = ITERATIONS;
    user.hash = await derive(newPassword, user.salt, ITERATIONS);
    write(USERS_KEY, list);
  }

  function deleteUser(id) {
    write(USERS_KEY, users().filter((u) => u.id !== id));
    remove(SELECTION_PREFIX + id);
    if (read(SESSION_KEY, null) === id) logout();
  }

  // Elimina la cuenta con sesión iniciada, pidiendo su contraseña.
  async function removeAccount(password) {
    const me = current();
    if (!me) throw new AccountError("Inicia sesión para eliminar la cuenta.");
    await verify(users().find((u) => u.id === me.id), password);
    deleteUser(me.id);
  }

  function selection() {
    const me = current();
    return me ? read(SELECTION_PREFIX + me.id, []) : [];
  }

  function saveSelection(items) {
    const me = current();
    if (!me) throw new AccountError("Inicia sesión para guardar tu pestaña.");
    write(SELECTION_PREFIX + me.id, items);
  }

  window.Accounts = {
    create,
    login,
    logout,
    current,
    changePassword,
    removeAccount,
    selection,
    saveSelection,
    AccountError,
    MIN_PASSWORD,
  };
})();
