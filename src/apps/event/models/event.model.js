import mongoose from 'mongoose';

const eventSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"]
    },
    description: {
      type: String,
      required: [true, "Event description is required"]
    },
    date: {
      type: Date,
      required: [true, "Event date is required"]
    },
    location: {
      type: String,
      required: [true, "Event location is required"]
    },
    imageUrl: {
      type: String,
      default: '/img/event-banner.png'
    },
    attendees: {
      type: Number,
      default: 0
    },
    price: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"]
    },
    category: {
      type: String,
      enum: ['Concerts', 'Meet & Greets', 'Fan Parties', 'Online Events', 'Viewing Parties', 'Charity Events'],
      default: 'Concerts'
    },
    // Users who booked to attend
    bookedUsers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      bookedAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ['booked', 'cancelled'],
        default: 'booked'
      }
    }],
    // Users who actually attended
    attendedUsers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      attendedAt: {
        type: Date,
        default: Date.now
      }
    }],
    // Users who interested in attending
    interestedUsers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      attendedAt: {
        type: Date,
        default: Date.now
      }
    }],
    // Additional event info
    isActive: { 
      type: Boolean,
      default: true // Event is active and accepting bookings
    },
    isCancelled: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String
    },
     // Optional: extra fields for richer event management
    capacity: {
      type: Number
    },
    tags: [{
      type: String
    }],
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public'
    },
    externalLink: {
      type: String
    },
  },
  {
    timestamps: true
  }
);


// Add a virtual to populate interestedUsers.user details
eventSchema.virtual('interestedUserDetails', {
  ref: 'User',
  localField: 'interestedUsers.user',
  foreignField: '_id',
  justOne: false
});

// Ensure virtuals are included when converting to JSON or Object
eventSchema.set('toObject', { virtuals: true });
eventSchema.set('toJSON', { virtuals: true });

export const EventModel = mongoose.model('Event', eventSchema);