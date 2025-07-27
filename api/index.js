module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'LinkedIn Analytics API is running',
    timestamp: new Date().toISOString(),
    environment: 'production'
  });
};
