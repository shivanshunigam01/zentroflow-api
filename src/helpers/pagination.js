export const getPagination = (query) => {
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 500);
  if (query.offset !== undefined && query.offset !== '') {
    const offset = Math.max(Number(query.offset) || 0, 0);
    const page = Math.floor(offset / limit) + 1;
    return { page, limit, skip: offset, offset };
  }
  const page = Math.max(Number(query.page || 1), 1);
  const skip = (page - 1) * limit;
  return { page, limit, skip, offset: skip };
};

export const paginationMeta = ({ page, limit, total }) => ({ page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
