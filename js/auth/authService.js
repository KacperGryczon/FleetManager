import { client } from "../api/supabase.js";

export async function getCurrentUser() {
  const { data } = await client.auth.getUser();
  return data.user || null;
}

export async function getCurrentSession() {
  const { data } = await client.auth.getSession();
  return data.session || null;
}

export async function getUserRole() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const { data: userRecord } = await client
    .from("UZYTKOWNIK")
    .select("rola")
    .eq("email", currentUser.email)
    .single();

  return userRecord?.rola || null;
}

export async function getCompanyIdForUser() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const { data: companyFromUser } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (companyFromUser?.id) return companyFromUser.id;

  const { data: userRecord } = await client
    .from("UZYTKOWNIK")
    .select("firma_id")
    .eq("email", currentUser.email)
    .maybeSingle();

  return userRecord?.firma_id || null;
}

export async function checkSession(redirectIfLoggedIn = false) {
  const currentUser = await getCurrentUser();

  if (currentUser && redirectIfLoggedIn) {
    window.location.href = "dashboard.html";
  }

  return currentUser;
}

export async function logout() {
  await client.auth.signOut();
  window.location.href = "index.html";
}

export async function ensureUserHasRole() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return;

  const { data: existing } = await client
    .from("UZYTKOWNIK")
    .select("*")
    .eq("email", currentUser.email)
    .maybeSingle();

  if (existing) return;

  const { data: company } = await client
    .from("FIRMA")
    .select("id")
    .eq("user_id", currentUser.id)
    .single();

  if (!company) {
    return;
  }

  await client.from("UZYTKOWNIK").insert({
    firma_id: company.id,
    email: currentUser.email,
    rola: "Właściciel",
    status: "aktywny",
  });
}
