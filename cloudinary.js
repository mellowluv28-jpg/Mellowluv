const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const heicConvert = require('heic-convert');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function isHeic(buf) {
  const magic = buf.slice(4, 12).toString();
  return magic.startsWith('ftyp') && (magic.includes('heic') || magic.includes('heix') || magic.includes('mif1') || magic.includes('hevc'));
}

async function uploadBuffer(buffer, folder, resourceType) {
  let buf = buffer;
  if (!resourceType || resourceType === 'image') {
    if (isHeic(buf)) {
      buf = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 });
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
