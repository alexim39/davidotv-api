import express from 'express';
import {
    createPlaylist,
    getPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    editPlaylist,
    deletePlaylist,
    removeVideoFromPlaylist
} from '../controllers/playlist.controller.js'

const PlaylistRouter = express.Router();

PlaylistRouter.post('/new', createPlaylist);
PlaylistRouter.put('/edit', editPlaylist);
PlaylistRouter.post('/add-video', addVideoToPlaylist);
PlaylistRouter.get('/details/:playlistId', getPlaylistById);
PlaylistRouter.get('/:userId', getPlaylists);
PlaylistRouter.delete('/delete/:playlistId/:userId', deletePlaylist);
PlaylistRouter.delete('/video/delete/:videoId/:userId/:playlistId', removeVideoFromPlaylist);


export default PlaylistRouter;