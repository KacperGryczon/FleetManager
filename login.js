document.addEventListener("DOMContentLoaded", async () => {
  await checkSession(true); // jeśli zalogowany → dashboard
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    login();
  }
});

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const login_error = document.getElementById("login_error");

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    login_error.innerText = "Niepoprawne hasło albo email.";
    return;
  }

  window.location.href = "dashboard.html";
}
