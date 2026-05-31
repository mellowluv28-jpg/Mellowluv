const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function uploadBuffer(buffer, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const opts = { resource_type: resourceType || 'image' };
    if (folder) opts.folder = folder;
    const stream = cloudinary.uploader.upload_stream(
      opts,
      (err, result) => {
        if (err) reject(err);
        else resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function deleteImage(publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

module.exports = { uploadBuffer, deleteImage };
