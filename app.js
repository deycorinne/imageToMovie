var express = require('express');
var app = express();
var fs = require('fs');


// set up server for testing the function
app.set('port', process.env.PORT || 3300);
var server = app.listen(app.get('port'), function() {
  console.log('Server up: http://localhost:' + app.get('port'));
});

// import our new function
/*
var index = require('./index.js');

fs.readdir('./testImages', function(err, files) {
  if (err) {
    throw new Error('Trouble reading files for test');
  }

  var options = {
    title: 'myvideo',
    duration: 50,
    size: 200,
    format: 'mp4'
  }

  index.imageToMovie(files, './testImages/', options, function(err, movie) {
    console.log(err);
    console.log(movie);
  });
})
*/
