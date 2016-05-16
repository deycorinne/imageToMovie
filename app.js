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
  duration: 50,
  size: 200,
  format: 'mp4',
  delete: true
}

var s3Keys = [
  'image1',
  'image2',
  'image3',
  'image4'
];

// var config = require('./config.js');
// var AWS = require('aws-sdk');
// var s3 = new AWS.S3({
//   accessKeyId: config.aws.accessKeyId,
//   secretAccessKey: config.aws.secretAccessKey
// });
//
//
// s3.listObjects({
//   Bucket: 'corinne-test'
// }, function(err, data) {
//   console.log('ERROR:', err);
//   console.log('DATA', data);
// });

controller.imageToMovieS3(s3Keys, 'corinne-test', 'myvideo', options, function(err, result) {
  if (err) {
    console.log('ERROR: ', err);
  }
  console.log('RESULT:', result);
});
