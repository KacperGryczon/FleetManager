let firmaExists = false;

document.addEventListener("DOMContentLoaded", async () => {
  firmaExists = false;

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("userInfo-userMail").innerText = user.email;

  const { data: uzytkownik } = await client
    .from("UZYTKOWNIK")
    .select("firma_id")
    .eq("email", user.email)
    .maybeSingle();

  if (uzytkownik && uzytkownik.firma_id) {
    firmaExists = true;
    await showView("viewDashboard");
  } else {
    await showView("viewCreateFirma", "Dodaj firmę");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await client.auth.signOut();
  window.location.href = "index.html";
});

function showAlert(success, message) {
  const alertBox = document.getElementById("alert");

  if (!alertBox) return;

  alertBox.className = "";
  alertBox.classList.add(success ? "success" : "error");

  alertBox.innerHTML = `
    <span>${message}</span>
  `;

  alertBox.classList.add("show");

  setTimeout(() => {
    alertBox.classList.remove("show");
  }, 5000);
}

function initMenuToggle() {
  const menuButton = document.getElementById("menuBarOpen");
  const menuBar = document.getElementById("menuBar");
  const menuCloseBtn = document.getElementById("menuCloseBtn");
  let menuOverlay = document.getElementById("menuOverlay");

  if (!menuOverlay) {
    menuOverlay = document.createElement("div");
    menuOverlay.id = "menuOverlay";
    menuOverlay.className = "menuOverlay";
    document.body.appendChild(menuOverlay);
  }

  menuButton.addEventListener("click", () => {
    menuBar.classList.toggle("open");
    menuOverlay.classList.toggle("active");
  });

  menuCloseBtn.addEventListener("click", () => {
    menuBar.classList.remove("open");
    menuOverlay.classList.remove("active");
  });

  menuOverlay.addEventListener("click", () => {
    menuBar.classList.remove("open");
    menuOverlay.classList.remove("active");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initMenuToggle, 100);
});

async function initApp() {
  await ensureUserHasRole();
  await applyRoleRestrictions();
  await goToDashboard();
}

function showLoader() {
  document.getElementById("globalLoader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("globalLoader").classList.add("hidden");
}

async function showView(viewId, title) {
  showLoader();

  const role = await getUserRole();

  const blockedViews = {
    Kierowca: ["viewPojazdy", "viewDodajPojazd", "viewUżytkownicy"],
    Przeglądający: [
      "viewDodajPojazd",
      "viewDodajKierowce",
      "viewDodajDokument",
      "viewUżytkownicy",
    ],
  };

  if (blockedViews[role]?.includes(viewId)) {
    return showView("viewDashboard", "Pulpit");
  }

  const allViews = document.querySelectorAll(".inView");
  allViews.forEach((view) => {
    view.classList.remove("visible");
  });

  const viewElement = document.getElementById(viewId);
  if (!viewElement) {
    hideLoader();
    return;
  }

  viewElement.classList.add("visible");

  if (title) {
    document.getElementById("viewTitle").innerText = title;
  }

  if (viewId === "viewDodajPojazd") await loadKierowcyDoSelecta();
  if (viewId === "viewPojazdy") await loadPojazdyList();
  if (viewId === "viewKierowcy") await loadKierowcyList();
  if (viewId === "viewDokumenty") await loadDokumentyList();
  if (viewId === "viewDashboard") {
    await loadDokumentyList();
    await renderNadchodzaceTerminy();
  }
  if (viewId === "viewUżytkownicy") await loadUzytkownicyList();
  if (viewId === "viewUstawieniaFirmy") await loadFirmaSettings();
  if (viewId === "viewUstawieniaProfilu") await loadUserSettings();

  hideLoader();
  setActiveMenu(viewId);

  if (window.innerWidth <= 1200) {
    const menuBar = document.getElementById("menuBar");
    const menuOverlay = document.getElementById("menuOverlay");
    if (menuBar && menuOverlay) {
      menuBar.classList.remove("open");
      menuOverlay.classList.remove("active");
    }
  }
}

async function goToDashboard() {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const { data: uzytkownik } = await client
    .from("UZYTKOWNIK")
    .select("firma_id")
    .eq("email", user.email)
    .maybeSingle();

  if (!uzytkownik || !uzytkownik.firma_id) {
    return showView("viewCreateFirma", "Dodaj firmę");
  }

  showView("viewDashboard", "Pulpit");
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-view]");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  let viewId = btn.dataset.view;
  let title = btn.dataset.title;

  if (btn.classList.contains("viewButton")) {
    document
      .querySelectorAll(".viewButton")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  showView(viewId, title);
});

async function ensureUserHasRole() {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return;

  const { data: existing } = await client
    .from("UZYTKOWNIK")
    .select("*")
    .eq("email", user.email)
    .maybeSingle();

  if (existing) return;

  const { data: firma } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!firma) {
    return;
  }

  await client.from("UZYTKOWNIK").insert({
    firma_id: firma.id,
    email: user.email,
    rola: "Właściciel",
    status: "aktywny",
  });

  console.log("Dodano właściciela firmy do tabeli UZYTKOWNIK");
}

