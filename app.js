//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const fileUpload = require('express-fileupload');
const fs = require("fs");
const _ = require("lodash");
require("dotenv").config();
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const { log } = require("console");
const { isErrored } = require("stream");
const cloudinary = require("cloudinary").v2;

//const homeStartingContent = "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";
const aboutContent = "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis purus sit. Egestas sed sed risus pretium quam vulputate dignissim suspendisse. Mauris in aliquam sem fringilla. Semper risus in hendrerit gravida rutrum quisque non tellus orci. Amet massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";
//const contactContent = "Scelerisque eleifend donec pretium vulputate sapien. Rhoncus urna neque viverra justo nec ultrices. Arcu dui vivamus arcu felis bibendum. Consectetur adipiscing elit duis tristique. Risus viverra adipiscing at in tellus integer feugiat. Sapien nec sagittis aliquam malesuada bibendum arcu vitae. Consequat interdum varius sit amet mattis. Iaculis nunc sed augue lacus. Interdum posuere lorem ipsum dolor sit amet consectetur adipiscing elit. Pulvinar elementum integer enim neque. Ultrices gravida dictum fusce ut placerat orci nulla. Mauris in aliquam sem fringilla ut morbi tincidunt. Tortor posuere ac ut consequat semper viverra nam libero.";

const app = express();

app.set('view engine', 'ejs');
app.use(fileUpload({
    limits: {
        fileSize: 10000000, // Around 10MB
    },
    abortOnLimit: true,
}));
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret:""+process.env.sessionPass,
    resave:false,
    saveUninitialized:true
}));
app.use(passport.initialize());
app.use(passport.session());

cloudinary.config({
    cloud_name:process.env.CLOUDINARY_NAME,
    api_key:process.env.API_KEY,
    api_secret:process.env.API_SECRET
});

mongoose.connect("mongodb+srv://"+process.env.mongoUrl);
// mongoose.connect("mongodb://0.0.0.0:27017/userDB");

const commentSchema = new mongoose.Schema({
    comment:String,
    userid : String,
    name : String
});

const blogSchema = new mongoose.Schema({
    userid : String,
    name : String,
    title : String,
    content : String,
    imageName:String,
    cloudinary_id : String,
    likeCount : Number,
    comments : [commentSchema]
});

const userSchema = new mongoose.Schema({
    name:String,
    email:String,
    password:String,
    likedpost:[String]    //blog id to be stored in this array
});

userSchema.plugin(findOrCreate);
userSchema.plugin(passportLocalMongoose);

blogSchema.index({title:"text" , content:"text"});

const User = mongoose.model("User",userSchema);
const Blog = mongoose.model("Blog",blogSchema);
const Comment = mongoose.model("Comment",commentSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user,done){
    done(null,user.id);
});
passport.deserializeUser(function(id,done){
    User.findById(id)
        .then(function(user){
            done(null,user);
        })
        .catch(function(err){
            done(err);
        });
});

app.get("/",function(req,res){
    Blog.find({})
        .then(function(blogList){
            res.render("homeBeforeAuth",{posts:blogList});
        });
});

app.get("/main",function(req,res){
    if(req.isAuthenticated()){
        Blog.find({})
            .then(function(blogList){
                
                User.findById({_id:req.user._id})
                    .then(function(user){
                        res.render("homeAfterAuth",{posts:blogList,userID:req.user._id,likedpost:user.likedpost});
                    });
            });
    }else{
        res.redirect("/login");
    }
});

app.get("/register",function(req,res){
    res.render("register");
});

app.get("/login",function(req,res){
    res.render("login");
});

app.get("/logout",function(req,res){
    req.logout(function(err){
        if(err){
            console.log(err);
        }else{
            res.redirect("/");
        }
    });
});

app.get("/about",function(req,res){
    res.render("about",{aboutContent : aboutContent});
});
app.get("/aboutBeforeAuth",function(req,res){
    res.render("aboutBeforeAuth",{aboutContent : aboutContent});
});

app.get("/contact",function(req,res){
    if(req.isAuthenticated()){
        res.render("contact");
    }else{
        res.redirect("/login");
    }
});
app.get("/contactBeforeAuth",function(req,res){
    res.render("contactBeforeAuth");
});

app.get("/compose",function(req,res){
    if(req.isAuthenticated()){
        res.render("compose");
    }else{
        res.redirect("/login");
    }
});

app.get("/delete/:deleteID",function(req,res){
    const reqDeleteID = req.params.deleteID;

    if(req.isAuthenticated()){
        Blog.findOneAndDelete({_id:reqDeleteID})
        .then(function(blog){
            cloudinary.uploader.destroy(blog.cloudinary_id,function(err,result){
                if(err) console.log(err);
                else console.log(result);
            });
        })
        .catch(function(err){
            console.log(err);
        });
    
        res.redirect("/main");
    }else{
        res.redirect("/login");
    }
});

