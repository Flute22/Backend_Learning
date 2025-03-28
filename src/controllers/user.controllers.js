import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { User } from "../models/user.models.js";  
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()   
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token");
    }
}



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



const loginUser = asyncHandler( async ( req, res) => {
    // Steps for login user: 
    /* 
        1. Get the user details form frontend
        2. Validation - not empty
        3. Check if user exists: username, email
        4. Check the password
        5. Access and Refresh token
        6. Send secure Cookie 
        7. return the response
    */
        // Get the user details form frontend
        const { username, email, password } = req.body;


        // Validation - not empty
        if ( !(username || email) ) throw new ApiError(400, "Username or Email is required");


        // Check if user exists: username, email
        const user = await User.findOne({
            $or: [ {username}, {email} ]
        });

        if ( !user ) throw new ApiError(404, "User does not exist");
        
        
        // Check the password
        const isPasswordCorrect = await user.isPasswordCorrect(password)

        if ( !isPasswordCorrect ) throw new ApiError (401, "Invalid user credentials");


        // Access and Refresh token
        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)
        const loggedInUser = await User.findById(user._id).select("-password -refreshToken") 


        // Send secure Cookie

        // If we set the options for cookies then it's only modified by the server. If we don't set the options then it's modified by the anyone (Not secure).
        const options = {
            httpOnly: true, 
            secure: true
        }


        // return the response
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User Logged In Successfully"
                
            ));
} );



const logoutUser = asyncHandler( async (req, res) => {
    // First remove the refresh token from the database
    await User.findByIdAndUpdate(
        req.user._id,

        {
            $set: { refreshToken: undefined }
        },

        {
            new: true
        }
    )

    // Then remove the refresh token from the cookie
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))
} );



const refreshAccessToken = asyncHandler( async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if ( !incomingRefreshToken ) throw new ApiError(401, "Unauthorized request"); 

    const decodedToken = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id)

    if ( !user ) throw new ApiError(401, "Invalid refresh token");

    if ( incomingRefreshToken !== user?.refreshToken ) throw new ApiError(401, "Refresh token is expired or used");


    const options = { httpOnly: true, secure: true }

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200, { accessToken, newRefreshToken }, "Access token refreshed")
        )
} );



const changeCurrentPassword = asyncHandler( async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

    if ( !isPasswordCorrect ) throw new ApiError(400, "Invalid current password");

    user.password = newPassword
    await user.save( {validateBeforeSave: true} );

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));

} );



const getCurrentUser = asyncHandler( async (req, res) => {
    return res
        .status(200)
        .json(200, req.user, "Current user fetched successfully");
} );



const updateAccountDetails = asyncHandler( async (req, res) => {
    const { fullName, username, email } = req.body;

    if ( !fullName || !email ) throw new ApiError(400, "All fields are required.");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            } 
        },

        {
            new: true
        }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"));
} );



const updateUserAvatar = asyncHandler( async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if ( !avatarLocalPath ) throw new ApiError(400, "Avatar file is missing");

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if ( !avatar.url ) throw new ApiError(400, "Error while uploading avatar on cloudinary");

    const user = await User.findByIdAndUpdate(
        req.user?._id,

        { $set: { avatar: avatar.url } },

        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"));
} )



const updateUserCoverImage = asyncHandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if ( !coverImageLocalPath ) throw new ApiError(400, "Cover image file is missing");

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if ( !coverImage.url ) throw new ApiError(400, "Error while uploading cover image on cloudinary");

    const user = await User.findByIdAndUpdate(
        req.user?._id,

        { $set: { coverImage: coverImage.url } },

        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover image updated successfully"));
} );



const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})



const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})



export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}
