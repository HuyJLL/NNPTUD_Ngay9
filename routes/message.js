const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const Message = require('../schemas/message'); // Import schema đã tạo ở trên

// Cấu hình Multer để lưu file upload vào thư mục 'uploads/'
const upload = multer({ dest: 'uploads/' });

// Middleware giả lập User hiện tại (Bạn thay thế bằng middleware Auth của bạn)
const requireAuth = (req, res, next) => {
    // Giả sử đây là ID của user đang đăng nhập (lấy từ Token)
    req.user = { _id: '65fa1b2c3d4e5f6a7b8c9d01' }; 
    next();
};

router.use(requireAuth);

/**
 * 1. GET /:userID 
 * Lấy toàn bộ lịch sử tin nhắn giữa user hiện tại và userID (cả gửi đi và nhận lại)
 */
router.get('/:userID', async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const targetUserId = req.params.userID;

        const messages = await Message.find({
            $or: [
                { from: currentUserId, to: targetUserId },
                { from: targetUserId, to: currentUserId }
            ]
        }).sort({ createdAt: 1 }); // Sắp xếp cũ nhất -> mới nhất (chiều từ trên xuống như app chat)

        res.status(200).json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi server khi lấy lịch sử tin nhắn' });
    }
});

/**
 * 2. POST /
 * Gửi tin nhắn mới. Nếu form-data có chứa file (field name là 'file') thì type='file', ngược lại type='text'.
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const { to, text } = req.body;
        
        let msgType = 'text';
        let msgContent = text;

        // Kiểm tra xem có file được upload lên hay không
        if (req.file) {
            msgType = 'file';
            msgContent = req.file.path; // text sẽ là đường dẫn file
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

/**
 * 3. GET /
 * Lấy ra tin nhắn cuối cùng (mới nhất) của mỗi user mà user hiện tại đã từng nhắn tin.
 */
router.get('/', async (req, res) => {
    try {
        // Cần convert sang ObjectId để Aggregate có thể so sánh chính xác
        const currentUserId = new mongoose.Types.ObjectId(req.user._id);

        const recentChats = await Message.aggregate([
            // B1: Lọc ra tất cả tin nhắn mà user hiện tại tham gia (gửi hoặc nhận)
            {
                $match: {
                    $or: [{ from: currentUserId }, { to: currentUserId }]
                }
            },
            // B2: Sắp xếp giảm dần theo thời gian (mới nhất lên đầu)
            {
                $sort: { createdAt: -1 }
            },
            // B3: Group theo người đối diện (bạn chat)
            {
                $group: {
                    _id: {
                        // Nếu 'from' là mình, thì gom nhóm theo 'to'. Nếu không, gom theo 'from'
                        $cond: [
                            { $eq: ['$from', currentUserId] },
                            '$to',
                            '$from'
                        ]
                    },
                    // Vì đã sort ở B2, nên bản ghi đầu tiên được gom vào chính là tin nhắn mới nhất
                    lastMessage: { $first: '$$ROOT' } 
                }
            },
            // B4: Đẩy cấu trúc document ra ngoài cho gọn
            {
                $replaceRoot: { newRoot: '$lastMessage' }
            },
            // B5: Sắp xếp lại danh sách các phòng chat sao cho tin có tương tác mới nhất lên trên cùng
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
