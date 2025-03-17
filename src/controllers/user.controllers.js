import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { User } from "../models/user.models.js";  
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req, res) => {
    // Register user
    /* 
       1. Get the user details form frontend
       2. Validation - not empty
       3. Check if user already exists: username, email
       4. Check for images, check for avatar
       5. upload them to cloudinary, avatar
       6. Create user object - create entry in database
       7. Remove password and refresh token field from response
       8. return the response
    */
   
        // Get the user details from frontend
        const { fullName, username, email, password } = req.body;


        // Validation
        if (
            [fullName, email, username, password].some((field) => 
                typeof field !== "string" || field.trim() === "")
        ) {
            throw new ApiError(400, "All fields are required");
        };


        // Check if user already exists
        const existedUser = await User.findOne({
            $or: [{ username }, { email }]
        });
        
        if (existedUser) {
            throw new ApiError(409, "User with email or username already exists");
        };
        
        // Check for images, check for avatar
        const avatarLocalPath = req.files?.avatar[0]?.path;
        // const coverImageLocalPath = req.files?.coverImage[0]?.path;        

        let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImageLocalPath = req.files.coverImage[0].path;
        }

        if(!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is required");
        };


        // upload them to cloudinary, avatar
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        if (!avatar) {
            throw new ApiError(400, "avatar file is required");
        };


        // Create user object - create entry in database
        const user = await User.create({
            fullName,
            avatar: avatar.url, 
            coverImage: coverImage?.url || "",
            email, 
            password,
            username: username.toLowerCase()
        });
        
        
        // Remove password and refresh token field from response
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );
        
        if(!createdUser) {
            throw new ApiError(500, "Something went wrong while registering the user");
        }


        return res.status(201).json(
            new ApiResponse(200, createdUser, "User Registered Successfully")
        );
} );

export { registerUser }