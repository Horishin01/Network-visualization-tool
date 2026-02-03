const readPath = (obj, path) => {
  if (!path) {
    return '';
  }
  return path.split('.').reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return '';
  }, obj);
};

export const renderTemplate = (value, context = {}) => {
  if (typeof value !== 'string') {
    return value ?? '';
  }
  return value.replace(/\{([^}]+)\}/g, (_match, key) => {
    const trimmed = `${key}`.trim();
    const resolved = readPath(context, trimmed);
    return resolved === undefined || resolved === null ? '' : `${resolved}`;
  });
};

export const renderLines = (lines, context = {}) => {
  if (!Array.isArray(lines)) {
    return [];
  }
  return lines
    .map((line) => renderTemplate(line, context))
    .filter((line) => line !== undefined && line !== null && `${line}`.length > 0);
};
