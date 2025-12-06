const express = require("express");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const File = require("../models/File");
const User = require("../models/User");
const fs = require("fs");
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDFs, documents, and archives are allowed."
        )
      );
    }
  },
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  jwt.verify(token, "your-secret-key-here", (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
    req.user = user;
    next();
  });
};

// Upload file
router.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Get user info
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Create file record
      const newFile = new File({
        filename: req.file.filename,
        originalName: req.file.originalname,
        displayName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
        owner: req.user.userId,
        ownerUsername: user.username,
      });

      await newFile.save();

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        file: {
          id: newFile._id,
          filename: newFile.displayName,
          size: formatFileSize(newFile.size),
          owner: newFile.ownerUsername,
          date: newFile.uploadedAt.toISOString().split("T")[0],
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during file upload",
      });
    }
  }
);

// Get all files
router.get("/", authenticateToken, async (req, res) => {
  try {
    const files = await File.find({})
      .sort({ uploadedAt: -1 })
      .select("displayName originalName size owner ownerUsername uploadedAt");

    const formattedFiles = files.map((file) => ({
      id: file._id,
      filename: file.displayName,
      size: formatFileSize(file.size),
      owner: file.ownerUsername,
      date: file.uploadedAt.toISOString().split("T")[0],
    }));

    res.json({
      success: true,
      files: formattedFiles,
    });
  } catch (error) {
    console.error("Get files error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching files",
    });
  }
});

// Download file
router.get("/download/:id", authenticateToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Send file with original name
    res.download(file.path, file.originalName);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during file download",
    });
  }
});

// Edit/Update file
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { newFilename } = req.body;

    if (!newFilename || newFilename.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "New filename is required",
      });
    }

    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Check if user owns the file
    if (file.owner.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Update display name only (keeping the same extension)
    const fileExtension = path.extname(file.originalName);
    const newNameWithExt = newFilename.endsWith(fileExtension)
      ? newFilename
      : newFilename + fileExtension;

    file.displayName = newNameWithExt;
    await file.save();

    res.json({
      success: true,
      message: "File renamed successfully",
      file: {
        id: file._id,
        filename: file.displayName,
        size: formatFileSize(file.size),
        owner: file.ownerUsername,
        date: file.uploadedAt.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Edit error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during file rename",
    });
  }
});

// Delete file
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Check if user owns the file
    if (file.owner.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Delete physical file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Delete database record
    await File.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during file deletion",
    });
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

module.exports = router;
