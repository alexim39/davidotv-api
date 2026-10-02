import express from 'express';
import { protect } from '../../middleware/auth.js';
import {
    getTransactions,
    withdrawRequest, deleteSavedAccount,
    getBanks, resolveAccount
} from '../controllers/transaction.controller.js'

const TransactionRouter = express.Router();

// NOTE: /banks must precede /:userId — Express matches in order (cf. notification fix).
// SEC-03: all routes behind protect (previously open); bank proxy keeps the
// Paystack secret server-side instead of embedded in the frontend.
TransactionRouter.get('/banks', protect, getBanks);
TransactionRouter.get('/banks/resolve', protect, resolveAccount);

// get transactions (owner or admin — enforced in controller)
TransactionRouter.get('/:userId', protect, getTransactions);

// confirm payment (owner enforced + atomic debit in controller)
TransactionRouter.post('/withdraw-request', protect, withdrawRequest);

// delete saved account (owner enforced in controller)
TransactionRouter.delete('/saved-accounts/:userId/:accountId', protect, deleteSavedAccount);

export default TransactionRouter;
