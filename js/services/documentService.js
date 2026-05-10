import {
  fetchDocuments,
  fetchDocumentsForDriver,
  fetchDocumentsForVehicles,
  fetchDocumentById,
  fetchVehicleNameForDocument,
  fetchDriverNameForDocument,
  fetchCompanyNameForDocument,
  createDocument,
  uploadDocumentFile,
  getDocumentFileUrl,
  deleteDocument,
  fetchDocumentsForPublicView,
  fetchVehiclesForPublicView,
  fetchDriversForPublicView,
} from "../api/documentApi.js";
import { fetchVehiclesForDriver } from "../api/vehicleApi.js";
import { showAlert } from "../ui/alertService.js";
import { calculateDocumentStatus } from "../utils/documentStatusCalculator.js";
import { getStatusLabel, getStatusColors } from "../utils/formatters.js";
import { validateDocumentDate } from "../utils/validators.js";
import { can } from "../auth/permissionService.js";

let dokumentyCache = [];

export function getDocumentsCache() {
  return dokumentyCache;
}

export function setDocumentsCache(documents) {
  dokumentyCache = documents;
}

export async function loadDocumentsForCompany(firmaId) {
  const { documents, error } = await fetchDocuments(firmaId);

  if (error) {
    return false;
  }

  dokumentyCache = documents || [];
  return true;
}

export async function loadDocumentsForDriverDashboard(kierowcaId) {
  const { documents: driverDocuments, error: driverError } =
    await fetchDocumentsForDriver(kierowcaId);

  if (driverError) {
    return false;
  }

  const { vehicles, error: vehicleError } =
    await fetchVehiclesForDriver(kierowcaId);

  if (vehicleError) {
    return false;
  }

  const vehicleIds = vehicles.map((v) => v.id);

  let vehicleDocuments = [];
  if (vehicleIds.length > 0) {
    const { documents: vDocs, error: vError } =
      await fetchDocumentsForVehicles(vehicleIds);

    if (!vError) {
      vehicleDocuments = vDocs || [];
    }
  }

  const allDocuments = [...driverDocuments, ...vehicleDocuments];

  setDocumentsCache(allDocuments);

  return true;
}

export async function renderDocuments(documentList) {
  const container = document.getElementById("dokumentyRows");
  if (!container) return;

  container.innerHTML = "";

  const dokumentyCount = document.querySelector(".dokumentyCount");
  if (dokumentyCount) {
    dokumentyCount.textContent = `(${documentList.length})`;
  }

  if (documentList.length === 0) {
    container.innerHTML = `<p>Brak dokumentów spełniających kryteria filtrów.</p>`;
    return;
  }

  for (const doc of documentList) {
    let ownerName = "";

    if (doc.typ_wlasciciela === "Pojazd") {
      const { name } = await fetchVehicleNameForDocument(doc.wlasciciel_id);
      ownerName = name;
    } else if (doc.typ_wlasciciela === "Kierowca") {
      const { name } = await fetchDriverNameForDocument(doc.wlasciciel_id);
      ownerName = name;
    } else if (doc.typ_wlasciciela === "Firma") {
      const { name } = await fetchCompanyNameForDocument(doc.wlasciciel_id);
      ownerName = name;
    }

    const { background, border } = getStatusColors(doc.status);

    const row = document.createElement("div");
    row.classList.add("table", "table-row");
    row.innerHTML = `
      <div class="dokumentDiv1">${doc.typ_dokumentu}</div>
      <div class="dokumentDiv2">${doc.typ_wlasciciela}: ${ownerName}</div>
      <div class="dokumentDiv3">${doc.data_waznosci}</div>
      <div class="dokumentDiv4">
        <div class="status-text" style="background-color:${background}; border: 2px solid ${border}; font-weight:bold">
          ${getStatusLabel(doc.status)}
        </div>
      </div>
      <div class="dokumentDiv5">
        <button data-details="dokument" data-id="${doc.id}">
          <i class="fa-regular fa-eye"></i>Szczegóły
        </button>
      </div>
    `;

    container.appendChild(row);
  }
}

export function updateDocumentDashboardTiles() {
  const validCount = dokumentyCache.filter((d) => d.status === "ok").length;
  const expiringCount = dokumentyCache.filter(
    (d) => d.status === "wygasa",
  ).length;
  const expiredCount = dokumentyCache.filter(
    (d) => d.status === "niewazny",
  ).length;

  const validElement = document.getElementById("wazneNumber");
  const expiringElement = document.getElementById("wygasajaNumber");
  const expiredElement = document.getElementById("nieWazneNumber");

  if (validElement) validElement.textContent = validCount;
  if (expiringElement) expiringElement.textContent = expiringCount;
  if (expiredElement) expiredElement.textContent = expiredCount;
}

