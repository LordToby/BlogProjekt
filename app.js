//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
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
const fs = require("fs");
const exp = require("constants");
const encrypt = require("mongoose-encryption");
const paginate = require("express-paginate");
//const upload = multer({limits: {fileSize:1064960}, dest: __dirname + '/uploads'}).single("picture");

//-------------------------------------DB Setup-------------------------------

mongoose.connect(`${process.env.CONNECTION}`, {useNewUrlParser: true, useUnifiedTopology: true})

const postSchema = {
  title: String,
  content: String,
  date: String,
  img: String
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

const Post = mongoose.model("Post", postSchema);
const User = mongoose.model("User", userSchema);

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

app.use(paginate.middleware(10, 50))
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "/uploads")));
app.use(express.static(path.join(__dirname + "/public")));
app.use(express.static(path.join(__dirname, "/public/javascript")))
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));
//app.use(cookieParser());
app.use(session({
    secret: process.env["SESSION-SECRET"],
    resave:false,
    saveUnitialized: true,
}));

//passport.js

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done){
  done(null, user.id);
})

passport.deserializeUser(function(id, done){
  User.findById(id, (err, user)=>{
      done(err, user)
  })

})

passport.use(new localStrategy(function(username, password, done){
  User.findOne({username: username}, function(err, user){
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


//-------------
let postsToShow = [];


//Routes 

app.get("/setup", async(req, res)=>{
  const exists = await User.exists({name:"admin"});

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

  // if(posts.length > 0){
  //   postsToShow = posts;
  // }

  Post.find({}, (err, results)=>{
    if(!err){
      const slicedArray = results.slice(0, 3)
      res.render("home",{posts:slicedArray})
    }
  })

  //res.render("home");

  
      
});

let thisPage;

app.get("/postsOverview/:page", async(req, res, next)=>{

 const perPage = 5;
 const page = req.params.page;
 //const total = await Post.countDocuments({});

 Post
 .find({})
  .skip((perPage * page) - perPage)
  .limit(perPage)
  .exec(function(err, posts){
    Post.count().exec(function(err, count){
      if(err) return next(err);
      res.render("postsOverview",{posts:posts, current:page, pages: Math.ceil(count/perPage)})
    })
  })
    
  })
 
  //if(err) throw err

  // Post.find({}, (err,posts)=>{
  //   if(!err){
  //    // posts = posts.toArray();
  //    // posts = posts.sort({"_id:": -1}).skip(startFrom).limit(perPage).toArray();
  //     res.render("postsOverview", {
  //       posts: posts,
  //       pages: pages
  //       });
  //   }
  //   else{
  //     res.render("postsOverview", {
  //       posts: postsToShow
  //     })
  //   }
   
  //  }).sort({"id": -1}).skip(startFrom).limit(perPage)


app.get("/about", function(req, res){
  res.render("about");
});

app.get("/contact", function(req, res){
  res.render("contact");
});

//isLoggedIn
app.get("/admin", isLoggedIn, (req, res)=>{
  Post.find({}, (err,posts)=>{
    if(!err){
      res.render("admin", {
        posts: posts
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
app.get("/compose",  function(req, res){
  isUpdate = false;
  res.render("compose",{title: "", content: "", postImage: "", postId: null, isUpdate:isUpdate});
});
//isLoggedIn
app.get("/compose/:postId", (req, res)=>{
  isUpdate = true;
  const requestedId = req.params.postId;
  Post.findById(requestedId, (err, post)=>{
    if(!err){
      res.render("compose", {title: post.title, content: post.content, postImage:post.img, postId: requestedId, isUpdate: isUpdate})
    }
    else{
      res.redirect("admin")
    }
  })
})
//isLoggedIn,
app.post("/compose", upload.single("postImage"),  function(req, res){
  let title = req.body.postTitle;
  let content = req.body.postBody;
  let id = req.body.postId;
  //For Image
  let image = "";
  if(req.file != undefined){
    image = req.file.filename;
  }


  // let image = {
  //   img:{data: fs.readFileSync(path.join(__dirname + "/uploads/" + req.file.filename)),
  //        contentType: "image/png"}
  // }
  // var img = fs.readFileSync(req.file.path);
  // var encode_img = img.toString('base64');
  // var final_img = {
  //   contentType: req.file.mimetype,
  //   image: new Buffer.from(encode_img, 'base64')
  // };

  if(!isUpdate){

    const time = new Date().toLocaleDateString({timeZone: 'Europe/Copenhagen'})
    let date = time.split(",");
    const post = new Post({
      title: title,
      content: content,
      date: date[0],
      img: image
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
    if(req.file === undefined){
      image = req.body.imageSource;
    }
    else{
      image = req.file.filename;
    }

    Post.findByIdAndUpdate(id, {title: title, content:content, img: image}, (err, document)=>{
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
}))

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



app.listen(3000, function() {
  console.log("Server started on port 3000");
});
