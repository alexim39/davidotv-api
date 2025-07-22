import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { UserModel } from '../apps/user/models/user.model.js';

const ProfileImageRouter = express.Router();

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${req.params.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only JPEG and PNG images are allowed'));
        }
        cb(null, true);
    }
});

ProfileImageRouter.post('/profile/:userId', upload.single('profilePicture'), async (req, res) => {
    const userId = req.params.userId;

    if (!req.file) {
        return res.status(400).json({
            message: 'No file uploaded or file type not allowed',
            success: false
        });
    }

    try {
        // Verify file was saved correctly
        const absoluteFilePath = path.join(uploadsDir, req.file.filename);
        if (!fs.existsSync(absoluteFilePath)) {
            return res.status(500).json({
                message: 'File upload failed - file not saved',
                success: false
            });
        }

        // Find the current user
        const currentUser = await UserModel.findById(userId);
        if (!currentUser) {
            fs.unlinkSync(absoluteFilePath);
            return res.status(404).json({
                message: 'User not found.',
                success: false
            });
        }

        // Delete old avatar if exists
        if (currentUser.avatar && currentUser.avatar !== 'img/avatar.png') {
            const oldAvatarPath = path.join(uploadsDir, path.basename(currentUser.avatar));
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        // Construct URLs
        const avatarFilename = req.file.filename;
        const avatarUrlPath = `/uploads/${avatarFilename}`;
        const fullAvatarUrl = `${req.protocol}://${req.get('host')}${avatarUrlPath}`;

        // Update user in database
        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            { 
                avatar: fullAvatarUrl, // Store URL path (not full URL)
                $set: { 'personalInfo.lastUpdated': new Date() }
            },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            message: 'Profile picture updated successfully',
            success: true,
            avatarUrl: fullAvatarUrl,
            user: updatedUser
        });

    } catch (error) {
        console.error('Upload error:', error);
        if (req.file) {
            fs.unlinkSync(path.join(uploadsDir, req.file.filename));
        }
        return res.status(500).json({
            message: error.message || 'Upload failed',
            success: false
        });
    }
});

export default ProfileImageRouter;