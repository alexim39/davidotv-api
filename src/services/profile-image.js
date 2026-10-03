import express from 'express';
import multer from 'multer';
import { UserModel } from '../apps/user/models/user.model.js';
import { uploadBuffer, deleteAsset } from '../config/cloudinary.js';

const ProfileImageRouter = express.Router();

// --- Multer Configuration (memory only — streams to Cloudinary) ---

// File filter to accept only JPEG and PNG images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG and PNG images are allowed'), false);
    }
};

// Configure multer upload middleware
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
}).single('profilePicture');


// --- Routes ---

/**
 * @desc    Upload a new profile picture (Cloudinary; same response shape)
 * @route   POST /api/profile/:userId
 * @access  Private
 */
ProfileImageRouter.post('/profile/:userId', async (req, res) => {
    // Wrap the entire logic within the multer upload callback,
    // consistent with the first example provided.
    upload(req, res, async (err) => {
        // Handle multer errors first
        if (err) {
            // If the error is a specific Multer error, return a 400 Bad Request
            if (err instanceof multer.MulterError) {
                return res.status(400).json({
                    success: false,
                    message: `Multer Error: ${err.message}`
                });
            } else if (err) { // Handle other errors from the fileFilter
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
        }

        const userId = req.params.userId;

        // If no file was uploaded, return an error
        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded or file type not allowed',
                success: false
            });
        }

        try {
            // Find the current user
            const currentUser = await UserModel.findById(userId).select('avatar avatarPublicId');
            if (!currentUser) {
                return res.status(404).json({
                    message: 'User not found.',
                    success: false
                });
            }

            // Stream to Cloudinary (no local disk at any point).
            const up = await uploadBuffer(req.file.buffer, {
                mimetype: req.file.mimetype,
                filename: req.file.originalname,
                subfolder: 'avatars',
            });

            // Delete the previous Cloudinary asset (local-path avatars are
            // simply orphaned — containers have no persistent disk anyway).
            if (currentUser.avatarPublicId) {
                await deleteAsset(currentUser.avatarPublicId, 'image');
            }

            // Update user in database
            const updatedUser = await UserModel.findByIdAndUpdate(
                userId,
                {
                    avatar: up.url, // Store URL path
                    avatarPublicId: up.publicId,
                    $set: { 'personalInfo.lastUpdated': new Date() }
                },
                { new: true, runValidators: true }
            );

            return res.status(200).json({
                message: 'Profile picture updated successfully',
                success: true,
                avatarUrl: up.url,
                user: updatedUser
            });

        } catch (error) {
            console.error('Upload error:', error);
            const status = error.statusCode || 500;
            return res.status(status).json({
                message: error.message || 'Upload failed',
                success: false
            });
        }
    });
});

export default ProfileImageRouter;
