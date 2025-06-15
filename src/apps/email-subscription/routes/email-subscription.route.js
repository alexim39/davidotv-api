import express from 'express';
import { subscribe, unsubscribe} from '../controllers/email-subscription.controller.js'

const EmailSubscriptionRouter = express.Router();

// User email subscription
EmailSubscriptionRouter.post('/subscribe', subscribe);
EmailSubscriptionRouter.post('/unsubscribe', unsubscribe);

export default EmailSubscriptionRouter;