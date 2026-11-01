// Older ESLint plugins expect require("minimatch") to be callable, while
// minimatch 11 exposes the same matcher through a named export. Keep that
// import contract without retaining an older matching implementation.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- This is the CommonJS entry point for legacy plugins.
const modern = require("minimatch-engine");
module.exports = Object.assign(modern.minimatch, modern);
