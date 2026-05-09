import {
  fetchCompanyById,
  createCompany,
  updateCompany,
} from "../api/companyApi.js";
import { showAlert } from "../ui/alertService.js";
import { validateEmail } from "../utils/validators.js";
import { client } from "../api/supabase.js";
import { getCurrentUser, getCompanyIdForUser } from "../auth/authService.js";

export async function handleCreateCompany(companyName, companyEmail) {
  if (!companyName || !companyName.trim()) {
    showAlert(false, "Podaj nazwę firmy.");
    return false;
  }

  if (!validateEmail(companyEmail)) {
    showAlert(false, "Podaj poprawny adres email.");
    return false;
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    showAlert(false, "Brak zalogowanego użytkownika.");
    return false;
  }

  const { error } = await createCompany({
    nazwa: companyName,
    email: companyEmail,
    user_id: currentUser.id,
  });

  if (error) {
    showAlert(false, "Nie udało się dodać firmy.");
    return false;
  }

  showAlert(true, "Firma została dodana.");
  return true;
}

export async function loadCompanySettings() {
  const currentUser = await getCurrentUser();

  if (!currentUser) return null;

  const companyId = await getCompanyIdForUser();

  if (!companyId) return null;

  const { company, error } = await fetchCompanyById(companyId);

  if (error) return null;

  return company;
}

export async function handleUpdateCompanySettings(companyData) {
  const companyId = await getCompanyIdForUser();

  if (!companyId) {
    showAlert(false, "Nie znaleziono firmy użytkownika.");
    return false;
  }

  const { error } = await updateCompany(companyId, companyData);

  if (error) {
    showAlert(false, "Nie udało się zapisać zmian.");
    return false;
  }

  showAlert(true, "Zapisano zmiany.");
  return true;
}
