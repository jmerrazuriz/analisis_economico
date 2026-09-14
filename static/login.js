/* Pantalla de inicio de sesión, creación de cuenta y contraseña olvidada (cuentas locales).
   En computador es una pantalla dividida; en el teléfono se apila (ver mobile.css). */
(function () {
  "use strict";

  const SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    mail: `<svg ${SVG}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
    lock: `<svg ${SVG}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
    user: `<svg ${SVG}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
    eye: `<svg ${SVG}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg ${SVG}><path d="m3 3 18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`,
    mark: '<svg viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22l6-7 5 4 7-9"/></svg>',
  };

  let active = null;
  let uid = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Botón de ojo para mostrar u ocultar una contraseña. Lo usan también otros formularios.
  function eyeButton(input, className) {
    const eye = el("button", className);
    eye.type = "button";
    eye.setAttribute("aria-controls", input.id);
    const sync = () => {
      const visible = input.type === "text";
      eye.setAttribute("aria-pressed", String(visible));
      eye.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
      eye.innerHTML = visible ? ICONS.eyeOff : ICONS.eye;
    };
    eye.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      sync();
    });
    sync();
    return eye;
  }

  function field({ label, name, icon, type = "text", password = false, autocomplete, hint }) {
    const id = `auth-${name}-${++uid}`;
    const wrap = el("div", "auth-field");
    const labelNode = el("label", "auth-label", label);
    labelNode.htmlFor = id;
    const box = el("div", "auth-input-wrap");
    const iconNode = el("span", "auth-icon");
    iconNode.innerHTML = ICONS[icon];
    iconNode.setAttribute("aria-hidden", "true");
    const input = el("input", "auth-input");
    input.id = id;
    input.name = name;
    input.type = password ? "password" : type;
    input.autocomplete = autocomplete;
    input.required = true;
    if (type === "email") {
      input.inputMode = "email";
      input.autocapitalize = "off";
      input.spellcheck = false;
    }
    box.append(iconNode, input);
    if (password) {
      input.classList.add("has-eye");
      box.appendChild(eyeButton(input, "auth-eye"));
    }
    wrap.append(labelNode, box);
    if (hint) {
      const hintNode = el("p", "auth-hint", hint);
      hintNode.id = id + "-hint";
      input.setAttribute("aria-describedby", hintNode.id);
      wrap.appendChild(hintNode);
    }
    return { wrap, input };
  }

  function link(text, onClick) {
    const button = el("button", "auth-link", text);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  const TEXTS = {
    login: {
      title: "Iniciar sesión",
      sub: "Ingresa tus credenciales para acceder a tu pestaña personalizada",
      submit: "Ingresar →",
      busy: "Ingresando…",
    },
    register: {
      title: "Crear cuenta",
      sub: "Tu cuenta y tu pestaña se guardan solo en este dispositivo",
      submit: "Crear cuenta →",
      busy: "Creando cuenta…",
    },
    forgot: {
      title: "¿Olvidaste tu contraseña?",
      sub: "Las cuentas se guardan solo en este dispositivo, así que la contraseña no se puede recuperar. Puedes eliminar la cuenta de este dispositivo, junto con su pestaña personalizada, y crear una nueva.",
      submit: "Eliminar cuenta de este dispositivo",
      confirm: "Sí, eliminar la cuenta y su pestaña",
    },
  };

  function render(s, notice) {
    const card = s.card;
    const texts = TEXTS[s.mode];
    card.textContent = "";

    const brand = el("div", "auth-brand");
    const logo = el("span", "auth-logo");
    logo.innerHTML = ICONS.mark;
    logo.setAttribute("aria-hidden", "true");
    brand.append(logo, el("span", null, "Panel macro Chile"));

    const title = el("h2", "auth-title", texts.title);
    title.id = "auth-title";
    card.append(brand, title, el("p", "auth-sub", notice || texts.sub));

    const form = el("form", "auth-form");
    form.noValidate = true;
    const fields = {};
    if (s.mode === "register") fields.name = field({ label: "Nombre", name: "name", icon: "user", autocomplete: "name" });
    fields.email = field({ label: "Correo electrónico", name: "email", icon: "mail", type: "email", autocomplete: "email" });
    fields.email.input.value = s.email || "";
    if (s.mode !== "forgot") {
      fields.password = field({
        label: "Contraseña",
        name: "password",
        icon: "lock",
        password: true,
        autocomplete: s.mode === "register" ? "new-password" : "current-password",
        hint: s.mode === "register" ? `Mínimo ${Accounts.MIN_PASSWORD} caracteres.` : null,
      });
    }
    if (s.mode === "register") {
      fields.confirm = field({ label: "Confirmar contraseña", name: "confirm", icon: "lock", password: true, autocomplete: "new-password" });
    }
    Object.values(fields).forEach((f) => form.appendChild(f.wrap));

    const error = el("p", "auth-error");
    error.setAttribute("role", "alert");
    const submit = el("button", "auth-submit" + (s.mode === "forgot" ? " is-danger" : ""), texts.submit);
    submit.type = "submit";
    form.append(error, submit);
    card.appendChild(form);

    const go = (mode) => {
      s.email = fields.email.input.value;
      s.mode = mode;
      render(s);
    };
    const switchRow = el("p", "auth-switch");
    if (s.mode === "login") switchRow.append("¿No tienes cuenta? ", link("Crear cuenta", () => go("register")));
    else switchRow.append(s.mode === "register" ? "¿Ya tienes cuenta? " : "¿La recordaste? ", link("Iniciar sesión", () => go("login")));
    card.appendChild(switchRow);
    if (s.mode === "login") {
      const forgotRow = el("p", "auth-switch");
      forgotRow.appendChild(link("¿Olvidaste tu contraseña?", () => go("forgot")));
      card.appendChild(forgotRow);
    }

    let confirmDelete = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      Object.values(fields).forEach((f) => f.input.removeAttribute("aria-invalid"));
      const values = Object.fromEntries(Object.entries(fields).map(([key, f]) => [key, f.input.value]));
      try {
        if (s.mode === "forgot") {
          if (!confirmDelete) {
            confirmDelete = true;
            submit.textContent = texts.confirm;
            return;
          }
          Accounts.forgetAccount(values.email);
          s.email = values.email;
          s.mode = "register";
          render(s, "Cuenta eliminada de este dispositivo. Ya puedes crear una nueva.");
          return;
        }
        if (s.mode === "register" && values.password !== values.confirm) {
          fields.confirm.input.setAttribute("aria-invalid", "true");
          throw new Accounts.AccountError("Las contraseñas no coinciden.");
        }
        submit.disabled = true;
        submit.textContent = texts.busy;
        const user = s.mode === "login"
          ? await Accounts.login(values.email, values.password)
          : await Accounts.create(values);
        const onSuccess = s.onSuccess;
        close(false);
        if (onSuccess) onSuccess(user);
      } catch (err) {
        submit.disabled = false;
        submit.textContent = texts.submit;
        confirmDelete = false;
        error.textContent = err instanceof Accounts.AccountError
          ? err.message
          : "No se pudo completar la operación. Intenta de nuevo.";
      }
    });

    // En pantallas táctiles no se enfoca solo, para no abrir el teclado sin que la persona lo pida.
    if (!window.matchMedia("(pointer: coarse)").matches) (fields.name || fields.email).input.focus();
  }

  function open({ mode = "login", email = "", onSuccess, onClose } = {}) {
    close(false);
    const root = el("div", "auth");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "auth-title");

    const hero = el("section", "auth-hero");
    const back = el("button", "auth-back", "← Volver al panel");
    back.type = "button";
    hero.append(
      back,
      el("p", "auth-eyebrow", "Tu pestaña personalizada"),
      el("h1", "auth-hero-title", "Bienvenido a Panel macro Chile"),
      el("p", "auth-hero-text", "Arma una pestaña con los indicadores y monedas que más sigues, incluso los que no aparecen en las otras secciones. Tu cuenta y tus preferencias se guardan solo en este dispositivo."),
    );

    const panel = el("section", "auth-panel");
    const card = el("div", "auth-card");
    panel.appendChild(card);
    root.append(hero, panel);

    const hidden = [...document.body.children];
    hidden.forEach((node) => { node.inert = true; });
    document.body.appendChild(root);
    document.documentElement.classList.add("auth-open");

    active = { mode, email, onSuccess, onClose, root, card, hidden, previousFocus: document.activeElement };
    back.addEventListener("click", () => close(true));
    root.addEventListener("keydown", (event) => { if (event.key === "Escape") close(true); });
    render(active);
  }

  function close(notify) {
    if (!active) return;
    const s = active;
    active = null;
    s.root.remove();
    s.hidden.forEach((node) => { node.inert = false; });
    document.documentElement.classList.remove("auth-open");
    if (s.previousFocus && typeof s.previousFocus.focus === "function") s.previousFocus.focus();
    if (notify && s.onClose) s.onClose();
  }

  window.LoginView = { open, close, eyeButton };
})();