export function getDocumentFiltersApplied() {
  const groups = document.querySelectorAll(".filtry .buttons");

  const statusFilter = groups[0]?.querySelector(".active");
  const typeFilter = groups[1]?.querySelector(".active");

  return {
    status: statusFilter ? statusFilter.textContent.trim() : "Wszystkie",
    type: typeFilter ? typeFilter.textContent.trim() : "Wszystkie",
  };
}

export function applyDocumentFilters() {
  const filters = getDocumentFiltersApplied();
  let filteredDocuments = dokumentyCache;

  if (filters.status !== "Wszystkie") {
    if (filters.status === "Ważne") {
      filteredDocuments = filteredDocuments.filter((d) => d.status === "ok");
    } else if (filters.status === "Wygasające") {
      filteredDocuments = filteredDocuments.filter(
        (d) => d.status === "wygasa",
      );
    } else if (filters.status === "Nieważne") {
      filteredDocuments = filteredDocuments.filter(
        (d) => d.status === "niewazny",
      );
    }
  }

  if (filters.type !== "Wszystkie") {
    if (filters.type === "Pojazdy") {
      filteredDocuments = filteredDocuments.filter(
        (d) => d.typ_wlasciciela === "Pojazd",
      );
    } else if (filters.type === "Kierowcy") {
      filteredDocuments = filteredDocuments.filter(
        (d) => d.typ_wlasciciela === "Kierowca",
      );
    } else if (filters.type === "Firma") {
      filteredDocuments = filteredDocuments.filter(
        (d) => d.typ_wlasciciela === "Firma",
      );
    }
  }

  renderDocuments(filteredDocuments);
}

export async function handleAddDocument(documentFormData, firmaId) {
  const { nazwa, dataWaznosci, typPrzypisania, file, wlascicielId } =
    documentFormData;

  if (!(await can("canManageDocuments"))) {
    showAlert(false, "Nie masz uprawnień do dodawania dokumentów");
    return false;
  }

  if (!nazwa) {
    showAlert(false, "Podaj nazwę dokumentu");
    return false;
  }

  if (!dataWaznosci) {
    showAlert(false, "Podaj datę ważności");
    return false;
  }

  const today = new Date().toISOString().split("T")[0];

  if (!validateDocumentDate(dataWaznosci, today)) {
    showAlert(false, "Data ważności nie może być starsza niż dzisiaj");
    return false;
  }

  let finalOwnerId = wlascicielId;

  if (typPrzypisania === "Firma") {
    finalOwnerId = firmaId;
  }

  if (!finalOwnerId) {
    showAlert(false, "Wybierz właściciela dokumentu");
    return false;
  }

  let fileUrl = null;

  if (file) {
    const filePath = `firma_${firmaId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await uploadDocumentFile(filePath, file);

    if (uploadError) {
      showAlert(false, "Błąd podczas przesyłania pliku");
      return false;
    }

    fileUrl = getDocumentFileUrl(filePath);
  }

  const status = calculateDocumentStatus(dataWaznosci);

  const { error } = await createDocument({
    firma_id: firmaId,
    typ_wlasciciela: typPrzypisania,
    wlasciciel_id: finalOwnerId,
    typ_dokumentu: nazwa,
    data_waznosci: dataWaznosci,
    status: status,
    plik_url: fileUrl,
  });

  if (error) {
    showAlert(false, "Błąd podczas zapisywania dokumentu");
    return false;
  }

  // 🔥 ZAMIAST DODAWAĆ RĘCZNIE → PRZEŁADUJEMY DANE
  await loadDocumentsForCompany(firmaId);

  updateDocumentDashboardTiles();
  applyDocumentFilters();

  import("./dashboardService.js").then(({ renderUpcomingDocuments }) => {
    renderUpcomingDocuments();
  });

  showAlert(true, "Dokument został dodany");
  return true;
}

export async function handleDeleteDocument(documentId) {
  const { error } = await deleteDocument(documentId);

  if (error) {
    showAlert(false, "Nie udało się usunąć dokumentu");
    return false;
  }

  showAlert(true, "Dokument został usunięty");
  return true;
}

export async function getDocumentDetails(documentId) {
  const { document, error } = await fetchDocumentById(documentId);

  if (error) {
    showAlert(false, "Nie znaleziono dokumentu");
    return null;
  }

  return document;
}

export async function fetchDocumentOwnerName(document) {
  if (document.typ_wlasciciela === "Pojazd") {
    const { name } = await fetchVehicleNameForDocument(document.wlasciciel_id);
    return name;
  } else if (document.typ_wlasciciela === "Kierowca") {
    const { name } = await fetchDriverNameForDocument(document.wlasciciel_id);
    return name;
  } else if (document.typ_wlasciciela === "Firma") {
    const { name } = await fetchCompanyNameForDocument(document.wlasciciel_id);
    return name;
  }

  return "Brak";
}
