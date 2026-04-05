import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadImage } from '../utils/cloudinary';
import { ApiResponse } from '../utils/ApiResponse';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/image', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 'No file uploaded', 400);
    }

    const imageUrl = await uploadImage(req.file.buffer);
    ApiResponse.success(res, { url: imageUrl }, 'Image uploaded successfully');
  } catch (error) {
    console.error('Upload error:', error);
    ApiResponse.error(res, 'Failed to upload image', 500);
  }
});

export default router;
