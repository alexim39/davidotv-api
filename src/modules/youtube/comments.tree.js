/**
 * Comment tree builder — ported 1:1 from the legacy youtube controller so the
 * new cached `GET /videos/:id` returns the exact nested shape the FE
 * video-comments components render (`comment.user`, `comment.replies[]`).
 * Pure function: input is the populated lean comments array.
 */
export const buildCommentTree = (comments) => {
  const commentMap = new Map();
  const topLevelComments = [];
  const replyMap = new Map();

  // First pass: map by _id, separate replies from top-level
  comments.forEach((comment) => {
    commentMap.set(comment._id.toString(), { ...comment });
    if (comment.parentComment) {
      const key = comment.parentComment.toString();
      if (!replyMap.has(key)) replyMap.set(key, []);
      replyMap.get(key).push(comment._id.toString());
    } else {
      topLevelComments.push(comment._id.toString());
    }
  });

  // Second pass: recursively attach replies
  const attachReplies = (commentId) => {
    const comment = commentMap.get(commentId);
    if (!comment) return null;

    // Flatten populated user and likedBy data
    comment.user = {
      _id: comment.userId?._id,
      username: comment.userId?.username,
      name: comment.userId?.name,
      lastname: comment.userId?.lastname,
      avatar: comment.userId?.avatar,
    };
    comment.likedBy = (comment.likedBy || []).map((user) => ({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
    }));
    delete comment.userId;

    comment.replies = [];

    if (replyMap.has(commentId)) {
      replyMap.get(commentId).forEach((replyId) => {
        const reply = attachReplies(replyId);
        if (reply) comment.replies.push(reply);
      });
      comment.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    return comment;
  };

  const finalComments = topLevelComments.map((id) => attachReplies(id)).filter(Boolean);
  finalComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return finalComments;
};

export default buildCommentTree;
