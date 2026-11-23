export function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  if (error.code === '23505') return res.status(409).json({ message: 'This record already exists' });
  if (error.code === '23503') return res.status(400).json({ message: 'A related record could not be found' });
  res.status(error.status || 500).json({ message: error.message || 'Internal server error' });
}
