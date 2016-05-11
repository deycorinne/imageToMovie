/*
 * Corinne Konoza
 * Tuesday May 10, 2016
 *
 * This file should export a function that can take a series of images (jpeg, png, etc.)
 * and convert them to a video (in the specified format) by giving the duration the image
 * should appear (to a minimum of 1/30th i.e. 30 frames per second)
 */

var allowedFormats = ["hls", "mp4"];
var _ = require("underscore");
var videoshow = require('videoshow');
var fs = require('fs');
var gm = require('gm');
var ffmpeg = require('ffmpeg');
var imageMagick = gm.subClass({
  imageMagick: true
});

exports.imageToMovie = function(imageArray, imageArrayDirectory, title, videoFormat, duration, fn) {
  // TODO: make async and remove setTimeout

  // validate inputs given
  if (!_.isArray(imageArray)) {
    throw new Error('An array of images must be provided to complete this action');
  }

  if (!_.isString(videoFormat) || (allowedFormats.indexOf(videoFormat) < 0)) {
    throw new Error('Please provide a valid video format');
  }

  if (!_.isString(title)) {
    throw new Error('Please provide a valid title for your video');
  }

  if (!_.isNumber(duration)) {
    throw new Error('Please provide a valid duration');
  }

  var jpgImageArray = [];

  // go through each image in array and check format-- change to .jpg & convert to buffer for easy conversion to movie
  // also make sure all images are the same size
  for (var i = 0; i < imageArray.length; i++) {
    var imageFile = imageArray[i];
    var temp = imageFile.split('.');
    var imageTitle = temp[0];
    var extension = temp[temp.length - 1];

    if (extension !== 'jpg') {
      fs.readFile(imageArrayDirectory + imageFile, function(err, data) {
        if (err) {
          throw new Error('There was an issue processing your files'); // Fail if the file can't be read.
        }

        var magick = imageMagick(data); // should now be a buffer
        magick.setFormat("jpg");

        fs.writeFile(imageArrayDirectory + imageTitle + '.jpg', magick.sourceBuffer, function(err) {
          if (err) {
            throw new Error('There was an issue saving your files in the new format'); // Fail if the file can't be saved.
          }

          jpgImageArray.push(imageArrayDirectory + imageTitle + '.jpg');
        });
      });
    } else {
      jpgImageArray.push(imageArrayDirectory + imageFile);
    }
  }

  setTimeout(function() {
    var videoTitle = title + '.' + videoFormat;
    var videoOptions = {
      fps: duration,
      transition: false,
      videoBitrate: 1024,
      videoCodec: 'libx264',
      size: '640x?',
      audioBitrate: '128k',
      audioChannels: 2,
      format: videoFormat
    }
    videoshow(jpgImageArray, videoOptions)
      .save(videoTitle)
      .on('start', function(command) {
        console.log('ffmpeg process started:', command)
      })
      .on('error', function(err, stdout, stderr) {
        console.error('Error:', err)
        console.error('ffmpeg stderr:', stderr)
      })
      .on('end', function(output) {
        console.error('Video created in:', output)
      })
  }, 2000);
}
