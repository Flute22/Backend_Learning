import { v2 as cloudinary } from "cloudinary";

// fs (file system) is a built-in node module that provides a way to interact with the file system. 
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        
        // upload the file on cloudinary
        let response = await cloudinary.uploader.upload(
            localFilePath, 
           
            {
                resource_type: "auto",
            }
        );

        fs.unlinkSync(localFilePath);

        return response

    } catch (error) {
        // remove the locally saved temporary file as the upload operation got failed
        fs.unlinkSync(localFilePath)
        
        return null;
    }
}


export { uploadOnCloudinary }