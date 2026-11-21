const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { UPLOAD_DIR } = require('../config');
const { authMiddleware } = require('../middleware/auth');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '';
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// Upload route (supports both normal files and client-encrypted payloads)
router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const isEncrypted = req.body.isEncrypted === 'true' || req.body.isEncrypted === true;
    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype || 'application/octet-stream',
      isEncrypted
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;
