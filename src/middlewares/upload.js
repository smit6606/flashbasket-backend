import multer from 'multer';

// Dummy implementation that just stores files in memory for now
const storage = multer.memoryStorage();

export const upload = multer({
    storage
});
