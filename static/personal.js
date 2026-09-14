/* Sección Personalizado: barra de la cuenta local y editor para elegir qué ver en la pestaña.
   Se puede elegir cualquier indicador del panel (aunque ya esté en otra sección) o una serie
   del catálogo ampliado (catalog.js). */
(function () {
  "use strict";

  const FREQ = { D: "diaria", M: "mensual", T: "trimestral", A: "anual" };
  let uid = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(text, className) {
    const node = el("button", className, text);
    node.type = "button";
    return node;
  }

  function iconButton(text, label, disabled, onClick) {
    const node = button(text, "icon-btn");
    node.setAttribute("aria-label", label);
    node.disabled = disabled;
    node.addEventListener("click", onClick);
    return node;
  }

  // Quita tildes para que "petroleo" encuentre "Petróleo".
  const fold = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const keyOf = (entry) => (entry.type === "panel" ? `panel:${entry.key}` : `serie:${entry.id}`);
  const freqOf = (id) => FREQ[id.slice(-1)] || "";
  const clone = (list) => list.map((entry) => ({ ...entry }));

  function passwordField(label, autocomplete) {
    const id = `cuenta-clave-${++uid}`;
    const wrap = el("div", "field");
    const labelNode = el("label", "field-label", label);
    labelNode.htmlFor = id;
    const box = el("div", "password-box");
    const input = el("input", "input");
    input.id = id;
    input.type = "password";
    input.autocomplete = autocomplete;
    input.required = true;
    box.append(input, LoginView.eyeButton(input, "eye-toggle"));
    wrap.append(labelNode, box);
    return { wrap, input };
  }

  /* ctx: { user, selection, sections, catalog, onSave(selection), onSignedOut() } */
  function mount(container, ctx) {
    const panelItems = new Map();
    ctx.sections.forEach((section) => section.items.forEach((item) => {
      if (!panelItems.has(item.key)) panelItems.set(item.key, { item, section });
    }));
    const catalogSeries = new Map();
    ctx.catalog.forEach((group) => group.series.forEach((serie) => catalogSeries.set(serie.id, { serie, group })));

    function describe(entry) {
      if (entry.type === "panel") {
        const found = panelItems.get(entry.key);
        return found && { name: found.item.name, meta: `${found.section.name}, ${freqOf(found.item.series[0].id)}`, canYoy: false };
      }
      const found = catalogSeries.get(entry.id);
      return found && { name: found.serie.name, meta: `${found.group.group}, ${freqOf(entry.id)}`, canYoy: !entry.id.endsWith(".D") };
    }

    const s = {
      editing: ctx.selection.length === 0,
      draft: clone(ctx.selection).filter(describe),
      query: "",
      account: false,
    };

    // Barra de la cuenta
    const bar = el("article", "card personal-bar");
    const who = el("div", "personal-who");
    who.append(el("strong", null, ctx.user.name), el("span", null, ctx.user.email));
    const actions = el("div", "personal-actions");
    const editButton = button("", "btn btn-primary");
    const accountButton = button("Mi cuenta", "btn");
    accountButton.setAttribute("aria-expanded", "false");
    const logoutButton = button("Cerrar sesión", "btn");
    actions.append(editButton, accountButton, logoutButton);
    const accountArea = el("div", "personal-account");
    accountArea.hidden = true;
    bar.append(who, actions, accountArea);

    const empty = el("article", "card personal-empty");
    empty.append(
      el("h2", null, "Tu pestaña está vacía"),
      el("p", "card-desc", "Usa «Editar pestaña» para elegir los indicadores y series que quieres ver aquí."),
    );

    const editor = el("article", "card personal-editor");
    container.append(bar, empty, editor);

    function sync() {
      editButton.textContent = s.editing ? "Cerrar editor" : "Editar pestaña";
      editButton.setAttribute("aria-expanded", String(s.editing));
      empty.hidden = s.editing || ctx.selection.length > 0;
      editor.hidden = !s.editing;
    }

    editButton.addEventListener("click", () => {
      s.editing = !s.editing;
      if (s.editing) {
        s.draft = clone(ctx.selection).filter(describe);
        renderEditor();
      }
      sync();
    });
    accountButton.addEventListener("click", () => {
      s.account = !s.account;
      accountButton.setAttribute("aria-expanded", String(s.account));
      accountArea.hidden = !s.account;
      if (s.account && !accountArea.childElementCount) renderAccount();
    });
    logoutButton.addEventListener("click", () => {
      Accounts.logout();
      ctx.onSignedOut();
    });

    function renderAccount() {
      // Cambiar contraseña
      const passwordForm = el("form", "account-form");
      passwordForm.noValidate = true;
      const current = passwordField("Contraseña actual", "current-password");
      const next = passwordField("Nueva contraseña", "new-password");
      const again = passwordField("Confirmar nueva contraseña", "new-password");
      const passwordMessage = el("p", "form-message");
      passwordMessage.setAttribute("role", "status");
      const passwordSubmit = el("button", "btn btn-primary", "Guardar contraseña");
      passwordSubmit.type = "submit";
      passwordForm.append(
        el("h3", null, "Cambiar contraseña"),
        el("p", null, `Mínimo ${Accounts.MIN_PASSWORD} caracteres.`),
        current.wrap, next.wrap, again.wrap, passwordMessage, passwordSubmit,
      );
      passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        passwordMessage.className = "form-message";
        passwordMessage.textContent = "";
        if (next.input.value !== again.input.value) {
          passwordMessage.textContent = "Las contraseñas nuevas no coinciden.";
          passwordMessage.classList.add("is-error");
          return;
        }
        passwordSubmit.disabled = true;
        try {
          await Accounts.changePassword(current.input.value, next.input.value);
          [current, next, again].forEach((f) => { f.input.value = ""; });
          passwordMessage.textContent = "Contraseña actualizada.";
          passwordMessage.classList.add("is-ok");
        } catch (err) {
          passwordMessage.textContent = err.message || "No se pudo cambiar la contraseña.";
          passwordMessage.classList.add("is-error");
        } finally {
          passwordSubmit.disabled = false;
        }
      });

      // Eliminar cuenta
      const deleteForm = el("form", "account-form");
      deleteForm.noValidate = true;
      const deletePassword = passwordField("Contraseña", "current-password");
      const deleteMessage = el("p", "form-message");
      deleteMessage.setAttribute("role", "status");
      const deleteSubmit = el("button", "btn btn-danger", "Eliminar cuenta");
      deleteSubmit.type = "submit";
      let confirmDelete = false;
      deleteForm.append(
        el("h3", null, "Eliminar cuenta"),
        el("p", null, "Se borrarán tu cuenta y tu pestaña personalizada de este dispositivo."),
        deletePassword.wrap, deleteMessage, deleteSubmit,
      );
      deleteForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        deleteMessage.className = "form-message";
        deleteMessage.textContent = "";
        if (!confirmDelete) {
          confirmDelete = true;
          deleteSubmit.textContent = "Sí, eliminar definitivamente";
          return;
        }
        deleteSubmit.disabled = true;
        try {
          await Accounts.removeAccount(deletePassword.input.value);
          ctx.onSignedOut();
        } catch (err) {
          confirmDelete = false;
          deleteSubmit.disabled = false;
          deleteSubmit.textContent = "Eliminar cuenta";
          deleteMessage.textContent = err.message || "No se pudo eliminar la cuenta.";
          deleteMessage.classList.add("is-error");
        }
      });

      accountArea.append(passwordForm, deleteForm);
    }

    function renderEditor() {
      editor.textContent = "";
      const head = el("div", "editor-head");
      head.append(
        el("h2", null, "Elige qué ver en tu pestaña"),
        el("p", "card-desc", "Marca indicadores del panel o series del catálogo ampliado, como monedas, materias primas, bolsas y tasas. Un indicador puede estar aquí aunque ya aparezca en otra sección."),
      );
      const search = el("input", "input editor-search");
      search.type = "search";
      search.placeholder = "Buscar, por ejemplo: cobre, yen, IPSA";
      search.setAttribute("aria-label", "Buscar indicadores y series");
      search.value = s.query;
      const layout = el("div", "editor-layout");
      const options = el("div", "editor-options");
      const chosen = el("div", "editor-chosen");
      layout.append(options, chosen);
      const footer = el("div", "editor-footer");
      const save = button("Guardar pestaña", "btn btn-primary");
      const cancel = button("Cancelar", "btn");
      footer.append(save, cancel);
      editor.append(head, search, layout, footer);

      const groups = [
        ...ctx.sections.map((section) => ({
          name: section.name,
          note: "del panel",
          entries: section.items.map((item) => ({ entry: { type: "panel", key: item.key }, name: item.name, meta: freqOf(item.series[0].id), search: "" })),
        })),
        ...ctx.catalog.map((group) => ({
          name: group.group,
          note: "catálogo ampliado",
          entries: group.series.map((serie) => ({ entry: { type: "serie", id: serie.id }, name: serie.name, meta: freqOf(serie.id), search: serie.title })),
        })),
      ];
      const chosenKeys = () => new Set(s.draft.map(keyOf));

      function renderOptions() {
        options.textContent = "";
        const query = fold(s.query.trim());
        const selected = chosenKeys();
        let total = 0;
        groups.forEach((group) => {
          const entries = query
            ? group.entries.filter((e) => fold(`${e.name} ${e.search} ${group.name}`).includes(query))
            : group.entries;
          if (!entries.length) return;
          total += entries.length;
          const details = el("details", "editor-group");
          details.open = Boolean(query) || entries.some((e) => selected.has(keyOf(e.entry)));
          const summary = el("summary");
          summary.append(el("span", null, group.name), el("small", null, `${entries.length} ${group.note}`));
          details.appendChild(summary);
          entries.forEach((e) => {
            const label = el("label", "editor-option");
            const box = el("input");
            box.type = "checkbox";
            box.dataset.key = keyOf(e.entry);
            box.checked = selected.has(box.dataset.key);
            box.addEventListener("change", () => {
              if (box.checked) {
                if (!chosenKeys().has(box.dataset.key)) s.draft.push({ ...e.entry });
              } else {
                s.draft = s.draft.filter((d) => keyOf(d) !== box.dataset.key);
              }
              renderChosen();
            });
            const text = el("span", "editor-option-text");
            text.append(el("span", null, e.name), el("small", null, e.meta));
            label.append(box, text);
            details.appendChild(label);
          });
          options.appendChild(details);
        });
        if (!total) options.appendChild(el("p", "side-note", "No hay series que coincidan con la búsqueda."));
      }

      function move(index, delta) {
        const [entry] = s.draft.splice(index, 1);
        s.draft.splice(index + delta, 0, entry);
        renderChosen();
      }

      function renderChosen() {
        chosen.textContent = "";
        chosen.appendChild(el("h3", null, `En tu pestaña (${s.draft.length})`));
        if (!s.draft.length) {
          chosen.appendChild(el("p", "side-note", "Aún no eliges nada. Marca indicadores en la lista."));
          return;
        }
        const list = el("ol", "chosen-list");
        s.draft.forEach((entry, index) => {
          const info = describe(entry);
          const item = el("li");
          const text = el("div", "chosen-text");
          text.append(el("span", null, info.name), el("small", null, info.meta));
          const controls = el("div", "chosen-controls");
          if (info.canYoy) {
            const view = el("select", "input chosen-view");
            view.setAttribute("aria-label", `Cómo mostrar ${info.name}`);
            [["value", "Valor"], ["yoy", "Variación anual"]].forEach(([value, label]) => {
              const option = el("option", null, label);
              option.value = value;
              view.appendChild(option);
            });
            view.value = entry.view === "yoy" ? "yoy" : "value";
            view.addEventListener("change", () => { entry.view = view.value; });
            controls.appendChild(view);
          }
          controls.append(
            iconButton("↑", `Subir ${info.name}`, index === 0, () => move(index, -1)),
            iconButton("↓", `Bajar ${info.name}`, index === s.draft.length - 1, () => move(index, 1)),
            iconButton("✕", `Quitar ${info.name}`, false, () => {
              s.draft.splice(index, 1);
              const box = options.querySelector(`input[data-key="${CSS.escape(keyOf(entry))}"]`);
              if (box) box.checked = false;
              renderChosen();
            }),
          );
          item.append(text, controls);
          list.appendChild(item);
        });
        chosen.appendChild(list);
      }

      search.addEventListener("input", () => {
        s.query = search.value;
        renderOptions();
      });
      save.addEventListener("click", () => ctx.onSave(clone(s.draft)));
      cancel.addEventListener("click", () => {
        s.editing = false;
        s.draft = clone(ctx.selection).filter(describe);
        sync();
      });

      renderOptions();
      renderChosen();
    }

    if (s.editing) renderEditor();
    sync();
  }

  window.Personal = { mount };
})();