async function getUserRole() {
  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: u } = await client
    .from("UZYTKOWNIK")
    .select("rola")
    .eq("email", user.email)
    .single();

  return u?.rola;
}

const PERMISSIONS = {
  Właściciel: {
    canManageFleet: true,
    canManageDrivers: true,
    canManageDocuments: true,
    canManageUsers: true,
    canViewAll: true,
    canViewOwn: true,
  },
  Administrator: {
    canManageFleet: true,
    canManageDrivers: true,
    canManageDocuments: true,
    canManageUsers: false,
    canViewAll: true,
    canViewOwn: true,
  },
  Kierowca: {
    canManageFleet: false,
    canManageDrivers: false,
    canManageDocuments: false,
    canManageUsers: false,
    canViewAll: false,
    canViewOwn: true,
  },
  Przeglądający: {
    canManageFleet: false,
    canManageDrivers: false,
    canManageDocuments: false,
    canManageUsers: false,
    canViewAll: true,
    canViewOwn: false,
  },
};

async function can(action) {
  const role = await getUserRole();
  return PERMISSIONS[role]?.[action] === true;
}

async function applyRoleRestrictions() {
  const role = await getUserRole();

  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.style.display = "none";
  });

  if (role === "Właściciel") {
    showMenu([
      "viewDashboard",
      "viewPojazdy",
      "viewKierowcy",
      "viewDokumenty",
      "viewUżytkownicy",
      "viewUstawieniaFirmy",
      "viewUstawieniaProfilu",
    ]);
    document.querySelectorAll(".addButton").forEach((btn) => {
      btn.style.display = "none";
    });
  }

  if (role === "Administrator") {
    showMenu([
      "viewDashboard",
      "viewPojazdy",
      "viewKierowcy",
      "viewDokumenty",
      "viewUstawieniaFirmy",
      "viewUstawieniaProfilu",
    ]);
  }

  if (role === "Przeglądający") {
    showMenu([
      "viewDashboard",
      "viewPojazdy",
      "viewKierowcy",
      "viewDokumenty",
      "viewUstawieniaProfilu",
    ]);
  }

  if (role === "Kierowca") {
    showMenu([
      "viewDashboard",
      "viewMojePojazdy",
      "viewMojeDokumenty",
      "viewUstawieniaProfilu",
    ]);
  }
}

function showMenu(ids) {
  ids.forEach((id) => {
    const btn = document.querySelector(`[data-view="${id}"]`);
    if (btn) btn.style.display = "flex";
  });
}

async function createFirmaFromForm() {
  const nazwa = document.getElementById("firmaNazwa").value.trim();
  const email = document.getElementById("firmaAdres").value.trim();

  document.getElementById("firmaNazwa").addEventListener("input", () => {
    document.getElementById("firmaNazwa").classList.remove("placeholder-red");
  });

  document.getElementById("firmaAdres").addEventListener("input", () => {
    document.getElementById("firmaAdres").classList.remove("placeholder-red");
  });

  if (!nazwa) {
    document.getElementById("firmaNazwa").classList.add("placeholder-red");
    if (!email) {
      document.getElementById("firmaAdres").classList.add("placeholder-red");
    }
    return;
  }

  if (!email) {
    document.getElementById("firmaAdres").classList.add("placeholder-red");
    return;
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    showAlert(false, "Brak zalogowanego użytkownika.");
    return;
  }

  const { data, error } = await client
    .from("FIRMA")
    .insert({
      nazwa,
      email,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    showAlert(false, "Nie udało się dodać firmy.");
    return;
  }

  showView("viewDashboard", "Pulpit");
}

async function cancelCreateFirmaFromForm() {
  showView("viewDashboard", "Pulpit");
}

async function loadKierowcyDoSelecta() {
  const select = document.getElementById("PojazdPrzypisanyKierowca");
  select.innerHTML = `<option value="">Brak przypisania</option>`;

  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: firma } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: kierowcy, error } = await client
    .from("KIEROWCA")
    .select("id, imie_nazwisko")
    .eq("firma_id", firma.id);

  if (error) {
    console.error(error);
    return;
  }

  kierowcy.forEach((k) => {
    const option = document.createElement("option");
    option.value = k.id;
    option.textContent = k.imie_nazwisko;
    select.appendChild(option);
  });
}

