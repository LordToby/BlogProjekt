//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");

const ejs = require("ejs");
const path = require("path")
const _ = require("lodash");
const mongoose = require("mongoose");
const mongodb = require("mongodb");
const passport = require("passport");
const localStrategy = require("passport-local").Strategy
const bcrypt = require("bcrypt");
const date = require(__dirname + "/date.js");
const { env } = require("process");
const multer = require("multer");
const fs = require("fs").promises;
const exp = require("constants");
const encrypt = require("mongoose-encryption");
const paginate = require("express-paginate");
const moment = require("moment");
const sanitizeHTML = require("sanitize-html");
let loggedIn = false;

//Sanitize html configs

const allowedTags = {
  b: true,
  i: true,
};

const sanitizeOptions = {
  allowedTags: allowedTags,
  allowedAttributes: {},
  allowedSchemes: [],
  transformTags: {
    br: function() {
      return '\n'; // Replace <br> with newline character
    },
  },
};

//const upload = multer({limits: {fileSize:1064960}, dest: __dirname + '/uploads'}).single("picture");

//-------------------------------------DB Setup-------------------------------

mongoose.connect(process.env.CONNECTION, {useNewUrlParser: true, useUnifiedTopology: true})

const postSchema = {
  title: String,
  content: String,
  date: String,
  img: String,
  audioFile: String
}

const userSchema = new mongoose.Schema({
  username:{
      type: String,
      required:true
  },
  password:{
      type:String,
      required: true
  }

});

// const audioSchema = new mongoose.Schema({
//   title: String,
//   artist: String,
//   album: String,
//   filename: String
// });

const Post = mongoose.model("Post", postSchema);
const User = mongoose.model("User", userSchema)
//const Audio = mongoose.model("Audio", audioSchema);


let storage = multer.diskStorage({
  destination: function(req, file, cb){
    cb(null,'./uploads')
  },
  filename: function(req, file, cb){
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
})

let upload = multer({storage:storage})

let isUpdate;
//---------------------------------------
const app = express();



let cookieSession = require('cookie-session')
let cookieParser = require("cookie-parser")
app.set('view engine', 'ejs');

const session = require("express-session");
const { split } = require('lodash');
const { application } = require('express');
const { buffer } = require('mongoose/lib/utils');
app.use(session({
    proxy: true,
    secret: process.env.SECRET,
    resave:false,
   // cookie: { maxAge: twoDay,secure:false },
    saveUnitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12, //12hours
    },
    cookie: { secure: false } // Remember to set this
}));

//passport.js

app.use(passport.initialize());
app.use(passport.session());



passport.use(new localStrategy(function(username, password, done){
  User.findOne({username:username}, function(err, user){
      if(err) return done(err);
      if(!user)
          return done(null, false, {message: "Incorrect username"})
      
      bcrypt.compare(password, user.password, function(err, res){
          if(err) return done(err);
          
          if(res === false){
              return done(null, false, {message: "Incorrect password"})
          }

          return done(null, user);

      })
  })
}))

passport.serializeUser(function(user, done){
  done(null, user.id);
})

passport.deserializeUser(function(id, done){
  User.findById(id, (err, user)=>{
      done(err, user)
  })

})


app.use(paginate.middleware(10, 50))
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "/uploads")));
app.use(express.static(path.join(__dirname + "/public")));
app.use(express.static(path.join(__dirname, "/public/javascript")))
app.use("/Images", express.static(__dirname + "/Images"))
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript')
    }
  }
}))
//app.use(cookieParser());
let emptyImage;

//-------------
let postsToShow = [];


//Routes 

app.get("/setup", async(req, res)=>{
  const exists = await User.exists({username:"admin"});

  if(exists){
      console.log("Exists");
      res.redirect("/login");
      return;
  }
  bcrypt.genSalt(10, function(err, salt){
      if(err) return next(err);
      bcrypt.hash(process.env.PASSWORD, salt, function(err, hash){
          if(err) return next(err);

          const newAdmin = new User({
              username:"admin",
              password: hash
          });
          console.log("New User added");

           newAdmin.save();
           res.redirect("/login");

      });
  });

});


