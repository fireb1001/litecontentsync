const fire = require('firebase')
const fs = require( 'fs' );
const axios = require( 'axios' );
const imgs_dir = './static/images/';
const posts_dir = './content/post/';

function downloadImage (url, image_path ) {
    axios( { 'url' : url, 'responseType' : 'stream' } ).then( response => {
    /*  
        let headerLine = response.data.headers['content-disposition']
        let startFileNameIndex = headerLine.indexOf('"') + 1
        let endFileNameIndex = headerLine.lastIndexOf('"')
        let filename = headerLine.substring(startFileNameIndex, endFileNameIndex)
    */
        response.data.pipe( fs.createWriteStream( imgs_dir+ image_path+ "-cover.jpg" ) )
        return { 'status' : true, 'error' : false };
    }).catch( error => {
        console.log(error)
    } );
}

const MD_BLKS = {
    FRONT_PLUS: "+++\n",
    DQ: "\"",
    NL: "\n"
}

function singleMDContent(content) {
    if(content.type === "md") {
        return content.content + MD_BLKS.NL
    }
    else if (content.type === "image") {
        return "!["+content.alt+"]("+content.src+")"
    }
}

function fm_val (label, value) {
    return label+": "+ MD_BLKS.DQ + value + MD_BLKS.DQ + MD_BLKS.NL
}

function createMD (post) {

    let post_content = MD_BLKS.FRONT_PLUS+ fm_val("title", post.title)+
        MD_BLKS.FRONT_PLUS
    if(post.md_contents) {
        post.md_contents.forEach(content_item => {
            post_content += singleMDContent(content_item) + MD_BLKS.NL
        });
    }

    fs.writeFileSync( posts_dir + post.slug+'.md',  post_content)
}

// SYNC !! 

function downloadPost (post) {
    downloadImage(post.cover,post.slug)
    createMD(post)
    return [post.cover]
}

fire.initializeApp({
    projectId: 'elecvue',
    databaseURL: 'https://elecvue.firebaseio.com'
  })

const db = fire.firestore()


db.collection('posts.accessories.wholesaleplaces').get().then(snap => {
    snap.forEach( doc => {
        console.log(downloadPost(doc.data()))
    })
    //process.exit(1)
})
