export const formatLankaPrice = (amount) => {
  const num = Number(amount || 0);
  if (num >= 1000000) {
    const m = num / 1000000;
    return `Rs. ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  return `Rs. ${num.toLocaleString()}`;
};
