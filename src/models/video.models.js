import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema({
    videoFile: {
        type: String, // Cloudinary Url
        required: true
    },

    thumbnail: {
        type: String, // Cloudinary Url
        required: true
    },

    title: {
        type: String,
        required: true
    },

    description: {
        type: String,
        requried: true
    },

    duration: {
        type: Number, // Cloudinary Url
        required: true
    },

    views: {
        type: Number,
        default: 0
    },

    isPublished: {
        type: Boolean,
        default: true
    },

    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
}, {timestamps: true})

// plugin() is method that allows you to add additional functionality to a schema. 
videoSchema.plugin(mongooseAggregatePaginate)

export const Video = mongoose.model("Video", videoSchema)