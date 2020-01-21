const fire = require('firebase')
const fs = require( 'fs' );
const axios = require( 'axios' );
const imgs_dir = './static/images/';
const posts_dir = './content/post/';
const images_dir = './content/image/';

const MD_BLKS = {
    FRONT_PLUS: "+++\n",
    DQ: "\"",
    DDQ: "\"\"",
    NL: "\n"
}

function getArgs () {
    const args = {}
    process.argv
        .slice(2, process.argv.length)
        .forEach( arg => {
        // long arg
        if (arg.slice(0,2) === '--') {
            const longArg = arg.split('=')
            let value = (longArg[1]==='true') ? true: longArg[1]
            args[longArg[0].slice(2,longArg[0].length)] = value
        }
        // flags
        else if (arg[0] === '-') {
            const flags = arg.slice(1,arg.length).split('')
            flags.forEach(flag => {
            args[flag] = true
            })
        }
        })
    return args
}

function downloadImage (url, img_name ) {
    return axios( { 'url' : url, 'responseType' : 'stream' } ).then( response => {
        let type = response.data.headers['content-type'] 
        console.log(img_name,type)
        let ext = (type === 'image/jpeg' || type === 'image/jpg')? '.jpg' :' ';// init ext
        ext = (type === 'image/webp')? '.webp' : ext ;
        ext = (type === 'image/png')? '.png' : ext;// check ext if png or leave as it is
    /*  
        let headerLine = response.data.headers['content-disposition']
        let startFileNameIndex = headerLine.indexOf('"') + 1
        let endFileNameIndex = headerLine.lastIndexOf('"')
        let filename = headerLine.substring(startFileNameIndex, endFileNameIndex)
    */  
        // console.log(type, img_name, ext)
        response.data.pipe( fs.createWriteStream( imgs_dir+ img_name+ ext ) )
        return { 'status' : true, 'error' : false, file_path: '/images/'+ img_name+ ext };
    }).catch( error => {
        console.error("error", error)
    } );
}

async function singleMDContent(content) {

    if(content.type === "md") {
        return content.content + MD_BLKS.NL
    }
    else if (content.type === "image") {
        let img_alt = content.alt ? content.alt : content.caption
        // First Download
        let img_data = await downloadImage(content.src, content.slug)
        // return "!["+content.alt+"]("+img_data.file_path+ " "+ MD_BLKS.DQ + content.caption + MD_BLKS.DQ +")"
		let img_slug = content.linked ? " img_slug=\""+content.slug+ MD_BLKS.DQ : ""
		
        if(img_data)
            return "{{< figure src=" + MD_BLKS.DQ +
                img_data.file_path+ MD_BLKS.DQ +
                " alt=\"" + img_alt + MD_BLKS.DQ +
                " position=\"center\"" + 
				img_slug +
                " caption=\"" + content.caption + MD_BLKS.DQ +
                " >}}"
    }
}

function fm_val (label, value) {
    if(value)
        return label+"= "+ MD_BLKS.DQ + value + MD_BLKS.DQ + MD_BLKS.NL
    else
        return ''
}

function is_JSON(value) {
    if(value) {
        try {
            // It's a number or string 
            return typeof JSON.parse(value)
        } catch (error) {
            return false
        }
    } 
    else return false
}

function toml_val(label, value) {
    if( is_JSON(value)) {
        return label + ' = '+ value
    }
    else { // String
        return label + ' = '+ MD_BLKS.DQ + value + MD_BLKS.DQ
    }
}

async function createMD (post) {
    let post_content = MD_BLKS.FRONT_PLUS +
        fm_val("title", post.title) +
        fm_val("cover", post.front_matter.cover) +
        fm_val("author", post.front_matter.author)+
        fm_val("description", post.front_matter.description)+
        fm_val("date", post.front_matter.date)+
        MD_BLKS.NL+MD_BLKS.FRONT_PLUS+MD_BLKS.NL

    if(post.md_contents) {
        /*
        post.md_contents.forEach(content_item => {
            // post_content += singleMDContent(content_item) + MD_BLKS.NL
            singleMDContent(content_item).then(md_content =>{
                post_content += md_content + MD_BLKS.NL
            })
        });
        post.md_contents.map(async(value) => { // map instead of forEach
            const result = await singleMDContent(value);
            console.log(res)
        })
        */
        
        await Promise.all(post.md_contents.map(async(value, index) => { // map instead of forEach
            
            const result = await singleMDContent(value);
            post.md_contents[index].processed_md = result + MD_BLKS.NL
            // post_content += result + MD_BLKS.NL
        }));

        // After resolving content markdown write it noramlly by same order
        post.md_contents.forEach(content_item => {
            post_content += content_item.processed_md + MD_BLKS.NL
        })
    }

    fs.writeFileSync( posts_dir + post.slug+'.md',  post_content)
    return
}