async function dodajPojazdFromForm() {
  const fields = [
    "selectTypPojazdu",
    "pojazdNumerRejestracyjny",
    "pojazdMarka",
    "pojazdModel",
    "pojazdRokProdukcji",
    "pojazdNumerVIN",
  ];

  if (!(await can("canManageFleet"))) {
    return showAlert(false, "Nie masz uprawnień do dodawania pojazdów");
  }

  let hasError = false;

  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.classList.add("placeholder-red");
      hasError = true;

      el.addEventListener(
        "input",
        () => {
          el.classList.remove("placeholder-red");
        },
        { once: true },
      );
    }
  });

  if (hasError) return;

  const typ = document.getElementById("selectTypPojazdu").value.trim();
  const numer_rejestracyjny = document
    .getElementById("pojazdNumerRejestracyjny")
    .value.trim();
  const marka = document.getElementById("pojazdMarka").value.trim();
  const model = document.getElementById("pojazdModel").value.trim();
  const rok_produkcji = parseInt(
    document.getElementById("pojazdRokProdukcji").value.trim(),
    10,
  );
  const vin = document.getElementById("pojazdNumerVIN").value.trim();
  const przypisany_kierowca =
    document.getElementById("PojazdPrzypisanyKierowca").value.trim() || null;

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    showAlert(false, "Brak zalogowanego użytkownika.");
    return;
  }

  const { data: firma, error: firmaError } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (firmaError || !firma) {
    showAlert(false, "Nie znaleziono firmy użytkownika.");
    return;
  }

  const { data, error } = await client
    .from("POJAZD")
    .insert({
      firma_id: firma.id,
      numer_rejestracyjny,
      vin,
      marka,
      model,
      rok_produkcji,
      przypisany_kierowca_id: przypisany_kierowca,
      typ,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    showAlert(false, "Nie udało się dodać pojazdu.");
    return;
  }

  showAlert(true, "Pojazd został dodany.");
  showView("viewPojazdy", "Pojazdy");

  document.getElementById("selectTypPojazdu").value = "";
  document.getElementById("pojazdNumerRejestracyjny").value = "";
  document.getElementById("pojazdMarka").value = "";
  document.getElementById("pojazdModel").value = "";
  document.getElementById("pojazdRokProdukcji").value = "";
  document.getElementById("pojazdNumerVIN").value = "";
  document.getElementById("PojazdPrzypisanyKierowca").value = "";
}

async function loadPojazdyList() {
  const role = await getUserRole();

  if (role === "Kierowca") {
    const {
      data: { user },
    } = await client.auth.getUser();

    const { data } = await client
      .from("POJAZD")
      .select("*")
      .eq("przypisany_kierowca_id", user.id);

    renderPojazdy(data);
    return;
  }

  const container = document.getElementById("pojazdyRows");
  container.innerHTML = "";

  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: firma } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: pojazdy, error } = await client
    .from("POJAZD")
    .select(
      `
      id,
      typ,
      numer_rejestracyjny,
      marka,
      model,
      przypisany_kierowca_id,
      KIEROWCA:przypisany_kierowca_id (imie_nazwisko)
    `,
    )
    .eq("firma_id", firma.id);

  if (error) {
    console.error(error);
    return;
  }

  if (!pojazdy || pojazdy.length === 0) {
    container.innerHTML = `
      <div class="brakPojazdow">
        <p>Nie masz jeszcze żadnych pojazdów.</p>
      </div>
    `;
    return;
  }

  pojazdy.forEach((p) => {
    const kierowca = p.KIEROWCA ? p.KIEROWCA.imie_nazwisko : "-";

    const row = document.createElement("div");
    row.classList.add("table", "table-row");

    row.innerHTML = `
      <div class="div1">${p.typ}</div>
      <div class="div2">${p.numer_rejestracyjny}</div>
      <div class="div3">${p.marka} ${p.model}</div>
      <div class="div4">${kierowca}</div>
      <div class="div5">
        <button data-view="viewSzczegolyPojazdu" data-id="${p.id}" data-title="Szczegóły pojazdu">
          <i class="fa-regular fa-eye"></i>Szczegóły
        </button>
      </div>
    `;

    container.appendChild(row);
  });
}

async function dodajKierowcęFromForm() {
  const fields = [
    "kierowcaImię",
    "kierowcaNazwisko",
    "kierowcaTelefon",
    "kierowcaMail",
  ];

  if (!(await can("canManageDrivers"))) {
    return showAlert(false, "Nie masz uprawnień do dodawania kierowców");
  }

  let hasError = false;

  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.classList.add("placeholder-red");
      hasError = true;

      el.addEventListener(
        "input",
        () => {
          el.classList.remove("placeholder-red");
        },
        { once: true },
      );
    }
  });

  if (hasError) return;

  const imię = document.getElementById("kierowcaImię").value.trim();
  const nazwisko = document.getElementById("kierowcaNazwisko").value.trim();
  const telefon = document.getElementById("kierowcaTelefon").value.trim();
  const email = document.getElementById("kierowcaMail").value.trim();

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    showAlert(false, "Brak zalogowanego użytkownika.");
    return;
  }

  const { data: firma, error: firmaError } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (firmaError || !firma) {
    showAlert(false, "Nie znaleziono firmy użytkownika.");
    return;
  }

  const { data, error } = await client
    .from("KIEROWCA")
    .insert({
      firma_id: firma.id,
      imie_nazwisko: imię + " " + nazwisko,
      telefon,
      email,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    showAlert(false, "Nie udało się dodać kierowcy.");
    return;
  }

  showAlert(true, "Pojazd został dodany.");
  showView("viewKierowcy", "Kierowcy");
}

