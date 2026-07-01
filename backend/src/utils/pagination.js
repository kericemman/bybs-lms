export function getPagination(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function paginatedResponse({ data, total, page, limit }) {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  };
}
