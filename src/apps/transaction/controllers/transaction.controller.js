import { TransactionModel } from "../models/transaction.model.js";
import { UserModel } from "./../../user/models/user.model.js";
import { sendEmail } from "../../../services/emailService.js";
import { ownerEmailTemplate } from "../services/email/ownerTemplate.js";
import { userWithdrawalEmailTemplate } from "../services/email/userTemplate.js";
import { processPayment } from "../services/process-payment.js"
import crypto from 'crypto';
import axios from 'axios';


export const getTransactions = async (req, res) => {
    try {
        const { userId } = req.params;

        // SEC-03 owner check (IDOR containment): session owns this history, admins exempt.
        if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Forbidden", success: false });
        }

        // Find transactions where userId matches the provided ID and sort by creation date in descending order
        const transac = await TransactionModel.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            message: "Transaction retrieved successfully!",
            data: transac,
            success: true,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Error retrieving transactions",
            success: false,
        });
    }
};

// User withdrawal request
// SEC-03 containment: session-derived owner, validated amount, atomic debit
// (single findOneAndUpdate with balance guard — concurrent requests can't
// double-spend), UUID reference. Full ledger + idempotency arrive in Phase-2.
export const withdrawRequest = async (req, res) => {
    const { bank, accountNumber, accountName, amount: rawAmount, userId: bodyUserId, saveAccount, bankName } = req.body;

    try {
        // Owner check: body userId must match the session (IDOR containment).
        if (bodyUserId && bodyUserId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Forbidden: user mismatch", success: false });
        }
        const userId = req.user._id;

        // Amount + field validation (FE enforces min ₦100; never trust the client).
        const amount = Number(rawAmount);
        if (!Number.isFinite(amount) || amount < 100) {
            return res.status(400).json({
                message: "Invalid amount: minimum withdrawal is ₦100",
                success: false,
            });
        }
        if (!bank || !accountNumber || !accountName) {
            return res.status(400).json({
                message: "Bank, account number and account name are required",
                success: false,
            });
        }

        // Atomic debit: succeeds only when balance covers the amount.
        const user = await UserModel.findOneAndUpdate(
            { _id: userId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) {
            return res.status(400).json({
                message: "Insufficient balance for transaction",
                success: false,
            });
        }

        // Unique reference (crypto UUID replaces Math.random 9-digit).
        const reference = crypto.randomUUID();

        // Record the transaction as pending
        const transaction = new TransactionModel({
            userId: user._id,
            amount: amount,
            status: "Pending",
            paymentMethod: "Withdrawal",
            transactionType: "Debit", // its credit when the user bank account is credited
            bankDetail: {
                bankCode: bank,
                accountNumber: accountNumber,
                accountName: accountName,
            },
            reference,
        });
        await transaction.save();

        // Process the automatic payment
        const paymentResponse = await processPayment(bank, accountNumber, accountName, amount);

        if (paymentResponse.success) {
            // Update transaction status to successful
            transaction.status = "Successful";
            await transaction.save();

            // // Send email notification to owner
            const ownerSubject = "New Withdrawal Request";
            const ownerMessage = ownerEmailTemplate(user);
            const ownerEmails = ["ago.fnc@gmail.com"];
            for (const email of ownerEmails) {
                await sendEmail(email, ownerSubject, ownerMessage);
            }

            // Send email notification to the user
            const userSubject = "Successful Withdrawal - MarketSpase";
            const userMessage = userWithdrawalEmailTemplate(user, req.body);
            await sendEmail(user.email, userSubject, userMessage);


            // If the user chooses to save the account, add it (dedupe by accountNumber).
            if (saveAccount) {
                await UserModel.updateOne(
                    { _id: user._id, 'savedAccounts.accountNumber': { $ne: accountNumber } },
                    { $push: { savedAccounts: {
                        bankCode: bank,
                        accountNumber: accountNumber,
                        accountName: accountName,
                        bank: bankName,
                    } } }
                );
            }

            return res.status(200).json({
                message: "Withdrawal successful, payment has been processed.",
                data: transaction,
                success: true,
            });
        } else {
            // If payment fails, refund balance (atomic $inc) and update transaction status
            await UserModel.findByIdAndUpdate(user._id, { $inc: { balance: amount } });

            transaction.status = "Failed";
            await transaction.save();

            // Notify the user and owner of the failure
            const failureSubject = "Withdrawal Failed";
            const failureMessage = userWithdrawalEmailTemplate(user, req.body, "Failed");
            await sendEmail(user.email, failureSubject, failureMessage);

            return res.status(500).json({
                message: "Payment failed. Your balance has been refunded.",
                data: transaction,
                success: false,
            });
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "An error occurred while processing the withdrawal.",
            success: false,
        });
    }
};


// Delete saved accounts
export const deleteSavedAccount = async (req, res) => {
    try {
        const { userId, accountId } = req.params;

        // SEC-03 owner check (IDOR containment).
        if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        // Find the user by ID
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Find the account to delete
        const accountIndex = user.savedAccounts.findIndex(
            (account) => account._id.toString() === accountId
        );

        if (accountIndex === -1) {
            return res.status(404).json({ success: false, message: 'Saved account not found' });
        }

        // Remove the account from the savedAccounts array
        user.savedAccounts.splice(accountIndex, 1);

        // Save the updated user document
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Saved account deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting saved account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the saved account',
        });
    }
};

const paystackSecret = () => process.env.PAYSTACK_SECRET || process.env.PAYSTACKTOKEN;

// SEC-03: server-side Paystack bank list (replaces FE direct call with embedded key).
export const getBanks = async (_req, res) => {
    try {
        const secret = paystackSecret();
        if (!secret) return res.status(500).json({ success: false, message: 'Payout provider not configured' });

        const { data } = await axios.get('https://api.paystack.co/bank', {
            headers: { Authorization: `Bearer ${secret}` },
            timeout: 10000,
        });

        // Paystack shape {status, data:[{name,code,...}]} — project to {name,code} for the FE dropdown.
        const banks = (data?.data || []).map((b) => ({ name: b.name, code: b.code }));
        res.status(200).json({ status: true, data: banks, success: true });
    } catch (error) {
        console.error('getBanks failed:', error.response?.data || error.message);
        res.status(502).json({ success: false, message: 'Failed to load banks, please try again' });
    }
};

// SEC-03: server-side account resolution (replaces FE direct call with embedded key).
export const resolveAccount = async (req, res) => {
    try {
        const { account_number, bank_code } = req.query;

        if (!/^\d{10}$/.test(account_number || '') || !bank_code) {
            return res.status(400).json({ success: false, message: 'Valid 10-digit account number and bank code required' });
        }

        const secret = paystackSecret();
        if (!secret) return res.status(500).json({ success: false, message: 'Payout provider not configured' });

        const { data } = await axios.get('https://api.paystack.co/bank/resolve', {
            params: { account_number, bank_code },
            headers: { Authorization: `Bearer ${secret}` },
            timeout: 10000,
        });

        // Preserve Paystack shape {status, data:{account_name}} so the FE resolver is unchanged.
        res.status(200).json({ status: data?.status ?? true, data: data?.data, success: true });
    } catch (error) {
        const message = error.response?.data?.message || 'Failed to resolve account name. Please check account details.';
        res.status(400).json({ success: false, message });
    }
};