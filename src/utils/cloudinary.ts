import cloudinary from '../config/cloudinary';

export const uploadImage = async (fileBuffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'tasks',
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary upload failed'));
        resolve(result.secure_url);
      }
    );

    uploadStream.end(fileBuffer);
  });
};
