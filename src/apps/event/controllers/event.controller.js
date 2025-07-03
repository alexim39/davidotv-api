import { EventModel } from '../models/event.model.js';
import mongoose from 'mongoose';

export const addEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      location,
    } = req.body;

    // Validate required fields
    if (!title || !description || !date || !location) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, date, location'
      });
    }

    // Optionally, validate date and price
    if (isNaN(Date.parse(date))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    // if (isNaN(Number(price)) || Number(price) < 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Price must be a non-negative number'
    //   });
    // }

    // Create and save event
    const event = new EventModel(req.body);
    const savedEvent = await event.save();

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: savedEvent
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: error.message
    });
  }
};


export const getActiveEvents = async (req, res) => {
  try {
    const events = await EventModel.find({ isActive: true, isCancelled: false }).sort({ date: 1 })
     .populate({
        path: 'interestedUsers.user',
        select: 'name email username avatar'
    });
    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error fetching active events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active events',
      error: error.message
    });
  }
};


export const getInactiveEvents = async (req, res) => {
  try {
    const events = await EventModel.find({ isActive: false }).sort({ date: 1 });
    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error fetching inactive events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inactive events',
      error: error.message
    });
  }
};


export const getEventBookedUsers = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await EventModel.findById(eventId)
      .populate({
        path: 'bookedUsers.user',
        select: 'name email username avatar'
      });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      count: event.bookedUsers.length,
      data: event.bookedUsers,
      message: 'Booked users fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching booked users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booked users',
      error: error.message
    });
  }
};


export const getEventsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID'
      });
    }

    const event = await EventModel.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching event by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event',
      error: error.message
    });
  }
};

export const getEventsIAttended = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all events where attendedUsers contains this user
    const events = await EventModel.find({ 'attendedUsers.user': userId }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error fetching attended events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attended events',
      error: error.message
    });
  }
};


export const getTrendingEvents = async (req, res) => {
  try {
    // Trending: active, not cancelled, future date, and has at least one interested or attended user
    const now = new Date();
    const events = await EventModel.find({
      isActive: true,
      isCancelled: false,
      date: { $gte: now },
      $or: [
        { 'interestedUsers.0': { $exists: true } },
        { 'attendedUsers.0': { $exists: true } }
      ]
    })
      .sort({ attendees: -1, date: 1 })
      .limit(100)
      .populate({
        path: 'interestedUsers.user',
        select: 'name email username avatar'
      })
      .populate({
        path: 'bookedUsers.user',
        select: 'name email username avatar'
      })
      .populate({
        path: 'attendedUsers.user',
        select: 'name email username avatar'
      });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
      message: 'Trending event returned successfully'
    });
  } catch (error) {
    console.error('Error fetching trending events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending events',
      error: error.message
    });
  }
};


export const bookEvent = async (req, res) => {
  try {
    const { eventId, userId } = req.body;

    if (!eventId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID and User ID are required'
      });
    }

    // Find the event
    const event = await EventModel.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user already booked
    const alreadyBooked = event.bookedUsers.some(
      (entry) => entry.user.toString() === userId
    );
    if (alreadyBooked) {
      return res.status(400).json({
        success: false,
        message: 'User has already booked this event'
      });
    }

    // Add user to bookedUsers
    event.bookedUsers.push({
      user: userId,
      bookedAt: new Date(),
      status: 'booked'
    });

    // Optionally increment attendees count
    event.attendees += 1;

    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event booked successfully',
      data: event
    });
  } catch (error) {
    console.error('Error booking event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book event',
      error: error.message
    });
  }
};

export const markEventInterest = async (req, res) => {
  try {
    const { eventId, userId } = req.body;

    //console.log('Marking interest in event:', { eventId, userId });

    if (!eventId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID and User ID are required'
      });
    }

    // Find the event
    const event = await EventModel.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user already marked as interested
    const alreadyInterested = event.interestedUsers.some(
      (entry) => entry.user.toString() === userId
    );
    if (alreadyInterested) {
      return res.status(400).json({
        success: false,
        message: 'You have already marked your interest in this event'
      });
    }

    // Add user to interestedUsers
    event.interestedUsers.push({
      user: userId,
      attendedAt: new Date()
    });

    await event.save();

    res.status(200).json({
      success: true,
      message: 'Interest in event recorded successfully',
      data: event
    });
  } catch (error) {
    console.error('Error marking event interest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record interest in event',
      error: error.message
    });
  }
};


export const getUserEventInterest = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Find all events where interestedUsers contains this user
    const events = await EventModel.find({ 'interestedUsers.user': userId })
      .sort({ date: 1 })
      .populate({
        path: 'interestedUsers.user',
        select: 'name email username avatar'
      });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error fetching user interested events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user interested events',
      error: error.message
    });
  }
}



export const getAllEvents = async (req, res) => {
  try {
    const events = await EventModel.find({})
      .sort({ date: 1 })
      .populate({
        path: 'interestedUsers.user',
        select: 'name email username avatar'
      })
      .populate({
        path: 'bookedUsers.user',
        select: 'name email username avatar'
      })
      .populate({
        path: 'attendedUsers.user',
        select: 'name email username avatar'
      });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error fetching all events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all events',
      error: error.message
    });
  }
};

export const getEventsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    const events = await EventModel.find({ category: { $regex: new RegExp('^' + category + '$', 'i') } })
      .sort({ date: 1 })
      .populate({
        path: 'interestedUsers.user',
        select: 'name email username avatar'
      })
      .populate({
        path: 'bookedUsers.user',
        select: 'name email username avatar'
      })
      .populate({
        path: 'attendedUsers.user',
        select: 'name email username avatar'
      });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error fetching events by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events by category',
      error: error.message
    });
  }
};