async function loadKierowcyList() {
  const container = document.getElementById("kierowcyRows");
  container.innerHTML = "";

  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: firma } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: kierowcy, error } = await client
    .from("KIEROWCA")
    .select("id, imie_nazwisko, telefon, email")
    .eq("firma_id", firma.id);

  if (error) {
    console.error(error);
    return;
  }

  if (!kierowcy || kierowcy.length === 0) {
    container.innerHTML = `
      <div class="brakPojazdow">
        <p>Nie masz jeszcze żadnych kierowców.</p>
      </div>
    `;
    return;
  }

  kierowcy.forEach((k) => {
    const row = document.createElement("div");
    row.classList.add("table", "table-row");

    row.innerHTML = `
      <div class="kierowcaDiv1">${k.imie_nazwisko}</div>
      <div class="kierowcaDiv2">${k.telefon || "-"}</div>
      <div class="kierowcaDiv3">${k.email || "-"}</div>
      <div class="kierowcaDiv4">
        <button data-view="viewSzczegolyKierowcy" data-id="${k.id}" data-title="Szczegóły kierowcy">
          <i class="fa-regular fa-eye"></i>Szczegóły
        </button>
      </div>
    `;

    container.appendChild(row);
  });
}

function setActiveMenu(viewId) {
  document.querySelectorAll(".viewButton").forEach((btn) => {
    btn.classList.remove("active");
  });

  const map = {
    viewDashboard: "viewDashboard",
    viewPojazdy: "viewPojazdy",
    viewDodajPojazd: "viewPojazdy",
    viewKierowcy: "viewKierowcy",
    viewDokumenty: "viewDokumenty",
    viewUżytkownicy: "viewUżytkownicy",
    viewUstawieniaFirmy: "viewUstawieniaFirmy",
    viewUstawieniaProfilu: "viewUstawieniaProfilu",
    viewDodajKierowcę: "viewKierowcy",
  };

  const target = map[viewId];
  if (!target) return;

  const btn = document.querySelector(`.viewButton[data-view="${target}"]`);
  if (btn) btn.classList.add("active");
}

async function cancelCreatePojazdFromForm() {
  showView("viewPojazdy", "Pojazdy");
}

async function cancelCreateKierowcęFromForm() {
  showView("viewKierowcy", "Kierowcy");
}

async function cancelCreateDokumentFromForm() {
  showView("viewDokumenty", "Dokumenty");
}

let dokumentyCache = [];
let currentRenderRequestId = 0;

async function loadDokumentyList() {
  const container = document.getElementById("dokumentyRows");
  container.innerHTML = "";

  const role = await getUserRole();

  if (role === "Kierowca") {
    const {
      data: { user },
    } = await client.auth.getUser();

    const { data } = await client
      .from("DOKUMENT")
      .select("*")
      .eq("wlasciciel_id", user.id);

    dokumentyCache = data;
    renderDokumenty(dokumentyCache);
    updateDashboardTiles();
    return;
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: firma } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: dokumenty, error } = await client
    .from("DOKUMENT")
    .select("*")
    .eq("firma_id", firma.id);

  if (error) {
    console.log(error);
    return;
  }

  dokumentyCache = dokumenty;

  renderDokumenty(dokumentyCache);
  updateDashboardTiles();
}