function isLoggedIn(req, res, next){
  if(req.isAuthenticated()) return next();
  res.redirect("login")
}

function isLoggedOut(req, res, next){
  if(!req.isAuthenticated()) return next();
  res.redirect("/")
}

app.get("/", function(req, res){

  // Post.find({}).sort({date: -1}).exec((err, results)=>{
  //   if(!err){
  //     res.render("home", {posts:results.slice(0,3)})

      
  //   }
  // })
  Post.find({})
  .exec((err, results) => {
    if (!err) {
        const sortedResults = results.reverse();
      //   const sortedResults = results.sort((a, b) => {
      //   // Parse date strings into Date objects
      //   const aDateParts = a.date.split("/");
      //   const aDate = new Date(aDateParts[2], aDateParts[1] - 1, aDateParts[0]);
      //   const bDateParts = b.date.split("/");
      //   const bDate = new Date(bDateParts[2], bDateParts[1] - 1, bDateParts[0]);

      //   // Compare dates
      //   const yearDiff = bDate.getFullYear() - aDate.getFullYear();
      //   if (yearDiff !== 0) {
      //     return yearDiff;
      //   }
      //   return bDate.getMonth() - aDate.getMonth();
      // });
      const topPosts = sortedResults.slice(0, 3);
      res.render("home", { posts: topPosts });
    }
  });


});

let thisPage;


app.get("/postsOverview/:page", async (req, res, next) => {
  const perPage = 5;
  const page = req.params.page;
  
  const count = await Post.countDocuments({});
  const totalPages = Math.ceil(count / perPage);

  Post.find({})
    .exec((err, posts) => {
      if (err) {
        return next(err);
      }
      const sortedPosts = posts.reverse();
      // const sortedPosts = posts.sort((a, b) => {
      //   // Parse date strings into Date objects
      //   const aDateParts = a.date.split("/");
      //   const aDate = new Date(aDateParts[2], aDateParts[1] - 1, aDateParts[0]);
      //   const bDateParts = b.date.split("/");
      //   const bDate = new Date(bDateParts[2], bDateParts[1] - 1, bDateParts[0]);

      //   // Compare dates
      //   const yearDiff = bDate.getFullYear() - aDate.getFullYear();
      //   if (yearDiff !== 0) {
      //     return yearDiff;
      //   }
      //   return bDate.getMonth() - aDate.getMonth();
      // });
      const paginatedPosts = sortedPosts.slice(
        (perPage * page) - perPage,
        perPage * page
      );
      paginatedPosts.forEach(e=>{
        e.content = sanitizeHTML(e.content);
      })
      res.render("postsOverview", {
        posts: paginatedPosts,
        current: page,
        pages: totalPages
      });
    });
});

    

app.get("/about", function(req, res){
  res.render("about");
});

app.get("/contact", function(req, res){
  res.render("contact");
});

//isLoggedIn
app.get("/admin", isLoggedIn, (req, res)=>{
  Post.find({}).sort({date: -1}).exec((err, results)=>{
    if(!err){
      res.render("admin", {
        posts: results.reverse()
        });
    }
    else{
      res.render("admin", {
        posts: postsToShow
      })
    }
   
  })

})
//isLoggedIn
//isLoggedIn
app.get("/compose", function(req, res){
  isUpdate = false;
  res.render("compose",{title: "", content: "", postImage: "",postAudio:"", postId: null, isUpdate:isUpdate, date: null});
});
//isLoggedIn
app.get("/compose/:postId", isLoggedIn, (req, res)=>{
  isUpdate = true;
  const requestedId = req.params.postId;
  Post.findById(requestedId, (err, post)=>{
    if(!err){
      res.render("compose", {title: post.title, content: post.content, postImage:post.img, postAudio: post.audioFile, postId: requestedId, isUpdate: isUpdate, date: post.date})
    }
    else{
      res.redirect("admin")
    }
  })
})

