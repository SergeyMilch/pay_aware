/** Функция для склонения (дней, месяцев, лет) */
export function declOfNum(number, titles) {
  number = Math.abs(number);
  const n = number % 100;
  if (n >= 5 && n <= 20) {
    return titles[2]; // «дней», «месяцев», «лет»
  }
  const n1 = number % 10;
  if (n1 === 1) {
    return titles[0]; // «день», «месяц», «год»
  }
  if (n1 >= 2 && n1 <= 4) {
    return titles[1]; // «дня», «месяца», «года»
  }
  return titles[2];
}

/**
 * getNextPaymentText(dateString, currentTime)
 *  - Возвращает строку типа "Платёж сегодня", "До платежа осталось 2 дня" и т.п.
 *  - currentTime нужен, чтобы при изменении currentTime (в нашем setInterval) пересчитывать.
 */
export function getNextPaymentText(dateString, currentTime = new Date()) {
  if (!dateString) return "Нет данных о платеже";

  const nextPayment = new Date(dateString);
  // Разница в миллисекундах
  const diffMs = nextPayment.setHours(23, 59, 59, 999) - currentTime;
  // Можно «округлить» дату платежа, например, до конца дня, чтобы если сегодня, то считалось "сегодня"

  // diffMs < 0 → дата уже прошла
  if (diffMs < 0) {
    return "Платёж уже прошёл";
  }

  // Посмотрим, не является ли этот день "сегодня"
  // Для упрощения можно считать: если год, месяц, дата совпадают — это сегодня
  const isSameDay =
    nextPayment.getDate() === currentTime.getDate() &&
    nextPayment.getMonth() === currentTime.getMonth() &&
    nextPayment.getFullYear() === currentTime.getFullYear();

  if (isSameDay) {
    return "Платёж сегодня";
  }

  // Если не сегодня, считаем разницу в днях (округлим вверх)
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Если diffDays == 1, значит завтра
  if (diffDays === 1) {
    return "Платёж завтра";
  }

  // Дальше обычная логика: дни, месяцы, годы
  if (diffDays < 31) {
    // «До платежа осталось X день/дня/дней»
    const dWord = declOfNum(diffDays, ["день", "дня", "дней"]);
    return `До платежа осталось ${diffDays} ${dWord}`;
  } else if (diffDays < 365) {
    // Месяцы
    const diffMonths = Math.ceil(diffDays / 30);
    const mWord = declOfNum(diffMonths, ["месяц", "месяца", "месяцев"]);
    return `До платежа осталось ${diffMonths} ${mWord}`;
  } else {
    // Годы (примерно)
    const diffYears = Math.ceil(diffDays / 365);
    const yWord = declOfNum(diffYears, ["год", "года", "лет"]);
    return `До платежа осталось ${diffYears} ${yWord}`;
  }
}
