const express = require('express')
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const NodeID3 = require('node-id3')
const download = require('image-downloader');
const fs = require('fs')
const path = require( "path" );
const Queue = require('bull');
const cluster = require('cluster');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { base64encode, base64decode } = require('nodejs-base64');
const HttpsProxyAgent = require('https-proxy-agent');

const proxy = 'http://mdjxjxut:7ffa95jej8l5@104.239.108.206:6441';
const agent = new HttpsProxyAgent.HttpsProxyAgent(proxy);

const cors = require("cors") 

function sanitizePath (path) {
    return path.replace(/[\\/:*?"<>|]/g, '')
  }

if (cluster.isMaster) {
    
    var numWorkers = require('os').cpus().length;

    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }
  
    cluster.on('exit', function (worker, code, signal) {
      console.log('worker ' + worker.process.pid + ' died');
    });
  } else {

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    let folder = `${__dirname}/converted`;
    const mp3Queue = new Queue('convert-mp3', { redis: { port: 6379, host: '127.0.0.1' } });

    mp3Queue.process(5, function (job, done) {
        id = job.data.id;

        if (fs.existsSync(`${folder}/${id}`)) {
            let files = fs.readdirSync(`${folder}/${id}`);
            let mp3 = files.find(function(file){
                return file.indexOf('.mp3') !== -1;
            });

            let jpg = files.find(function(file){
                return file.indexOf('.jpg') !== -1;
            });

            if( mp3 && jpg ) {
                const absolutePath = path.resolve( `${folder}/${id}/${mp3}`);
                done(null, { path: absolutePath });
                return;
            }
        }
            let stream = ytdl(id, {
                quality: 'highestaudio',
                requestOptions: { agent },
            });

            let totalTime;

            ytdl.getBasicInfo(id, {
                requestOptions: { agent },
            }).then(info => {
                job.progress(1);
                try { fs.mkdirSync(`${folder}/${id}`)} catch (error){}
                ffmpeg(stream)
                    .audioBitrate(128)
                    .save(`${folder}/${id}/${sanitizePath(info.videoDetails.title)}.mp3`)
                    .on('codecData', data => {
                        totalTime = parseInt(data.duration.replace(/:/g, '')) 
                     })
                    .on('progress', progress => {
                        const time = parseInt(progress.timemark.replace(/:/g, ''))

                        const percent = (time / totalTime) * 100
                            
                        job.progress(parseInt((percent)));
                    })
                    .on('end', () => {
                        const options = {
                            url: 'https://i.ytimg.com/vi/'+id+'/default.jpg',
                            dest: `${folder}/${id}/${sanitizePath(info.videoDetails.title)}.jpg`,
                        };
                
                        download.image(options)
                        .then(() => {
                            tags = {
                                title: info.videoDetails.title,
                                artist: info.videoDetails.author.name,
                                APIC: `${folder}/${id}//${sanitizePath(info.videoDetails.title)}.jpg`
                            }
                            NodeID3.write(tags, `${folder}/${id}/${sanitizePath(info.videoDetails.title)}.mp3`, function(err) { 
                                const absolutePath = path.resolve( `${folder}/${id}/${sanitizePath(info.videoDetails.title)}.mp3` ) 
                                done(null, { path: absolutePath });
                            });
                        })
                        .catch((err) => {
                            done(new Error('error transcoding'));
                            console.error(err)
                        });
                });
            });
    });

   

    const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [new BullAdapter(mp3Queue)],
    serverAdapter: serverAdapter,
    });

    const app = express()
    const port = 3003

    app.use(cors())

    app.use('/admin/queues', serverAdapter.getRouter());

    app.use(express.urlencoded({ 
        extended: true
    })) 

    app.get('/convert/:id', (req, res) => {
        id = req.params.id;
        
        if (fs.existsSync(`${folder}/${id}`)) {
            let files = fs.readdirSync(`${folder}/${id}`);
            let mp3 = files.find(function(file){
                return file.indexOf('.mp3') !== -1;
            });

            let jpg = files.find(function(file){
                return file.indexOf('.jpg') !== -1;
            });

            if( mp3 && jpg ) {
                var fullUrl = req.protocol + 's://' + req.get('host');

                const absolutePath = `${fullUrl}/cdn/download?path=${base64encode(id+'/'+mp3)}`;
                res.send({
                    'status': 'done',
                    link: absolutePath
                });
                return;
            } else {
                if(ytdl.validateID(id)) {
                    mp3Queue.getJob(id).then(job => {
                        res.send({
                            'status': 'converting',
                            progress: job?.progress() ?? 1
                        });
                    })
                    mp3Queue.add({id: id}, { jobId: id, removeOnComplete: true, removeOnFail: true });
                } else {
                    res.send({
                        'status': 'error'
                    });
                };
                
            }
        } else {
            if(ytdl.validateID(id)) {
                mp3Queue.getJob(id).then(job => {
                    res.send({
                        'status': 'converting',
                        progress: job?.progress() ?? 1
                    });
                })
                mp3Queue.add({id: id}, { jobId: id, removeOnComplete: true, removeOnFail: true });
            } else {
                res.send({
                    'status': 'error'
                });
            };
            
        }

    });

    app.get('/download', (req, res) => {
        let mypath = req.query.path;
        mypath = base64decode(mypath);
        
        res.download(`${folder}/${mypath}`);
    });
    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`)
    })
  };
