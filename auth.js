// ======================
// SUPABASE INIT
// ======================

const { createClient } = supabase;

const supabaseUrl = "https://ljgaynalrpmhqagqucdb.supabase.co";
const supabaseKey = "sb_publishable_fI4hiqkxxSqxFp0gx9E7OA_GCKQPwPt";

const client = createClient(supabaseUrl, supabaseKey);

// ======================
// SPRAWDZENIE SESJI
// ======================

async function checkSession(redirectIfLoggedIn = false) {
  const { data } = await client.auth.getUser();

  if (data.user) {
    if (redirectIfLoggedIn) {
      window.location.href = "dashboard.html";
    }
    return data.user;
  }

  return null;
}

// ======================
// WYLOGOWANIE
// ======================

async function logout() {
  await client.auth.signOut();
  window.location.href = "index.html";
}
