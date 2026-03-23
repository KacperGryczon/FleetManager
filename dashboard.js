// Zmienna globalna do śledzenia czy firma istnieje
let firmaExists = false;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await checkSession(false);

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("userInfo-userMail").innerText = user.email;

  const { data: firma } = await client
    .from("FIRMA")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  firmaExists = !!firma;

  if (!firma) {
    document.querySelectorAll(".viewButton").forEach((item) => {
      if (!item.classList.contains("always-visible")) {
        item.style.display = "none";
        document.getElementById("logoutBtn").style.display = "flex";
      }
    });

    showView("viewCreateFirma");
  } else {
    document.querySelectorAll(".viewButton").forEach((item) => {
      item.style.display = "flex";
    });

    showView("viewDashboard");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await client.auth.signOut();
  window.location.href = "index.html";
});

// FUNKCJA DO ZMIANY WIDOKÓW //
function showView(viewId, title) {
  document.querySelectorAll(".inView").forEach((v) => {
    v.style.display = "none";
  });

  document.getElementById(viewId).style.display = "flex";

  if (title) {
    document.getElementById("viewTitle").innerText = title;
  }
  if (viewId === "viewDodajPojazd") {
    loadKierowcyDoSelecta();
  }
  if (viewId === "viewPojazdy") {
    loadPojazdyList();
  }
  if (viewId === "viewKierowcy") {
    loadKierowcyList();
  }

  setActiveMenu(viewId);
}

document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    let viewId = btn.dataset.view;
    let title = btn.dataset.title;

    if (viewId === "viewDashboard" && !firmaExists) {
      viewId = "viewCreateFirma";
      title = "Dodaj firmę";
    }

    if (btn.classList.contains("viewButton")) {
      document
        .querySelectorAll(".viewButton")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }

    showView(viewId, title);
  });
});

async function createFirmaFromForm() {
  const nazwa = document.getElementById("firmaNazwa").value.trim();
  const email = document.getElementById("firmaAdres").value.trim();
  const alert = document.getElementById("alert");

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
    alert("Brak zalogowanego użytkownika.");
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
    alert("Nie udało się dodać firmy.");
    return;
  }

  showView("viewDashboard", "Pulpit");
  alert.style.display = "block";
  setTimeout(() => {
    alert.style.display = "none";
  }, 5000);
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
    alert("Brak zalogowanego użytkownika.");
    return;
  }

  const { data: firma, error: firmaError } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (firmaError || !firma) {
    alert("Nie znaleziono firmy użytkownika.");
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
    alert("Nie udało się dodać pojazdu.");
    return;
  }

  alert("Pojazd został dodany.");
  showView("viewPojazdy", "Pojazdy");
}

async function loadPojazdyList() {
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
        <button data-view="viewDodajPojazd" data-title="Dodaj pojazd">Dodaj pojazd</button>
      </div>
    `;
    return;
  }

  pojazdy.forEach((p) => {
    const kierowca = p.KIEROWCA ? p.KIEROWCA.imie_nazwisko : "-";

    const row = document.createElement("div");
    row.classList.add("table", "table-row");

    row.innerHTML = `
      <div>${p.typ}</div>
      <div>${p.numer_rejestracyjny}</div>
      <div>${p.marka} ${p.model}</div>
      <div>${kierowca}</div>
      <div class="status green">Ważny</div>
      <div>
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
    alert("Brak zalogowanego użytkownika.");
    return;
  }

  const { data: firma, error: firmaError } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (firmaError || !firma) {
    alert("Nie znaleziono firmy użytkownika.");
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
    alert("Nie udało się dodać kierowcy.");
    return;
  }

  alert("Pojazd został dodany.");
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
        <button data-view="viewDodajKierowce" data-title="Dodaj kierowcę">Dodaj kierowcę</button>
      </div>
    `;
    return;
  }

  kierowcy.forEach((k) => {
    const row = document.createElement("div");
    row.classList.add("table", "table-row");

    row.innerHTML = `
      <div>${k.imie_nazwisko}</div>
      <div>${k.telefon || "-"}</div>
      <div>${k.email || "-"}</div>
      <div class="status green">Ważny</div>
      <div>
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
