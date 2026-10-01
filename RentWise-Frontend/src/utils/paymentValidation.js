// These checks validate input only. The server/payment provider confirms payment.
export function validateCard({ cardHolder, cardNumber, cardExpiry, cardCvc }, now = new Date()) {
  if (!cardHolder?.trim()) return 'Enter the name on the card.';
  const number = (cardNumber || '').replace(/\s/g, '');
  if (!/^\d{15,16}$/.test(number)) return 'Enter a valid 15 or 16-digit card number.';
  let sum = 0;
  let double = false;
  for (let index = number.length - 1; index >= 0; index--) {
    let digit = Number(number[index]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  if (sum % 10 !== 0) return 'Check the card number.';
  const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(cardExpiry || '');
  if (!expiry) return 'Enter a valid expiry date (MM/YY).';
  const year = 2000 + Number(expiry[2]);
  if (year < now.getFullYear() || (year === now.getFullYear() && Number(expiry[1]) < now.getMonth() + 1)) {
    return 'This card has expired.';
  }
  const validCvc = /^3[47]/.test(number) ? /^\d{4}$/ : /^\d{3}$/;
  if (!validCvc.test(cardCvc || '')) return /^3[47]/.test(number) ? 'Enter the 4-digit security code.' : 'Enter the 3-digit security code.';
  return '';
}
