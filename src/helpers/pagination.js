export const getPagination = (query) => {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

export const paginationMeta = ({ page, limit, total }) => ({ page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
