async function register() {
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmed = document.getElementById("confirmed_password").value;
  const errorBox = document.getElementById("register_error");

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

  const { error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    errorBox.innerText = "Nie udało się utworzyć konta.";
    return;
  }

  errorBox.style.color = "green";
  errorBox.innerText =
    "Konto utworzone. Sprawdź maila i potwierdź rejestrację.";
}
