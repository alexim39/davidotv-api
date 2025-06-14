import {ContactModel, GuideDownloadModel} from '../models/contact.model.js';
import { sendEmail } from "../../../services/emailService.js";
import { ownerContactEmailTemplate } from '../services/email/ownerTemplate.js';
import { userGuideTemplate } from '../services/email/userGuideTemplate.js';
import { userContactEmailTemplate } from '../services/email/userTemplate.js';


//generate a numerical id.
function generateNumericContactRequestId(length = 8) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10); // Generates a random digit (0-9)
    }
    return result;
}

// User contact contnroller
export const ContactController = async (req, res) => {
    const requestID = generateNumericContactRequestId();
    try {

        //console.log('sent==',req.body);

        const contactObject = await ContactModel.create({
            name: req.body.name,
            surname: req.body.surname,
            email: req.body.email,
            subject: req.body.subject,
            message: req.body.message,
            requestID: requestID
        });

        // Send email to form owner
        const ownerSubject = 'MarketSpase Support Request';
        const ownerMessage = ownerContactEmailTemplate(contactObject);
        const ownerEmails = ['ago.fnc@gmail.com'];
        await Promise.all(ownerEmails.map(email => sendEmail(email, ownerSubject, ownerMessage)));

        // Send email to the user
        const userSubject = `MarketSpase Support Request - ${requestID}`;
        const userMessage = userContactEmailTemplate(contactObject);
        const receiverEmails = [contactObject.email, 'contacts@marketspase.com'];
        await Promise.all(receiverEmails.map(email => sendEmail(email, userSubject, userMessage)));

        res.status(200).json({data: contactObject, success: true, message: "Contact form submitted successfully."});

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'internal server error',
            success: false,
        })
    }
}



// User download contnroller
export const GuideDownloadController = async (req, res) => {
    try {

        //console.log('sent==',req.body);

        const downloadObject = await GuideDownloadModel.create({
            name: req.body.name,
            surname: req.body.surname,
            email: req.body.email,
            userDevice: req.body.userDevice,
            username: req.body.username,
        });  

        // Send email to form owner
        const ownerSubject = 'MarketSpase Business Guide Download';
        const ownerMessage = userGuideTemplate(downloadObject);
        const ownerEmails = ['ago.fnc@gmail.com'];
        await Promise.all(ownerEmails.map(email => sendEmail(email, ownerSubject, ownerMessage)));

        res.status(200).json(downloadObject);

    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: error.message
        })
    }
}