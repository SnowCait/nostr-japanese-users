export const isProxy = (/** @type {Event} **/event) => {
  return event.tags.some(([tagName]) => tagName === 'proxy' || tagName === 'mostr');
};
