module.exports = function(fn) {
  return async function(...args) {
    let error, result;
    try {
      result = await fn(...args);
    } catch(e) {
      error = e;
    }
    return [error, result];
  }
}
