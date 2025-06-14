import express from 'express';
import {} from '../controllers/auth.controller.js'

const UserRouter = express.Router();

/* // partner login
AuthRouter.post('/signin', signin);
// Get partner
AuthRouter.get('/', getPartner);
// partner logout
AuthRouter.post('/signout', signout);
// partner account activation email request
AuthRouter.post('/activate', accountActivationEmail);
// partner account activation email request
AuthRouter.get('/activation/:partnerId', activateAccount);
// partner forgot password
AuthRouter.post('/forgot-password', forgotPassword);
// partner reset password
AuthRouter.post('/reset-password', resetPassword);
// Change password
AuthRouter.put('/change-password', changePassword) */

export default UserRouter;