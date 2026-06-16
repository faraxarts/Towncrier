const Message = require("../models/Message");

exports.createMessage = async (req, res) => {
  try {
    const title = req.body.title?.trim();
    const preacher = req.body.preacher?.trim();
    const description = req.body.description?.trim();
    const mediaType = req.body.mediaType?.trim();
    const mediaUrl = req.body.mediaUrl?.trim();
    const eventDate = req.body.eventDate;

    if (!title || !preacher || !description || !mediaType || !mediaUrl || !eventDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const allowedMediaTypes = ["audio", "video", "image", "pdf"];
    if (!allowedMediaTypes.includes(mediaType.toLowerCase())) {
      return res.status(400).json({ message: "Invalid media type" });
    }

    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid event date" });
    }

    const newMessage = new Message({
      title,
      preacher,
      description,
      mediaType: mediaType.toLowerCase(),
      mediaUrl,
      eventDate: parsedDate,
      uploadedBy: req.session.userId,
    });

    await newMessage.save();

    res.status(201).json({
      message: "Message uploaded successfully",
      data: newMessage,
    });
  } catch (error) {
    console.error("Create message error:", error);
    res.status(500).json({ message: "Server error" });
  }
};