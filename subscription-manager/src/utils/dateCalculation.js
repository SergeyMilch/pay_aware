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
  // Считаем разницу в миллисекундах для «точных» дней/часов
  const diffMs = nextPayment - currentTime;

  // Если дата уже прошла
  if (diffMs < 0) {
    return "Дата платежа прошла";
  }

  // Вычислим «календарную» разницу в днях
  const currentDay = new Date(
    currentTime.getFullYear(),
    currentTime.getMonth(),
    currentTime.getDate()
  );
  const paymentDay = new Date(
    nextPayment.getFullYear(),
    nextPayment.getMonth(),
    nextPayment.getDate()
  );
  // Количество полных дней между полуночью сегодняшнего дня и полуночью дня платежа
  const diffDaysCalendar = Math.round(
    (paymentDay - currentDay) / (1000 * 60 * 60 * 24)
  );

  // - Если diffDaysCalendar === 0, значит это та же календарная дата → «сегодня»
  if (diffDaysCalendar === 0) {
    return "Платёж сегодня";
  }
  // - Если diffDaysCalendar === 1 → «завтра»
  if (diffDaysCalendar === 1) {
    return "Платёж завтра";
  }

  // Если календарная разница больше 1 или 2, используем «точное» кол-во суток
  // (либо можно продолжить в том же календарном стиле).
  // Для точности берём `Math.floor(...)` по разнице в миллисекундах:
  const diffExactDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Если diffExactDays < 31, считаем днями
  if (diffExactDays < 31) {
    // одно слово для 1 дня ("остался"), другое для остальных ("осталось")
    // вызываем функцию склонения для "день/дня/дней"
    if (diffExactDays === 1) {
      return "До платежа остался 1 день";
    } else {
      const dWord = declOfNum(diffExactDays, ["день", "дня", "дней"]);
      return `До платежа осталось ${diffExactDays} ${dWord}`;
    }
  }

  // Если diffExactDays < 365, считаем месяцами
  const diffMonths = Math.floor(diffExactDays / 30);
  if (diffExactDays < 365) {
    if (diffMonths === 1) {
      // Для одного месяца "остался 1 месяц"
      return "До платежа остался 1 месяц";
    } else {
      const mWord = declOfNum(diffMonths, ["месяц", "месяца", "месяцев"]);
      return `До платежа осталось ${diffMonths} ${mWord}`;
    }
  }

  // Иначе считаем годами (примерно)
  const diffYears = Math.floor(diffExactDays / 365);
  if (diffYears === 1) {
    return "До платежа остался 1 год";
  } else {
    const yWord = declOfNum(diffYears, ["год", "года", "лет"]);
    return `До платежа осталось ${diffYears} ${yWord}`;
  }
}
