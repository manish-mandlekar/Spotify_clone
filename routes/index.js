var express = require('express');
var router = express.Router();
const userModel = require('../models/usermodel')
const songModel = require('../models/songmodel')
const playlistModel = require('../models/playlistmodel')
const passport = require("passport");
const localStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose')
var multer = require('multer')
var crypto = require('crypto')
const {Readable} = require('stream')
var id3 = require('node-id3')
mongoose.connect('mongodb://0.0.0.0/spotify').then(()=>{
  console.log('Connected To Database');
}).catch(err =>{
  console.log(err);
})

const conn = mongoose.connection
var gfsBucket , gfsBucketPoster
conn.once('open',() =>{
gfsBucket = new mongoose.mongo.GridFSBucket(conn.db,{
  bucketName : 'audio'
})
gfsBucketPoster = new mongoose.mongo.GridFSBucket(conn.db,{
  bucketName : 'poster'
})
})

passport.use(new localStrategy(userModel.authenticate()));

/* GET home page. */
router.get('/', isLoggedIn,async function(req, res, next) {
  const currentuser = await userModel.findOne({
    _id:req.user._id
  }).populate('playlist').populate({ 
    path: 'playlist',
    populate: {
      path: 'songs',
      model: 'song'
    } 
 })
  res.render('index', {currentuser});
});
/*user authentication code */
router.get('/auth', function(req, res, next) {
  res.render('register');
});
router.get('/singup', function(req, res, next) {
  res.render('singup');
});



router.post('/register', function (req, res) {
  var newUser = new userModel({
    username: req.body.username,
    email: req.body.mail,
  })


  userModel.register(newUser, req.body.password)
  .then(function (u) {
    passport.authenticate('local')(req, res, async function () {
      const songs = await songModel.find()
  const defaultplaylist =await playlistModel.create({
    name : req.body.username,
    owner : req.user._id,
    songs : songs.map(song=>song._id)
     
  })
  const newUser = await userModel.findOne({
    _id : req.user._id
  })
  newUser.playlist.push(defaultplaylist._id)
  await newUser.save();

  

      res.redirect('/');
    })
  })
});
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/auth",
  }),
  function (req, res, next) {}
);
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  else {
    res.redirect('/auth');
  }
}

function isAdmin(req,res,next){
  if (req.user.isAdmin) return next()
  else return res.redirect('/')
}

router.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

/*user authentication code */
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

router.get('/uploadMusic',isLoggedIn,isAdmin, function(req, res, next) {
  res.render('uploadMusic');
});
router.get('/poster/:posterName', function(req, res, next) {
  gfsBucketPoster.openDownloadStreamByName(req.params.posterName).pipe(res)
});
router.post('/uploadMusic',isLoggedIn,isAdmin,upload.array('song'), async (req, res, next)=>{
   
  await Promise.all(req.files.map(async file=>{

    
    const randomName = crypto.randomBytes(20).toString('hex')
    console.log(file.buffer);
    const songData = id3.read(file.buffer)
    
    Readable.from(file.buffer).pipe(gfsBucket.openUploadStream(randomName))
    Readable.from(songData.image.imageBuffer).pipe(gfsBucketPoster.openUploadStream(randomName + 'poster'))
    
    await songModel.create({
      title : songData.title,
      artist : songData.artist,
      album : songData.album,
      size : file.size,
      poster :randomName + 'poster',
      filename : randomName
    })
  }))

 res.send('song uploaded')
})
 
router.get('/stream/:songname', async(req,res,next)=>{
const currentSong = await songModel.findOne({
  filename : req.params.songname

})
const stream = gfsBucket.openDownloadStreamByName(req.params.songname)

res.set('Content-Type','audio/mpeg')
res.set('Content-Length',currentSong.size + 1)
res.set('Content-Range',`bytes 0-${currentSong.size - 1}/${currentSong.size}`)
res.set('Content-Ranges','bytes')
res.status(206)

stream.pipe(res)

})

module.exports = router;

