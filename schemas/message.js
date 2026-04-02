const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    from: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    to: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    messageContent: {
        type: { 
            type: String, 
            enum: ['file', 'text'], 
            required: true 
        },
        text: { 
            type: String, 
            required: true // Nếu là 'text' thì chứa nội dung, nếu là 'file' thì chứa đường dẫn (path)
        }
    }
}, { 
    timestamps: true // Bắt buộc phải có để lấy ra tin nhắn cuối cùng dựa trên thời gian (createdAt)
});

module.exports = mongoose.model('Message', messageSchema);
