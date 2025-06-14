import mongoose from 'mongoose';


/* Schema*/
const emailSubscriptionSchema = mongoose.Schema(
    {
    
        email: {
            type: String,
            unique: true,
            required: [true, "Please enter email address"]
        },
        status: {
            type: String,
            default: 'Subscribed',
        }      
    },
    {
        timestamps: true
    }
)

/* Model */
export const EmailSubscriptionModel = mongoose.model('EmailSubscription', emailSubscriptionSchema);