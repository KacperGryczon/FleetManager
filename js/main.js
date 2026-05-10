import { client } from "./api/supabase.js";
import {
  getCurrentUser,
  ensureUserHasRole,
  getUserRole,
  getCompanyIdForUser,
} from "./auth/authService.js";
import { getMenuVisibility } from "./auth/permissionService.js";
import {
  showView,
  initMenuToggle,
  showMenu,
  hideAllMenuItems,
  showAddButtons,
} from "./ui/menuService.js";
import { showLoader, hideLoader } from "./ui/loaderService.js";
import {
  initModalHandlers,
  hideDeleteButtons,
  closeModal,
  openModal,
} from "./ui/modalService.js";
import { showAlert } from "./ui/alertService.js";
import { initPhoneMask } from "./utils/phoneMask.js";

import {
  loadAndRenderVehicles,
  populateDriverSelect,
  handleAddVehicle,
  handleDeleteVehicle,
  getVehicleDetails,
} from "./services/vehicleService.js";
import {
  loadAndRenderDrivers,
  handleAddDriver,
  handleDeleteDriver,
  getDriverDetails,
  loadAvailableDriversForUserForm,
  getDriverInfoForUserForm,
} from "./services/driverService.js";
import {
  loadDocumentsForCompany,
  renderDocuments,
  updateDocumentDashboardTiles,
  applyDocumentFilters,
  handleAddDocument,
  handleDeleteDocument,
  getDocumentDetails,
  fetchDocumentOwnerName,
  getDocumentsCache,
  setDocumentsCache,
  loadDocumentsForDriverDashboard,
} from "./services/documentService.js";
import {
  loadAndRenderUsers,
  handleAddUser,
  handleDeleteUser,
  getUserDetails,
  loadUserProfile,
  handleUpdateUserProfile,
  handleChangePassword,
  renderUserProfile,
} from "./services/userService.js";
import { renderUpcomingDocuments } from "./services/dashboardService.js";
import {
  handleCreateCompany,
  loadCompanySettings,
  handleUpdateCompanySettings,
  renderCompanySettings,
} from "./services/companyService.js";
import { getStatusLabel, getStatusColors } from "./utils/formatters.js";
import { calculateDocumentStatus } from "./utils/documentStatusCalculator.js";
import { fetchDocumentsForPublicView } from "./api/documentApi.js";
import { setupUIEventHandlers } from "./uiEventHandlers.js";
import "./globals.js";

let currentUserRole = null;

window.addEventListener("DOMContentLoaded", async () => {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  const userMailElement = document.getElementById("userInfo-userMail");
  if (userMailElement) {
    userMailElement.innerText = currentUser.email;
  }

  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await client.auth.signOut();
      window.location.href = "index.html";
    });
  }

  // Initialize menu toggle
  setTimeout(initMenuToggle, 100);

  const { data: userRecord } = await client
    .from("UZYTKOWNIK")
    .select("firma_id")
    .eq("email", currentUser.email)
    .maybeSingle();

  if (userRecord && userRecord.firma_id) {
    await showView("viewDashboard", "Pulpit", async () => {
      currentUserRole = await getUserRole();
      await applyRoleRestrictions();
      await loadDashboardData();
    });
  } else {
    await showView("viewCreateFirma", "Dodaj firmę");
  }

  currentUserRole = await getUserRole();
});

async function applyRoleRestrictions() {
  const role = await getUserRole();

  hideAllMenuItems();

  const visibleMenuIds = getMenuVisibility(role);
  showMenu(visibleMenuIds);

  if (role === "Właściciel" || role === "Administrator") {
    showAddButtons();
  }
}

