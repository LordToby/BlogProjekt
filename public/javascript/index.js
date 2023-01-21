//const { read } = require("fs");

let postImages;
console.log("Hello world!")
if(document.getElementsByClassName("post-image") != null){
    postImages= document.getElementsByClassName("post-image")
    let postImagesArray = Array.from(postImages);
    console.log(postImagesArray);
    postImagesArray.forEach(image=>{
        if(image.attributes[1].nodeValue === ""){
            image.style.visibility = "hidden";
            //image.style.borderStyle = "solid";
        }
    })
}
let preview = document.querySelector(".preview-image")
console.log(preview);
let fileName = document.querySelectorAll(".filename")[0];
fileName.addEventListener('change', function(){
    const reader = new FileReader()
    reader.addEventListener("load", () => {
        preview.src = reader.result
      })
       
      console.log(reader);
      reader.readAsDataURL(this.files[0])
});

