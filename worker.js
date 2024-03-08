const kue = require('kue')
    , cluster = require('cluster')
    , jobs = kue.createQueue();

var clusterWorkerSize = require('os').cpus().length;

if (cluster.isMaster) {

    // start the UI
    kue.app.listen( 3000 );
    console.log( 'UI started on port 3000' );

    for (var i = 0; i < clusterWorkerSize; i++) {
        cluster.fork();
    }
} else {

    // Consumer / Worker for jobs testing

    jobs.process( 'activity_log', 10, function ( job, done ) {
      console.log( 'Starting ' + job.data.title );

      console.log("Execute activity_log jobs...");

    });

    jobs.process( 'testing', 4, function ( job, done ) {
      console.log( 'Starting ' + job.data.title );

      console.log("Execute testing jobs...");

      setTimeout( function () {
        console.log( 'Finished ' + job.data.title );
        done();
      }, 1000 );
    });

}