app.post("/compose", upload.fields([{ name: "postImage" }, { name: "audioField" }]),  function(req, res){
  let title = req.body.postTitle;
  let content = req.body.postBody.trim();
  let id = req.body.postId;
  let reqDate = req.body.date;
  //let reqAudi = 

  //For Image
  let image = "";
  if(req.files["postImage"] != undefined){
    image = req.files["postImage"][0].filename;
  }
  else{
    image = emptyImage;
  }

  //For audio
  let audio = "";
  if(req.files["audioField"] != undefined){
    audio = req.files["audioField"][0].filename;
  }

  let time = null;
  let date = null;
  if(reqDate === ' '){
    time = new Date().toLocaleDateString("en-GB", {timeZone: 'Europe/Copenhagen'})
    date = time.split(',');
  }

  if(!isUpdate){ //

   console.log(audio, "is not null")
    const post = new Post({
      title: title,
      content: content,
      date: date[0],
      img: image,
      audioFile: audio
    });
    post.save((err)=>{
      if(!err){
        res.redirect("/admin");
      }
      else{
        res.redirect("/compose")
      }
    });
  }
  else{
    if(req.files["postImage"] === undefined){
      console.log("Det er sgu undefined");
      image = req.body.imageSource;
    }
    else{
      console.log("sæt nyt billede!")
      image = req.files["postImage"][0].filename;
    }
    if (req.files["audioField"] === undefined) {
      audio = req.body.audioSource;
    } else {
      audio = req.files["audioField"][0].filename;
    }

    Post.findByIdAndUpdate(id, {title: title, content:content, img: image, audioFile: audio, date: reqDate}, (err, document)=>{
      if(!err){
        console.log(document.title + " updated with new data");
        res.redirect("/admin");
      }
    })


  }
 
  

  //posts.push(post);



});

app.post("/deletePost", (req, res)=>{
  const id = req.body.deleteId;
  console.log(id);
  Post.findByIdAndDelete(id, (err, document)=>{
    if(!err){
      console.log("document deleted: ", document.title);
      res.redirect("/admin")
    }
  })
})




app.get("/posts/:postId", function(req, res){
  const requestedId = req.params.postId;


   Post.findOne({_id: requestedId}, (err, result)=>{
    if(!err){
      result.content = sanitizeHTML(result.content)
      res.render("post", {post:result})
    }
  });

  // posts.forEach(function(post){
  //   const storedTitle = _.lowerCase(post.title);

  //   if (storedTitle === requestedTitle) {
  //     res.render("post", {
  //       title: post.title,
  //       content: post.content
  //     });
  //   }
  // });

});

app.get("/login", isLoggedOut, (req, res)=>{
  let response = {
      title:"login",
      error: req.query.error
  };
  res.render("login", response)
})

app.post("/login", passport.authenticate('local', {
  successRedirect: "/admin",
  failureRedirect: "/login?error=true"
}),
)

app.get("/logout", (req, res)=> {
  req.logout((err)=>{
      if(err){
          return next(err);
      }
      res.redirect("/admin")
  });

});

function preview(obj){
  if (FileReader)
{
  let reader = new FileReader();
  reader.readAsDataURL(obj.files[0]);
  reader.onload = function (e) {
  let image=new Image();
  image.src= e.target.result;

  image.onload = function () {
    document.getElementById(outImage).src=image.src;
  };

  }
}
else
{
  alert("Der skete en fejl!")
}
}

function stripHtmlTags(text) {
  // remove HTML tags from text using a regular expression
  return text.replace(/<\/?[^>]+(>|$)/g, "");
}


let port = process.env.PORT;
if (port == null || port == "") {
  port = 4000;
}
app.listen(port, function() {
  console.log("Server started on port 4000");
});
