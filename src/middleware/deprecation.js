/**
 * API-01: marks frozen legacy mounts as deprecated (RFC 8594 style).
 * New integrations must use /api/v1/*. Removal only after FE migration +
 * announced sunset (see docs/modernization/01-architecture/api-standards.md).
 */
export const deprecated = (_req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</api/v1>; rel="successor-version"');
  next();
};

export default deprecated;
