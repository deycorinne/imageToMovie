/*
 * Corinne Konoza
 * Tuesday May 10, 2016
 *
 * This file should contain one exportable function.
 * imageToMovieS3 can take an array of s3 keys and will convert the
 * images attached to those keys into a video that is then saved in the provided bucket
 * with the provided key. This function has options that can be used to specify video features
 * options.delete-- when set to true has all of the original s3 keys deleted
 * options.format-- video format
 * options.title-- video title
 * options.fps--- video fps
 * options.size--- video size
 * options.duration-- video duration
 */

var allowedFormats = ["hls", "mp4"];
var _ = require("underscore");
var async = require("async");
var fs = require("fs");
var gm = require("gm");
var AWS = require('aws-sdk');
var ffmpeg = require('fluent-ffmpeg');
var config = require('./config.js');
var imageMagick = gm.subClass({
  imageMagick: true
});
var s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey
});

//TODO: fix duration
//TODO: pipe directly to s3 if possible
exports.imageToMovieS3 = function(s3KeyArray, bucket, videoKey, options, fn) {

  // validate inputs given
  if (!_.isArray(s3KeyArray)) {
    return fn('An array of images must be provided to complete this action', null);
  }

  if (options.format && (!_.isString(options.format) || (allowedFormats.indexOf(options.format) < 0))) {
    return fn('Please provide a valid video format', null);
  }

  if (options.title && !_.isString(options.title)) {
    return fn('Please provide a valid title for your video', null);
  }

  if (options.fps && (!_.isNumber(options.fps) || options.fps < 30)) {
    return fn('Please provide a valid fps', null);
  }

  if (options.size && !_.isNumber(options.size)) {
    return fn('Please provide a valid video size', null);
  }

  if (options.duration && !_.isNumber(options.duration)) {
    return fn('Please provide a valid video duration', null);
  }

  options.format = options.format || 'mp4';
  options.title = options.title || 'video';
  options.duration = options.duration || 50;
  options.fps = options.fps || 20;
  options.size = options.size || 200;
  options.delete = options.delete || false;

  var command = ffmpeg();
  var imageArray = [];


  // Need to set up to work with 1000s of images-- so 5 at a time, not all at once
  var arrays = [];
  while (s3KeyArray.length > 0) {
    arrays.push(s3KeyArray.splice(0, 5));
  }
  // loop though each array of 5 and perform the conversion magic
  async.each(arrays, function(array, cb) {
      // go through each image in array and convert to buffer for easy conversion to movie
      // also make sure all images are the same size
      async.each(array, function(s3Key, callback) {
          s3.getObject({
            Bucket: bucket,
            Key: s3Key
          }, function(err, data) {
            if (err) {
              console.log(err);
              return callback('There was an issue grabbing your files from s3.');
            }

            var magick = imageMagick(data.Body); // should now be a buffer
            // check size
            magick.size(function(err, specs) {
              if (err || !_.isObject(specs)) {
                var error = "Could not get image size.";
                logger.error(error, err, specs)
                return res.status(500).json({
                  errors: [{
                    title: error,
                    status: 500
                  }]
                })
              }

              if (specs.width !== specs.height) {
                var min = Math.min(specs.width, specs.height);
                if (specs.width > specs.height) {
                  var x = specs.height * .25;
                  var y = 0;
                  magick.crop(min, min, x, y);
                } else if (specs.height > specs.width) {
                  var x = 0;
                  var y = specs.width * .25;
                  magick.crop(min, min, x, y);
                } else { // image is a square
                  magick.crop(min, min, 0, 0);
                }
              }

              magick.resize(options.size, options.size).stream(function(err, stdout, stderr) {
                if (err) {
                  var error = "Could not export image.";
                  logger.error(error, err)
                  return res.status(500).json({
                    errors: [{
                      title: error,
                      status: 500
                    }]
                  })
                }
                var buffer = new Buffer(0);
                stdout.on('data', function(d) {
                  buffer = Buffer.concat([buffer, d]);
                });
                stdout.on('end', function() {
                  //ffmpeg only can take one buffer at a time and addition files so we have to save them all locally
                  fs.writeFile('temp/' + options.size + s3Key + '.jpg', buffer, function(err) {
                    if (err) {
                      return callback('There was an issue saving your files in the new format'); // Fail if the file can't be saved.
                    }

                    command.addInput('temp/' + options.size + s3Key + '.jpg');
                    imageArray.push('temp/' + options.size + s3Key + '.jpg');
                    callback();
                  });
                });
              });
            });
          });
        },
        function(err) {
          if (err) {
            return cb(err, null);
          }
          cb();
        });
    },
    function(err) {
      if (err) {
        return fn(err, null);
      }

      command.on('error', function(err, stdout, stderr) {
          return fn('Could not process video');
        })
        .videoCodec('libx264')
        .noAudio()
        .mergeToFile('temp/' + videoKey + '.' + options.format)
        .on('end', function(stdout, stderr) {
          fs.readFile('temp/' + videoKey + '.' + options.format, function(err, data) {
            if (err) {
              return fn('There was an issue reading the video file'); // Fail if the file can't be read.
            }
            var details = {
              Bucket: bucket,
              Key: videoKey,
              ContentType: 'video/mp4',
              Body: data
            };

            s3.putObject(details, function(err, data) {
              if (err) {
                return fn("Unable to save video to s3.");
              }

              async.each(imageArray, function(imagePath, callback) {
                fs.unlink(imagePath, function(err) {
                  if (err) {
                    return callback('There was an issue removing the temp files');
                  }
                  callback();
                });
              }, function(err) {
                if (err) {
                  return fn(err);
                }

                fs.unlink('temp/' + videoKey + '.' + options.format, function(err) {
                  if (err) {
                    return fn('There was an issue removing the temp video file');
                  }

                  if (!options.delete) {
                    return fn(null);
                  }

                  var keyPairs = s3KeyArray.map(function(obj) {
                    return {
                      Key: obj
                    }
                  });

                  var deleteparams = {
                    Bucket: bucket,
                    Delete: {
                      Objects: keyPairs
                    }
                  };

                  s3.deleteObjects(deleteparams, function(err) {
                    if (err) {
                      console.log(err);
                      return fn("Issue while deleting images from s3");
                    }
                    return fn(null);
                  });
                });
              });
            });
          });
        });
    });
}
