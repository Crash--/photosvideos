//import { createClientInteractive} from 'cozy-client'
const {createClientInteractive} = require('cozy-client')
const fse = require('fs-extra')
const stream = require('stream')
const { FFScene, FFText, FFVideo, FFAlbum, FFImage, FFCreator } = require("ffcreator");
const colors = require('colors')

const DOCTYPE_FILES = 'io.cozy.files'
const DOCTYPE_ALBUMS = 'io.cozy.photos.albums'
const schema = {
    albums: {
        doctype: DOCTYPE_ALBUMS,
        attributes: {
          name: {
            type: 'string'
          }
        },
        relationships: {
          photos: {
            type: 'has-many',
            doctype: DOCTYPE_FILES
          }
        }
      }
    
  }

  
const findAutoAlbums = async client => {
    const query = client
        .find('io.cozy.photos.albums')
        //.where({ auto: true })
        
    const results = await client.queryAll(query)
    return client.hydrateDocuments('io.cozy.photos.albums', results)
}


const getFilesByAutoAlbum = async (client, album) => {
    console.log('album', album)
    let allPhotos = []
    const query = client
      .find('io.cozy.photos.albums')
      .getById(album._id)
      .include(['photos'])
    const resp = await client.query(query)
  
    let data = client.hydrateDocument(resp.data)
    const photos = await data.photos.data
    allPhotos = allPhotos.concat(photos)
    while (data.photos.hasMore) {
      await data.photos.fetchMore()
      const fromState = client.getDocumentFromState('io.cozy.photos.albums', album._id)
      data = client.hydrateDocument(fromState)
      allPhotos = await data.photos.data
    }
    return allPhotos

}
const dir = '/Users/quentinvalmori/Sites/photosVideos/'

const creator = new FFCreator({
    cacheDir: dir + 'cache',
    outputDir: dir + 'videos',
    width: 800,
    height: 450
});

// Create scene
const scene = new FFScene();
scene.setBgColor("#ffcc22");
scene.setDuration(56);
scene.setTransition("GridFlip", 2);


  const main = async () => {
    const client = await createClientInteractive({
        scope: ['io.cozy.files', 'io.cozy.photos', 'io.cozy.photos.albums'],
        uri: 'https://xxx.mycozy.cloud',
        schema,
      oauth: {
        softwareID: 'io.cozy.client.cli'
      }
    })
    const albums = await findAutoAlbums(client)
    const photos = await getFilesByAutoAlbum(client, album[0])
    //toutes les photos sont en local
    const images = []
    try {
    await Promise.all(photos.map(async photo => {
        const data = await client.getStackClient().collection('io.cozy.files').fetchFileContentById(photo._id)
        await new Promise((resolve) => {
            stream.pipeline(data.body, fse.createWriteStream(dir+'photos/'+photo.name), resolve)    
        })
            
        console.log('path: ', dir+'photos/' + photo.name)
        images.push(new FFImage({ path: dir+'photos/' + photo.name }));

    }))
}catch(e){
    console.log('eerrorr', e)
}
console.log('images', images)
    const album = new FFAlbum({
        list: images.map( i => {
            console.log('i.conf.path', i.conf.path)
            return i.conf.path}),   // Picture collection for album
        x: 400,
        y: 225,   
        width: 800,
        height: 450,
        showCover: true
    });
    album.setTransition('zoomIn');      // Set album switching animation
 album.setDuration(56);             // Set the stay time of a single sheet
album.setTransTime(2);            // Set the duration of a single animation
scene.addChild(album);
//const video = new FFVideo({ path: dir+'videos/ex.mp4', x: 300, y: 50, width: 300, height: 200 });
//video.addEffect("zoomIn", 1, 0);
//scene.addChild(video);
creator.addAudio(dir+'audio/audio.mp3');
creator.addChild(scene);

creator.output(dir+'videos/ex1.mp4');
creator.start();        // Start processing
creator.closeLog();     // Close log (including perf)

creator.on('start', () => {
    console.log(`FFCreator start`);
});
creator.on('error', e => {
    console.log(`FFCreator error: ${JSON.stringify(e)}`);
});
creator.on('progress', e => {
    console.log(colors.yellow(`FFCreator progress: ${e.state} ${(e.percent * 100) >> 0}%`));
});
creator.on('complete', e => {
    console.log(colors.magenta(`FFCreator completed: \n USEAGE: ${e.useage} \n PATH: ${e.output} `));
}); 

  }

  
  if (require.main === module) {
    main().catch(e => {
      console.error(e)
      process.exit(1)
    })
  }
  