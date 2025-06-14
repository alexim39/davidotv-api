import express from 'express';
import { subscribe, unsubscribe} from '../controllers/email-subscription.controller.js'

const emailSubscriptionRouter = express.Router();

// User email subscription
emailSubscriptionRouter.post('/subscribe', subscribe);
emailSubscriptionRouter.post('/unsubscribe', unsubscribe);

export default emailSubscriptionRouter;