async function renderDokumenty(lista) {
  const container = document.getElementById("dokumentyRows");
  container.innerHTML = "";

  document.querySelector(".dokumentyCount").textContent = `(${lista.length})`;

  if (lista.length === 0) {
    container.innerHTML = `<p>Brak dokumentów spełniających kryteria filtrów.</p>`;
    return;
  }

  for (const d of lista) {
    let przypisanieNazwa = "";

    if (d.typ_wlasciciela === "Pojazd") {
      const { data: pojazd } = await client
        .from("POJAZD")
        .select("numer_rejestracyjny")
        .eq("id", d.wlasciciel_id)
        .single();
      przypisanieNazwa = pojazd?.numer_rejestracyjny || "—";
    }

    if (d.typ_wlasciciela === "Kierowca") {
      const { data: kierowca } = await client
        .from("KIEROWCA")
        .select("imie_nazwisko")
        .eq("id", d.wlasciciel_id)
        .single();
      przypisanieNazwa = kierowca?.imie_nazwisko || "—";
    }

    if (d.typ_wlasciciela === "Firma") {
      const { data: firma } = await client
        .from("FIRMA")
        .select("nazwa")
        .eq("id", d.wlasciciel_id)
        .single();
      przypisanieNazwa = firma?.nazwa || "Firma";
    }

    const borderKolor =
      d.status === "ok"
        ? "rgba(52, 243, 52, 0.53)"
        : d.status === "wygasa"
          ? "rgba(243, 163, 52, 0.53)"
          : "rgba(255, 0, 0, 0.53)";

    const kolor =
      d.status === "ok"
        ? "rgba(52, 243, 52, 0.43)"
        : d.status === "wygasa"
          ? "rgba(243, 163, 52, 0.43)"
          : "rgba(255, 0, 0, 0.43)";

    const row = document.createElement("div");
    row.classList.add("table", "table-row");

    function statusLabel(status) {
      if (status === "ok") return "Ważny";
      if (status === "wygasa") return "Wygasa";
      if (status === "niewazny") return "Nieważny";
      return status;
    }

    row.innerHTML = `
      <div class="dokumentDiv1">${d.typ_dokumentu}</div>
      <div class="dokumentDiv2">${d.typ_wlasciciela}: ${przypisanieNazwa}</div>
      <div class="dokumentDiv3">${d.data_waznosci}</div>
      <div class="dokumentDiv4" class="status"> <div class="status-text" style="background-color:${kolor}; border: 2px solid ${borderKolor}; font-weight:bold">${statusLabel(d.status)}</div></div>
      <div class="dokumentDiv5">
        <button data-view="viewSzczegolyDokumentu" data-id="${d.id}" data-title="Szczegóły dokumentu"><i class="fa-regular fa-eye"></i>Szczegóły</button>
      </div>
    `;

    container.appendChild(row);
  }
}

function updateDashboardTiles() {
  const wazne = dokumentyCache.filter((d) => d.status === "ok").length;
  const wygasaja = dokumentyCache.filter((d) => d.status === "wygasa").length;
  const niewazne = dokumentyCache.filter((d) => d.status === "niewazny").length;

  document.getElementById("wazneNumber").textContent = wazne;
  document.getElementById("wygasajaNumber").textContent = wygasaja;
  document.getElementById("nieWazneNumber").textContent = niewazne;
}

function statusColor(status) {
  if (status === "Ważny") return "green";
  if (status === "Wygasający") return "orange";
  return "red";
}

let filtrStatus = "Wszystkie";
let filtrTyp = "Wszystkie";

document.querySelectorAll(".filtry .buttons").forEach((group, index) => {
  group.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      group
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (index === 0) {
        filtrStatus = btn.textContent.trim();
      } else {
        filtrTyp = btn.textContent.trim();
      }

      applyFilters();
    });
  });
});

function applyFilters() {
  let wynik = dokumentyCache;

  if (filtrStatus !== "Wszystkie") {
    if (filtrStatus === "Ważne") wynik = wynik.filter((d) => d.status === "ok");
    if (filtrStatus === "Wygasające")
      wynik = wynik.filter((d) => d.status === "wygasa");
    if (filtrStatus === "Nieważne")
      wynik = wynik.filter((d) => d.status === "niewazny");
  }

  if (filtrTyp !== "Wszystkie") {
    if (filtrTyp === "Pojazdy")
      wynik = wynik.filter((d) => d.typ_wlasciciela === "Pojazd");
    if (filtrTyp === "Kierowcy")
      wynik = wynik.filter((d) => d.typ_wlasciciela === "Kierowca");
    if (filtrTyp === "Firma")
      wynik = wynik.filter((d) => d.typ_wlasciciela === "Firma");
  }

  renderDokumenty(wynik);
}

const fileInput = document.getElementById("fileInput");
const uploadBox = document.querySelector(".upload-box");

uploadBox.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    uploadBox.querySelector("p").textContent = fileInput.files[0].name;
  }
});

uploadBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadBox.classList.add("dragover");
});

uploadBox.addEventListener("dragleave", () => {
  uploadBox.classList.remove("dragover");
});

uploadBox.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadBox.classList.remove("dragover");

  const file = e.dataTransfer.files[0];
  fileInput.files = e.dataTransfer.files;

  uploadBox.querySelector("p").textContent = file.name;
});

function obliczStatusDokumentu(dataWaznosci) {
  const dzis = new Date();
  dzis.setHours(0, 0, 0, 0);

  const data = new Date(dataWaznosci);
  data.setHours(0, 0, 0, 0);

  if (data < dzis) return "niewazny";

  const roznica = Math.floor((data - dzis) / (1000 * 60 * 60 * 24));

  if (roznica <= 30) return "wygasa";

  return "ok";
}

