import { PlaylistModel } from '../models/playlist.model.js'; 
import { YoutubeVideoModel } from '../../youtube/models/youtube.model.js'; 
import mongoose from 'mongoose';

// create playlist
export const createPlaylist = async (req, res) => {
  try {
    const { title, content, visibility, userId } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ success: false, message: 'Title and user ID are required.' });
    }

    const newPlaylist = new PlaylistModel({
      title: title,
      description: content || '',
      owner: userId,
      isPublic: visibility === 'public',
    });

    const savedPlaylist = await newPlaylist.save();

    return res.status(201).json({
      message: 'Playlist created successfully.',
      data: savedPlaylist,
      success: true,
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    return res.status(500).json({ success: false, message: 'Failed to create playlist.' });
  }
};

// get all playlist for a user
export const getPlaylists = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required.' 
      });
    }

    // First get all playlists with basic info
    const playlists = await PlaylistModel.find({ owner: userId })
      .populate({
        path: 'owner',
        select: 'username avatar'
      })
      .sort({ createdAt: -1 })
      .lean();

    // For each playlist, fetch the first few videos to show as preview
    const playlistsWithVideos = await Promise.all(
      playlists.map(async (playlist) => {
        // Get first 3 videos for preview (adjust number as needed)
        const previewVideos = await YoutubeVideoModel.find({
          youtubeVideoId: { $in: playlist.videoIDs.slice(0, 3) }
        })
        .select('youtubeVideoId title thumbnail')
        .lean();

        return {
          ...playlist,
          previewVideos: previewVideos.map(video => ({
            ...video,
            thumbnailUrl: `https://i.ytimg.com/vi/${video.youtubeVideoId}/mqdefault.jpg`
          })),
          videoCount: playlist.videoIDs ? playlist.videoIDs.length : 0
        };
      })
    );

    return res.status(200).json({
      message: 'Playlists fetched successfully.',
      data: playlistsWithVideos,
      success: true,
    });

  } catch (error) {
    console.error('Error fetching playlists:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch playlists.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single playlist
export const getPlaylistById = async (req, res) => {
  try {
    const { playlistId } = req.params;

    // First get the playlist with owner and collaborators populated
    const playlist = await PlaylistModel.findById(playlistId)
      .populate({
        path: 'owner',
        select: 'username avatar'
      })
      .populate({
        path: 'collaborators',
        select: 'username avatar'
      })
      .lean();

    if (!playlist) {
      return res.status(404).json({ success: false, success: false, message: 'Playlist not found.' });
    }

    // Now fetch the videos using the videoIDs array
    const videos = await YoutubeVideoModel.find({
      youtubeVideoId: { $in: playlist.videoIDs || [] }
    })
    .select('youtubeVideoId title description channel channelId publishedAt thumbnail duration views likes dislikes commentCount engagementScore')
    .sort({ createdAt: -1 })
    .lean();

    // Format the videos with additional computed fields
    const formattedVideos = videos.map(video => ({
      ...video,
      thumbnailUrl: `https://i.ytimg.com/vi/${video.youtubeVideoId}/mqdefault.jpg`
    }));

    //console.log('Fetched videos:', formattedVideos);

    return res.status(200).json({
      message: 'Playlist fetched successfully.',
      data: {
        ...playlist,
        videos: formattedVideos,
        videoCount: formattedVideos.length
      },
      success: true,
    });

  } catch (error) {
    console.error('Error fetching playlist:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch playlist.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// add video to playlist
export const addVideoToPlaylist = async (req, res) => {
  try {
    const { userId, videoId, playlistId } = req.body;

    //console.log(req.body); return;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
      return res.status(400).json({ success: false, message: 'Invalid playlist ID' });
    }

    // Check if playlist exists
    const playlist = await PlaylistModel.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({success: false, message: 'Playlist not found' });
    }

    // Check if user owns the playlist
    if (playlist.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized to modify this playlist' });
    }

    // Check if video already exists in playlist
    if (playlist.videoIDs.includes(videoId)) {
      return res.status(400).json({ success: false, message: 'Video already in playlist' });
    }

    // Add video to playlist
    playlist.videoIDs.push(videoId);
    await playlist.save();

    res.status(200).json({ 
      message: 'Video added to playlist successfully',
      playlist,
      success: true, 
    });

  } catch (error) {
    console.error('Error adding video to playlist:', error);
    res.status(500).json({ success: false, message: 'Server error while adding video to playlist' });
  }
};

// edit playlist
export const editPlaylist = async (req, res) => {
  try {
    const { _id, title, description, isPublic, tags } = req.body;
    
    // Validate required fields
    if (!_id || !title) {
      return res.status(400).json({  success: false, message: 'Playlist ID and title are required' });
    }

    // Find and update the playlist
    const updatedPlaylist = await PlaylistModel.findOneAndUpdate(
      { _id },
      { 
        title,
        description,
        isPublic,
        tags,
        updatedAt: new Date()
      },
      { new: true } // Return the updated document
    );

    if (!updatedPlaylist) {
      return res.status(404).json({  success: false, message: 'Playlist not found' });
    }

    res.status(200).json({data: updatedPlaylist,  success: true, message: 'Playlist updated successfully'});
  } catch (error) {
    console.error('Error editing playlist:', error);
    res.status(500).json({  success: false, message: 'Server error while editing playlist' });
  }
};

// delete playlist
export const deletePlaylist = async (req, res) => {
  try {
    const { playlistId, userId } = req.params;
    //const userId = req.user._id; // Assuming you have user info from auth middleware

    // Validate playlist ID
    if (!playlistId) {
      return res.status(400).json({ message: 'Playlist ID is required' });
    }

    // Find the playlist and verify ownership
    const playlist = await PlaylistModel.findOne({ _id: playlistId, owner: userId });

    if (!playlist) {
      return res.status(404).json({ 
        message: 'Playlist not found or you are not the owner' 
      });
    }

    // Delete the playlist
    await PlaylistModel.deleteOne({ _id: playlistId });

    res.status(200).json({ 
      success: true,
      message: 'Playlist deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ 
      message: 'Server error while deleting playlist',
      error: error.message 
    });
  }
};

// remove video from playlist
export const removeVideoFromPlaylist = async (req, res) => {
  try {
    const { playlistId, videoId, userId } = req.params;



    // Validate input
    if (!playlistId || !videoId) {
      return res.status(400).json({ 
        success: false,
        message: 'Both playlistId and videoId are required' 
      });
    }

    // Find playlist and verify ownership
    const playlist = await PlaylistModel.findOne({ 
      _id: playlistId, 
      owner: userId 
    });

    if (!playlist) {
      return res.status(404).json({ 
        message: 'Playlist not found or you are not the owner',
        success: false,
      });
    }

    // Check if video exists in playlist
    const videoIndex = playlist.videoIDs.indexOf(videoId);
    if (videoIndex === -1) {
      return res.status(404).json({ 
        message: 'Video not found in this playlist',
        success: false,
      });
    }

    // Remove video and save
    playlist.videoIDs.splice(videoIndex, 1);
    playlist.updatedAt = new Date();
    await playlist.save();

    res.status(200).json({
      success: true,
      message: 'Video removed from playlist',
      updatedPlaylist: playlist
    });

  } catch (error) {
    console.error('Error removing video from playlist:', error);
    res.status(500).json({ 
      message: 'Server error while removing video from playlist',
      success: false,
      error: error.message 
    });
  }
};