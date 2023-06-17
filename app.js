//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const fileUpload = require('express-fileupload');
const fs = require("fs");
const _ = require("lodash");
require("dotenv").config();
const mongoose = require("mongoose");
const { log } = require("console");
//mongoose.connect("mongodb+srv://admin-harsh:"+ process.env.mongoPass +"@cluster0.xoqf80d.mongodb.net/blogDB");

mongoose.connect("mongodb://0.0.0.0:27017/userDB");

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

const blogSchema = new mongoose.Schema({
    title : String,
    content : String,
    imageName:String
});

blogSchema.index({title:"text" , content:"text"});

const Blog = mongoose.model("Blog",blogSchema);

// var posts=[];

app.get("/",function(req,res){
    Blog.find({})
        .then(function(blogList){
            res.render("home",{posts:blogList});
        });
});

app.get("/about",function(req,res){
    res.render("about",{aboutContent : aboutContent});
});

app.get("/contact",function(req,res){
    res.render("contact");
});

app.get("/compose",function(req,res){
    res.render("compose");
});

app.get("/delete/:deleteID",function(req,res){
    const reqDeleteID = req.params.deleteID;

    Blog.findOneAndDelete({_id:reqDeleteID})
        .then(function(blog){
            const pathtofile = __dirname+"/public/images/"+blog.imageName;
            fs.unlink(pathtofile,function(err){
                if(err) console.log(err);
                else console.log("successfully deleted");
            })
        })
        .catch(function(err){
            console.log(err);
        });
    
    res.redirect("/");
});

app.post("/compose",function(req,res){
    const {image} = req.files;
    
    // If no image submitted, exit
    if (!image) return res.sendStatus(400);
    // if (/^image/.test(image.jpg)) console.log("error");
    //moving image to images folder
    image.mv(__dirname + "/public/images/" + image.name);
    
    const post = {title : req.body.postTitle , content : req.body.postBody};
    const blog = new Blog({
        title : post.title,
        content : post.content,
        imageName : image.name
    });
    blog.save();
    res.redirect("/");
});

app.get("/posts/:postID",function(req,res){
    const requestedID = req.params.postID;
    
    Blog.findOne({_id:requestedID})
        .then(function(post){
            res.render("post",{postTitle : post.title , postBody : post.content , postImage : post.imageName});
        })
        .catch(function(err){
            console.log(err);
        });

});

app.post("/search",function(req,res){
    //take input entered by user in search input 
    //perform text search functionality
    //will have array of it
    //render home ejs file by passing array to it

    const searchInput = req.body.searchinput;
    Blog.find({$text:{$search: searchInput}},{score:{ $meta: "textScore" }}).sort( { score: { $meta: "textScore" } } )
        .then(function(bloglist){
            res.render("search",{posts:bloglist});
        })
        .catch(function(err){
            console.log(err);
        });
});


app.listen(3000, function() {
  console.log("Server started on port 3000");
});
