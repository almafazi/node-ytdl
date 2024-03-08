var kue = require('kue')
  , jobs = kue.createQueue();

// Producer for jobs testing

for ( var i = 0; i < 10; i++ ) {
    console.log( 'Creating Job #' + i );

    jobs.create( 'testing', {
      title: 'jobs #' + i
    }).save();
}

for ( var i = 0; i < 100; i++ ) {
    console.log( 'Creating Activity Job #' + i );

    jobs.create( 'activity_log', {
        title: 'visited_item',
        body: 'lorem ipsum sit dolor amet- '+ i,
        status:'200',
        url:'http://www.example.com/item/mouse-imac-1j1h2j4h12'
    }).save();
}