app.get("/like/:docID",function(req,res){
    const reqID = req.params.docID;

    if(req.isAuthenticated()){
        Blog.updateOne({_id:reqID},{$inc:{likeCount:1}})
        .then(function(){
            User.updateOne({_id:req.user._id},{$push:{likedpost:reqID}})
                .catch(function(err){console.log(err);});
        })
        .catch(function(err){
            console.log(err);
        });

        res.redirect("/main");
    }else{
        res.redirect("/login");
    }
});

app.get("/userProfile",function(req,res){
    if(req.isAuthenticated()){
        Blog.find({userid:(req.user._id).toString()})
            .then(function(blogList){

                User.findById({_id:req.user._id})
                    .then(function(user){
                        res.render("profile",{posts:blogList,name:user.name,likedpost:user.likedpost});
                    });
            });
    }else{
        res.redirect("/login");
    }
});

app.post("/register",function(req,res){
    const user = new User({
        username:req.body.username,
        name : req.body.name
    });
    User.register(user,req.body.password,function(err,user){
        if(err){
            console.log(err);
            res.redirect("/login");
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/main");
            });
        }
    });
});

app.post("/login",function(req,res){
    const user = new User({
        name : req.body.name,
        username : req.body.username,
        password : req.body.password
    });
    req.login(user,function(err){
        if(err){
            console.log(err);
            res.redirect("/login");
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/main");
            });
        }
    });
});

app.post("/compose",function(req,res){
    const {image} = req.files;
    if(req.isAuthenticated()){
        // If no image submitted, exit
        if (!image) return res.sendStatus(400);
        // if (/^image/.test(image.jpg)) console.log("error");
        //moving image to images folder
        image.mv(__dirname + "/public/images/" + image.name);
        cloudinary.uploader.upload(__dirname+"/public/images/"+image.name,function(err,result){
            if(err) console.log(err);
            else{
                const userID = req.user._id;
        
                User.findById({_id:userID})
                    .then(function(data){

                        const post = {title : req.body.postTitle , content : req.body.postBody};
                        const blog = new Blog({
                            userid : userID,
                            name : data.name,
                            cloudinary_id : result.public_id,
                            title : post.title,
                            content : post.content,
                            imageName : image.name
                        });
                        blog.save();
                    });
            }
        });

        res.redirect("/main");
    }else{
        res.redirect("/login");
    }
});

app.get("/posts/:postID",function(req,res){
    const requestedID = req.params.postID;
    
    if(req.isAuthenticated()){
        Blog.findOne({_id:requestedID})
        .then(function(post){
            res.render("post",{postTitle : post.title , postBody : post.content , postImage : post.imageName , comments : post.comments,id:requestedID,userID:req.user._id,cloud_id:post.cloudinary_id});
        })
        .catch(function(err){
            console.log(err);
        });
    }else{
        res.redirect("/login");
    }

});

app.get("/posts/BeforeAuth/:postID",function(req,res){
    const requestedID = req.params.postID;

    Blog.findOne({_id:requestedID})
        .then(function(post){
            res.render("postBeforeAuth",{postTitle : post.title , postBody : post.content , postImage : post.imageName , comments : post.comments,cloud_id:post.cloudinary_id});
        })
        .catch(function(err){
            console.log(err);
        });
});

app.post("/search",function(req,res){
    if(req.isAuthenticated()){
        const searchInput = req.body.searchinput;
        Blog.find({$text:{$search: searchInput}},{score:{ $meta: "textScore" }}).sort( { score: { $meta: "textScore" } } )
            .then(function(bloglist){

                User.findById({_id:req.user._id})
                    .then(function(user){
                        res.render("search",{posts:bloglist,userID:req.user._id,likedpost:user.likedpost});
                    });
            })
            .catch(function(err){
                console.log(err);
            });
    }else{
        res.redirect("/login");
    }
});

app.post("/searchBeforeAuth",function(req,res){
    const searchInput = req.body.searchinput;
    Blog.find({$text:{$search: searchInput}},{score:{ $meta: "textScore" }}).sort( { score: { $meta: "textScore" } } )
        .then(function(bloglist){
            res.render("searchBeforeAuth",{posts:bloglist});
        })
        .catch(function(err){
            console.log(err);
        });
});

app.post("/comment",function(req,res){
    const {Usercomment,id} = req.body;

    if(req.isAuthenticated()){
        User.findById({_id:req.user._id})
        .then(function(ans){
            
            const data = new Comment({comment:Usercomment,userid:req.user._id,name:ans.name});
            data.save();    
            
            Blog.updateOne({_id:id},{$push:{comments:data}})
                .catch(function(err){
                    console.log(err);
                }); 
        });

        res.redirect("/posts/"+id);
    }else{
        res.redirect("/login");
    }
});

app.get("/posts/deleteComment/:postID/:commentID",function(req,res){
    
    if(req.isAuthenticated()){
        Comment.findByIdAndRemove({_id:req.params.commentID})
        .catch(function(err){
            console.log(err);
        });

        Blog.updateOne({_id:req.params.postID},{$pull:{comments:{_id:req.params.commentID}}})
            .catch(function(err){
                console.log(err);
            });
        res.redirect("/posts/"+req.params.postID);
    }else{
        res.redirect("/login");
    }
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
