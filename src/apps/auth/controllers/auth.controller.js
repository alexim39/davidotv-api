import { UserModel } from "../../user/models/user.model.js";
import bcrypt from "bcryptjs";
import { userPasswordResetLinkEmailTemplate } from "../services/email/userResetPasswordTemplate.js";
import { sendEmail } from "../../../services/emailService.js";
import crypto from 'crypto';
import jwt from "jsonwebtoken";
import { userAccountActivationEmailTemplate } from "../services/email/userActivationTemplate.js";
import dotenv  from "dotenv"
dotenv.config()
import { generateUniqueUsername } from '../services/username-generator.js'; 
import { ownerEmailTemplate } from '../services/email/ownerTemplate.js'; 
import { userWelcomeEmailTemplate } from '../services/email/userWelcomeTemplate.js';


/**
 * Handles prospect sign up form submissions.
 * - Validates the request data.
 * - Checks if the prospect already exists as a partner.
 * - Retrieves prospect data from the Survey collection.
 * - Hashes the password and generates a unique username.
 * - Creates a new partner record in the database.
 * - Sends email notifications to the owner and a welcome email to the prospect.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @returns {Promise<void>}
 */
export const signup = async (req, res) => {
    try {
        const signUpData = req.body;

        // Input Validation: Check if required fields are present and valid
        if (!signUpData.email || !signUpData.password || !signUpData.name) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Check if user already exists (case-insensitive)
        const existingUser = await UserModel.findOne({
            email: signUpData.email.trim(),
        }).collation({ locale: "en", strength: 2 });

        if (existingUser) {
            return res.status(400).json({ success: false, message: "This email has signed up before. Try login" }); // Use 409 Conflict
        }

        // Validate that password and confirmPassword match
        // if (signUpData.password !== signUpData.confirmPassword) {
        //     return res.status(400).json({ success: false, message: "Passwords do not match" }); // Use 400 Bad Request
        // }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(signUpData.password, salt);
        //const hashedPassword = await bcrypt.hash(signUpData.password, 10);

        // Generate a unique username
        const username = await generateUniqueUsername(signUpData.name, signUpData.lastname);

        // Create a new User
        const newUser = new UserModel({
            name: signUpData.name.trim(),
            lastname: signUpData.lastname.trim(),
            email: signUpData.email.trim(),
            password: hashedPassword,
            username
        });

        await newUser.save();

        //Send email to form owner
        const ownerSubject = 'New DavidoTV Sign Up';
        const ownerMessage = ownerEmailTemplate(newUser);
        const ownerEmails = ['alexim39@yahoo.com'];
        await Promise.all(ownerEmails.map(email => sendEmail(email, ownerSubject, ownerMessage)));

        //Send welcome email to the user
        const userSubject = 'Welcome to DavidoTV';
        const userMessage = userWelcomeEmailTemplate(newUser);
        await sendEmail(newUser.email, userSubject, userMessage);

        // Exclude password from the response
        const { password: _, ...userObject } = newUser.toJSON();
        res.status(200).json({success: true, user: userObject, message: 'Profile created successfully'}); // Use 200 Created for successful resource creation

    } catch (error) {
        console.error('Error handling User signup:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// User App login
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ success: false, message: "Wrong email or password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWTTOKENSECRET, {
      expiresIn: "1d",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ success: true, message: "SignedIn" });

  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// User Google login
export const googleSignin = async (req, res) => {
  try {
    const { googleUser } = req.body;

    if (!googleUser || !googleUser.email) {
      return res.status(400).json({ success: false, message: "Missing Google user data" });
    }

    const { email, displayName, photoURL } = googleUser;
    
    // Split displayName into name and lastname
    const [name, ...restOfName] = displayName.split(" ");
    const lastname = restOfName.join(" ") || "";

    let user = await UserModel.findOne({ email });

    // If user doesn't exist, create a new one
    if (!user) {
      // Generate a unique username
      const username = await generateUniqueUsername(name, lastname);

      user = new UserModel({
        name: name,
        lastname: lastname,
        email: email,
        username: username,
        avatar: photoURL,
        // Since Google authentication doesn't provide a password,
        // we'll set a placeholder to prevent direct password login.
        password: "google_signin_placeholder_password",
        // Add a flag to identify users who signed up with a provider
        authenticationMethod: 'google',
      });

      await user.save();
    } else {
      // If the user exists, we can still update their info if needed
      // (e.g., photoURL, display name) or simply authenticate them.
      // We'll also update the authentication method if it's not set.
      if (!user.authenticationMethod) {
        user.authenticationMethod = 'google';
        await user.save();
      }
    }

    // Now, authenticate the user regardless of whether they were newly created or already existed
    const token = jwt.sign({ id: user._id }, process.env.JWTTOKENSECRET, {
      expiresIn: "1d",
    });

    res.cookie("jwt", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Exclude password and other sensitive fields from the response
    const { password: _, ...userObject } = user.toJSON();

    res.status(200).json({ success: true, message: "Signed in successfully with Google", user: userObject });
  } catch (error) {
    console.error("Error with Google Sign-In:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// User logout
export const signout = async (req, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.json({ success: true, message: "Logged out successfully" });
};

// Get user details (modified to handle GET request with JWT)
export const getUser = async (req, res) => {
  try {
    const token = req.cookies["jwt"];
    
    if (!token) {
      return res.status(401).json({ success: false, message: "User unauthenticated: JWT missing" });
    }

    const claims = jwt.verify(token, process.env.JWTTOKENSECRET);

    if (!claims) {
      return res.status(401).json({ success: false, message: "User unauthenticated: JWT invalid" });
    }

    const user = await UserModel.findById(claims.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { password: _, ...userObject } = user.toJSON(); // Remove password from response

    res.status(200).json({success: true,  user: userObject});
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "User unauthenticated: JWT expired" });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: "User unauthenticated: Invalid JWT" });
    }
    console.error("Error getting user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Send email to user for account activation
export const accountActivationEmail = async (req, res) => {
    try {
      const { state, partnerId } = req.body;
  
      // Validate input
      if (!partnerId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
      }
      if (typeof state !== 'boolean') {
        return res.status(400).json({ success: false, message: 'State must be a boolean' });
      }
  
      // Find the partner by ID
      const partner = await UserModel.findById(partnerId);
  
      if (!partner) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Send email to the user
      const userSubject = "Account Activation Request - MarketSpase";
      const userMessage = userAccountActivationEmailTemplate(partner);
      await sendEmail(partner.email, userSubject, userMessage);
  
      res.status(200).json({
        success: true, 
        message: `Account activation email sent successfully`,
      });
    } catch (error) {
      console.error('Error updating notification setting:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Activate User Account
export const activateAccount = async (req, res) => {
    try {
  
      const { partnerId } = req.params;
      
      const updatedPartner = await UserModel.findByIdAndUpdate(
        partnerId,
        { status: true },
        { new: true } // Return the updated document
      );
  
      if (!updatedPartner) {
        return res.status(404).json({  success: false, message: 'User not found' });
      }
  
      res.status(200).json({
        success: true, 
        message: 'Account activated successfully.', 
        partner: updatedPartner 
      });
  
  
    } catch (error) {
      console.error('Error activating partner account:', error);
      return { success: false, message: 'Failed to activate account.' };
    }
};
  

export const forgotPassword = async (req, res) => {
    try {
      const { email } = req.body;
      const user = await UserModel.findOne({ email });

      if (!user) {
        return res.status(404).json({ success: true, message: 'If the email is registered, a password reset link has been sent' });
      }
  
      const resetToken = crypto.randomBytes(20).toString('hex');
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour
  
      user.resetToken = resetToken;
      user.resetTokenExpiry = resetTokenExpiry;
      await user.save();

      //console.log('user ',user)

    // Send email to the user
    const userSubject = "Password Reset Link - DavidoTV";
    const userMessage = userPasswordResetLinkEmailTemplate(user);
    await sendEmail(user.email, userSubject, userMessage);
  
    res.json({ success: true, message: 'Password reset email sent.' });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ success: false, message: 'An error occurred.' });
    }
};

// change password for user who forgot their password
export const resetPassword = async (req, res) => {
  try {
    const { password, token } = req.body;

    // Validate input
    if (!password || !token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password and token are required.' 
      });
    }

    // Check password length (matches frontend validation)
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters.' 
      });
    }

    // Find user with valid token
    const user = await UserModel.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired token. Please request a new password reset.' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    // Return success response
    res.status(200).json({ 
      success: true, 
      message: 'Password changed successfully! You can now sign in with your new password.' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    
    // Handle rate limiting or other specific errors
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ 
        success: false, 
        message: 'Too many requests. Please try again later.' 
      });
    }

    // Generic error response
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while resetting your password. Please try again later.' 
    });
  }
};

// Change a user's password
export const changePassword = async (req, res) => {
  const { id, currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password are required.",
    });
  }

  if (newPassword.length < 6) {
    return res.status(402).json({
      success: false,
      message: "New password must be at least 6 characters long.",
    });
  }

  if (currentPassword === newPassword) {
    return res.status(401).json({
      success: false,
      message: "Current password and new password cannot be the same.",
    });
  }

  try {
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully!",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: 'An error occurred while changing the password.'
    });
  }
};