document
  .getElementById("dokumentTypPrzypisania")
  .addEventListener("change", async () => {
    const typ = document.getElementById("dokumentTypPrzypisania").value;
    const wrapper = document.getElementById("dokumentWlascicielWrapper");
    const select = document.getElementById("dokumentWlascicielId");

    if (typ === "Firma") {
      wrapper.style.display = "none";
      select.innerHTML = "";
      return;
    }

    wrapper.style.display = "block";
    select.innerHTML = `<option>Ładowanie...</option>`;

    const {
      data: { user },
    } = await client.auth.getUser();

    const { data: firma } = await client
      .from("FIRMA")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (typ === "Pojazd") {
      const { data: pojazdy } = await client
        .from("POJAZD")
        .select("id, numer_rejestracyjny")
        .eq("firma_id", firma.id);

      select.innerHTML = pojazdy
        .map((p) => `<option value="${p.id}">${p.numer_rejestracyjny}</option>`)
        .join("");

      document.getElementById("dokumentWlascicielText").innerText =
        "Wybierz pojazd";
    }

    if (typ === "Kierowca") {
      const { data: kierowcy } = await client
        .from("KIEROWCA")
        .select("id, imie_nazwisko")
        .eq("firma_id", firma.id);

      select.innerHTML = kierowcy
        .map((k) => `<option value="${k.id}">${k.imie_nazwisko}</option>`)
        .join("");

      document.getElementById("dokumentWlascicielText").innerText =
        "Wybierz właściciela";
    }
  });

