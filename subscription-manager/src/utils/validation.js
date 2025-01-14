export const IsValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

export const IsValidPassword = (password) => {
  const minLen = 6;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(password);

  return (
    password.length >= minLen && hasUpper && hasLower && hasNumber && hasSpecial
  );
};

export const isValidName = (input) =>
  /^[a-zA-Zа-яА-Я0-9\s\-+\.,!]+$/.test(input);

export const isValidPrice = (input) => /^\d+(\.\d{0,2})?$/.test(input);
