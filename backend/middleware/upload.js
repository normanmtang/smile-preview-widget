'use strict';

const multer = require('multer');
const { ALLOWED_MIME_TYPES } = require('../utils/sanitize');

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 8;

/**
 * Memory storage is used deliberately: the uploaded selfie is held in
 * a RAM buffer for the lifetime of the request only. It is never
 * written to disk, so there is no temp file to forget to delete and
 * no window where a partial upload sits on the filesystem. Once the
 * response is sent, the buffer falls out of scope and is garbage
 * collected. This satisfies the "no permanent storage / temp files
 * deleted after processing" privacy requirement by construction.
 */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('UNSUPPORTED_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
});

module.exports = { upload, MAX_UPLOAD_MB };
