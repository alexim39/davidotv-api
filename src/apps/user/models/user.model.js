import mongoose from 'mongoose';

/* Schema*/
const userSchema = mongoose.Schema(
    {
        username: {
            type: String,
            unique: true,
            required: [true, "Please enter username"],
        },
        name: {
            type: String,
            required: [true, "Please enter name"]
        },
        lastname: {
            type: String,
            required: [true, "Please enter lastname"]
        },
        email: {
            type: String,
            unique: true,
            required: [true, "Please enter email"],
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
        },
        password: {
            type: String,
            required: [true, "Please enter password"]
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        },       
       
    },
    {
        timestamps: true
    }
)

/* Model */
export const UserModel = mongoose.model('User', userSchema);