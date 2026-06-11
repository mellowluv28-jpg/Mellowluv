const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadBuffer(buffer, folder, resourceType) {
  let buf = buffer;
  if (!resourceType || resourceType === 'image') {
    try {
      const sharp = require('sharp');
      buf = await sharp(buffer).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    } catch (e) {
      console.error('Sharp conversion failed, using original buffer:', e.message);
    }
  }
  return new Promise((resolve, reject) => {
    const opts = {};
    if (!resourceType || resourceType === 'image') {
      opts.resource_type = 'image';
      opts.format = 'jpg';
      opts.quality = 'auto';
    } else {
      opts.resource_type = 'video';
      opts.format = 'auto';
    }
    if (folder) opts.folder = folder;
    const stream = cloudinary.uploader.upload_stream(
      opts,
      (err, result) => {
        if (err) reject(err);
        else resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    streamifier.createReadStream(buf).pipe(stream);
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
