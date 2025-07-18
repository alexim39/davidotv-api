import { UserModel } from "../../user/models/user.model.js";
import { sendEmail } from "../../../services/emailService.js";
import { ownerEmailTemplate } from "../services/email/ownerTemplate.js";
import { userNotificationEmailTemplate } from "../services/email/userTemplate.js";

// Toggle notification
export const toggleNotification = async (req, res) => {
  try {
    const { state, userId } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    if (typeof state !== 'boolean') {
      return res.status(400).json({ message: 'State must be a boolean' });
    }

    // Find the partner by ID
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }user

    // Update the notification setting
    user.preferences.notification = state;
    await user.save();

    res.status(200).json({
      message: `Notifications ${state ? 'enabled' : 'disabled'} successfully`,
      data: {
        userId: user._id,
        notificationState: user.notification,
      },
      success: true,
    });
  } catch (error) {
    console.error('Error updating notification setting:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Toggle theme
export const toggleTheme = async (req, res) => {
  try {
    const { state, userId } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({success: false,  message: 'Partner ID is required' });
    }
    if (typeof state !== 'boolean') {
      return res.status(400).json({ success: false, message: 'State must be a boolean' });
    }

    // Find the partner by ID
    const partner = await UserModel.findById(userId);

    if (!partner) {
      return res.status(400).json({ success: false, message: 'Partner not found' });
    }

    // Update the notification setting
    partner.darkMode = state;
    await partner.save();

    res.status(200).json({
      message: `Theme ${state ? 'enabled' : 'disabled'} successfully`,
      data: {
        userId: partner._id,
        notificationState: partner.darkMode,
      },
      success: true,
    });
  } catch (error) {
    console.error('Error updating notification setting:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get partner theme settings
export const getThemeSetting = async (req, res) => {
  try {
    const { userId } = req.params;
    const partner = await UserModel.findOne({ _id: userId }); // Corrected to _id

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    // get theme state from partner object
    const darkMode = partner.darkMode;

    res.status(200).json({ success: true, darkMode });

  } catch (error) {
    console.error('Error updating notification setting:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
