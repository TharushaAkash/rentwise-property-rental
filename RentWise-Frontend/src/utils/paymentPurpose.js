export const paymentPurpose = (payment) => {
  if (payment.purpose && payment.purpose !== 'Unspecified') return payment.purpose;
  if (payment.paymentReference?.startsWith('RENT-')) return 'MonthlyRent';
  if (payment.paymentReference?.startsWith('PAY-')) return 'SecurityDeposit';
  return 'Unspecified';
};

export function paidRentMonths(payments) {
  return [...new Map(payments.filter(p => p.isSuccessful && paymentPurpose(p) === 'MonthlyRent').map(p => {
    const date = new Date(p.paymentDate);
    return [`${date.getFullYear()}-${date.getMonth()}`, p];
  })).values()];
}