async function loadDashboardData() {
  const role = await getUserRole();
  const firmaId = await getCompanyIdForUser();

  if (!firmaId) return;

  // KIEROWCA
  if (role === "Kierowca") {
    const { data: userRecord } = await client
      .from("UZYTKOWNIK")
      .select("kierowca_id")
      .eq("email", (await getCurrentUser()).email)
      .single();

    if (userRecord?.kierowca_id) {
      await loadDocumentsForDriverDashboard(userRecord.kierowca_id);
      updateDocumentDashboardTiles();
      renderUpcomingDocuments(userRecord.kierowca_id); // <-- TU
    }

    return;
  }

  // PRZEGLĄDAJĄCY
  if (role === "Przeglądający") {
    const { documents, error: docError } = await fetchDocumentsForPublicView();

    if (!docError) {
      setDocumentsCache(documents || []);
      updateDocumentDashboardTiles();
      renderUpcomingDocuments(); // <-- TU
    }

    return;
  }

  // ADMIN / WŁAŚCICIEL
  await loadDocumentsForCompany(firmaId);
  updateDocumentDashboardTiles();
  renderUpcomingDocuments(); // <-- TU
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-view]");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const viewId = btn.dataset.view;
  const title = btn.dataset.title;

  const role = await getUserRole();
  const firmaId = await getCompanyIdForUser();

  let loadCallback = null;

  if (viewId === "viewPojazdy") {
    loadCallback = () => loadAndRenderVehicles(firmaId);
  } else if (viewId === "viewDodajPojazd") {
    loadCallback = () => populateDriverSelect(firmaId);
  } else if (viewId === "viewKierowcy") {
    loadCallback = () => loadAndRenderDrivers(firmaId);
  } else if (viewId === "viewDokumenty") {
    loadCallback = async () => {
      await loadDocumentsForCompany(firmaId);
      await renderDocuments(getDocumentsCache());
      updateDocumentDashboardTiles();
    };
  } else if (viewId === "viewDashboard") {
    loadCallback = loadDashboardData;
  } else if (viewId === "viewUżytkownicy") {
    loadCallback = () => loadAndRenderUsers(firmaId);
  } else if (viewId === "viewUstawieniaFirmy") {
    loadCallback = renderCompanySettings;
  } else if (viewId === "viewUstawieniaProfilu") {
    loadCallback = renderUserProfile;
  } else if (viewId === "viewMojePojazdy") {
    loadCallback = async () => {
      const authUser = await client.auth.getUser();
      const user = authUser.data.user;

      if (!user) return;

      // 1. Pobierz rekord użytkownika z bazy
      const { data: userRecord, error: userError } = await client
        .from("UZYTKOWNIK")
        .select("kierowca_id")
        .eq("auth_id", user.id)
        .single();

      if (userError || !userRecord || !userRecord.kierowca_id) {
        console.warn("Brak kierowca_id dla użytkownika");
        return;
      }

      const kierowcaId = userRecord.kierowca_id;

      // 2. Pobierz pojazdy przypisane do kierowcy
      const { data: vehicles, error: vehError } = await client
        .from("POJAZD")
        .select("*")
        .eq("przypisany_kierowca_id", kierowcaId);

      const container = document.getElementById("mojePojazdyRows");
      if (!container) return;

      container.innerHTML = "";

      if (vehError || !vehicles || vehicles.length === 0) {
        container.innerHTML = `
        <div class="brakPojazdow">
          <p>Nie masz żadnych przypisanych pojazdów.</p>
        </div>
      `;
        return;
      }

      vehicles.forEach((vehicle) => {
        const row = document.createElement("div");
        row.classList.add("table", "table-row");
        row.innerHTML = `
        <div>${vehicle.numer_rejestracyjny}</div>
        <div>${vehicle.marka}</div>
        <div>${vehicle.model}</div>
        <div>
          <button data-details="pojazd" data-id="${vehicle.id}">
            <i class="fa-regular fa-eye"></i>Szczegóły
          </button>
        </div>
      `;
        container.appendChild(row);
      });
    };
  } else if (viewId === "viewMojeDokumenty") {
    loadCallback = async () => {
      const authUser = await client.auth.getUser();
      const user = authUser.data.user;
      if (!user) return;

      const { data: userRecord } = await client
        .from("UZYTKOWNIK")
        .select("kierowca_id")
        .eq("auth_id", user.id)
        .single();

      const kierowcaId = userRecord?.kierowca_id;
      if (!kierowcaId) return;

      const { data: driverDocs } = await client
        .from("DOKUMENT")
        .select("*")
        .eq("typ_wlasciciela", "Kierowca")
        .eq("wlasciciel_id", kierowcaId);

      const { data: vehicles } = await client
        .from("POJAZD")
        .select("id, numer_rejestracyjny")
        .eq("przypisany_kierowca_id", kierowcaId);

      const vehicleIds = vehicles.map((v) => v.id);

      let vehicleDocs = [];
      if (vehicleIds.length > 0) {
        const { data } = await client
          .from("DOKUMENT")
          .select("*")
          .eq("typ_wlasciciela", "Pojazd")
          .in("wlasciciel_id", vehicleIds);

        vehicleDocs = data || [];
      }

      const documents = [...driverDocs, ...vehicleDocs];

      const container = document.getElementById("mojeDokumentyRows");
      container.innerHTML = "";

      if (documents.length === 0) {
        container.innerHTML = `
        <div class="brakPojazdow">
          <p>Nie masz żadnych dokumentów.</p>
        </div>
      `;
        return;
      }

      documents.forEach((doc) => {
        const row = document.createElement("div");
        row.classList.add("table", "table-row");

        // 🔥 NAJPIERW definiujemy zmienne
        const nazwa = doc.nazwa_dokumentu || doc.typ_dokumentu || "Dokument";

        const wlasciciel =
          doc.typ_wlasciciela === "Kierowca"
            ? "Ty"
            : vehicles.find((v) => v.id === doc.wlasciciel_id)
                ?.numer_rejestracyjny || "Pojazd";

        const wygasa = doc.data_waznosci || "-";

        const label = getStatusLabel(doc.status);
        const colors = getStatusColors(doc.status);

        // 🔥 Dopiero teraz generujemy HTML
        row.innerHTML = `
    <div>${nazwa}</div>
    <div>${wlasciciel}</div>
    <div>${wygasa}</div>
    <div>
      <span class="status-text" 
        style="
          background-color:${colors.background};
          border:2px solid ${colors.border};
          font-weight:bold;
          border-radius: 16px;
          padding: 8px 16px;
          text-align: center;
          display: inline-block;
        ">
        ${label}
      </span>
    </div>
    <div>
      <button data-details="dokument" data-id="${doc.id}">
        <i class="fa-regular fa-eye"></i>Szczegóły
      </button>
    </div>
  `;

        container.appendChild(row);
      });
    };
  }

  await showView(viewId, title, loadCallback);
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-details]");
  if (!btn) return;

  const id = btn.dataset.id;
  const type = btn.dataset.details;

  if (type === "pojazd") {
    const vehicle = await getVehicleDetails(id);
    if (vehicle) {
      const driverName = vehicle.KIEROWCA?.imie_nazwisko || "Brak";

      const modal = document.getElementById("detailsModal");
      if (modal) {
        modal.dataset.pojazdId = id;
      }

      openModal(`
        <div class="markaModel">
          <h2>${vehicle.numer_rejestracyjny}</h2>
          <p>${vehicle.marka} ${vehicle.model}</p>
        </div>
        <div class="danePojazdu">
          <div class="danePojazduTile">
            <p>Typ pojazdu</p>
            <h3>${vehicle.typ}</h3>
          </div>
          <div class="danePojazduTile">
            <p>Rok produkcji</p>
            <h3>${vehicle.rok_produkcji}</h3>
          </div>
          <div class="danePojazduTile">
            <p>Numer VIN</p>
            <h3>${vehicle.vin}</h3>
          </div>
          <div class="danePojazduTile">
            <p>Marka i model</p>
            <h3>${vehicle.marka} ${vehicle.model}</h3>
          </div>
        </div>
        <p class="przypisanyKierowcaP">Przypisany kierowca</p>
        <div id="przypisanyKierowcaModal" class="przypisanyKierowca">
          <h3>${driverName}</h3>
        </div>
        <button class="usunPojazdBtn" onclick="window.deleteVehicleHandler()">
          <i class="fa-solid fa-trash"></i>Usuń pojazd
        </button>
      `);

      hideDeleteButtons(currentUserRole);
    }
  } else if (type === "kierowca") {
    const driver = await getDriverDetails(id);
    if (driver) {
      const modal = document.getElementById("detailsModal");
      if (modal) {
        modal.dataset.kierowcaId = id;
      }

      openModal(`
        <div class="markaModel">
          <h2>${driver.imie_nazwisko}</h2>
          <p>Kierowca</p>
        </div>
        <p class="przypisanyKierowcaP">Adres email</p>
        <div class="przypisanyKierowca">
          <h3>${driver.email || "Brak"}</h3>
        </div>
        <p class="przypisanyKierowcaP">Numer telefonu</p>
        <div class="przypisanyKierowca">
          <h3>${driver.telefon || "Brak"}</h3>
        </div>
        <button class="usunPojazdBtn" onclick="window.deleteDriverHandler()">
          <i class="fa-solid fa-trash"></i>Usuń kierowcę
        </button>
      `);

      hideDeleteButtons(currentUserRole);
    }
  } else if (type === "dokument") {
    const doc = await getDocumentDetails(id);
    if (doc) {
      const ownerName = await fetchDocumentOwnerName(doc);
      const { background, border } = getStatusColors(doc.status);

      const modal = document.getElementById("detailsModal");
      if (modal) {
        modal.dataset.dokumentId = id;
      }

      const downloadLink = doc.plik_url
        ? `<a class="pobierzPlik" href="${doc.plik_url}" target="_blank"><i class="fa-solid fa-arrow-up-from-bracket"></i>Pobierz plik</a>`
        : "";

      openModal(`
        <div class="markaModel">
          <h2>${doc.typ_dokumentu}</h2>
          <div>
            <div class="status-text" style="background-color:${background}; border: 2px solid ${border}; font-weight:bold">
              ${getStatusLabel(doc.status)}
            </div>
          </div>
        </div>
        <div class="danePojazdu">
          <div class="danePojazduTile">
            <p>Typ dokumentu</p>
            <h3>${doc.typ_wlasciciela}</h3>
          </div>
          <div class="danePojazduTile">
            <p>Data wygaśnięcia</p>
            <h3>${doc.data_waznosci}</h3>
          </div>
        </div>
        <p class="przypisanyKierowcaP">Przypisany do</p>
        <div id="przypisanyKierowcaModal" class="przypisanyKierowca">
          <h3>${ownerName}</h3>
        </div>
        ${downloadLink}
        <button class="usunPojazdBtn" onclick="window.deleteDocumentHandler()">
          <i class="fa-solid fa-trash"></i>Usuń dokument
        </button>
      `);

      hideDeleteButtons(currentUserRole);
    }
  } else if (type === "uzytkownik") {
    const user = await getUserDetails(id);
    if (user) {
      const deleteBtn =
        user.rola === "Właściciel"
          ? ""
          : `<button class="usunPojazdBtn" onclick="window.deleteUserHandler()"><i class="fa-solid fa-trash"></i>Usuń użytkownika</button>`;

      const modal = document.getElementById("detailsModal");
      if (modal) {
        modal.dataset.uzytkownikId = id;
      }

      openModal(`
        <div class="markaModel">
          <h2>${user.email}</h2>
          <p class="${user.rola}">${user.rola}</p>
        </div>
        <div class="danePojazdu">
          <div class="danePojazduTile">
            <p>Rola</p>
            <h3>${user.rola}</h3>
          </div>
          <div class="danePojazduTile">
            <p>Status</p>
            <h3>${user.status}</h3>
          </div>
          <div class="danePojazduTile">
            <p>Dane osobowe</p>
            <h3>${user.imie && user.nazwisko ? `${user.imie} ${user.nazwisko}` : "Brak"}</h3>
          </div>
        </div>
        <p class="przypisanyKierowcaP">Firma</p>
        <div class="przypisanyKierowca">
          <h3>${user.FIRMA?.nazwa || "Brak"}</h3>
        </div>
        ${deleteBtn}
      `);
    }
  }
});

