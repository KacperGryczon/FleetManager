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

  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: uzytkownik } = await client
    .from("UZYTKOWNIK")
    .select("*")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!uzytkownik) {
    await client.from("UZYTKOWNIK").insert({
      email: user.email,
      auth_id: user.id,
      rola: "Właściciel",
      status: "aktywny",
    });
  }

  window.location.href = "dashboard.html";
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    login();
  }
});
