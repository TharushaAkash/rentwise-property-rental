export function applyServerErrors(error, setError, fields) {
  const errors = error.response?.data?.errors;
  if (!errors || typeof errors !== 'object') return;
  for (const [key, messages] of Object.entries(errors)) {
    const field = fields.find(name => name.toLowerCase() === key.toLowerCase());
    const message = Array.isArray(messages) ? messages.join(' ') : messages;
    if (field && typeof message === 'string') setError(field, { type: 'server', message });
  }
}
