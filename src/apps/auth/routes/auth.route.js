import express from 'express';
import {
    forgotPassword, resetPassword, changePassword, signup, signin, googleSignin, getUser, signout, accountActivationEmail, activateAccount
} from '../controllers/auth.controller.js'

const AuthRouter = express.Router();

AuthRouter.post('/signup', signup);
AuthRouter.post('/signin', signin);
AuthRouter.post('/google-signin', googleSignin);
AuthRouter.post('/signout', signout);
// Get partner
AuthRouter.get('/', getUser);
// partner account activation email request
AuthRouter.post('/activate', accountActivationEmail);
// partner account activation email request
AuthRouter.get('/activation/:partnerId', activateAccount);
// partner forgot password
AuthRouter.post('/forgot-password', forgotPassword);
// partner reset password
AuthRouter.post('/reset-password', resetPassword);
// Change password
AuthRouter.put('/change-password', changePassword)

export default AuthRouter;