const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const Message = require('../schemas/message'); 
const upload = multer({ dest: 'uploads/' });
const requireAuth = (req, res, next) => {
    req.user = { _id: '65fa1b2c3d4e5f6a7b8c9d01' }; 
    next();
};

router.use(requireAuth);


router.get('/:userID', async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const targetUserId = req.params.userID;

        const messages = await Message.find({
            $or: [
                { from: currentUserId, to: targetUserId },
                { from: targetUserId, to: currentUserId }
            ]
        }).sort({ createdAt: 1 }); 

        res.status(200).json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi server khi lấy lịch sử tin nhắn' });
    }
});

router.post('/', upload.single('file'), async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const { to, text } = req.body;
        
        let msgType = 'text';
        let msgContent = text;
        if (req.file) {
            msgType = 'file';
            msgContent = req.file.path;
        }

        if (!to || (!text && !req.file)) {
            return res.status(400).json({ error: 'Thiếu dữ liệu: "to" và ("text" hoặc "file")' });
        }

        const newMessage = new Message({
            from: currentUserId,
            to: to,
            messageContent: {
                type: msgType,
                text: msgContent
            }
        });

        const savedMessage = await newMessage.save();
        res.status(201).json(savedMessage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi server khi gửi tin nhắn' });
    }
});

router.get('/', async (req, res) => {
    try {
        const currentUserId = new mongoose.Types.ObjectId(req.user._id);

        const recentChats = await Message.aggregate([
            {
                $match: {
                    $or: [{ from: currentUserId }, { to: currentUserId }]
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$from', currentUserId] },
                            '$to',
                            '$from'
                        ]
                    },
                    lastMessage: { $first: '$$ROOT' } 
                }
            },
            {
                $replaceRoot: { newRoot: '$lastMessage' }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        res.status(200).json(recentChats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi server khi lấy danh sách tin nhắn gần đây' });
    }
});

module.exports = router;