async function dodajDokumentFromForm() {
  const nazwa = document.getElementById("dokumentNazwa").value.trim();
  const dataWaznosci = document.getElementById("dokumentDataWaznosci").value;
  const typPrzypisania = document.getElementById(
    "dokumentTypPrzypisania",
  ).value;
  const file = document.getElementById("fileInput").files[0];

  if (!(await can("canManageDocuments"))) {
    return showAlert(false, "Nie masz uprawnień do dodawania dokumentów");
  }

  if (!nazwa) return showAlert(false, "Podaj nazwę dokumentu");
  if (!dataWaznosci) return showAlert(false, "Podaj datę ważności");

  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: firma } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  let wlascicielId;

  if (typPrzypisania === "Firma") {
    wlascicielId = firma.id;
  } else {
    wlascicielId = document.getElementById("dokumentWlascicielId").value;
  }

  let fileUrl = null;

  if (file) {
    const filePath = `firma_${firma.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await client.storage
      .from("dokumenty")
      .upload(filePath, file);

    if (uploadError) {
      console.error(uploadError);
      return showAlert(false, "Błąd podczas przesyłania pliku");
    }

    const { data: urlData } = client.storage
      .from("dokumenty")
      .getPublicUrl(filePath);

    fileUrl = urlData.publicUrl;
  }

  const status = obliczStatusDokumentu(dataWaznosci);

  const { error: insertError } = await client.from("DOKUMENT").insert({
    firma_id: firma.id,
    typ_wlasciciela: typPrzypisania,
    wlasciciel_id: wlascicielId,
    typ_dokumentu: nazwa,
    data_waznosci: dataWaznosci,
    status: status,
    plik_url: fileUrl,
  });

  if (insertError) {
    console.error(insertError);
    return showAlert(false, "Błąd podczas zapisywania dokumentu");
  }

  await showView("viewDokumenty", "Dokumenty");

  updateDashboardTiles();

  document.getElementById("dokumentNazwa").value = "";
  document.getElementById("dokumentDataWaznosci").value = "";
  document.getElementById("dokumentTypPrzypisania").value = "Pojazd";
  document.getElementById("fileInput").value = "";

  document.getElementById("dokumentWlascicielWrapper").style.display = "none";
  document.getElementById("dokumentWlascicielId").innerHTML = "";
  document.getElementById("dokumentNazwa").value = "";
  document.getElementById("dokumentDataWaznosci").value = "";
  document.getElementById("dokumentTypPrzypisania").value = "Pojazd";
  document.getElementById("fileInput").value = "";

  document.getElementById("dokumentWlascicielWrapper").style.display = "none";
  document.getElementById("dokumentWlascicielId").innerHTML = "";
}

function dniDoWygasniecia(data) {
  const dzis = new Date();
  dzis.setHours(0, 0, 0, 0);

  const termin = new Date(data);
  termin.setHours(0, 0, 0, 0);

  return Math.floor((termin - dzis) / (1000 * 60 * 60 * 24));
}

async function buildTile(d) {
  let przypisanieNazwa = "";

  if (d.typ_wlasciciela === "Pojazd") {
    const { data } = await client
      .from("POJAZD")
      .select("numer_rejestracyjny")
      .eq("id", d.wlasciciel_id)
      .single();
    przypisanieNazwa = data?.numer_rejestracyjny || "—";
  }

  if (d.typ_wlasciciela === "Kierowca") {
    const { data } = await client
      .from("KIEROWCA")
      .select("imie_nazwisko")
      .eq("id", d.wlasciciel_id)
      .single();
    przypisanieNazwa = data?.imie_nazwisko || "—";
  }

  if (d.typ_wlasciciela === "Firma") {
    const { data } = await client
      .from("FIRMA")
      .select("nazwa")
      .eq("id", d.wlasciciel_id)
      .single();
    przypisanieNazwa = data?.nazwa || "Firma";
  }

  const tile = document.createElement("div");
  tile.classList.add("tile");

  tile.innerHTML = `
    <div class="info">
      <p class="infoBold">${d.typ_dokumentu}</p>
      <p>${d.typ_wlasciciela}: ${przypisanieNazwa}</p>
    </div>
    <div class="terminWygasniecia" id="statusBox"></div>
  `;

  return tile;
}

async function renderNadchodzaceTerminy() {
  const requestId = ++currentRenderRequestId;
  const container = document.getElementById("nadchodzaceTiles");
  container.innerHTML = "";

  const lista = dokumentyCache.filter((d) => {
    const dni = dniDoWygasniecia(d.data_waznosci);
    return dni <= 30;
  });

  if (lista.length === 0) {
    container.innerHTML = `<p>Brak nadchodzących terminów.</p>`;
    return;
  }

  for (const d of lista) {
    if (requestId !== currentRenderRequestId) {
      return;
    }

    const tile = await buildTile(d);

    if (requestId !== currentRenderRequestId) {
      return;
    }

    const dni = dniDoWygasniecia(d.data_waznosci);
    const statusBox = tile.querySelector("#statusBox");

    if (dni <= 0) {
      tile.classList.add("expired");
      statusBox.innerHTML = `<p>Nieważny</p>`;
    } else {
      tile.classList.add("expireSoon");
      statusBox.innerHTML = `<p>Wygasa: ${d.data_waznosci}</p>`;
    }

    container.appendChild(tile);
  }
}

async function dodajUżytkownikaFromForm() {
  const email = document.getElementById("użytkownikMail").value.trim();
  const rola = document.getElementById("selectTypUżytkownika").value;
  const haslo = document.getElementById("użytkownikHaslo").value.trim();

  if (!email) return showAlert(false, "Podaj adres e-mail");
  if (!haslo) return showAlert(false, "Podaj hasło tymczasowe");
  if (haslo.length < 6)
    return showAlert(false, "Hasło musi mieć co najmniej 6 znaków");

  if (!(await can("canManageUsers"))) {
    return showAlert(false, "Nie masz uprawnień do dodawania użytkowników");
  }

  const {
    data: { user: owner },
    error: ownerError,
  } = await client.auth.getUser();

  if (ownerError || !owner) {
    console.error(ownerError);
    return showAlert(false, "Nie udało się pobrać zalogowanego użytkownika");
  }

  const { data: firma, error: firmaError } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", owner.id)
    .single();

  if (firmaError || !firma) {
    console.error(firmaError);
    return showAlert(false, "Nie udało się pobrać firmy właściciela");
  }

  const { error: insertError } = await client.from("UZYTKOWNIK").insert({
    firma_id: firma.id,
    email: email,
    rola: rola,
    status: "zaproszony",
  });

  if (insertError) {
    console.error(insertError);
    return showAlert(false, "Błąd podczas dodawania użytkownika");
  }

  showAlert(
    true,
    "Użytkownik dodany do Twojej firmy. Ustal z nim sposób pierwszego logowania / ustawienia hasła.",
  );

  await loadUzytkownicyList();
  cancelCreateUżytkownikaFromForm();
}

let uzytkownicyCache = [];

async function loadUzytkownicyList() {
  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: firma } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data, error } = await client
    .from("UZYTKOWNIK")
    .select("*")
    .eq("firma_id", firma.id)
    .order("data_utworzenia", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  uzytkownicyCache = data;
  renderUzytkownicy(data);
}

function renderUzytkownicy(lista) {
  const container = document.getElementById("użytkownicyRows");
  container.innerHTML = "";

  lista.forEach((u) => {
    const row = document.createElement("div");
    row.classList.add("table", "table-row");

    row.innerHTML = `
      <div class="uzytkownicyDiv1">${u.email}</div>
      <div class="uzytkownicyDiv2"> <div class="${u.rola}"> ${u.rola} </div> </div>
      <div class="uzytkownicyDiv3">${u.status}</div>
      <div class="uzytkownicyDiv4">
        <button data-view="viewSzczegolyUzytkownika" data-id="${u.id}" data-title="Szczegóły użytkownika">
          <i class="fa-regular fa-eye"></i>Szczegóły
        </button>
      </div>
    `;

    container.appendChild(row);
  });
}

async function cancelCreateUżytkownikaFromForm() {
  showView("viewUżytkownicy", "Użytkownicy");
}

async function loadFirmaSettings() {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return;

  const { data: uzytkownik } = await client
    .from("UZYTKOWNIK")
    .select("firma_id")
    .eq("email", user.email)
    .maybeSingle();

  if (!uzytkownik) return;

  const { data: firma } = await client
    .from("FIRMA")
    .select("*")
    .eq("id", uzytkownik.firma_id)
    .single();

  if (!firma) return;

  document.getElementById("firmaDaneNazwa").value = firma.nazwa || "";
  document.getElementById("firmaMail").value = firma.email || "";
  document.getElementById("firmaDaneAdres").value = firma.adres || "";
  document.getElementById("firmaNIP").value = firma.nip || "";
  document.getElementById("firmaREGON").value = firma.regon || "";
  document.getElementById("firmaNumerLicencji").value =
    firma.numer_licencji || "";
  console.log(firma.nazwa);
}

async function acceptZmianyFirmy() {
  const nazwa = document.getElementById("firmaDaneNazwa").value.trim();
  const email = document.getElementById("firmaMail").value.trim();
  const adres = document.getElementById("firmaDaneAdres").value.trim();
  const nip = document.getElementById("firmaNIP").value.trim();
  const regon = document.getElementById("firmaREGON").value.trim();
  const numerLicencji = document
    .getElementById("firmaNumerLicencji")
    .value.trim();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return showAlert(false, "Brak zalogowanego użytkownika.");

  const { data: uzytkownik } = await client
    .from("UZYTKOWNIK")
    .select("firma_id")
    .eq("email", user.email)
    .maybeSingle();

  console.log("firma_id użytkownika:", uzytkownik.firma_id);

  if (!uzytkownik) return showAlert(false, "Nie znaleziono firmy użytkownika.");

  const { error } = await client
    .from("FIRMA")
    .update({
      nazwa,
      email,
      adres,
      nip,
      regon,
      numer_licencji: numerLicencji,
    })
    .eq("id", uzytkownik.firma_id);

  if (error) {
    console.error(error);
    return showAlert(false, "Nie udało się zapisać zmian.");
  }

  showAlert(true, "Zapisano zmiany.");
  showView("viewDashboard", "Pulpit");
}

function cancelZmianyFirmy() {
  showView("viewDashboard", "Pulpit");
}

async function loadUserSettings() {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return;

  const { data: uzytkownik, error } = await client
    .from("UZYTKOWNIK")
    .select("imie, nazwisko, telefon, email")
    .eq("email", user.email)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (!uzytkownik) return;

  document.getElementById("userMail").value = uzytkownik.email || "";
  document.getElementById("userImie").value = uzytkownik.imie || "";
  document.getElementById("userNazwisko").value = uzytkownik.nazwisko || "";
  document.getElementById("userTelefon").value = uzytkownik.telefon || "";
}

async function acceptZmianyUser() {
  const email = document.getElementById("userMail").value.trim();
  const imie = document.getElementById("userImie").value.trim();
  const nazwisko = document.getElementById("userNazwisko").value.trim();
  const telefon = document.getElementById("userTelefon").value.trim();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return showAlert(false, "Brak zalogowanego użytkownika.");

  const { data: uzytkownik } = await client
    .from("UZYTKOWNIK")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  if (!uzytkownik)
    return showAlert(false, "Nie znaleziono użytkownika w bazie.");

  const { error } = await client
    .from("UZYTKOWNIK")
    .update({
      email,
      imie,
      nazwisko,
      telefon,
    })
    .eq("id", uzytkownik.id);

  if (error) {
    console.error(error);
    return showAlert(false, "Nie udało się zapisać zmian.");
  }

  showAlert(true, "Zapisano zmiany.");
  showView("viewDashboard", "Pulpit");
}

function cancelZmianyUser() {
  showView("viewDashboard", "Pulpit");
}

async function acceptZmianyHasla() {
  const obecneHaslo = document.getElementById("userHaslo").value.trim();
  const noweHaslo = document.getElementById("userNoweHaslo").value.trim();
  const noweHasloPowtorz = document
    .getElementById("userNoweHasloPowtorz")
    .value.trim();

  if (noweHaslo !== noweHasloPowtorz) {
    return showAlert(false, "Nowe hasła nie są takie same.");
  }

  const hasNumber = /\d/.test(noweHaslo);
  const hasSpecial = /[^A-Za-z0-9]/.test(noweHaslo);

  if (noweHaslo.length < 10 || !hasNumber || !hasSpecial) {
    return showAlert(
      false,
      "Hasło musi mieć min. 10 znaków, zawierać cyfrę i znak specjalny.",
    );
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return showAlert(false, "Brak zalogowanego użytkownika.");

  const { error: loginError } = await client.auth.signInWithPassword({
    email: user.email,
    password: obecneHaslo,
  });

  if (loginError) {
    console.error(loginError);
    return showAlert(false, "Obecne hasło jest nieprawidłowe.");
  }

  const { error: updateError } = await client.auth.updateUser({
    password: noweHaslo,
  });

  if (updateError) {
    console.error(updateError);
    return showAlert(false, "Nie udało się zmienić hasła.");
  }

  showAlert(true, "Hasło zostało zmienione.");
  showView("viewDashboard", "Pulpit");
}

window.addEventListener("load", initApp);
