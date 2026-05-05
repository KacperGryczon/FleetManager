async function register() {
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmed = document.getElementById("confirmed_password").value;
  const errorBox = document.getElementById("register_error");

  errorBox.style.color = "red";
  errorBox.innerText = "";

  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (password.length < 10 || !hasNumber || !hasSpecial) {
    errorBox.innerText =
      "Hasło musi mieć min. 10 znaków, cyfrę i znak specjalny.";
    return;
  }

  if (password !== confirmed) {
    errorBox.innerText = "Hasła się nie zgadzają.";
    return;
  }

  const { data: userRow, error: userRowError } = await client
    .from("UZYTKOWNIK")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  const isOwnerRegistration = !userRow;

  const { data: signupData, error: signupError } = await client.auth.signUp({
    email,
    password,
  });

  if (signupError) {
    console.error(signupError);
    errorBox.innerText = "Nie udało się utworzyć konta.";
    return;
  }

  if (isOwnerRegistration) {
    await client.from("UZYTKOWNIK").insert({
      email,
      rola: "Właściciel",
      status: "aktywny",
    });

    errorBox.style.color = "green";
    errorBox.innerText =
      "Konto właściciela utworzone. Zaloguj się i utwórz firmę.";
    return;
  }

  if (userRow.status === "zaproszony") {
    await client
      .from("UZYTKOWNIK")
      .update({ status: "aktywny" })
      .eq("email", email);

    errorBox.style.color = "green";
    errorBox.innerText = "Konto aktywowane. Możesz się zalogować.";
    return;
  }

  errorBox.innerText =
    "Nie możesz założyć konta. Skontaktuj się z administratorem.";
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    register();
  }
});
