// Attrape les erreurs des routes asynchrones et les transmet à Express
// au lieu de laisser planter tout le serveur.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