window.deleteVehicleHandler = async () => {
  const modal = document.getElementById("detailsModal");
  const vehicleId = modal?.dataset.pojazdId;

  if (!vehicleId) {
    showAlert(false, "Nie znaleziono ID pojazdu");
    return;
  }

  if (await handleDeleteVehicle(vehicleId)) {
    closeModal();
    const firmaId = await getCompanyIdForUser();
    await loadAndRenderVehicles(firmaId);
  }
};

window.deleteDriverHandler = async () => {
  const modal = document.getElementById("detailsModal");
  const driverId = modal?.dataset.kierowcaId;

  if (!driverId) {
    showAlert(false, "Nie znaleziono ID kierowcy");
    return;
  }

  if (await handleDeleteDriver(driverId)) {
    closeModal();
    const firmaId = await getCompanyIdForUser();
    await loadAndRenderDrivers(firmaId);
  }
};

window.deleteDocumentHandler = async () => {
  const modal = document.getElementById("detailsModal");
  const documentId = modal?.dataset.dokumentId;

  if (!documentId) {
    showAlert(false, "Nie znaleziono ID dokumentu");
    return;
  }

  if (await handleDeleteDocument(documentId)) {
    closeModal();
    const firmaId = await getCompanyIdForUser();
    await loadDocumentsForCompany(firmaId);
    await renderDocuments(getDocumentsCache());
    updateDocumentDashboardTiles();
  }
};

