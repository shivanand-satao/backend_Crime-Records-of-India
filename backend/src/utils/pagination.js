exports.paginate = (page = 1, pageSize = 25) => {
  const limit = parseInt(pageSize, 10);
  const offset = (parseInt(page, 10) - 1) * limit;
  return { limit, offset };
};
