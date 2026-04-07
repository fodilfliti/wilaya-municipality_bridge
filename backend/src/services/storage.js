const fs = require("fs");
const path = require("path");

function storageRoot() {
  const root = process.env.FILE_STORAGE_ROOT || "./storage";
  return path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function ensureStorageDirs() {
  const root = storageRoot();
  ensureDir(root);
  ensureDir(path.join(root, "binaries"));
  ensureDir(path.join(root, "logos"));
  ensureDir(path.join(root, "pdf"));
  ensureDir(path.join(root, "mail"));
}

function publicFileUrl(relativePath) {
  const normalized = String(relativePath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `/files/${normalized}`;
}

module.exports = {
  storageRoot,
  ensureStorageDirs,
  publicFileUrl
};

