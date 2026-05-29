// Analytics service placeholder
exports.recordEvent = async (event) => {
  // implement event recording to DB or analytics store
  return true;
};

exports.getOverview = async () => {
  return { visitors: 0, views: 0 };
};
