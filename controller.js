/*
 * Corinne Konoza
 * Tuesday May 10, 2016
 *
 * This file should contain two exportable functions.
 * The first function imageToMovie can take a array of images (jpeg, png, etc.)
 * and convert them to a video (in the specified format) by giving the duration the image
 * should appear (to a minimum of 1/30th i.e. 30 frames per second)
 * The second function imageToMovieS3 can take an array of s3 keys and will convert the
 * images attached to those keys into a video that is then saved in the provided bucket
 * with the provided key. This function has an additonal option-- delete-- that when set
 * to true has all of the original s3 keys deleted
 */

var allowedFormats = ["hls", "mp4"];
var _ = require("underscore");
var async = require("async");
var videoshow = require("videoshow");
var fs = require("fs");
var gm = require("gm");
var AWS = require('aws-sdk');
var ffmpeg = require("ffmpeg");
var config = require('./config.js');
var imageMagick = gm.subClass({
  imageMagick: true
});
var s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey
});


// options- title, format, duration, size
exports.imageToMovie = function(imageArray, imageArrayDirectory, options, fn) {

  // validate inputs given
  if (!_.isArray(imageArray)) {
    return fn('An array of images must be provided to complete this action', null);
  }

  if (!_.isString(imageArrayDirectory)) {
    return fn('Please provide a valid directory for your image array', null);
  }

  if (options.format && (!_.isString(options.format) || (allowedFormats.indexOf(options.format) < 0))) {
    return fn('Please provide a valid video format', null);
  }

  if (options.title && !_.isString(options.title)) {
    return fn('Please provide a valid title for your video', null);
  }

  if (options.duration && (!_.isNumber(options.duration) || options.duration < 30)) {
    return fn('Please provide a valid duration', null);
  }

  if (options.size && !_.isNumber(options.size)) {
    return fn('Please provide a valid video size', null);
  }

  options.format = options.format || 'mp4';
  options.title = options.title || 'video';
  options.duration = options.duration || 50;
  options.size = options.size || 200;

  var jpgImageArray = [];

  // go through each image in array and convert to buffer for easy conversion to movie
  // also make sure all images are the same size
  async.each(imageArray, function(imageFile, callback) {
      fs.readFile(imageArrayDirectory + imageFile, function(err, data) {
        if (err) {
          return callback('There was an issue processing your files.'); // Fail if the file can't be read.
        }

        var magick = imageMagick(data); // should now be a buffer
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
              fs.writeFile(imageArrayDirectory + options.size + imageFile, buffer, function(err) {
                if (err) {
                  return callback('There was an issue saving your files in the new format'); // Fail if the file can't be saved.
                }

                jpgImageArray.push(imageArrayDirectory + options.size + imageFile);
                callback();
              });
            });
          });
        });
      });
    },
    function(err) {
      if (err) {
        return fn(err, null);
      }

      var videoTitle = options.title + '.' + options.format;
      var videoOptions = {
        fps: options.duration,
        transition: false,
        videoBitrate: 1024,
        videoCodec: 'libx264',
        format: options.format
      }

      // source: https://github.com/h2non/videoshow/tree/master/lib
      videoshow(jpgImageArray, videoOptions)
        .save(imageArrayDirectory + videoTitle)
        .on('error', function(err, stdout, stderr) {
          return fn(err, null);
        })
        .on('end', function(output) {
          return fn(null, output);
        })
    });
}

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

  if (options.duration && (!_.isNumber(options.duration) || options.duration < 30)) {
    return fn('Please provide a valid duration', null);
  }

  if (options.size && !_.isNumber(options.size)) {
    return fn('Please provide a valid video size', null);
  }

  options.format = options.format || 'mp4';
  options.title = options.title || 'video';
  options.duration = options.duration || 50;
  options.size = options.size || 200;
  options.delete = options.delete || false;

  var jpgImageArray = [];

  // go through each image in array and convert to buffer for easy conversion to movie
  // also make sure all images are the same size
  async.each(s3KeyArray, function(s3Key, callback) {
      s3.getObject({
        Bucket: bucket,
        Key: s3Key
      }, function(err, data) {
        if (err) {
          console.log(err);
          console.log(s3Key);
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
              fs.writeFile('temp/' + options.size + s3Key + '.jpg', buffer, function(err) {
                if (err) {
                  return callback('There was an issue saving your files in the new format'); // Fail if the file can't be saved.
                }

                jpgImageArray.push('temp/' + options.size + s3Key + '.jpg');
                callback();
              });
            });
          });
        });
      });
    },
    function(err) {
      if (err) {
        return fn(err, null);
      }

      var videoTitle = options.title + '.' + options.format;
      var videoOptions = {
        fps: options.duration,
        transition: false,
        videoBitrate: 1024,
        videoCodec: 'libx264',
        format: options.format
      }

      // source: https://github.com/h2non/videoshow/tree/master/lib
      videoshow(jpgImageArray, videoOptions)
        .save('temp/' + videoKey + '.' + options.format)
        .on('error', function(err, stdout, stderr) {
          return fn(err);
        })
        .on('end', function(output) {

          fs.readFile('temp/' + videoKey + '.' + options.format, function(err, data) {
            if (err) {
              return callback('There was an issue reading the video file'); // Fail if the file can't be read.
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

              async.each(jpgImageArray, function(jpgImage, callback) {
                fs.unlink(jpgImage, function(err) {
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

                  var deleteparams = {
                    Bucket: bucket,
                    Delete: {
                      Objects: s3KeyArray
                    }
                  };

                  s3.deleteObjects(deleteparams, function(err, data) {
                    if (err) {
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
