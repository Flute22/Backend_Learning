import multer from "multer";

// There two type storage options in multer which you can use - memory storage and disk storage. Here we are using disk storage because we want to save the file on disk, and memory storage is used when you want to save the file in memory (RAM) and not on disk.

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './public/temp')
    },

    filename: function(req, file, cb) {
        cb(null, file.originalname)
    }
})

export const upload = multer({storage: storage})