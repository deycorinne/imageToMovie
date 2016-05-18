var express = require('express');
var app = express();
var fs = require('fs');


// set up server for testing the function
app.set('port', process.env.PORT || 3300);
var server = app.listen(app.get('port'), function() {
  console.log('Server up: http://localhost:' + app.get('port'));
});

// import our new function
var controller = require('./controller.js');

var options = {
  title: 'myvideo',
  fps: 50,
  duration: 10, //seconds
  size: 200,
  format: 'mp4',
  delete: false
}

var s3Keys = [
  'image1',
  'image2',
  'image3',
  'image4',
  'image5',
  'image6',
  'image7'
];


controller.imageToMovieS3(s3Keys, 'corinne-test', 'myvideo', options, function(err, result) {
  if (err) {
    console.log('ERROR: ', err);
  }
  console.log('RESULT:', result);
});
