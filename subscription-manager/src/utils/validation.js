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

export function isValidTag(tag) {
  // Разрешаем пустую строку
  if (!tag || tag.trim() === "") {
    return true; // пустой тег считается валидным
  }
  // Проверяем длину
  if (tag.length > 20) {
    return false;
  }
  // Проверяем, нет ли пробелов (если хотим, чтобы тег был одним словом)
  if (/\s/.test(tag)) {
    return false;
  }

  return true;
}