window.deleteUserHandler = async () => {
  const modal = document.getElementById("detailsModal");
  const userId = modal?.dataset.uzytkownikId;

  if (!userId) {
    showAlert(false, "Nie znaleziono ID użytkownika");
    return;
  }

  if (await handleDeleteUser(userId)) {
    closeModal();
    const firmaId = await getCompanyIdForUser();
    await loadAndRenderUsers(firmaId);
  }
};

document.addEventListener("click", async (e) => {
  const role = await getUserRole();

  if (role === "Przeglądający") {
    if (e.target.closest(".addButton")) {
      e.preventDefault();
      showAlert(
        false,
        "Nie masz uprawnień do dodawania ani modyfikowania danych.",
      );
      return;
    }
  }
});

window.addEventListener("load", async () => {
  await ensureUserHasRole();
  await applyRoleRestrictions();

  initModalHandlers();
  initPhoneMask("kierowcaTelefon");
  initPhoneMask("userTelefon");

  setupUIEventHandlers();

  const filterButtons = document.querySelectorAll(".filtry .buttons button");
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.parentElement;
      group
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyDocumentFilters();
    });
  });

  const fileInput = document.getElementById("fileInput");
  const uploadBox = document.querySelector(".upload-box");

  if (uploadBox && fileInput) {
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
  }
});

window.addEventListener("unload", () => {
  hideLoader();
});
