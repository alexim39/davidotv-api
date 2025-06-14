import { EmailSubscriptionModel } from '../models/email-subscription.model.js';
import { sendEmail } from "../../../services/emailService.js";

// User email subscription
export const subscribe = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email is provided
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        // Validate email format (same regex as your user model)
        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email"
            });
        }

        // Check if already subscribed
        const existingSubscription = await EmailSubscriptionModel.findOne({ email });
        if (existingSubscription) {
            return res.status(409).json({
                success: false,
                message: "This email is already subscribed"
            });
        }

        // Create new subscription
        const emailSubscription = await EmailSubscriptionModel.create({ email });

        // Send notification email to admin
        const emailSubject = 'DavidoTV Email Subscription';
        const emailMessage = `
            <p>Hi Admin,</p>
            <p>Kindly note that a user just subscribed to the email subscription list on DavidoTV platform: ${email}</p>
        `;
        const emailsToSend = ['ago.fnc@gmail.com'];

        for (const adminEmail of emailsToSend) {
            await sendEmail(adminEmail, emailSubject, emailMessage);
        }

        res.status(200).json({ success: true, data: emailSubscription });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Internal server error',
            success: false,
        });
    }
}

// Unsubscribe user from email subscription
export const unsubscribe = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email is provided
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        // Validate email format
        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email"
            });
        }

        // Find subscription
        const subscription = await EmailSubscriptionModel.findOne({ email });
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found"
            });
        }

        // Check if already unsubscribed
        if (subscription.status === 'Unsubscribed') {
            return res.status(409).json({
                success: false,
                message: "This email is already unsubscribed"
            });
        }

        // Update status to Unsubscribed
        subscription.status = 'Unsubscribed';
        await subscription.save();

        res.status(200).json({
            success: true,
            message: "You have successfully unsubscribed"
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Internal server error',
            success: false,
        });
    }
}