async function createImageMD (image_post) {
    let image_content = MD_BLKS.FRONT_PLUS +
        fm_val("title", image_post.caption) +
        fm_val("image", image_post.src) +
        fm_val("author", image_post.parent.author)+
        fm_val("type", "image")+
        fm_val("layout", "image_ly")+ // TODO get from config
        // fm_val("description", post.front_matter.description)+
        fm_val("date", image_post.parent.date)+
		fm_val("parent_slug", image_post.parent.slug)+
		fm_val("parent_cover", image_post.parent.cover)+
		fm_val("parent_title", image_post.parent.title)+
		fm_val("parent_description", image_post.parent.description)+
        MD_BLKS.NL+MD_BLKS.FRONT_PLUS+MD_BLKS.NL

    image_content += image_post.content
    // TODO Linking image with content

    fs.writeFileSync( images_dir + image_post.slug+'.md',  image_content)
    return
}

async function downloadPost (post, type = 'post') {
    // First Download post cover or image src
    if(type == 'post') {
        if(post.draft) return
        await downloadImage(post.front_matter.cover, post.slug).then( async data => {
            if(data)
                post.front_matter.cover = data.file_path
            await createMD(post)
            console.log('post done: ', post.title)
        }).catch( e=> console.error(e))
    }
    else if(type == 'image') {
        await downloadImage(post.src, post.slug).then( async data => {
            if(data)
                post.src= data.file_path
            await createImageMD(post)
            console.log('post done: ', post.caption)
        }).catch( e=> console.error(e))
    }


    return
}

function createTOML ( root_settings, theme_params ) {
    let content=''
    for (index in root_settings) {
        content += toml_val(index, root_settings[index] ) + MD_BLKS.NL
        // Check if number
        //let val = Number(root_settings[index] ) ? Number(root_settings[index]) : MD_BLKS.DQ + root_settings[index] + MD_BLKS.DQ
        //content += index + ' = '+ val + MD_BLKS.NL
    }
    // Adding Theme Settings
    content += 
`
[params]
    `
    for (index in theme_params) {        
        content += toml_val(index, theme_params[index])
        content +=
`
    `
    }
    content +=
`
[menu]
  [[menu.main]]
    identifier = "image"
    name = "الصور"
    url = "/image"
`
    return content
}
/*
async function downloadConfigs( config ) {

    createTOML(config)
}
*/

fire.initializeApp({
    projectId: 'elecvue',
    databaseURL: 'https://elecvue.firebaseio.com'
})

const args = getArgs()
const db = fire.firestore()
try {
		
	if(args.config && args.blog_ref) {
		db.collection('static_blogs').doc(args.blog_ref).get().then( async doc => {
			var root_settings = doc.data().root_settings
			var theme_params = doc.data().theme_params
			var tomlContent = createTOML(root_settings, theme_params)
			fs.writeFileSync( 'config.toml',  tomlContent)
		}).then(()=>{
			if(args.E)
			process.exit(0)
		})
	} 
	else if (args.blog_name) {
		// Create Posts files
		db.collection('posts.'+args.blog_name).get().then( async posts => {
			await Promise.all(posts.docs.map(async(doc, index) => { // map instead of forEach
				await downloadPost(doc.data())
			}))
		})

		db.collection('mvision').where("published", "==", true).where("blog","==",args.blog_name)
		.get().then( async img_posts =>{
			await Promise.all(img_posts.docs.map(async(img_doc, index) => {
				await downloadPost(img_doc.data(), "image")
			}))
		})
	}
}
catch (error) {
	console.error(error);
}
