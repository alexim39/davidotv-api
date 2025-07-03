import express from 'express';
import {
    addEvent,
    getActiveEvents,
    getInactiveEvents,
    getEventBookedUsers,
    getEventsById,
    getEventsIAttended,
    getTrendingEvents,
    bookEvent,
    markEventInterest,
    getUserEventInterest,
    getAllEvents,
    getEventsByCategory
} from '../controllers/event.controller.js';
const EventRouter = express.Router();

// get all events
EventRouter.get('/', getAllEvents); 
// add new event
EventRouter.post('/new', addEvent);
// book a new event
EventRouter.post('/booked', bookEvent);
// mark event as interested
EventRouter.post('/interested', markEventInterest);
// get all active events
EventRouter.get('/active', getActiveEvents);
// get all inactive events
EventRouter.get('/inactive', getInactiveEvents);
// get trending events
EventRouter.get('/trending', getTrendingEvents); 
// get a event by ID
EventRouter.get('/:id', getEventsById);
// get a event by ID
EventRouter.get('/:category', getEventsByCategory);
// get event booked users
EventRouter.get('/booked-users/:eventId', getEventBookedUsers);
// get events i attended
EventRouter.get('/attended/:userId', getEventsIAttended);
// get event a user is interested in
EventRouter.get('/interested/:userId', getUserEventInterest)

export default EventRouter;