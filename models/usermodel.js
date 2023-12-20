const mongoose = require('mongoose')
const plm = require('passport-local-mongoose')

const userScehma = mongoose.Schema({
    username : String,
    email:String,
    contact : String,
    playlist : [
        {
            type:mongoose.Schema.Types.ObjectId,
            ref : 'playlist'
        }
    ],
    liked : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'song'
        }
    ],
    profileImage:{
        type : String,
        default: '/images/user.png.webp'
    },
    isAdmin:{
        type : Boolean,
        default : false
    }
})
userScehma.plugin(plm)
const usermodel = mongoose.model('user',userScehma)
module.exports = usermodel;